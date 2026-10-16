'use strict';
const $ = (selector) => document.querySelector(selector);
const supportDialog = $('#support-dialog');
const videoDialog = $('#video-dialog');
const feedback = $('#chat-feedback');
const chatInput = $('#chat-input');
const chatLog = $('#chat-log');
// Local demo checks only: no AI and no server-side protection yet.
const guardState = { recent: [], lastText: '', repeats: 0 };
const piiPatterns = [
 {name:'e-mail',regex:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i},
 {name:'telefone',regex:/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[\s-]?\d{4}\b/},
 {name:'possível CPF',regex:/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/}
];
const suspiciousLink = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|xyz|ru|click|top|zip|info)\b)/i;
const abusiveTerms = ['vou te encontrar','te matar','matar você','ameaça'];
function inspectMessage(raw) {
 const text = raw.trim(), now = Date.now();
 guardState.recent = guardState.recent.filter(time => now-time < 10000);
 if (!text) return {ok:false,message:'Escreva uma mensagem antes de enviar.'};
 if (text.length > 400) return {ok:false,message:'A mensagem passou do limite de 400 caracteres.'};
 if (guardState.recent.length >= 4) return {ok:false,message:'O Guardião bloqueou o envio rápido demais. Espere alguns segundos.'};
 if (text.toLowerCase() === guardState.lastText.toLowerCase()) guardState.repeats++;
 else guardState.repeats = 0;
 if (guardState.repeats >= 2) return {ok:false,message:'O Antispam detectou mensagens repetidas. Mude o texto antes de tentar de novo.'};
 if (suspiciousLink.test(text)) return {ok:false,message:'O Agente de Links bloqueou links neste protótipo para reduzir golpes e phishing.'};
 const pii = piiPatterns.find(pattern => pattern.regex.test(text));
 if (pii) return {ok:false,message:'O Agente de Privacidade detectou um possível '+pii.name+'. Não publique dados pessoais.'};
 if (abusiveTerms.some(term => text.toLowerCase().includes(term))) return {ok:false,message:'A mensagem foi bloqueada pelo filtro de segurança. Converse sem ameaças.'};
 if (/(.)\1{11,}/u.test(text)) return {ok:false,message:'O Antispam detectou caracteres repetidos demais.'};
 return {ok:true,text};
}
function appendMessage(text) {
 // Safe rendering: user input stays text, never HTML.
 const item=document.createElement('div'); item.className='chat-message';
 const name=document.createElement('strong'); name.textContent='Visitante de demonstração';
 const body=document.createElement('span'); body.textContent=text;
 item.append(name,body); chatLog.append(item); chatLog.scrollTop=chatLog.scrollHeight;
}
$('#chat-form').addEventListener('submit',event=>{
 event.preventDefault(); const result=inspectMessage(chatInput.value);
 if(!result.ok){feedback.textContent='🛡️ '+result.message;feedback.dataset.state='blocked';return;}
 guardState.recent.push(Date.now());guardState.lastText=result.text;appendMessage(result.text);chatInput.value='';
 feedback.textContent='✓ Verificações locais concluídas. Mensagem adicionada somente nesta sessão.';feedback.dataset.state='ok';
});
function openSupport(){if(typeof supportDialog.showModal==='function')supportDialog.showModal();else alert('Seu navegador não oferece suporte a esta janela.');}
['#support-top','#hero-support','#support-main'].forEach(selector=>$(selector).addEventListener('click',openSupport));
$('#close-support').addEventListener('click',()=>supportDialog.close());
document.querySelectorAll('[data-amount]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-amount]').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');
 const amount=Number(button.dataset.amount),tiers={2:'Gaterson Broto 🍃',5:'Gaterson Cítrico 🍋',10:'Gaterson Dourado 🌟',20:'Gaterson Lendário 👑'};
 $('#payment-placeholder').textContent='Você selecionou R$ '+amount.toFixed(2).replace('.',',')+' — '+tiers[amount]+'. O Pix ainda não está configurado: não faça nenhum pagamento por esta tela. Quando houver um QR Code válido e confirmado, ele será exibido aqui.';
}));
document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',()=>{$('#video-title').textContent=button.dataset.video;if(typeof videoDialog.showModal==='function')videoDialog.showModal();}));
$('#search-form').addEventListener('submit',event=>{
 event.preventDefault();const query=$('#search-input').value.trim().toLocaleLowerCase('pt-BR');let visible=0;
 document.querySelectorAll('.video-card').forEach(card=>{const match=!query||(card.dataset.search+' '+card.textContent).toLocaleLowerCase('pt-BR').includes(query);card.hidden=!match;if(match)visible++;});
 $('#show-all').textContent=visible+' resultado(s)';
});
$('#show-all').addEventListener('click',()=>{document.querySelectorAll('.video-card').forEach(card=>card.hidden=false);$('#search-input').value='';$('#show-all').textContent='Ver todos ↗';});
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));button.classList.add('active');
 if(button.dataset.view==='gatersons')$('.gaterson-panel').scrollIntoView({behavior:'smooth',block:'center'});
 else if(button.dataset.view==='explorar')$('.video-grid').scrollIntoView({behavior:'smooth',block:'start'});
 else window.scrollTo({top:0,behavior:'smooth'});
}));