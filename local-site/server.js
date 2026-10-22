"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "whitespace.sqlite");
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:8787,http://127.0.0.1:8787")
    .split(",").map((s) => s.trim()).filter(Boolean)
);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    account_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT '#a78bfa',
    background TEXT NOT NULL DEFAULT '#101018',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
`);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const nowISO = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const scrypt = (password, salt) => new Promise((resolve, reject) =>
  crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key.toString("hex")))
);
const safeUser = (row) => ({
  id: row.id, username: row.username, accountKey: row.account_key,
  createdAt: row.created_at
});

function validUsername(name) {
  return typeof name === "string" && /^[A-Za-z0-9_]{3,24}$/.test(name);
}
function makeAccountKey() {
  // Identificador único, não é senha nem substitui autenticação.
  return "WS-" + crypto.randomBytes(12).toString("hex").toUpperCase();
}
async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + await scrypt(password, salt);
}
async function passwordMatches(password, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected) return false;
  const actual = Buffer.from(await scrypt(password, salt), "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}
function auth(req, res, next) {
  const token = (req.headers.authorization || "").match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if (!token) return res.status(401).json({ error: "Entre na sua conta para continuar." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = db.prepare(`
    SELECT users.id, users.username, users.account_key, users.created_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Date.now());
  if (!session) return res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  req.user = session;
  next();
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "WhiteSpace local API", storage: "SQLite local" }));

app.post("/api/auth/register", authLimiter, async (req, res, next) => {
  try {
    const username = cleanText(req.body?.username, 24);
    const password = req.body?.password;
    if (!validUsername(username)) return res.status(400).json({ error: "Use um nome de 3 a 24 caracteres: letras, números e _." });
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: "A senha precisa ter entre 10 e 128 caracteres." });
    }
    if (db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE").get(username)) {
      return res.status(409).json({ error: "Esse nome já está em uso." });
    }
    const userId = id();
    const createdAt = nowISO();
    let accountKey;
    do { accountKey = makeAccountKey(); } while (db.prepare("SELECT 1 FROM users WHERE account_key = ?").get(accountKey));
    const hash = await passwordHash(password);
    const create = db.transaction(() => {
      db.prepare("INSERT INTO users (id, username, password_hash, account_key, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(userId, username, hash, accountKey, createdAt);
      db.prepare("INSERT INTO profiles (user_id, display_name, updated_at) VALUES (?, ?, ?)")
        .run(userId, username, createdAt);
    });
    create();
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, userId, Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.status(201).json({ user: { id: userId, username, accountKey, createdAt }, token,
      warning: "Guarde sua chave de conta em um lugar seguro. Ela identifica sua conta, mas não recupera a senha automaticamente." });
  } catch (e) { next(e); }
});

app.post("/api/auth/login", authLimiter, async (req, res, next) => {
  try {
    const username = cleanText(req.body?.username, 24);
    const password = req.body?.password;
    const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
    const ok = row && typeof password === "string" && await passwordMatches(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Nome ou senha incorretos." });
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, row.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.json({ user: safeUser(row), token });
  } catch (e) { next(e); }
});

app.post("/api/auth/logout", auth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  db.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .run(crypto.createHash("sha256").update(token).digest("hex"));
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  const profile = db.prepare("SELECT display_name, bio, accent, background, updated_at FROM profiles WHERE user_id = ?").get(req.user.id);
  res.json({ user: safeUser(req.user), profile });
});

app.patch("/api/profile", auth, writeLimiter, (req, res) => {
  const displayName = cleanText(req.body?.displayName, 40) || req.user.username;
  const bio = cleanText(req.body?.bio, 280);
  const accent = /^#[0-9a-fA-F]{6}$/.test(req.body?.accent) ? req.body.accent : "#a78bfa";
  const background = /^#[0-9a-fA-F]{6}$/.test(req.body?.background) ? req.body.background : "#101018";
  db.prepare("UPDATE profiles SET display_name = ?, bio = ?, accent = ?, background = ?, updated_at = ? WHERE user_id = ?")
    .run(displayName, bio, accent, background, nowISO(), req.user.id);
  res.json({ ok: true });
});

app.get("/api/posts", (_req, res) => {
  const posts = db.prepare(`
    SELECT posts.id, posts.content, posts.created_at AS createdAt,
           users.username, profiles.display_name AS displayName,
           profiles.accent
    FROM posts JOIN users ON users.id = posts.user_id
    JOIN profiles ON profiles.user_id = users.id
    ORDER BY posts.created_at DESC LIMIT 100
  `).all();
  res.json({ posts });
});

app.post("/api/posts", auth, writeLimiter, (req, res) => {
  const content = cleanText(req.body?.content, 1000);
  if (!content) return res.status(400).json({ error: "Escreva algo antes de publicar." });
  const post = { id: id(), userId: req.user.id, content, createdAt: nowISO() };
  db.prepare("INSERT INTO posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)")
    .run(post.id, post.userId, post.content, post.createdAt);
  res.status(201).json({ post: { id: post.id, content: post.content, createdAt: post.createdAt, username: req.user.username } });
});

app.use(express.static(path.join(ROOT, "public"), { extensions: ["html"] }));
app.use((err, _req, res, _next) => {
  console.error("[WhiteSpace]", err.message);
  res.status(500).json({ error: "Erro interno. Consulte o log local do servidor." });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`WhiteSpace API em http://${HOST}:${PORT}`);
  console.log(`Banco SQLite: ${DB_PATH}`);
  console.log("Este servidor escuta apenas no host configurado. Para acesso público, configure um túnel HTTPS e revise a segurança.");
});
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
