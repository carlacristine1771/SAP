'use strict';
/* v2.2.2 - Chat unificado estilo WhatsApp para Admin, Coordenação e Instrutor. */
(function(){
  var chatPara = null;
  var chatExtras = [];

  function roleLabel(u){
    var r = (u && u.role) || '';
    if (r === 'psicologa') return 'Psicóloga';
    if (r === 'instrutor') return 'Instrutor';
    if (r === 'coordenacao') return 'Coordenação';
    if (r === 'administrador') return 'Administrador';
    return 'Usuário';
  }
  function iniciais(nome){
    var partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length-1].charAt(0) : '')).toUpperCase();
  }
  function me(){ return (typeof _sess !== 'undefined' && _sess) ? _sess : {}; }
  function userId(u){ return u && (u.id || (u.apiId ? apiIdCompat('usr', u.apiId) : null)); }
  function usersDisponiveis(){
    var s = getStore();
    var sess = me();
    return allUsuarios(s).filter(function(u){
      if (!u) return false;
      var id = userId(u);
      if (!id || id === sess.id) return false;
      if (u.statusCadastro === 'inativo' || u.ativo === false) return false;
      if (sess.role === 'administrador') return true;
      return !u.unidadeId || !sess.unidadeId || u.unidadeId === sess.unidadeId || u.role === 'administrador';
    }).sort(function(a,b){ return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
  }
  function userById(uid){
    return usersDisponiveis().find(function(u){
      return u.id === uid || u.apiId === uid || u.id === apiIdCompat('usr', uid) || apiIdCompat('usr', u.apiId) === uid;
    }) || null;
  }
  function msgs(uid){
    var sess = me();
    return (getStore().mensagens || []).filter(function(m){
      return (m.de === sess.id && m.para === uid) || (m.de === uid && m.para === sess.id);
    }).sort(function(a,b){ return new Date(a.criacao || 0) - new Date(b.criacao || 0); });
  }
  function dataKey(iso){
    var d = new Date(iso || '');
    if (isNaN(d.getTime())) return 'sem-data';
    return d.toISOString().slice(0,10);
  }
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function dataLabel(iso){
    var d = new Date(iso || '');
    if (isNaN(d.getTime())) return 'Sem data';
    var hoje = new Date(); var ontem = new Date(); ontem.setDate(hoje.getDate()-1);
    if (sameDay(d, hoje)) return 'Hoje';
    if (sameDay(d, ontem)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'});
  }
  function metaHora(iso){
    var d = new Date(iso || '');
    if (isNaN(d.getTime())) return fmtDatetime(iso);
    var hoje = new Date(); var ontem = new Date(); ontem.setDate(hoje.getDate()-1);
    var hora = d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    if (sameDay(d, hoje)) return 'Hoje às ' + hora;
    if (sameDay(d, ontem)) return 'Ontem às ' + hora;
    return d.toLocaleDateString('pt-BR') + ' às ' + hora;
  }
  function contatos(){
    var sess = me();
    var ids = [];
    (getStore().mensagens || []).forEach(function(m){
      if (m.de === sess.id && m.para) ids.push(m.para);
      if (m.para === sess.id && m.de) ids.push(m.de);
    });
    chatExtras.forEach(function(id){ ids.push(id); });
    ids = Array.from(new Set(ids));
    var users = usersDisponiveis();
    return ids.map(function(id){ return users.find(function(u){ return userId(u) === id || u.id === id; }); }).filter(Boolean).sort(function(a,b){
      var ma = msgs(userId(a)).slice(-1)[0];
      var mb = msgs(userId(b)).slice(-1)[0];
      return new Date((mb && mb.criacao) || 0) - new Date((ma && ma.criacao) || 0);
    });
  }
  function atualizarHeader(contato){
    var el = document.getElementById('chat-current-header');
    if (!el) return;
    if (!contato) {
      el.innerHTML = '<div class="chat-current-avatar">?</div><div class="chat-current-info"><strong>Selecione uma conversa</strong><small>Escolha um contato na lateral ou inicie uma nova conversa</small></div>';
      return;
    }
    el.innerHTML = '<div class="chat-current-avatar">' + escape(iniciais(contato.nome)) + '</div>'
      + '<div class="chat-current-info"><strong>' + escape(contato.nome || 'Usuário') + '</strong>'
      + '<small>' + escape(roleLabel(contato)) + '</small></div>';
  }
  function renderMensagens(uid){
    var contato = userById(uid);
    atualizarHeader(contato);
    var body = document.getElementById('chat-body');
    var input = document.getElementById('chat-txt');
    var btn = document.getElementById('chat-send-btn');
    if (input) input.disabled = !contato;
    if (btn) btn.disabled = !contato;
    if (!body) return;
    if (!contato) { body.innerHTML = '<div class="chat-empty-msg">Selecione uma conversa na lateral ou clique em + Nova.</div>'; return; }
    var lista = msgs(uid);
    if (!lista.length) { body.innerHTML = '<div class="chat-empty-msg">Nenhuma mensagem com este contato.<br>Digite abaixo para iniciar.</div>'; return; }
    var last = null;
    body.innerHTML = '<div class="chat-messages-area">' + lista.map(function(m){
      var key = dataKey(m.criacao); var sep = '';
      if (key !== last) { last = key; sep = '<div class="chat-day-separator">' + escape(dataLabel(m.criacao)) + '</div>'; }
      return sep + '<div class="chat-msg ' + (m.de === me().id ? 'sent' : 'recv') + '">'
        + '<div class="chat-bubble">' + escape(m.texto || '') + '</div>'
        + '<div class="chat-meta">' + escape(metaHora(m.criacao)) + '</div></div>';
    }).join('') + '</div>';
    var area = body.querySelector('.chat-messages-area'); if (area) area.scrollTop = area.scrollHeight;
  }
  function renderTabs(){
    var tabs = document.getElementById('chat-tabs');
    if (!tabs) return;
    var cs = contatos();
    if (!cs.length) {
      tabs.innerHTML = '<div class="chat-empty-msg" style="padding:22px">Nenhuma conversa ainda.<br>Clique em <b>+ Nova</b> para iniciar.</div>';
      atualizarHeader(null); renderMensagens(chatPara); return;
    }
    tabs.innerHTML = cs.map(function(u){
      var id = userId(u);
      var lista = msgs(id); var ultima = lista[lista.length-1];
      var unread = (getStore().mensagens || []).filter(function(m){ return m.de === id && m.para === me().id && !m.lida; }).length;
      return '<button class="chat-tab chat-contact-item' + (chatPara === id ? ' active' : '') + '" id="sbtn-' + id + '" onclick="selecionarChatGlobal(\'' + id + '\')">'
        + '<span class="chat-contact-avatar">' + escape(iniciais(u.nome)) + '</span>'
        + '<span class="chat-contact-text"><span class="chat-contact-name">' + escape(u.nome || 'Usuário') + '</span>'
        + '<span class="chat-contact-role">' + escape(roleLabel(u)) + '</span>'
        + '<span class="chat-contact-preview">' + escape(ultima ? String(ultima.texto || '').slice(0,44) : 'Clique para abrir conversa') + '</span></span>'
        + (unread ? '<span class="chat-unread">' + unread + '</span>' : '') + '</button>';
    }).join('');
    if (!chatPara && cs.length) window.selecionarChatGlobal(userId(cs[0]));
    else renderMensagens(chatPara);
  }
  window.renderChat = renderTabs;
  window.renderChatTabs = renderTabs;
  window.selecionarChatGlobal = function(uid){
    chatPara = uid;
    if (chatExtras.indexOf(uid) < 0) chatExtras.push(uid);
    document.querySelectorAll('.chat-tab').forEach(function(t){ t.classList.remove('active'); });
    var btn = document.getElementById('sbtn-' + uid); if (btn) btn.classList.add('active');
    apiFetch('/chat/mensagens/lidas/' + apiLongFromCompat(uid), {method:'PATCH'}).catch(function(){});
    renderMensagens(uid);
  };
  window.abrirNovoChat = function(){ renderNovoChatUsuarios(); openModal('modal-novo-chat'); };
  window.renderNovoChatUsuarios = function(){
    var el = document.getElementById('chat-user-list'); if (!el) return;
    var qEl = document.getElementById('chat-user-search'); var q = (qEl && qEl.value ? qEl.value : '').toLowerCase();
    var users = usersDisponiveis().filter(function(u){ return !q || [u.nome,u.usuario,u.email,roleLabel(u)].join(' ').toLowerCase().indexOf(q) >= 0; });
    if (!users.length) { el.innerHTML = '<div class="empty-state" style="padding:22px"><div class="empty-state-title">Nenhum usuário encontrado</div></div>'; return; }
    el.innerHTML = users.map(function(u){ var id = userId(u); return '<button type="button" class="chat-user-option" onclick="iniciarConversaComUsuario(\'' + id + '\')">'
      + '<span class="chat-contact-avatar">' + escape(iniciais(u.nome)) + '</span>'
      + '<span><strong>' + escape(u.nome || 'Usuário') + '</strong><small>' + escape(u.email || u.usuario || '') + '</small></span>'
      + '<span class="chat-user-role-pill">' + escape(roleLabel(u)) + '</span></button>'; }).join('');
  };
  window.iniciarConversaComUsuario = function(uid){
    if (chatExtras.indexOf(uid) < 0) chatExtras.push(uid);
    closeModal('modal-novo-chat'); renderTabs(); window.selecionarChatGlobal(uid);
  };
  window.enviarMsgGlobal = function(){
    var input = document.getElementById('chat-txt'); var texto = input ? input.value.trim() : '';
    if (!texto || !chatPara) { toast('Selecione um contato e escreva a mensagem.', 'warning'); return; }
    var store = getStore();
    store.mensagens.push({id:genId('m'), de:me().id, para:chatPara, unidadeId:me().unidadeId || null, texto:texto, criacao:new Date().toISOString(), lida:false});
    saveStore(store).catch(function(err){ toast(err && err.message ? err.message : 'Não foi possível enviar a mensagem.', 'error'); });
    if (input) input.value = '';
    renderTabs(); renderMensagens(chatPara);
  };
  window.enviarMsg = window.enviarMsgGlobal;
  document.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement && document.activeElement.id === 'chat-txt') { e.preventDefault(); window.enviarMsgGlobal(); }
  });
})();
