'use strict';
function sapCookieGet(name){
  return document.cookie.split('; ').reduce(function(acc, part){
    var p = part.split('='); return p[0] === name ? decodeURIComponent(p.slice(1).join('=')) : acc;
  }, '');
}
function sapCookieSet(name, value){
  document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
}
initStore();

/* ── Tema ── */
(function(){
  var t = sapCookieGet('sap_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('ico-moon').style.display = t==='dark'?'none':'block';
  document.getElementById('ico-sun').style.display  = t==='dark'?'block':'none';
})();
function toggleTheme(){
  var t = document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  sapCookieSet('sap_theme', t);
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('ico-moon').style.display = t==='dark'?'none':'block';
  document.getElementById('ico-sun').style.display  = t==='dark'?'block':'none';
}

/* Redireciona se já logado */
(function(){
  var s = getSession();
  if (!s) return;
  var mapa = { administrador:'pages/painel-admin.html', psicologa:'pages/painel-psicologo.html', coordenacao:'pages/painel-coordenacao.html', instrutor:'pages/painel-instrutor.html' };
  if (mapa[s.role]) window.location.href = mapa[s.role];
})();

/* ── Os botões das cards redirecionam para o login com perfil pré-selecionado ── */
/* Reutilizamos o sistema de login original mas com modal overlay */
var _perfilAtual = null;

var PERFIS = {
  administrador:{ label:'Administrador', sub:'Acesse a gestão completa do sistema', mostraCampoUnidade:false, color:'#1B4E9B' },
  psicologa:    { label:'Psicólogo(a)',  sub:'Selecione uma unidade cadastrada e entre com seu login individual', mostraCampoUnidade:true, color:'#0D2240' },
  coordenacao:  { label:'Coordenação',   sub:'Selecione uma unidade cadastrada e entre com seu login individual', mostraCampoUnidade:true, color:'#C87F00' },
  instrutor:    { label:'Instrutor',     sub:'Selecione uma unidade cadastrada e entre com seu login individual', mostraCampoUnidade:true, color:'#C87F00' }
};

/* Override botões das cards para abrir modal */
document.querySelectorAll('.card-btn').forEach(function(btn){
  btn.onclick = null;
});

/* Verificar querystring para pré-selecionar perfil */
(function(){
  var p = new URLSearchParams(window.location.search).get('perfil');
  if(p && PERFIS[p]) { window.history.replaceState({},'',window.location.pathname); abrirLogin(p); }
})();

function abrirLogin(perfil) {
  if (typeof afterStoreReady === 'function' && !getStore().unidades.length && !window.__sapLoginWaited) {
    window.__sapLoginWaited = true;
    return afterStoreReady(function(){ abrirLogin(perfil); });
  }
  window.__sapLoginWaited = false;
  _perfilAtual = perfil;
  var cfg = PERFIS[perfil];
  var store = getStore();
  var unidadesOpts = store.unidades.map(function(u){ return '<option value="'+u.id+'">'+u.nome+' ('+(u.regiao||'')+')</option>'; }).join('');
  if (cfg.mostraCampoUnidade && !store.unidades.length) { unidadesOpts = '<option value="" disabled>Nenhuma unidade cadastrada. Entre como admin e cadastre uma unidade.</option>'; }

  document.getElementById('modal-title').textContent = cfg.label;
  document.getElementById('modal-body').innerHTML =
    '<p style="font-size:13px;color:var(--ink-soft);margin-bottom:16px">'+cfg.sub+'</p>'
    + '<div id="login-err" style="display:none;padding:10px 14px;background:#fef0f0;border:1px solid #f5c6c6;border-radius:8px;color:#c0392b;font-size:13px;margin-bottom:14px"></div>'
    + (cfg.mostraCampoUnidade ? '<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--ink-mid);margin-bottom:7px">Unidade *</label><select id="f-unidade" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;color:var(--ink);background:var(--bg);outline:none"><option value="">Selecione sua unidade...</option>'+unidadesOpts+'</select></div>' : '')
    + '<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:700;color:var(--ink-mid);margin-bottom:7px">Usuário *</label><input type="text" id="f-user" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;color:var(--ink);background:var(--bg);outline:none" placeholder="Seu usuário" autocomplete="username"></div>'
    + '<div style="margin-bottom:20px"><label style="display:block;font-size:12px;font-weight:700;color:var(--ink-mid);margin-bottom:7px">Senha *</label><input type="password" id="f-pw" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;color:var(--ink);background:var(--bg);outline:none" placeholder="Sua senha" autocomplete="current-password"></div>'
    + '<button onclick="doLogin()" style="width:100%;padding:14px;background:linear-gradient(135deg,'+cfg.color+','+cfg.color+'cc);color:#fff;font-family:var(--font);font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;transition:all .2s;box-shadow:0 4px 18px rgba(0,0,0,.18)">Entrar no sistema <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-left:6px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>';

  var mo = document.getElementById('modal-perfil');
  mo.style.display = 'flex';
  setTimeout(function(){ var el=document.getElementById('f-user'); if(el) el.focus(); }, 100);
}

function fecharModal() {
  document.getElementById('modal-perfil').style.display = 'none';
  _perfilAtual = null;
}

function doLogin() {
  var cfg = PERFIS[_perfilAtual];
  if (!cfg) return;
  var u = document.getElementById('f-user').value.trim();
  var p = document.getElementById('f-pw').value.trim();
  var unidadeId = cfg.mostraCampoUnidade ? (document.getElementById('f-unidade') ? document.getElementById('f-unidade').value : null) : null;
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!u || !p) { errEl.textContent='Preencha usuário e senha.'; errEl.style.display='block'; return; }
  if (cfg.mostraCampoUnidade && !unidadeId) { errEl.textContent='Selecione a unidade antes de entrar.'; errEl.style.display='block'; return; }
  var btn = errEl.parentElement.querySelector('button');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

  login(_perfilAtual, u, p, unidadeId || null).then(function(resultado) {
    if (resultado.ok) {
      var mapa = { administrador:'pages/painel-admin.html', psicologa:'pages/painel-psicologo.html', coordenacao:'pages/painel-coordenacao.html', instrutor:'pages/painel-instrutor.html' };
      if (resultado.senhaTemporaria) {
        var nova = prompt('Este é seu primeiro acesso. Crie uma nova senha com pelo menos 6 caracteres:');
        if (!nova || nova.length < 6) { errEl.textContent='A nova senha deve ter pelo menos 6 caracteres.'; errEl.style.display='block'; return; }
        apiFetch('/auth/change-password', {method:'PATCH', body:JSON.stringify({senhaAtual:p, novaSenha:nova})})
          .then(function(){ window.location.href = mapa[_perfilAtual]; })
          .catch(function(e){ errEl.textContent=e.message || 'Não foi possível alterar a senha.'; errEl.style.display='block'; });
        return;
      }
      window.location.href = mapa[_perfilAtual];
    } else {
      errEl.textContent = resultado.msg;
      errEl.style.display = 'block';
    }
  }).catch(function(e) {
    errEl.textContent = e.message || 'Não foi possível entrar.';
    errEl.style.display = 'block';
  }).finally(function(){
    if (btn) { btn.disabled = false; btn.innerHTML = 'Entrar no sistema <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-left:6px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'; }
  });
}

/* Atribuir onclick correto aos botões das cards */
(function(){
  var cards = document.querySelectorAll('.role-card');
  var perfis = ['administrador','psicologa','coordenacao','instrutor'];
  cards.forEach(function(card, i){
    card.querySelector('.card-btn').onclick = function(){ abrirLogin(perfis[i]||'psicologa'); };
  });
})();

document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && document.getElementById('modal-perfil').style.display==='flex') doLogin();
  if(e.key==='Escape') fecharModal();
});

/* O modal de login não fecha mais ao clicar fora. Isso evita fechamento acidental ao selecionar texto com o mouse. */