/* ============================================================
   app.js — SAP SENAC DF
   Atualizado: dados funcionais saem do backend/banco real.
   ============================================================ */
'use strict';

var SAP_VERSION = 'v2.3.7';
var SESSION_COOKIE = 'SAP_SESSION';
var API_BASE = window.SAP_API_BASE || window.location.origin;

var SEED = {
  unidades: [], cursos: [], turmas: [], administradores: [], psicologos: [], coordenadores: [], instrutores: [],
  alunos: [], atendimentos: [], mensagens: []
};

var _sapStore = clone(SEED);
var _sapLastPersisted = clone(SEED);
var _sapSavingFromApi = false;
var _sapSyncPromise = Promise.resolve(_sapStore);

function clone(obj) { return JSON.parse(JSON.stringify(obj || {})); }
function sameJson(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
function apiIdCompat(prefix, id) { return prefix + String(id); }
function unidadeIdCompat(id) { return id ? ('u' + id) : null; }
function apiLongFromCompat(id) {
  if (id === null || id === undefined || id === '') return null;
  if (typeof id === 'number') return id;
  var n = Number(String(id).replace(/^[a-zA-Z]+/, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cssVar(name, fallback) {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch(e) { return fallback; }
}
function alunoCursoNome(aluno, store) {
  if (!aluno) return 'Curso não informado';
  if (aluno.curso && String(aluno.curso).trim()) return aluno.curso;
  store = store || getStore();
  var cid = aluno.cursoId || aluno.cursoApiId;
  var curso = (store.cursos || []).find(function(c){ return c.id === cid || c.apiId === cid || c.apiId === apiLongFromCompat(cid); });
  return curso && curso.nome ? curso.nome : 'Curso não informado';
}
function alunoTurmaNome(aluno, store) {
  if (!aluno) return '';
  if (aluno.turma && String(aluno.turma).trim()) return aluno.turma;
  store = store || getStore();
  var tid = aluno.turmaId || aluno.turmaApiId;
  var turma = (store.turmas || []).find(function(t){ return t.id === tid || t.apiId === tid || t.apiId === apiLongFromCompat(tid); });
  return turma && turma.nome ? turma.nome : '';
}
function sapSnapshotFormState(root) {
  root = root || document;
  var state = { values:{}, checked:{}, activeId:(document.activeElement && document.activeElement.id) || '' };
  try {
    root.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el){
      if (el.type === 'button' || el.type === 'submit' || el.type === 'reset' || el.type === 'hidden') return;
      if (el.type === 'checkbox' || el.type === 'radio') state.checked[el.id] = !!el.checked;
      else state.values[el.id] = el.value;
    });
  } catch(e) {}
  return state;
}
function sapRestoreFormState(state, root) {
  if (!state) return;
  root = root || document;
  try {
    Object.keys(state.values || {}).forEach(function(id){
      var el = root.getElementById ? root.getElementById(id) : document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        var val = state.values[id];
        if (val === '' || Array.from(el.options).some(function(o){ return o.value === val; })) el.value = val;
      } else {
        el.value = state.values[id];
      }
    });
    Object.keys(state.checked || {}).forEach(function(id){
      var el = root.getElementById ? root.getElementById(id) : document.getElementById(id);
      if (el) el.checked = state.checked[id];
    });
    if (state.activeId) {
      var active = document.getElementById(state.activeId);
      if (active && typeof active.focus === 'function') active.focus();
    }
  } catch(e) { console.warn('Falha ao restaurar formulário:', e); }
}
function sapPreserveFormState(fn) {
  var snapshot = sapSnapshotFormState(document);
  try { if (typeof fn === 'function') fn(); }
  finally {
    sapRestoreFormState(snapshot, document);
    setTimeout(function(){ sapRestoreFormState(snapshot, document); }, 0);
  }
}
function sapSetSelectOptions(selectEl, html, fallbackValue) {
  if (!selectEl) return;
  var atual = fallbackValue !== undefined ? fallbackValue : selectEl.value;
  selectEl.innerHTML = html || '';
  if (atual === '' || Array.from(selectEl.options).some(function(o){ return o.value === atual; })) selectEl.value = atual;
}
function refreshActivePanel() {
  sapPreserveFormState(function(){
    try {
      var active = document.querySelector('.panel-section.active');
      var nav = active ? document.querySelector('[data-panel="' + active.id + '"]') : null;
      if (active && typeof navTo === 'function') navTo(active.id, nav);
      else {
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderHome === 'function') renderHome();
      }
    } catch(e) { console.warn('Falha ao atualizar painel ativo:', e); }
  });
}
function afterStoreReady(fn) {
  return (_sapSyncPromise || Promise.resolve(getStore())).then(function(){
    if (typeof fn === 'function') fn(getStore());
    return getStore();
  });
}

/* ============================================================  VALIDATORS  ============================================================ */
var Validators = (function () {
  function cpf(v) {
    v = String(v||'').replace(/\D/g,'');
    if (v.length!==11||/^(\d)\1{10}$/.test(v)) return false;
    var s=0,r; for(var i=0;i<9;i++) s+=parseInt(v[i])*(10-i); r=(s*10)%11; if(r===10||r===11)r=0; if(r!==parseInt(v[9])) return false;
    s=0; for(var j=0;j<10;j++) s+=parseInt(v[j])*(11-j); r=(s*10)%11; if(r===10||r===11)r=0; return r===parseInt(v[10]);
  }
  function email(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'')); }
  function telefone(v) { v=String(v||'').replace(/\D/g,''); return v.length>=10&&v.length<=11; }
  function data(v) { if(!v) return null; var d=new Date(v+'T12:00:00'); return isNaN(d.getTime())?null:d; }
  function normalizeTurno(t) {
    t=String(t||'').toLowerCase().trim();
    if(t==='manha'||t==='manhã'||t==='matutino') return 'manhã';
    if(t==='tarde'||t==='vespertino') return 'tarde';
    if(t==='noite'||t==='noturno') return 'noite';
    if(t==='remoto') return 'remoto';
    return '';
  }
  return { cpf, email, telefone, data, normalizeTurno };
})();

function normalizeStore(store) {
  store = store && typeof store === 'object' ? store : {};
  var out = {
    unidades: Array.isArray(store.unidades) ? store.unidades : [],
    cursos: Array.isArray(store.cursos) ? store.cursos : [],
    turmas: Array.isArray(store.turmas) ? store.turmas : [],
    administradores: Array.isArray(store.administradores) ? store.administradores : [],
    psicologos: Array.isArray(store.psicologos) ? store.psicologos : [],
    coordenadores: Array.isArray(store.coordenadores) ? store.coordenadores : [],
    instrutores: Array.isArray(store.instrutores) ? store.instrutores : [],
    alunos: Array.isArray(store.alunos) ? store.alunos : [],
    atendimentos: Array.isArray(store.atendimentos) ? store.atendimentos : [],
    mensagens: Array.isArray(store.mensagens) ? store.mensagens : []
  };

  out.cursos = out.cursos.map(function(c){ c = c || {}; if (!c.tipoAprendizagem) c.tipoAprendizagem = ''; return c; });

  out.alunos = out.alunos.map(function(a){
    a = a || {};
    if (!a.statusCadastro || a.statusCadastro === 'pendente' || a.statusCadastro === 'aprovado') a.statusCadastro = 'ativo';
    if (typeof a.pcd !== 'boolean') a.pcd = false;
    a.turnoCurso = Validators.normalizeTurno(a.turnoCurso || a.turno || '');
    if (!a.unidadeId) a.unidadeId = null;
    return a;
  });
  out.atendimentos = out.atendimentos.map(function(c){
    c = c || {};
    if (!c.motivoSolicitação && c.motivo) c.motivoSolicitação = c.motivo;
    if (!c.obsResponsavel && c.obsAluno) c.obsResponsavel = c.obsAluno;
    if (!c.unidadeId) c.unidadeId = null;
    if (!c.status) c.status = 'aguardando';
    if (!c.tipoAtendimento) c.tipoAtendimento = 'dentro';
    if (!c.categoriaAtendimento) c.categoriaAtendimento = '';
    return c;
  });
  out.mensagens = out.mensagens.map(function(m){ m = m || {}; if (!m.unidadeId) m.unidadeId = null; return m; });
  return out;
}

/* ============================================================  SESSION  ============================================================ */
function sapCookieGet(name){
  return document.cookie.split('; ').reduce(function(acc, part){
    var p = part.split('=');
    return p[0] === name ? decodeURIComponent(p.slice(1).join('=')) : acc;
  }, '');
}
function sapCookieSet(name, value, maxAge){
  document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + (maxAge || 86400) + '; SameSite=Lax';
}
function sapCookieDelete(name){
  document.cookie = name + '=; path=/; max-age=0; SameSite=Lax';
}
var _sapSessionMemory = null;
var SessionService = (function () {
  function normalizeSession(s) {
    if (!s) return null;
    return {
      id:s.id, apiId:s.apiId||apiLongFromCompat(s.id), role:s.role, nome:s.nome,
      disciplina:s.disciplina||null, crp:s.crp||null, setor:s.setor||null,
      turmas:s.turmas||[], turmaIds:s.turmaIds||[], unidadeId:s.unidadeId||null,
      email:s.email||null, senhaTemporaria:!!s.senhaTemporaria, adminUnidade:!!s.adminUnidade
    };
  }
  function readCookieSession(){
    try {
      var raw = sapCookieGet(SESSION_COOKIE);
      return raw ? normalizeSession(JSON.parse(raw)) : null;
    } catch(e) { return null; }
  }
  return {
    get: function() {
      _sapSessionMemory = _sapSessionMemory || readCookieSession();
      return _sapSessionMemory;
    },
    set: function(s) {
      _sapSessionMemory = normalizeSession(s);
      if (_sapSessionMemory) sapCookieSet(SESSION_COOKIE, JSON.stringify(_sapSessionMemory), 86400);
    },
    clear: function() {
      _sapSessionMemory = null;
      sapCookieDelete(SESSION_COOKIE);
    }
  };
})();
function getSession()   { return SessionService.get(); }
function clearSession() { SessionService.clear(); }
function ensureServerSession() {
  if (getSession()) return Promise.resolve(getSession());
  return fetch(API_BASE + '/auth/me', { credentials:'include' })
    .then(function(resp){ if (!resp.ok) return null; return resp.json(); })
    .then(function(res){
      if (!res) return null;
      var role = roleBackendToFront(res.tipoUsuario);
      var sess = { id:apiIdCompat('usr', res.id), apiId:res.id, role:role, nome:res.nome, unidadeId:unidadeIdCompat(res.unidadeId), email:res.email, senhaTemporaria:!!res.senhaTemporaria, adminUnidade:isAdminUnidadeResponse(res) };
      SessionService.set(sess);
      return sess;
    })
    .catch(function(){ return null; });
}
/* ============================================================  API  ============================================================ */
function apiParseResponseText(text) {
  if (!text) return null;
  try { return JSON.parse(text); }
  catch(e) { return { message: text, raw: text }; }
}

function apiExtractErrorMessage(err, status) {
  var msg = '';
  if (err && err.message) msg = err.message;
  if (!msg && err && err.messages) {
    var campos = Object.keys(err.messages);
    if (campos.length) msg = campos.map(function(campo){ return err.messages[campo]; }).join(' | ');
  }
  if (!msg && err && err.error) msg = err.error;
  if (!msg && err && err.raw) msg = err.raw;
  return msg || (status === 401 ? 'Sessão expirada. Entre novamente.' : ('Erro HTTP ' + status));
}

function apiFetch(path, options) {
  options = options || {};
  options.headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
  }
  options.credentials = 'include';

  return fetch(API_BASE + path, options).then(function(resp) {
    return resp.text().then(function(text){
      var data = apiParseResponseText(text);
      if (!resp.ok) {
        if (resp.status === 401) {
          clearSession();
          if (!/\/auth\/(login|me)/.test(path)) {
            setTimeout(function(){ window.location.href = window.location.pathname.indexOf('/pages/') >= 0 ? '../index.html' : 'index.html'; }, 0);
          }
        }
        throw new Error(apiExtractErrorMessage(data, resp.status));
      }
      return data;
    });
  });
}


function isAdminUnidadeResponse(res) {
  return String(res && res.tipoUsuario || '').toUpperCase() === 'ADMIN_UNIDADE'
    || (String(res && res.tipoUsuario || '').toUpperCase() === 'ADMINISTRADOR' && !!(res && res.unidadeId));
}

function roleBackendToFront(tipo) {
  var t = String(tipo || '').toUpperCase();
  if (t === 'ADMINISTRADOR' || t === 'ADMIN_UNIDADE') return 'administrador';
  if (t === 'PSICOLOGO') return 'psicologa';
  if (t === 'COORDENACAO') return 'coordenacao';
  if (t === 'INSTRUTOR') return 'instrutor';
  return '';
}
function roleFrontToBackend(role) {
  if (role === 'admin_unidade') return 'ADMINISTRADOR';
  if (role === 'administrador') return 'ADMINISTRADOR';
  if (role === 'psicologa') return 'PSICOLOGO';
  if (role === 'coordenacao') return 'COORDENACAO';
  if (role === 'instrutor') return 'INSTRUTOR';
  return role;
}
function mapTurnoBackendToFront(turno) {
  var t = String(turno || '').toUpperCase();
  if (t === 'MATUTINO') return 'manhã';
  if (t === 'VESPERTINO') return 'tarde';
  if (t === 'NOTURNO') return 'noite';
  return Validators.normalizeTurno(turno) || 'manhã';
}
function mapTurnoFrontToBackend(turno) {
  var t = Validators.normalizeTurno(turno);
  if (t === 'manhã') return 'MATUTINO';
  if (t === 'tarde') return 'VESPERTINO';
  if (t === 'noite') return 'NOTURNO';
  return 'MATUTINO';
}
function mapStatusBackendToFront(status) {
  var s = String(status || '').toUpperCase();
  if (s === 'PENDENTE') return 'aguardando';
  if (s === 'EM_ANDAMENTO') return 'confirmada';
  if (s === 'FINALIZADO') return 'realizada';
  if (s === 'CANCELADO') return 'cancelada';
  return 'aguardando';
}
function mapStatusFrontToBackend(status) {
  if (status === 'aguardando') return 'PENDENTE';
  if (status === 'confirmada') return 'EM_ANDAMENTO';
  if (status === 'realizada') return 'FINALIZADO';
  if (status === 'cancelada' || status === 'falta') return 'CANCELADO';
  return 'PENDENTE';
}

function localAlunoFromApi(a) {
  var obs = a.observacoes || '';
  var cursoObs = /Curso:\s*([^|]+)/i.exec(obs);
  var turmaObs = /Turma:\s*([^|]+)/i.exec(obs);
  return {
    id: apiIdCompat('al', a.id), apiId:a.id, nome:a.nome, matricula:String(a.id).padStart(6,'0'), cpf:a.cpf || '',
    dataNascimento:a.dataNascimento || '', curso:a.curso || (cursoObs ? cursoObs[1].trim() : ''), turma:a.turma || (turmaObs ? turmaObs[1].trim() : ''), cursoApiId:a.cursoId || null, turmaApiId:a.turmaId || null, turnoCurso:mapTurnoBackendToFront(a.turno),
    telefone:a.telefone || '', email:a.email || '', pcd:false, responsavelCad:a.responsavel || '',
    unidadeId: unidadeIdCompat(a.unidadeId || null), statusCadastro:a.ativo === false ? 'inativo' : 'ativo',
    dataCadastro:a.createdAt || '', observacoes:obs
  };
}
function localAtendimentoFromApi(c, alunos) {
  var data = c.dataAtendimento || '';
  var alunoLocal = (alunos || []).find(function(a){ return a.apiId === c.alunoId; });
  return {
    id: apiIdCompat('c', c.id), apiId:c.id, alunoApiId:c.alunoId || null, idAluno: alunoLocal ? alunoLocal.id : (c.alunoId ? apiIdCompat('al', c.alunoId) : ''), aluno:c.aluno || '', psicologo:c.psicologo || '',
    psicologoApiId:c.psicologoId || null, agendadoPor:c.solicitanteId ? apiIdCompat('usr', c.solicitanteId) : '', solicitante:c.solicitante || '', unidadeId: alunoLocal ? alunoLocal.unidadeId : null,
    motivoSolicitação:c.descricao || c.titulo || '', dataPreferencial:String(data).slice(0,10),
    horarioPreferencial:String(data).slice(11,16), turno:(alunoLocal ? alunoLocal.turnoCurso : 'manhã'),
    tipoAtendimento:c.tipoAtendimento || 'dentro',
    categoriaAtendimento:c.categoriaAtendimento || '',
    obsResponsavel:'', obsPsicologa:c.observacoes || '', relatorioConsulta:c.relatorioConsulta || '', status:mapStatusBackendToFront(c.status), criacao:c.createdAt || ''
  };
}

function localMensagemFromApi(m) {
  return {
    id: apiIdCompat('m', m.id), apiId:m.id,
    de: apiIdCompat('usr', m.remetenteId), para: apiIdCompat('usr', m.destinatarioId),
    unidadeId: unidadeIdCompat(m.unidadeId), texto:m.texto || '', lida:!!m.lida, criacao:m.createdAt || new Date().toISOString()
  };
}
function cursoPayload(c) { return { nome:c.nome||'', tipoAprendizagem:c.tipoAprendizagem||'', descricao:c.descricao||'', unidadeId:apiLongFromCompat(c.unidadeId), ativo:c.ativo!==false }; }
function turmaPayload(t) { return { nome:t.nome||'', turno:mapTurnoFrontToBackend(t.turno), cursoId:apiLongFromCompat(t.cursoId), unidadeId:apiLongFromCompat(t.unidadeId), instrutorId:apiLongFromCompat(t.instrutorId), ativo:t.ativo!==false }; }
function mensagemPayload(m) { return { destinatarioId:apiLongFromCompat(m.para), texto:m.texto||'', unidadeId:apiLongFromCompat(m.unidadeId) }; }

function setStoreFromApi(store) {
  _sapSavingFromApi = true;
  _sapStore = normalizeStore(store);
  hydrateInstrutorTurmas(_sapStore);
  updateSessionFromStore(_sapStore);
  _sapLastPersisted = clone(_sapStore);
  _sapSavingFromApi = false;
  return _sapStore;
}
function hydrateInstrutorTurmas(store) {
  (store.instrutores || []).forEach(function(inst){
    var turmas = (store.turmas || []).filter(function(t){
      return t.instrutorId === inst.id || t.instrutorId === inst.apiId || apiLongFromCompat(t.instrutorId) === inst.apiId;
    });
    inst.turmas = turmas.map(function(t){ return t.nome; }).filter(Boolean);
    inst.turmaIds = turmas.map(function(t){ return t.id; }).filter(Boolean);
  });
}

function aplicarEscopoAdministradorUnidade(store) {
  var sess = getSession && getSession();
  if (!sess || !sess.adminUnidade || !sess.unidadeId) return store;
  var unidadeId = sess.unidadeId;
  var scoped = clone(store);
  scoped.unidades = (scoped.unidades || []).filter(function(u){ return u.id === unidadeId; });
  scoped.cursos = (scoped.cursos || []).filter(function(c){ return c.unidadeId === unidadeId; });
  scoped.turmas = (scoped.turmas || []).filter(function(t){ return t.unidadeId === unidadeId; });
  scoped.alunos = (scoped.alunos || []).filter(function(a){ return a.unidadeId === unidadeId; });
  scoped.atendimentos = (scoped.atendimentos || []).filter(function(a){ return a.unidadeId === unidadeId; });
  scoped.psicologos = (scoped.psicologos || []).filter(function(u){ return u.unidadeId === unidadeId; });
  scoped.coordenadores = (scoped.coordenadores || []).filter(function(u){ return u.unidadeId === unidadeId; });
  scoped.instrutores = (scoped.instrutores || []).filter(function(u){ return u.unidadeId === unidadeId; });
  scoped.administradores = (scoped.administradores || []).filter(function(u){ return u.id === sess.id || u.unidadeId === unidadeId; });
  return scoped;
}

function updateSessionFromStore(store) {
  var sess = getSession && getSession();
  if (!sess) return;
  var all = allUsuarios ? allUsuarios(store) : [];
  var usuario = all.find(function(u){ return u.id === sess.id || u.apiId === sess.apiId; });
  if (!usuario) return;
  var next = Object.assign({}, sess, {
    nome: usuario.nome || sess.nome,
    unidadeId: usuario.unidadeId || sess.unidadeId,
    email: usuario.email || sess.email,
    turmas: usuario.turmas || sess.turmas || [],
    turmaIds: usuario.turmaIds || sess.turmaIds || [],
    disciplina: usuario.disciplina || sess.disciplina || null,
    crp: usuario.crp || sess.crp || null,
    setor: usuario.setor || sess.setor || null
  });
  SessionService.set(next);
}

function syncStoreFromApi() {
  _sapSyncPromise = Promise.all([
    apiFetch('/unidades'),
    apiFetch('/usuarios'),
    apiFetch('/alunos'),
    apiFetch('/atendimentos'),
    apiFetch('/cursos'),
    apiFetch('/turmas'),
    apiFetch('/chat/mensagens').catch(function(){ return []; })
  ]).then(function(results) {
    var unidades = results[0] || [];
    var usuarios = results[1] || [];
    var alunosApi = results[2] || [];
    var atendimentosApi = results[3] || [];
    var cursosApi = results[4] || [];
    var turmasApi = results[5] || [];
    var mensagensApi = results[6] || [];

    var atual = clone(SEED);
    atual.mensagens = mensagensApi.length ? mensagensApi.map(localMensagemFromApi) : ((_sapStore && _sapStore.mensagens) || []);

    atual.unidades = unidades.map(function(u){
      return { id: unidadeIdCompat(u.id), apiId:u.id, nome:u.nome, regiao:u.endereco || 'SENAC DF', telefone:u.telefone || '' };
    });

    usuarios.forEach(function(u){
      var role = roleBackendToFront(u.tipoUsuario);
      var unidadeId = unidadeIdCompat(u.unidade && u.unidade.id ? u.unidade.id : u.unidadeId);
      var base = {
        id: apiIdCompat('usr', u.id), apiId:u.id, usuario:u.usuario || u.email, email:u.email, senha:'',
        nome:u.nome, unidadeId: unidadeId, role:role, tipoBackend:(String(u.tipoUsuario||'').toUpperCase()==='ADMINISTRADOR' && unidadeId ? 'ADMIN_UNIDADE' : String(u.tipoUsuario||''))
      };
      if (role === 'administrador') atual.administradores.push(base);
      if (role === 'psicologa') atual.psicologos.push(Object.assign(base, {crp:''}));
      if (role === 'coordenacao') atual.coordenadores.push(Object.assign(base, {setor:''}));
      if (role === 'instrutor') atual.instrutores.push(Object.assign(base, {disciplina:'', turmas:[]}));
    });

    atual.cursos = cursosApi.map(function(c){ return {id:apiIdCompat('cur', c.id), apiId:c.id, nome:c.nome, tipoAprendizagem:c.tipoAprendizagem||'', descricao:c.descricao||'', unidadeId:unidadeIdCompat(c.unidadeId), ativo:c.ativo!==false}; });
    atual.turmas = turmasApi.map(function(t){ return {id:apiIdCompat('tur', t.id), apiId:t.id, nome:t.nome, cursoId:apiIdCompat('cur', t.cursoId), curso:t.curso||'', unidadeId:unidadeIdCompat(t.unidadeId), instrutorId:t.instrutorId?apiIdCompat('usr', t.instrutorId):null, turno:mapTurnoBackendToFront(t.turno), ativo:t.ativo!==false}; });
    atual.alunos = alunosApi.map(localAlunoFromApi).map(function(a){ a.curso = alunoCursoNome(a, atual); a.turma = alunoTurmaNome(a, atual); return a; });
    atual.atendimentos = atendimentosApi.map(function(c){ return localAtendimentoFromApi(c, atual.alunos); });

    atual = aplicarEscopoAdministradorUnidade(atual);
    setStoreFromApi(atual);
    if (typeof window.SAP_ON_STORE_SYNC === 'function') window.SAP_ON_STORE_SYNC(_sapStore);
    setTimeout(refreshActivePanel, 0);
    return _sapStore;
  }).catch(function(e){
    console.warn('Não foi possível carregar dados do banco:', e.message || e);
    if (typeof toast === 'function' && getSession()) toast('Não consegui carregar o banco. Verifique se o backend está rodando.', 'error');
    return _sapStore;
  });
  return _sapSyncPromise;
}

function refreshAfterSync() {
  return syncStoreFromApi().then(function(){
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderHome === 'function') renderHome();
    if (typeof renderUsuarios === 'function') renderUsuarios();
    if (typeof renderUnidades === 'function') renderUnidades();
    if (typeof renderAlunos === 'function') renderAlunos();
    if (typeof renderAtendimentos === 'function') renderAtendimentos();
    if (typeof renderCursos === 'function') renderCursos();
    if (typeof renderTurmas === 'function') renderTurmas();
    if (typeof renderChat === 'function') renderChat();
    if (typeof updateBadge === 'function') updateBadge();
  });
}

function initStore() {
  _sapStore = normalizeStore(_sapStore || SEED);
  var sess = getSession();
  if (sess) {
    syncStoreFromApi();
  } else {
    _sapSyncPromise = ensureServerSession().then(function(serverSess){
      if (serverSess) return syncStoreFromApi();
      return apiFetch('/unidades');
    }).then(function(unidades){
      if (Array.isArray(unidades) === false) return _sapStore;
      var atual = clone(SEED);
      atual.unidades = (unidades || []).map(function(u){
        return { id: unidadeIdCompat(u.id), apiId:u.id, nome:u.nome, regiao:u.endereco || 'SENAC DF', telefone:u.telefone || '' };
      });
      atual = aplicarEscopoAdministradorUnidade(atual);
    setStoreFromApi(atual);
      return _sapStore;
    }).catch(function(){ return _sapStore; });
  }
  return _sapSyncPromise;
}
function getStore() { return _sapStore = normalizeStore(_sapStore); }
function resetStore() { setStoreFromApi(SEED); }
function getAluno(id) { return getStore().alunos.find(function(a){ return a.id===id; })||null; }

function unidadePayload(u) {
  return { nome:u.nome || '', endereco:u.regiao || u.endereco || 'SENAC DF', telefone:u.telefone || '(61) 0000-0000' };
}
function alunoPayload(a) {
  return {
    nome:a.nome || '', cpf:a.cpf || '', dataNascimento:a.dataNascimento || '', telefone:a.telefone || '',
    email:a.email || '', responsavel:a.responsavelCad || a.responsavel || 'Não informado',
    turno:mapTurnoFrontToBackend(a.turnoCurso || a.turno),
    observacoes:a.observacoes || ('Curso: '+(a.curso||'')+' | Turma: '+(a.turma||'')+' | Matrícula: '+(a.matricula||'')),
    unidadeId:apiLongFromCompat(a.unidadeId),
    cursoId:a.cursoApiId || apiLongFromCompat(a.cursoId),
    turmaId:a.turmaApiId || apiLongFromCompat(a.turmaId)
  };
}
function atendimentoPayload(c) {
  var alunoId = c.alunoApiId || apiLongFromCompat(c.idAluno);
  var aluno = getStore().alunos.find(function(a){ return a.id === c.idAluno; });
  if (aluno && aluno.apiId) alunoId = aluno.apiId;
  // O profissional responsável só deve ser definido quando um psicólogo aceitar/confirmar o atendimento.
  // Nunca usar o solicitante como psicólogo.
  var psicologoId = c.psicologoApiId || apiLongFromCompat(c.psicologoId);
  return {
    titulo:c.titulo || 'Atendimento SAP',
    descricao:c.motivoSolicitação || c.descricao || 'Atendimento solicitado pelo SAP',
    dataAtendimento:(c.dataPreferencial || new Date().toISOString().slice(0,10)) + 'T' + (c.horarioPreferencial || '08:00') + ':00',
    observacoes:c.obsPsicologa || c.obsResponsavel || '',
    relatorioConsulta:c.relatorioConsulta || '',
    tipoAtendimento:c.tipoAtendimento || 'dentro',
    categoriaAtendimento:c.categoriaAtendimento || '',
    alunoId:alunoId,
    psicologoId:psicologoId,
    solicitanteId:apiLongFromCompat(c.agendadoPor) || apiLongFromCompat((typeof _sess !== 'undefined' && _sess) ? _sess.id : null)
  };
}
function usuarioPayload(u) {
  var payload = {
    nome:u.nome || '', email:u.email || (u.usuario + '@sap.local'), usuario:u.usuario || u.email,
    tipoUsuario:roleFrontToBackend(u.role), unidadeId:apiLongFromCompat(u.unidadeId)
  };
  if (u.senha) payload.senha = u.senha;
  return payload;
}
function allUsuarios(store) {
  return (store.administradores||[]).concat(store.psicologos||[], store.coordenadores||[], store.instrutores||[]);
}

function persistChanges(prev, next) {
  var tasks = [];

  (next.unidades||[]).forEach(function(u){
    if (!u.apiId) tasks.push(apiFetch('/unidades', {method:'POST', body:JSON.stringify(unidadePayload(u))}));
    else {
      var old = (prev.unidades||[]).find(function(x){ return x.apiId === u.apiId; });
      if (old && !sameJson(unidadePayload(old), unidadePayload(u))) tasks.push(apiFetch('/unidades/'+u.apiId, {method:'PUT', body:JSON.stringify(unidadePayload(u))}));
    }
  });
  (prev.unidades||[]).forEach(function(u){
    if (u.apiId && !(next.unidades||[]).some(function(x){ return x.apiId === u.apiId; })) tasks.push(apiFetch('/unidades/'+u.apiId, {method:'DELETE'}));
  });

  (next.cursos||[]).forEach(function(c){
    if (!c.apiId) tasks.push(apiFetch('/cursos', {method:'POST', body:JSON.stringify(cursoPayload(c))}));
    else { var oldC=(prev.cursos||[]).find(function(x){return x.apiId===c.apiId;}); if (oldC && !sameJson(cursoPayload(oldC), cursoPayload(c))) tasks.push(apiFetch('/cursos/'+c.apiId, {method:'PUT', body:JSON.stringify(cursoPayload(c))})); }
  });
  (prev.cursos||[]).forEach(function(c){ if (c.apiId && !(next.cursos||[]).some(function(x){return x.apiId===c.apiId;})) tasks.push(apiFetch('/cursos/'+c.apiId, {method:'DELETE'})); });

  (next.turmas||[]).forEach(function(t){
    if (!t.apiId) tasks.push(apiFetch('/turmas', {method:'POST', body:JSON.stringify(turmaPayload(t))}));
    else { var oldT=(prev.turmas||[]).find(function(x){return x.apiId===t.apiId;}); if (oldT && !sameJson(turmaPayload(oldT), turmaPayload(t))) tasks.push(apiFetch('/turmas/'+t.apiId, {method:'PUT', body:JSON.stringify(turmaPayload(t))})); }
  });
  (prev.turmas||[]).forEach(function(t){ if (t.apiId && !(next.turmas||[]).some(function(x){return x.apiId===t.apiId;})) tasks.push(apiFetch('/turmas/'+t.apiId, {method:'DELETE'})); });

  allUsuarios(next).forEach(function(u){
    if (!u.apiId) tasks.push(apiFetch('/auth/register', {method:'POST', body:JSON.stringify(usuarioPayload(u))}));
    else {
      var oldU = allUsuarios(prev).find(function(x){ return x.apiId === u.apiId; });
      if (oldU && !sameJson(usuarioPayload(oldU), usuarioPayload(u))) {
        tasks.push(apiFetch('/usuarios/'+u.apiId, {method:'PUT', body:JSON.stringify(usuarioPayload(u))}));
      }
    }
  });
  allUsuarios(prev).forEach(function(u){
    if (u.apiId && !allUsuarios(next).some(function(x){ return x.apiId === u.apiId; })) {
      tasks.push(apiFetch('/usuarios/'+u.apiId, {method:'DELETE'}));
    }
  });

  (next.alunos||[]).forEach(function(a){
    if (!a.apiId) tasks.push(apiFetch('/alunos', {method:'POST', body:JSON.stringify(alunoPayload(a))}));
    else {
      var oldA = (prev.alunos||[]).find(function(x){ return x.apiId === a.apiId; });
      if (oldA && !sameJson(alunoPayload(oldA), alunoPayload(a))) tasks.push(apiFetch('/alunos/'+a.apiId, {method:'PUT', body:JSON.stringify(alunoPayload(a))}));
    }
  });
  (prev.alunos||[]).forEach(function(a){
    if (a.apiId && !(next.alunos||[]).some(function(x){ return x.apiId === a.apiId; })) tasks.push(apiFetch('/alunos/'+a.apiId, {method:'DELETE'}));
  });

  (next.atendimentos||[]).forEach(function(c){
    if (!c.apiId) {
      var payload = atendimentoPayload(c);
      if (payload.alunoId) {
        var criarAtendimento = apiFetch('/atendimentos', {method:'POST', body:JSON.stringify(payload)});
        // Quando a psicóloga cria o atendimento diretamente, ele já deve nascer assumido/confirmado.
        // O backend cria primeiro como PENDENTE; por isso, se o frontend marcou outro status,
        // encadeamos a atualização de status logo após receber o ID criado no banco.
        if (c.status && c.status !== 'aguardando') {
          criarAtendimento = criarAtendimento.then(function(criado){
            if (!criado || !criado.id) return criado;
            return apiFetch('/atendimentos/'+criado.id+'/status', {
              method:'PATCH',
              body:JSON.stringify({status:mapStatusFrontToBackend(c.status)})
            });
          });
        }
        tasks.push(criarAtendimento);
      } else {
        tasks.push(Promise.reject(new Error('Atendimento não salvo: selecione um aluno válido.')));
      }
      return;
    }
    var oldC = (prev.atendimentos||[]).find(function(x){ return x.apiId === c.apiId; });
    if (!oldC) return;
    var payloadMudou = !sameJson(atendimentoPayload(oldC), atendimentoPayload(c));
    var statusMudou = oldC.status !== c.status;
    if (payloadMudou || statusMudou) {
      var fluxoAtendimento = Promise.resolve();
      // Primeiro salva data/horário/profissional. Depois altera o status.
      // Isso evita erro de validação quando o status é confirmado antes do novo horário chegar ao backend.
      if (payloadMudou) {
        fluxoAtendimento = fluxoAtendimento.then(function(){
          return apiFetch('/atendimentos/'+c.apiId, {method:'PUT', body:JSON.stringify(atendimentoPayload(c))});
        });
      }
      if (statusMudou) {
        fluxoAtendimento = fluxoAtendimento.then(function(){
          return apiFetch('/atendimentos/'+c.apiId+'/status', {method:'PATCH', body:JSON.stringify({status:mapStatusFrontToBackend(c.status)})});
        });
      }
      tasks.push(fluxoAtendimento);
    }
  });

  (next.mensagens||[]).forEach(function(m){
    if (!m.apiId && m.para && m.texto) tasks.push(apiFetch('/chat/mensagens', {method:'POST', body:JSON.stringify(mensagemPayload(m))}));
  });

  if (!tasks.length) {
    _sapLastPersisted = clone(next);
    return Promise.resolve(next);
  }
  return Promise.allSettled(tasks).then(function(results){
    var fails = results.filter(function(r){ return r.status === 'rejected'; });
    if (fails.length) {
      console.error('Falha ao sincronizar com banco:', fails);
      var msg = fails.map(function(f){ return f.reason && f.reason.message ? f.reason.message : 'Falha desconhecida ao salvar.'; }).join(' | ');
      throw new Error(msg || 'Alguma alteração não foi salva no banco.');
    }
    return refreshAfterSync();
  });
}

function saveStore(d) {
  var prev = clone(_sapLastPersisted || _sapStore || SEED);
  var next = normalizeStore(clone(d));
  _sapStore = next;
  if (_sapSavingFromApi) return Promise.resolve(_sapStore);
  return persistChanges(prev, next).catch(function(err){
    _sapStore = normalizeStore(prev);
    if (typeof window.SAP_ON_STORE_SYNC === 'function') window.SAP_ON_STORE_SYNC(_sapStore);
    setTimeout(refreshActivePanel, 0);
    throw err;
  });
}

function saveStoreOrToast(d, successMessage) {
  return saveStore(d).then(function(res){
    if (successMessage && typeof toast === 'function') toast(successMessage, 'success');
    return res;
  }).catch(function(err){
    var msg = err && err.message ? err.message : 'Não foi possível salvar no banco. Confira os dados e tente novamente.';
    if (typeof toast === 'function') toast(msg, 'error');
    throw err;
  });
}

/* ============================================================  AUTH  ============================================================ */
function login(role, usuario, senha, unidadeId) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: usuario, senha: senha })
  }).then(function(res) {
    var roleApi = roleBackendToFront(res.tipoUsuario);
    if (roleApi && roleApi !== role) return {ok:false, msg:'Este usuário existe, mas pertence ao perfil '+roleApi+'. Entre pelo card correto.'};

    var unidadeCompat = unidadeIdCompat(res.unidadeId);
    if (unidadeId && unidadeCompat !== unidadeId) return {ok:false, msg:'Acesso negado: este usuário não pertence à unidade selecionada.'};

    SessionService.set({
      id: apiIdCompat('usr', res.id), apiId:res.id, role:role, nome:res.nome, unidadeId:unidadeCompat,
      email:res.email, crp:null, setor:null, disciplina:null, turmas:[], senhaTemporaria:!!res.senhaTemporaria, adminUnidade:isAdminUnidadeResponse(res)
    });
    return syncStoreFromApi().then(function(){ return {ok:true, senhaTemporaria:!!res.senhaTemporaria}; });
  }).catch(function(e) {
    return {ok:false, msg:e.message || 'Usuário ou senha incorretos. Verifique se o backend e o MySQL estão rodando.'};
  });
}
function logout() {
  apiFetch('/auth/logout', {method:'POST'}).catch(function(){}).finally(function(){
    clearSession();
    window.location.href='../index.html';
  });
}

/* ============================================================  PERMISSIONS  ============================================================ */
var Permissions = (function () {
  function getPsicologa(store, unidadeId) { return store.psicologos.find(function(p){ return p.unidadeId===unidadeId; }) || store.psicologos[0]; }
  function getUsuariosUnidade(store, unidadeId) {
    var lista = [];
    store.psicologos.forEach(function(u){ if(u.unidadeId===unidadeId) lista.push(u); });
    store.instrutores.forEach(function(u){ if(u.unidadeId===unidadeId) lista.push(u); });
    store.coordenadores.forEach(function(u){ if(u.unidadeId===unidadeId) lista.push(u); });
    return lista;
  }
  function getAlunosVisiveis(sess, alunos) {
    if (!sess) return [];
    var lista = (alunos || []).filter(function(a){ return a.unidadeId===sess.unidadeId && a.statusCadastro==='ativo'; });
    if (sess.role==='instrutor') {
      var store = getStore();
      var nomes = Array.isArray(sess.turmas) ? sess.turmas : [];
      var ids = Array.isArray(sess.turmaIds) ? sess.turmaIds : [];
      if (!nomes.length && !ids.length) {
        var minhas = (store.turmas || []).filter(function(t){
          return t.instrutorId === sess.id || t.instrutorId === sess.apiId || apiLongFromCompat(t.instrutorId) === sess.apiId;
        });
        nomes = minhas.map(function(t){ return t.nome; });
        ids = minhas.map(function(t){ return t.id; });
      }
      lista = lista.filter(function(a){
        var turmaNome = alunoTurmaNome(a, store);
        var turmaId = a.turmaId || (a.turmaApiId ? apiIdCompat('tur', a.turmaApiId) : null);
        return (nomes.length && nomes.indexOf(turmaNome) >= 0) || (ids.length && ids.indexOf(turmaId) >= 0);
      });
    }
    return lista;
  }
  function getAtendimentosVisiveis(sess, atendimentos, alunos) {
    var uc = atendimentos.filter(function(c){ return c.unidadeId===sess.unidadeId; });
    if (sess.role==='psicologa'||sess.role==='coordenacao'||sess.role==='administrador') return uc;
    if (sess.role==='instrutor') {
      var ids = getAlunosVisiveis(sess, alunos).map(function(a){ return a.id; });
      return uc.filter(function(c){ return ids.indexOf(c.idAluno)>=0; });
    }
    return [];
  }
  function podeEncaminharAluno(sess, aluno) {
    if (!sess||!aluno) return false;
    if (aluno.unidadeId!==sess.unidadeId) return false;
    if (sess.role==='coordenacao') return true;
    if (sess.role==='instrutor') { return getAlunosVisiveis(sess, [aluno]).length === 1; }
    return false;
  }
  return { getAlunosVisiveis:getAlunosVisiveis, getAtendimentosVisiveis:getAtendimentosVisiveis, podeEncaminharAluno:podeEncaminharAluno, getPsicologa:getPsicologa, getUsuariosUnidade:getUsuariosUnidade };
})();

/* ============================================================  FORMATTERS / UI  ============================================================ */
function fmtDate(iso) {
  if(!iso) return '—';
  var texto = String(iso).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  var d=Validators.data(texto.slice(0,10));
  return d?d.toLocaleDateString('pt-BR'):'—';
}
function fmtDatetime(iso) {
  if(!iso) return '—';
  var texto = String(iso).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(texto);
  if (m) return m[3] + '/' + m[2] + '/' + m[1] + ' às ' + m[4] + ':' + m[5];
  try { var d=new Date(iso); if(isNaN(d.getTime())) return '—'; return d.toLocaleDateString('pt-BR')+' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(e) { return '—'; }
}
function calcIdade(dn) { if(!dn) return null; var h=new Date(),n=new Date(dn+'T12:00:00'); if(isNaN(n.getTime())) return null; var i=h.getFullYear()-n.getFullYear(),m=h.getMonth()-n.getMonth(); if(m<0||(m===0&&h.getDate()<n.getDate())) i--; return i; }
function isMenor(dn) { var i=calcIdade(dn); return i!==null&&i<18; }
function turnoLabel(t) { var n=Validators.normalizeTurno(t); if(!n) return '—'; return n.charAt(0).toUpperCase()+n.slice(1); }
function nomeUnidade(id) { var u=getStore().unidades.find(function(x){ return x.id===id; }); return u?u.nome:(id||'—'); }
function nomeResponsavel(id) {
  if(!id) return '—'; var s=getStore();
  var p=s.psicologos.find(function(x){ return x.id===id; }); if(p) return 'Psic. '+p.nome;
  var i=s.instrutores.find(function(x){ return x.id===id; }); if(i) return 'Instr. '+i.nome;
  var c=s.coordenadores.find(function(x){ return x.id===id; }); if(c) return 'Coord. '+c.nome;
  var a=s.administradores.find(function(x){ return x.id===id; }); if(a) return 'Admin. '+a.nome;
  return id;
}
function solicitanteNome(c) {
  if (!c) return '—';
  if (c.solicitante) return c.solicitante;
  return nomeResponsavel(c.agendadoPor);
}
function profissionalAtendimentoNome(c) {
  if (!c) return '—';
  if (c.status === 'aguardando') return 'Aguardando aceite';
  if (c.psicologo) return c.psicologo;
  if (c.psicologoApiId) return nomeResponsavel(apiIdCompat('usr', c.psicologoApiId));
  if (c.psicologoId) return nomeResponsavel(c.psicologoId);
  return '—';
}
function genId(p) { return (p||'x')+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function turnoHoraConfig(t) { t=Validators.normalizeTurno(t); if(t==='manhã') return {inicio:'08:00',fim:'11:59'}; if(t==='tarde') return {inicio:'13:00',fim:'17:59'}; if(t==='noite') return {inicio:'18:00',fim:'21:59'}; return null; }
function horarioDentroDoTurno(h,t) { if(!h) return true; var c=turnoHoraConfig(t); if(!c) return true; return h>=c.inicio&&h<=c.fim; }
function getCompatibilidadeAtendimento(aluno, turnoAtendimento, horaAtendimento) {
  var tc=Validators.normalizeTurno(aluno&&aluno.turnoCurso), t=Validators.normalizeTurno(turnoAtendimento);
  if(!tc) return {ok:true,motivo:''};
  if(!t) return {ok:false,motivo:'Selecione o turno do atendimento.'};
  if(t!==tc) return {ok:false,motivo:'O atendimento deve ocorrer no turno do curso do aluno ('+turnoLabel(tc)+').'};
  if(horaAtendimento&&!horarioDentroDoTurno(horaAtendimento,tc)){ var f=turnoHoraConfig(tc); return {ok:false,motivo:'Horário fora do turno ('+f.inicio+' às '+f.fim+').'}; }
  return {ok:true,motivo:''};
}
function descricaoDisponibilidadeAluno(aluno) { if(!aluno) return 'Selecione um aluno para ver o turno compatível.'; var tc=Validators.normalizeTurno(aluno.turnoCurso); if(!tc) return 'O aluno não tem turno de curso cadastrado.'; var f=turnoHoraConfig(tc); return 'Curso no turno da '+turnoLabel(tc).toLowerCase()+(f?' ('+f.inicio+' às '+f.fim+').':'.'); }
var STATUS_MAP = { aguardando:{cls:'badge-wait',label:'Aguardando'}, confirmada:{cls:'badge-ok',label:'Confirmada'}, realizada:{cls:'badge-done',label:'Realizada'}, cancelada:{cls:'badge-cancel',label:'Cancelada'}, falta:{cls:'badge-miss',label:'Não compareceu'} };
function statusBadge(s) { var m=STATUS_MAP[s]||{cls:'',label:s||'—'}; return '<span class="badge '+m.cls+'"><span class="badge-dot"></span>'+m.label+'</span>'; }
function toast(msg, type) { type=type||'success'; var c=document.getElementById('toast-container'); if(!c){c=document.createElement('div');c.id='toast-container';document.body.appendChild(c);} var el=document.createElement('div'); el.className='toast '+type; var sp=document.createElement('span'); sp.textContent=msg; el.appendChild(sp); c.appendChild(el); setTimeout(function(){el.style.opacity='0';},2800); setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},3200); }
function openModal(id)  { var el=document.getElementById(id); if(el) el.classList.add('open'); }
function closeModal(id) { var el=document.getElementById(id); if(el) el.classList.remove('open'); }
function escape(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function mCPF(el) { var v=el.value.replace(/\D/g,'').slice(0,11); if(v.length>9)v=v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4'); else if(v.length>6)v=v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3'); else if(v.length>3)v=v.replace(/(\d{3})(\d{0,3})/,'$1.$2'); el.value=v; }
function mTel(el) { var v=el.value.replace(/\D/g,'').slice(0,11); if(v.length>10)v=v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'); else if(v.length>6)v=v.replace(/(\d{2})(\d{4,5})(\d{0,4})/,'($1) $2-$3'); else if(v.length>2)v=v.replace(/(\d{2})(\d{0,5})/,'($1) $2'); el.value=v; }

window.afterStoreReady = afterStoreReady;
window.refreshActivePanel = refreshActivePanel;

/* Dashboard: distribuição por faixa etária.
   Gráfico horizontal simples: mostra claramente a faixa etária e quantos alunos existem em cada faixa. */
function renderAgeDistributionChart(alunos, canvasId) {
  var canvas = document.getElementById(canvasId || 'chart-linha');
  if (!canvas || !canvas.getContext) return;

  var lista = (alunos || []).filter(function(a){ return a && a.statusCadastro !== 'inativo'; });
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var computed = window.getComputedStyle ? getComputedStyle(canvas) : null;
  var cssW = Math.round(rect.width || canvas.offsetWidth || 560);
  var cssH = Math.round((rect.height || (computed ? parseFloat(computed.height) : 0) || canvas.offsetHeight || 310));
  // Importante: o tamanho interno do canvas deve bater com o tamanho exibido na tela.
  // Se CSS força 320px e o desenho usa 310px, o navegador estica e o gráfico fica embaçado.
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  var root = getComputedStyle(document.documentElement);
  function cssVar(name, fallback) {
    return (root.getPropertyValue(name) || fallback).trim() || fallback;
  }

  var surface = cssVar('--surface', '#ffffff');
  var ink = cssVar('--ink', '#0f172a');
  var muted = cssVar('--ink-mid', '#64748b');
  var soft = cssVar('--gray-50', '#f8fafc');
  var border = 'rgba(148,163,184,0.22)';
  var blue = cssVar('--senac-blue', '#2d7ff9');
  var orange = cssVar('--senac-orange', '#f2a900');
  var green = '#10b981';
  var purple = '#8b5cf6';
  var red = '#ef4444';
  var palette = [blue, purple, green, orange, red];

  var faixas = [
    { label:'Até 17 anos', curto:'≤ 17', min:0, max:17, total:0 },
    { label:'18 a 21 anos', curto:'18–21', min:18, max:21, total:0 },
    { label:'22 a 25 anos', curto:'22–25', min:22, max:25, total:0 },
    { label:'26 a 29 anos', curto:'26–29', min:26, max:29, total:0 },
    { label:'30 anos ou mais', curto:'30+', min:30, max:200, total:0 }
  ];

  var idadesValidas = [];
  lista.forEach(function(a){
    var idade = calcIdade(a.dataNascimento);
    if (idade === null || isNaN(idade)) return;
    idadesValidas.push(idade);
    var faixa = faixas.find(function(f){ return idade >= f.min && idade <= f.max; });
    if (faixa) faixa.total += 1;
  });

  function roundRect(x, y, w, h, r, fill, stroke) {
    if (w <= 0 || h <= 0) return;
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  if (!idadesValidas.length) {
    ctx.fillStyle = soft;
    roundRect(16, 24, cssW-32, cssH-48, 18, true, false);
    ctx.strokeStyle = border;
    roundRect(16, 24, cssW-32, cssH-48, 18, false, true);
    ctx.fillStyle = muted;
    ctx.font = '700 14px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Nenhum dado de idade cadastrado', cssW/2, cssH/2);
    return;
  }

  var total = idadesValidas.length;
  var max = Math.max.apply(null, faixas.map(function(f){ return f.total; })) || 1;
  var media = idadesValidas.reduce(function(s,n){ return s+n; },0) / total;

  /* Cabeçalho simples */
  ctx.fillStyle = ink;
  ctx.font = '800 15px "DM Sans", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Faixa etária dos alunos', 18, 26);

  ctx.fillStyle = muted;
  ctx.font = '700 11px "DM Sans", Arial, sans-serif';
  ctx.fillText('Quantidade de alunos por grupo de idade', 18, 45);

  ctx.textAlign = 'right';
  ctx.fillText('Total: ' + total + ' alunos • Média: ' + media.toFixed(1).replace('.', ',') + ' anos', cssW - 18, 45);

  /* Gráfico horizontal */
  var left = 18;
  var right = 18;
  var labelW = Math.min(132, Math.max(94, cssW * 0.22));
  var countW = 72;
  var barX = left + labelW;
  var barW = cssW - left - right - labelW - countW;
  var rowH = 42;
  var gap = 8;
  var startY = 70;

  ctx.font = '800 10px "DM Sans", Arial, sans-serif';
  ctx.fillStyle = muted;
  ctx.textAlign = 'left';
  ctx.fillText('FAIXA', left, startY - 10);
  ctx.fillText('ALUNOS', barX + barW + 18, startY - 10);

  faixas.forEach(function(f, i){
    var y = startY + i*(rowH + gap);
    var color = palette[i % palette.length];
    var pct = total ? Math.round((f.total / total) * 100) : 0;
    var filled = Math.max(f.total ? 10 : 0, barW * (f.total / max));

    /* linha de fundo */
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148,163,184,0.07)' : 'rgba(148,163,184,0.035)';
    roundRect(left - 2, y - 9, cssW - left - right + 4, rowH, 13, true, false);

    /* label da faixa */
    ctx.fillStyle = ink;
    ctx.font = '800 13px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(f.label, left, y + 15);

    /* trilho da barra */
    ctx.fillStyle = 'rgba(148,163,184,0.16)';
    roundRect(barX, y + 1, barW, 16, 8, true, false);

    /* barra preenchida */
    var grad = ctx.createLinearGradient(barX, y, barX + filled, y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + 'cc');
    ctx.fillStyle = grad;
    roundRect(barX, y + 1, filled, 16, 8, true, false);

    /* porcentagem dentro/ao lado da barra */
    ctx.fillStyle = muted;
    ctx.font = '700 10px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pct + '%', barX, y + 33);

    /* quantidade bem visível */
    ctx.fillStyle = ink;
    ctx.font = '900 18px "DM Sans", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(f.total), cssW - right, y + 15);

    ctx.fillStyle = muted;
    ctx.font = '700 10px "DM Sans", Arial, sans-serif';
    ctx.fillText(f.total === 1 ? 'aluno' : 'alunos', cssW - right, y + 30);
  });
}
