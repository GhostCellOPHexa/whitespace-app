(() => {
  "use strict";

  const C = window.WHITESPACE_CONFIG || {};
  const ready = C.supabaseUrl && !C.supabaseUrl.startsWith("COLE_") && C.supabaseKey && !C.supabaseKey.startsWith("COLE_");
  const sb = ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let currentUser = null;
  let currentProfile = null;

  const toast = (message, type = "info") => {
    const el = $("#toast"); el.textContent = message; el.dataset.type = type; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
  };
  const escapeHtml = s => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const timeAgo = iso => {
    const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec/60)}min`;
    if (sec < 86400) return `${Math.floor(sec/3600)}h`;
    return `${Math.floor(sec/86400)}d`;
  };
  const initials = name => (name || "?").trim().slice(0, 1).toUpperCase();
  const avatarHtml = (p, cls = "avatar") => p?.avatar_url
    ? `<img class="${cls}" src="${escapeHtml(p.avatar_url)}" alt="Avatar de ${escapeHtml(p.display_name)}">`
    : `<div class="${cls} avatar-fallback">${escapeHtml(initials(p?.display_name))}</div>`;

  function requireConfig() {
    if (!ready) {
      $("#setup-note").classList.remove("hidden");
      $("#setup-note").innerHTML = `<strong>Primeiro configure o banco.</strong><br>Abra <code>js/config.js</code> e cole a URL e a publishable key do seu projeto Supabase. Depois publique novamente no GitHub.`;
    }
  }

  async function uploadAvatar(file, userId) {
    if (!file) return null;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use PNG, JPG ou WebP.");
    if (file.size > 3 * 1024 * 1024) throw new Error("A foto precisa ter no máximo 3 MB.");
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
    if (error) throw error;
    return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  async function signUp(e) {
    e.preventDefault(); if (!sb) return toast("Configure o Supabase primeiro.", "error");
    const name = $("#signup-name").value.trim(), username = $("#signup-username").value.trim().replace(/^@/, "").toLowerCase();
    const email = $("#signup-email").value.trim(), password = $("#signup-password").value, file = $("#signup-avatar").files[0];
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("Usuário: 3–24 caracteres, letras, números e _.", "error");
    try {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name, username } } });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível criar a conta.");
      let avatarUrl = null;
      if (file) avatarUrl = await uploadAvatar(file, data.user.id);
      const { error: pError } = await sb.from("profiles").upsert({ id: data.user.id, display_name: name, username, bio: "", avatar_url: avatarUrl });
      if (pError) throw pError;
      if (!data.session) toast("Conta criada! Verifique seu e-mail para entrar."); else await boot();
    } catch (err) { toast(err.message || "Erro ao criar perfil.", "error"); }
  }

  async function signIn(e) {
    e.preventDefault(); if (!sb) return toast("Configure o Supabase primeiro.", "error");
    try { const { error } = await sb.auth.signInWithPassword({ email: $("#login-email").value.trim(), password: $("#login-password").value }); if (error) throw error; await boot(); }
    catch (err) { toast(err.message || "Não foi possível entrar.", "error"); }
  }

  async function resetPassword() {
    if (!sb) return toast("Configure o Supabase primeiro.", "error");
    const email = $("#login-email").value.trim(); if (!email) return toast("Digite seu e-mail primeiro.", "error");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
    toast(error ? error.message : "Se o e-mail existir, enviamos as instruções de recuperação.", error ? "error" : "ok");
  }

  async function loadProfile(userId = currentUser.id) {
    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error; return data;
  }

  async function boot() {
    if (!sb) return requireConfig();
    const { data: { user } } = await sb.auth.getUser(); currentUser = user;
    if (!user) return showAuth();
    try { currentProfile = await loadProfile(); } catch { toast("Seu perfil ainda não foi encontrado.", "error"); return showAuth(); }
    $("#auth-screen").classList.add("hidden"); $("#app").classList.remove("hidden");
    renderMiniProfile(); await loadFeed(); await renderProfile(); await renderSettings(); await renderNotifications();
    $("#connection-status").textContent = "● online"; $("#connection-status").classList.add("online");
  }

  function showAuth() { $("#app").classList.add("hidden"); $("#auth-screen").classList.remove("hidden"); }

  function renderMiniProfile() {
    $("#mini-profile").innerHTML = `${avatarHtml(currentProfile, "avatar mini-avatar")}<div><strong>${escapeHtml(currentProfile.display_name)}</strong><span>@${escapeHtml(currentProfile.username)}</span></div>`;
  }

  async function loadFeed() {
    const feed = $("#feed"); feed.innerHTML = `<div class="loading aero-panel">Carregando o oceano... 🌊</div>`;
    const { data, error } = await sb.from("posts").select(`id, content, created_at, author_id, profiles!posts_author_id_fkey(id,display_name,username,avatar_url), likes(user_id)`).order("created_at", { ascending: false }).limit(50);
    if (error) return feed.innerHTML = `<div class="empty aero-panel">${escapeHtml(error.message)}</div>`;
    feed.innerHTML = data?.length ? data.map(postCard).join("") : `<div class="empty aero-panel"><span>🌱</span><h2>O feed está vazio</h2><p>Seja a primeira pessoa a publicar alguma coisa.</p></div>`;
    $$(".like-button", feed).forEach(b => b.onclick = () => toggleLike(b.dataset.id));
    $$(".comment-form", feed).forEach(f => f.onsubmit = e => addComment(e, f.dataset.id));
    $$(".delete-post", feed).forEach(b => b.onclick = () => deletePost(b.dataset.id));
  }

  function postCard(p) {
    const liked = (p.likes || []).some(x => x.user_id === currentUser.id);
    const likes = (p.likes || []).length;
    return `<article class="post aero-panel" data-post="${p.id}"><div class="post-head">${avatarHtml(p.profiles, "avatar") }<div><strong>${escapeHtml(p.profiles?.display_name || "Pessoa")}</strong><span>@${escapeHtml(p.profiles?.username || "user")} · ${timeAgo(p.created_at)}</span></div>${p.author_id === currentUser.id ? `<button class="delete-post icon-button" data-id="${p.id}" title="Apagar">🗑️</button>` : ""}</div><p class="post-text">${escapeHtml(p.content).replace(/\n/g,"<br>")}</p><div class="post-actions"><button class="like-button ${liked ? "liked" : ""}" data-id="${p.id}">💙 ${likes}</button><button class="comment-toggle" data-id="${p.id}">💬 Comentar</button></div><div class="comments-area hidden" id="comments-${p.id}"></div><form class="comment-form hidden" data-id="${p.id}"><input maxlength="500" required placeholder="Escreva um comentário..."><button class="aero-button" type="submit">Enviar</button></form></article>`;
  }

  async function toggleLike(postId) {
    const { data: existing } = await sb.from("likes").select("post_id").eq("post_id", postId).eq("user_id", currentUser.id).maybeSingle();
    if (existing) await sb.from("likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    else await sb.from("likes").insert({ post_id: postId, user_id: currentUser.id });
    await loadFeed();
  }

  async function deletePost(id) {
    if (!confirm("Apagar esta publicação?")) return;
    const { error } = await sb.from("posts").delete().eq("id", id); if (error) toast(error.message, "error"); else await loadFeed();
  }

  async function addComment(e, postId) {
    e.preventDefault(); const input = $("input", e.currentTarget);
    const { error } = await sb.from("comments").insert({ post_id: postId, author_id: currentUser.id, content: input.value.trim() });
    if (error) toast(error.message, "error"); else { input.value = ""; await loadComments(postId); }
  }

  async function loadComments(postId) {
    const area = $(`#comments-${postId}`); area.classList.remove("hidden");
    const { data, error } = await sb.from("comments").select(`id,content,created_at,author_id,profiles!comments_author_id_fkey(display_name,username,avatar_url)`).eq("post_id", postId).order("created_at");
    if (error) return area.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    area.innerHTML = data?.length ? data.map(c => `<div class="comment">${avatarHtml(c.profiles,"avatar tiny-avatar")}<div><strong>${escapeHtml(c.profiles.display_name)}</strong><span>${escapeHtml(c.content)}</span></div></div>`).join("") : `<p class="tiny">Ainda não há comentários.</p>`;
  }

  async function renderProfile(userId = currentUser.id) {
    const p = userId === currentUser.id ? currentProfile : await loadProfile(userId);
    const { data: posts } = await sb.from("posts").select("id,content,created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(30);
    $("#profile-page").innerHTML = `<div class="profile-cover aero-panel"></div><div class="profile-card aero-panel"><div class="profile-avatar">${avatarHtml(p,"avatar profile-avatar-img")}</div><div class="profile-main"><div class="profile-title"><div><h1>${escapeHtml(p.display_name)}</h1><p>@${escapeHtml(p.username)}</p></div>${userId === currentUser.id ? `<button class="aero-button" data-view="settings">Editar perfil</button>` : `<button class="aero-button" data-message-user="${p.id}">💌 Mensagem</button>`}</div><p class="bio">${escapeHtml(p.bio || "Sem bio ainda.")}</p><div class="stats"><span><b>${posts?.length || 0}</b> publicações</span><span><b>∞</b> possibilidades</span></div></div></div><div class="profile-posts">${posts?.map(x => `<article class="post aero-panel"><span class="post-time">${timeAgo(x.created_at)}</span><p class="post-text">${escapeHtml(x.content).replace(/\n/g,"<br>")}</p></article>`).join("") || ""}</div>`;
    $$('[data-view="settings"]', $("#profile-page")).forEach(b => b.onclick = () => switchView("settings"));
  }

  async function renderSettings() {
    $("#settings-page").innerHTML = `<div class="settings-grid"><div class="aero-panel settings-card"><p class="eyebrow">YOUR CORNER OF THE WEB</p><h2>Editar perfil</h2><form id="profile-form" class="auth-form"><label>Nome<input id="edit-name" maxlength="40" value="${escapeHtml(currentProfile.display_name)}" required></label><label>Usuário<input id="edit-username" maxlength="24" value="${escapeHtml(currentProfile.username)}" required pattern="[A-Za-z0-9_]{3,24}"></label><label>Bio<textarea id="edit-bio" maxlength="180">${escapeHtml(currentProfile.bio || "")}</textarea></label><label>Nova foto<input id="edit-avatar" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="aero-button primary">Salvar alterações</button></form></div><div class="aero-panel settings-card"><p class="eyebrow">ACCOUNT</p><h2>Conta</h2><p>${escapeHtml(currentUser.email || "")}</p><button id="send-reset" class="aero-button">Enviar link de troca de senha</button><p class="tiny">A autenticação e as senhas são gerenciadas pelo Supabase Auth.</p></div></div>`;
    $("#profile-form").onsubmit = saveProfile; $("#send-reset").onclick = resetPassword;
  }

  async function saveProfile(e) {
    e.preventDefault(); const username = $("#edit-username").value.trim().replace(/^@/,"").toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("Usuário inválido.", "error");
    try {
      let avatar_url = currentProfile.avatar_url; const file = $("#edit-avatar").files[0]; if (file) avatar_url = await uploadAvatar(file, currentUser.id);
      const { data, error } = await sb.from("profiles").update({ display_name: $("#edit-name").value.trim(), username, bio: $("#edit-bio").value.trim(), avatar_url }).eq("id", currentUser.id).select().single();
      if (error) throw error; currentProfile = data; renderMiniProfile(); await renderProfile(); await renderSettings(); toast("Perfil atualizado! 🌊", "ok");
    } catch (err) { toast(err.message, "error"); }
  }

  async function search() {
    const q = $("#search-input").value.trim(); if (!q) return;
    const [people, posts] = await Promise.all([
      sb.from("profiles").select("id,display_name,username,bio,avatar_url").or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(20),
      sb.from("posts").select(`id,content,created_at,author_id,profiles!posts_author_id_fkey(display_name,username,avatar_url)`).ilike("content", `%${q}%`).limit(30)
    ]);
    const el = $("#search-results"); el.innerHTML = `<div class="search-section"><h2>Pessoas</h2>${people.data?.map(p=>`<button class="person-result aero-panel" data-profile="${p.id}">${avatarHtml(p,"avatar")}<span><strong>${escapeHtml(p.display_name)}</strong><small>@${escapeHtml(p.username)}</small></span></button>`).join("") || `<p>Nenhuma pessoa encontrada.</p>`}</div><div class="search-section"><h2>Publicações</h2>${posts.data?.map(p=>`<article class="post aero-panel"><div class="post-head">${avatarHtml(p.profiles,"avatar")}<div><strong>${escapeHtml(p.profiles.display_name)}</strong><span>@${escapeHtml(p.profiles.username)} · ${timeAgo(p.created_at)}</span></div></div><p class="post-text">${escapeHtml(p.content)}</p></article>`).join("") || `<p>Nenhuma publicação encontrada.</p>`}</div>`;
    $$("[data-profile]", el).forEach(b => b.onclick = async () => { await renderProfile(b.dataset.profile); switchView("profile"); });
  }

  async function renderNotifications() {
    const { data, error } = await sb.from("notifications").select("id,type,created_at,read,actor_id").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(30);
    $("#notifications-list").innerHTML = `<div class="aero-panel settings-card"><p class="eyebrow">YOUR SIGNALS</p><h2>Notificações</h2>${error ? `<p>${escapeHtml(error.message)}</p>` : data?.length ? data.map(n=>`<div class="notification">🔔 <span>${escapeHtml(n.type)} · ${timeAgo(n.created_at)}</span></div>`).join("") : `<p>Nada novo por aqui.</p>`}</div>`;
  }

  function switchView(view) {
    const titles = { home:"Início", profile:"Meu perfil", explore:"Explorar", messages:"Mensagens", notifications:"Notificações", settings:"Configurações" };
    $$(".view").forEach(v => v.classList.add("hidden")); $(`#view-${view}`).classList.remove("hidden"); $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view)); $("#view-title").textContent = titles[view] || "WhiteSpace";
    if (view === "profile") renderProfile(); if (view === "settings") renderSettings(); if (view === "notifications") renderNotifications();
  }

  function setupDonations() {
    const amounts = [5,10,20,50,100], box = $("#donation-options");
    box.innerHTML = amounts.map(a => `<a class="donation-card ${C.donations?.[a] ? "ready" : "disabled"}" href="${C.donations?.[a] || "#"}" ${C.donations?.[a] ? 'target="_blank" rel="noopener noreferrer"' : ""}>💧<strong>R$ ${a}</strong><span>${C.donations?.[a] ? "Apoiar agora" : "Configurar link"}</span></a>`).join("");
  }

  $$("[data-auth-tab]").forEach(b => b.onclick = () => { $$(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active"); $("#signup-form").classList.toggle("hidden", b.dataset.authTab !== "signup"); $("#login-form").classList.toggle("hidden", b.dataset.authTab !== "login"); });
  $("#signup-form").onsubmit = signUp; $("#login-form").onsubmit = signIn; $("#forgot-password").onclick = resetPassword;
  $("#logout").onclick = async () => { await sb?.auth.signOut(); currentUser = null; currentProfile = null; showAuth(); };
  $$(".nav-item").forEach(b => b.onclick = () => switchView(b.dataset.view));
  $("#post-content").oninput = e => $("#post-count").textContent = `${e.target.value.length} / 1000`;
  $("#post-form").onsubmit = async e => { e.preventDefault(); const content = $("#post-content").value.trim(); if (!content) return; const { error } = await sb.from("posts").insert({ author_id: currentUser.id, content }); if (error) toast(error.message,"error"); else { $("#post-content").value=""; $("#post-count").textContent="0 / 1000"; await loadFeed(); } };
  $("#refresh-feed").onclick = loadFeed; $("#search-button").onclick = search; $("#search-input").onkeydown = e => { if(e.key === "Enter") search(); };
  $("#donate-open").onclick = () => { setupDonations(); $("#donate-dialog").showModal(); }; $("#donate-close").onclick = () => $("#donate-dialog").close();
  $("#feed").addEventListener("click", e => { const b = e.target.closest(".comment-toggle"); if (!b) return; $(`#comments-${b.dataset.id}`).classList.toggle("hidden"); $(`.comment-form[data-id="${b.dataset.id}"]`).classList.toggle("hidden"); loadComments(b.dataset.id); });

  requireConfig(); if (sb) { sb.auth.onAuthStateChange(() => setTimeout(boot, 0)); boot(); }
})();
