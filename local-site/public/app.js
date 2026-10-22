const API = window.WHITESPACE_API_URL || (location.protocol === "file:" ? "http://127.0.0.1:8787" : location.origin);
const $ = (id) => document.getElementById(id);
let mode = "login";
let session = JSON.parse(localStorage.getItem("ws-session") || "null");
let me = null;
const show = (el, yes=true) => el.classList.toggle("hidden", !yes);
const api = async (route, options={}) => {
  const headers = { "Content-Type":"application/json", ...(options.headers||{}) };
  if (session?.token) headers.Authorization = "Bearer " + session.token;
  const response = await fetch(API + route, {...options, headers});
  const data = await response.json().catch(()=>({error:"Resposta inválida do servidor."}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data;
};
function error(id, message) { $(id).textContent=message; show($(id),true); }
function clearError(id) { $(id).textContent=""; show($(id),false); }
function setMode(next) {
  mode=next; $("auth-title").textContent=next==="login"?"Entre no seu espaço.":"Crie seu espaço.";
  $("auth-submit").textContent=next==="login"?"Entrar ↗":"Criar conta ↗";
  document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===next));
  $("password").autocomplete=next==="login"?"current-password":"new-password";
  $("password").minLength=next==="login"?1:10;
  show($("new-key"),false);clearError("auth-error");
}
async function loadFeed() {
  try {
    const {posts}=await api("/api/posts");
    const list=$("feed-list"); list.replaceChildren();
    if(!posts.length){list.innerHTML='<p class="empty">Ainda não há publicações. Seja a primeira pessoa a compartilhar algo. ✦</p>';return;}
    for(const p of posts){
      const article=document.createElement("article");article.className="post";
      const meta=document.createElement("div");meta.className="post-meta";
      const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=(p.displayName||p.username||"?").slice(0,1).toUpperCase();
      const name=document.createElement("strong");name.textContent=p.displayName||p.username;
      const handle=document.createElement("span");handle.textContent="@"+p.username;
      const date=document.createElement("span");date.textContent=new Date(p.createdAt).toLocaleDateString("pt-BR");
      meta.append(avatar,name,handle,date);
      const content=document.createElement("p");content.className="post-content";content.textContent=p.content;
      article.append(meta,content);list.append(article);
    }
  } catch(e) { $("feed-list").innerHTML='<p class="empty">O servidor local não está disponível. Inicie o servidor para carregar as publicações.</p>'; }
}
async function refreshMe() {
  if(!session?.token){me=null;renderAccount();return;}
  try{me=await api("/api/me");}catch{localStorage.removeItem("ws-session");session=null;me=null;}
  renderAccount();
}
function renderAccount(){
  const logged=!!me;show($("account-panel"),logged);show($("composer-panel"),logged);
  if(logged){$("hello-name").textContent="Olá, "+me.profile.display_name+"."; $("account-key").textContent=me.user.accountKey;
    document.documentElement.style.setProperty("--accent",me.profile.accent);
    document.documentElement.style.setProperty("--bg",me.profile.background);
  }
}
async function authSubmit(event){
  event.preventDefault();clearError("auth-error");$("auth-submit").disabled=true;
  try{
    const payload={username:$("username").value.trim(),password:$("password").value};
    const result=await api(mode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",body:JSON.stringify(payload)});
    session={token:result.token};localStorage.setItem("ws-session",JSON.stringify(session));
    if(mode==="register"){show($("new-key"),true);$("new-key-value").textContent=result.user.accountKey;$("auth-submit").disabled=false;await navigator.clipboard?.writeText(result.user.accountKey).catch(()=>{});}
    await refreshMe();await loadFeed();
    if(mode==="login")$("auth-dialog").close();
    else $("auth-title").textContent="Sua conta está pronta!";
  }catch(e){error("auth-error",e.message);}
  finally{$("auth-submit").disabled=false;}
}
$("open-auth").onclick=()=>{setMode("login");$("auth-dialog").showModal();};
$("hero-signup").onclick=()=>{setMode("register");$("auth-dialog").showModal();};
$("close-auth").onclick=()=>$("auth-dialog").close();
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$("auth-form").onsubmit=authSubmit;
$("reload").onclick=loadFeed;
$("post-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/posts",{method:"POST",body:JSON.stringify({content:$("post-content").value})});$("post-content").value="";await loadFeed();}catch(err){alert(err.message);}};
$("logout").onclick=async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch{}localStorage.removeItem("ws-session");session=null;me=null;renderAccount();};
$("edit-profile").onclick=()=>{if(!me)return;$("display-name").value=me.profile.display_name;$("bio").value=me.profile.bio;$("accent").value=me.profile.accent;$("background").value=me.profile.background;$("profile-dialog").showModal();};
$("close-profile").onclick=()=>$("profile-dialog").close();
$("profile-form").onsubmit=async e=>{e.preventDefault();clearError("profile-error");try{await api("/api/profile",{method:"PATCH",body:JSON.stringify({displayName:$("display-name").value,bio:$("bio").value,accent:$("accent").value,background:$("background").value})});await refreshMe();$("profile-dialog").close();}catch(err){error("profile-error",err.message);}};
$("copy-key").onclick=async()=>{try{await navigator.clipboard.writeText($("new-key-value").textContent);$("copy-key").textContent="Chave copiada ✓";}catch{$("new-key-value").focus();}};
$("year").textContent=new Date().getFullYear();
(async()=>{try{const h=await api("/api/health");document.querySelector(".status-line").innerHTML='<span class="dot"></span> SERVIDOR '+h.service.toUpperCase()+' <span>·</span> BANCO SQLITE LOCAL';}catch{}await refreshMe();await loadFeed();})();
