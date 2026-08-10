'use strict';
initStore();

var _sess = getSession();
if (!_sess || _sess.role !== 'psicologa') { clearSession(); window.location.href = '../index.html'; }

document.getElementById('sb-nome').textContent   = _sess.nome || 'Psicóloga';
document.getElementById('sb-avatar').textContent = (_sess.nome || 'P').charAt(0);
document.getElementById('wb-nome').textContent   = 'Olá, ' + (_sess.nome || 'Psicóloga').split(' ')[0] + '!';
/* Mostra unidade no topbar */
(function(){
  var unNome = nomeUnidade(_sess.unidadeId);
  var el = document.getElementById('topbar-unidade');
  if (el) el.textContent = 'SAP · Psicólogo(a) · ' + unNome;
})();

var _atendimentoSel = null;
var _tabPac = 'todos';
var _cursoPacFiltro = 'todos';
var _chatPara = null;
var _indAnoSelecionado = new Date().getFullYear();
var _indMesSelecionado = 'todos';

function tipoAtendimentoLabel(tipo) {
  var t = String(tipo || '').toLowerCase();
  if (t === 'remoto') return 'Atendimento remoto';
  if (t === 'fora') return 'Fora do horário do curso';
  return 'Dentro do horário do curso';
}
function tipoAtendimentoBadge(tipo) {
  var t = String(tipo || '').toLowerCase();
  if (t === 'remoto') return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:#dbeafe;color:#1d4ed8;padding:4px 9px;border-radius:999px;border:1px solid #93c5fd">📱 Remoto</span>';
  if (t === 'fora') return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:#fef3dc;color:#c87f00;padding:4px 9px;border-radius:999px;border:1px solid #f5c518">⚠️ Fora do horário</span>';
  return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:#e8f8ef;color:#166534;padding:4px 9px;border-radius:999px;border:1px solid #86efac">✅ Dentro do horário</span>';
}
function tipoAtendimentoSelectOptions(tipoAtual) {
  var atual = String(tipoAtual || 'dentro').toLowerCase();
  var opts = [
    ['dentro', 'Dentro do horário do curso'],
    ['fora', 'Fora do horário do curso'],
    ['remoto', 'Atendimento remoto']
  ];
  return opts.map(function(o){ return '<option value="'+o[0]+'"'+(atual===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('');
}
function tipoAtendimentoSelecionadoModal() {
  var el = document.getElementById('mc-tipo-atendimento');
  return el ? (el.value || 'dentro') : 'dentro';
}


var CATEGORIAS_ATENDIMENTO = [
  {value:'atendimento_online', label:'Atendimento online', color:'#2d7ff9'},
  {value:'atendimento_presencial', label:'Atendimento presencial', color:'#10b981'},
  {value:'atendimento_familia', label:'Atendimento família', color:'#f97316'},
  {value:'acompanhamento_do_aluno', label:'Acompanhamento do Aluno', color:'#8b5cf6'},
  {value:'dinamica_de_grupo', label:'Dinâmica de Grupo', color:'#ec4899'},
  {value:'saida_campo_oficinas_palestras', label:'Saída de Campo/Oficinas e Palestras', color:'#f59e0b'},
  {value:'outros_atendimentos', label:'Outros atendimentos', color:'#94a3b8'}
];
function categoriaAtendimentoLabel(valor) {
  var item = CATEGORIAS_ATENDIMENTO.find(function(x){ return x.value === String(valor || ''); });
  return item ? item.label : 'Não classificado';
}
function categoriaAtendimentoSelectOptions(valorAtual) {
  var atual = String(valorAtual || '');
  return '<option value="">Selecione o tipo realizado...</option>'
    + CATEGORIAS_ATENDIMENTO.map(function(item){
      return '<option value="' + item.value + '"' + (atual === item.value ? ' selected' : '') + '>' + item.label + '</option>';
    }).join('');
}
function categoriaAtendimentoSelecionadaModal() {
  var el = document.getElementById('mc-categoria-atendimento');
  return el ? (el.value || '') : '';
}
function categoriaAtendimentoBadge(valor) {
  var item = CATEGORIAS_ATENDIMENTO.find(function(x){ return x.value === String(valor || ''); });
  if (!item) return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:var(--gray-50);color:var(--gray-500);padding:4px 9px;border-radius:999px;border:1px solid var(--gray-100)">Não classificado</span>';
  return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:var(--gray-50);color:var(--senac-navy);padding:4px 9px;border-radius:999px;border:1px solid var(--gray-100)"><span style="width:8px;height:8px;border-radius:999px;background:' + item.color + ';display:inline-block"></span>' + escape(item.label) + '</span>';
}

function validarTipoHorarioPsicologo(aluno, tipoAtendimento, turnoAtendimento, horaAtendimento) {
  var tipo = String(tipoAtendimento || 'dentro').toLowerCase();
  var tc = Validators.normalizeTurno(aluno && aluno.turnoCurso);
  var turno = Validators.normalizeTurno(turnoAtendimento);
  if (tipo === 'remoto') return { ok:true, motivo:'' };
  if (!turno) return { ok:false, motivo:'Selecione o turno do atendimento.' };
  var faixa = turnoHoraConfig(turno);
  if (horaAtendimento && faixa && !horarioDentroDoTurno(horaAtendimento, turno)) {
    return { ok:false, motivo:'Horário fora do turno selecionado (' + faixa.inicio + ' às ' + faixa.fim + ').' };
  }
  if (!tc) return { ok:true, motivo:'' };
  if (tipo === 'dentro' && turno !== tc) {
    return { ok:false, motivo:'Para atendimento dentro do horário, use o turno do curso do aluno (' + turnoLabel(tc) + ').' };
  }
  if (tipo === 'fora' && turno === tc) {
    return { ok:false, motivo:'Para atendimento fora do horário, escolha um turno diferente do curso do aluno (' + turnoLabel(tc) + ').' };
  }
  return { ok:true, motivo:'' };
}


/* ── Navegação ── */
function navTo(panelId, navEl) {
  document.querySelectorAll('.panel-section').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(n){ n.classList.remove('active'); });
  var p = document.getElementById(panelId);
  if (p) p.classList.add('active');
  if (navEl) navEl.classList.add('active');
  var lEl = navEl ? navEl.querySelector('.nav-label') : null;
  var tt  = document.getElementById('topbar-title');
  if (tt) tt.textContent = lEl ? lEl.textContent : '';
  if (panelId==='panel-dashboard')  renderDashboard();
  if (panelId==='panel-indicativos') renderIndicativos();
  if (panelId==='panel-historico') renderHistoricoAnual();
  if (panelId==='panel-atendimentos')  renderAtendimentos();
  if (panelId==='panel-aprovacoes') renderAprovacoes();
  if (panelId==='panel-alunos')  renderAlunos();
  if (panelId==='panel-chat')       renderChatTabs();
  if (panelId==='panel-calendario') renderCalendario();
}

function recarregar() {
  var a = document.querySelector('.panel-section.active');
  if (a) navTo(a.id, document.querySelector('[data-panel="' + a.id + '"]'));
  toast('Dados atualizados!', 'info');
}

function updateBadge() {
  var store = getStore();
  var pend = store.alunos.filter(function(a){ return a.statusCadastro==='pendente'; }).length;
  var agt  = store.atendimentos.filter(function(c){ return c.status==='aguardando'; }).length;
  var bP = document.getElementById('badge-pend'), bA = document.getElementById('badge-agt');
  if (bP) { bP.textContent=pend; bP.classList.toggle('hidden', pend===0); }
  if (bA) { bA.textContent=agt;  bA.style.display = agt>0?'flex':'none'; }
}

/* ── Dashboard ── */
var _dashView = 'geral';
function setDashView(v, el) {
  _dashView = v;
  document.querySelectorAll('#panel-dashboard .wb-actions .btn').forEach(function(b){ b.classList.remove('btn-orange'); b.style.borderColor='rgba(255,255,255,.4)'; b.style.color='#fff'; });
  if (el) { el.classList.add('btn-orange'); el.style.borderColor=''; el.style.color=''; }
  renderDashboard();
}
function renderDashboard() {
  var store = getStore();
  var todas = store.atendimentos.filter(function(c){ return c.unidadeId===_sess.unidadeId; });
  var minhasAtendimentos = todas;
  var periodoLabel = 'Todas as atendimentos da unidade';
  if (_dashView === 'mensal') {
    var agora = new Date();
    minhasAtendimentos = todas.filter(function(c){
      var d = new Date(c.criacao);
      return d.getMonth()===agora.getMonth() && d.getFullYear()===agora.getFullYear();
    });
    var meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    periodoLabel = meses[agora.getMonth()] + ' de ' + agora.getFullYear();
  }
  var plEl = document.getElementById('ds-periodo-label');
  if (plEl) plEl.textContent = '📊 ' + periodoLabel;
  var ds = {
    agt:  minhasAtendimentos.filter(function(c){ return c.status==='aguardando'; }).length,
    conf: minhasAtendimentos.filter(function(c){ return c.status==='confirmada'; }).length,
    real: minhasAtendimentos.filter(function(c){ return c.status==='realizada';  }).length,
    pac:  store.alunos.filter(function(a){ return a.unidadeId===_sess.unidadeId && a.statusCadastro==='ativo'; }).length
  };
  Object.keys(ds).forEach(function(k){ var el=document.getElementById('ds-'+k); if(el) el.textContent=ds[k]; });
  /* Atualiza título do banner com nome + unidade */
  var unNome = nomeUnidade(_sess.unidadeId);
  var subEl = document.getElementById('wb-unidade-sub');
  if (subEl) subEl.textContent = 'Unidade: ' + unNome + ' · Gerencie atendimentos e comunicações.';
  updateBadge();
  var recentes = minhasAtendimentos.slice().sort(function(a,b){ return new Date(b.criacao)-new Date(a.criacao); }).slice(0,6);
  var el = document.getElementById('ds-recentes');
  if (!el) return;
  if (!recentes.length) { el.innerHTML='<div class="empty-state" style="padding:28px"><div class="empty-state-title">Nenhum atendimento ainda</div></div>'; return; }
  el.innerHTML = '<table><thead><tr><th>Aluno</th><th>Motivo</th><th>Data Pref.</th><th>Status</th><th>Ações</th></tr></thead><tbody>'
    + recentes.map(function(c){
        var a = getAluno(c.idAluno);
        return '<tr>'
          + '<td><strong>' + escape(a&&a.nome||'—') + '</strong><span class="td-sub">' + escape(a&&a.matricula||'') + '</span></td>'
          + '<td>' + escape(c.motivoSolicitação.length>42?c.motivoSolicitação.slice(0,42)+'…':c.motivoSolicitação) + '</td>'
          + '<td>' + fmtDate(c.dataPreferencial) + '</td>'
          + '<td>' + statusBadge(c.status) + '</td>'
          + '<td><button class="btn btn-outline btn-sm" onclick="abrirModalAtendimento(\'' + c.id + '\')">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Ver</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>';
}

function mesesIndicativos() {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
}

function dataBaseAtendimento(c) {
  var raw = (c && (c.dataPreferencial || c.dataAtendimento || c.criacao || c.createdAt)) || '';
  if (!raw) return null;
  var d = new Date(String(raw).length <= 10 ? String(raw) + 'T12:00:00' : raw);
  return isNaN(d.getTime()) ? null : d;
}

function anosComAtendimentos() {
  var store = getStore();
  var anos = {};
  (store.atendimentos || []).forEach(function(c){
    if (c.unidadeId !== _sess.unidadeId) return;
    var d = dataBaseAtendimento(c);
    if (d && d.getFullYear() <= new Date().getFullYear()) anos[d.getFullYear()] = true;
  });
  var lista = Object.keys(anos).map(Number).sort(function(a,b){ return b-a; });
  var atual = new Date().getFullYear();
  if (lista.indexOf(atual) < 0) lista.unshift(atual);
  return lista;
}

function garantirPeriodoIndicativos() {
  var anos = anosComAtendimentos();
  if (!_indAnoSelecionado || anos.indexOf(Number(_indAnoSelecionado)) < 0) _indAnoSelecionado = anos[0] || new Date().getFullYear();
  if (!_indMesSelecionado) _indMesSelecionado = 'todos';
}

function popularFiltrosIndicativos() {
  garantirPeriodoIndicativos();
  var anoEl = document.getElementById('ind-filtro-ano');
  var mesEl = document.getElementById('ind-filtro-mes');
  var anos = anosComAtendimentos();
  if (anoEl) {
    anoEl.innerHTML = anos.map(function(ano){ return '<option value="'+ano+'">'+ano+'</option>'; }).join('');
    anoEl.value = String(_indAnoSelecionado);
  }
  if (mesEl) {
    var meses = mesesIndicativos();
    mesEl.innerHTML = '<option value="todos">Todos os meses</option>' + meses.map(function(nome,idx){
      var v = String(idx + 1);
      return '<option value="'+v+'">'+nome+'</option>';
    }).join('');
    mesEl.value = String(_indMesSelecionado || 'todos');
  }
}

function alterarPeriodoIndicativos() {
  var anoEl = document.getElementById('ind-filtro-ano');
  var mesEl = document.getElementById('ind-filtro-mes');
  _indAnoSelecionado = Number(anoEl && anoEl.value ? anoEl.value : new Date().getFullYear());
  _indMesSelecionado = mesEl && mesEl.value ? mesEl.value : 'todos';
  renderIndicativos();
}

function atendimentosDoPeriodo(ano, mes) {
  var store = getStore();
  ano = Number(ano || new Date().getFullYear());
  mes = String(mes || 'todos');
  return (store.atendimentos || []).filter(function(c){
    if (c.unidadeId !== _sess.unidadeId) return false;
    var d = dataBaseAtendimento(c);
    if (!d || d.getFullYear() !== ano) return false;
    if (mes !== 'todos' && (d.getMonth() + 1) !== Number(mes)) return false;
    return true;
  });
}

function alunosDosAtendimentos(atendimentos) {
  var store = getStore();
  var idsLocal = {};
  var idsApi = {};
  (atendimentos || []).forEach(function(c){
    if (!c) return;
    if (c.idAluno) idsLocal[c.idAluno] = true;
    if (c.alunoApiId) idsApi[String(c.alunoApiId)] = true;
    var apiFromLocal = apiLongFromCompat(c.idAluno);
    if (apiFromLocal) idsApi[String(apiFromLocal)] = true;
  });
  return (store.alunos || []).filter(function(a){
    if (a.unidadeId !== _sess.unidadeId) return false;
    return !!idsLocal[a.id] || (a.apiId && !!idsApi[String(a.apiId)]);
  });
}

function labelPeriodoIndicativos(ano, mes) {
  var meses = mesesIndicativos();
  if (String(mes || 'todos') === 'todos') return 'Ano de ' + ano + ' · Todos os meses';
  return meses[Number(mes)-1] + ' de ' + ano;
}

function renderIndicativos() {
  popularFiltrosIndicativos();

  // Perfil anual: usado em todos os indicadores de perfil dos alunos.
  // O mês não altera esses gráficos, para evitar leituras distorcidas com poucos atendimentos.
  var atendimentosAno = atendimentosDoPeriodo(_indAnoSelecionado, 'todos');
  var alunosAno = alunosDosAtendimentos(atendimentosAno);

  // Movimento do atendimento: obedece ao mês selecionado.
  // Usado para tipos de atendimento e cartões de status/movimentação.
  var atendimentosMovimento = atendimentosDoPeriodo(_indAnoSelecionado, _indMesSelecionado);
  var periodoPerfil = 'Ano de ' + _indAnoSelecionado;
  var periodoMovimento = labelPeriodoIndicativos(_indAnoSelecionado, _indMesSelecionado);

  var totalEl = document.getElementById('ind-total-alunos');
  var labelEl = document.getElementById('ind-total-label');
  var titleEl = document.getElementById('ind-title');
  var subEl = document.getElementById('ind-subtitle');
  var periodoEl = document.getElementById('ind-periodo-label');

  if (totalEl) totalEl.textContent = alunosAno.length;
  if (labelEl) labelEl.textContent = alunosAno.length === 1 ? 'aluno atendido no ano' : 'alunos atendidos no ano';
  if (titleEl) titleEl.textContent = 'Indicativos da Psicologia';
  if (subEl) subEl.textContent = 'Perfil dos alunos consolidado por ano. Movimentação dos atendimentos filtrada por mês.';
  if (periodoEl) {
    periodoEl.textContent = 'Perfil dos alunos: ' + periodoPerfil + ' · Movimentação dos atendimentos: ' + periodoMovimento + ' · ' + atendimentosMovimento.length + ' atendimento' + (atendimentosMovimento.length !== 1 ? 's' : '');
  }

  renderResumoMovimentoAtendimentos(atendimentosMovimento);
  renderGraficos(alunosAno, { totalLabel: alunosAno.length === 1 ? 'ALUNO ATENDIDO' : 'ALUNOS ATENDIDOS', baseLabel:'da base atendida no ano', emptyMeta:'Não há alunos atendidos nesse ano.' });
  renderIndicativosExtras(alunosAno, atendimentosMovimento);
}

function normalizarStatusAtendimento(status) {
  var s = String(status || '').toLowerCase();
  s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
  return s.trim();
}

function renderResumoMovimentoAtendimentos(atendimentos) {
  var lista = Array.isArray(atendimentos) ? atendimentos : [];
  var total = lista.length;
  var realizados = lista.filter(function(c){ return normalizarStatusAtendimento(c.status) === 'realizada'; }).length;
  var pendentes = lista.filter(function(c){
    var s = normalizarStatusAtendimento(c.status);
    return s === 'aguardando' || s === 'confirmada' || s === 'pendente';
  }).length;
  var faltas = lista.filter(function(c){
    var s = normalizarStatusAtendimento(c.status);
    return s === 'falta' || s === 'nao compareceu' || s === 'nao_compareceu';
  }).length;
  var cancelados = lista.filter(function(c){ return normalizarStatusAtendimento(c.status) === 'cancelada'; }).length;

  var set = function(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; };
  set('ind-mov-total', total);
  set('ind-mov-realizados', realizados);
  set('ind-mov-pendentes', pendentes);
  set('ind-mov-faltas', faltas);
  set('ind-mov-cancelados', cancelados);
}

function renderHistoricoAnual() {
  var store = getStore();
  var anos = anosComAtendimentos().filter(function(ano){
    return (store.atendimentos || []).some(function(c){
      var d = dataBaseAtendimento(c);
      return c.unidadeId === _sess.unidadeId && d && d.getFullYear() === ano;
    });
  });
  var grid = document.getElementById('historico-anos-grid');
  if (!grid) return;
  if (!anos.length) {
    grid.innerHTML = '<div class="empty-state historico-empty"><div class="empty-state-title">Nenhum ano com atendimento ainda</div><p>Quando houver atendimentos registrados, os anos aparecerão aqui automaticamente.</p></div>';
    return;
  }
  grid.innerHTML = anos.map(function(ano){
    var atend = atendimentosDoPeriodo(ano, 'todos');
    var alunos = alunosDosAtendimentos(atend);
    var realizados = atend.filter(function(c){ return c.status === 'realizada'; }).length;
    var pendentes = atend.filter(function(c){ return c.status === 'aguardando' || c.status === 'confirmada'; }).length;
    return '<div class="historico-ano-card" role="button" tabindex="0" onclick="abrirIndicativosDoAno('+ano+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();abrirIndicativosDoAno('+ano+')}">'
      + '<div class="historico-card-main">'
      + '<span class="historico-ano-kicker">Histórico</span>'
      + '<strong>Ano de '+ano+'</strong>'
      + '<span>'+atend.length+' atendimento'+(atend.length!==1?'s':'')+' · '+alunos.length+' aluno'+(alunos.length!==1?'s':'')+'</span>'
      + '<small>'+realizados+' realizados · '+pendentes+' em aberto</small>'
      + '</div>'
      + '<button type="button" class="btn-relatorio-ano" onclick="event.stopPropagation(); gerarRelatorioAnualPDF('+ano+')" title="Gerar PDF do relatório anual">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg> Gerar relatório PDF</button>'
      + '</div>';
  }).join('');
}

function abrirIndicativosDoAno(ano) {
  _indAnoSelecionado = Number(ano || new Date().getFullYear());
  _indMesSelecionado = 'todos';
  var nav = document.querySelector('[data-panel="panel-indicativos"]');
  navTo('panel-indicativos', nav);
}


function tipoCursoIndicadorLabelFromTexto(texto) {
  var t = String(texto || '').toLowerCase();
  t = t.normalize ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
  if (t.indexOf('aprendizagem') >= 0) return 'Aprendizagem';
  if (t.indexOf('ensino medio') >= 0 || t.indexOf('ensino medio tecnico') >= 0 || t.indexOf('medio') >= 0) return 'Técnico no Ensino Médio';
  if (t.indexOf('tecnico') >= 0 || t.indexOf('técnico') >= 0) return 'Técnico';
  return 'Outros';
}

function tipoCursoDoAluno(aluno, store) {
  store = store || getStore();
  if (!aluno) return 'Outros';
  var cid = aluno.cursoId || aluno.cursoApiId;
  var curso = (store.cursos || []).find(function(c){
    return c.id === cid || c.apiId === cid || c.id === apiIdCompat('cur', cid) || c.apiId === apiLongFromCompat(cid);
  });
  var base = '';
  if (curso) base = [curso.tipoAprendizagem || '', curso.nome || ''].join(' ');
  if (!base.trim()) base = aluno.curso || alunoCursoNome(aluno, store) || '';
  return tipoCursoIndicadorLabelFromTexto(base);
}

function renderIndicativosExtras(alunos, atendimentosPeriodo) {
  var store = getStore();
  var atendimentos = Array.isArray(atendimentosPeriodo) ? atendimentosPeriodo : store.atendimentos.filter(function(c){ return c.unidadeId === _sess.unidadeId; });

  var tipoCursoQtd = { 'Aprendizagem':0, 'Técnico no Ensino Médio':0, 'Técnico':0, 'Outros':0 };
  alunos.forEach(function(a){
    var label = tipoCursoDoAluno(a, store);
    if (!Object.prototype.hasOwnProperty.call(tipoCursoQtd, label)) label = 'Outros';
    tipoCursoQtd[label] += 1;
  });
  renderIndicativoPizza('chart-tipo-curso', [
    {label:'Aprendizagem', value:tipoCursoQtd['Aprendizagem'], color:'#2d7ff9'},
    {label:'Técnico no Ensino Médio', value:tipoCursoQtd['Técnico no Ensino Médio'], color:'#f97316'},
    {label:'Técnico', value:tipoCursoQtd['Técnico'], color:'#10b981'},
    {label:'Outros', value:tipoCursoQtd['Outros'], color:'#8b5cf6'}
  ], {
    totalLabel: alunos.length === 1 ? 'ALUNO' : 'ALUNOS',
    summaryKicker: 'Tipo predominante',
    emptyTitle: 'Sem tipos de curso',
    emptyMeta: 'Cadastre cursos e alunos para visualizar esse indicador.'
  });

  var pcdSim = alunos.filter(function(a){ return !!a.pcd; }).length;
  var pcdNao = Math.max(0, alunos.length - pcdSim);
  renderIndicativoPizza('chart-pcd', [
    {label:'Alunos PCD', value:pcdSim, color:'#2d7ff9'},
    {label:'Alunos não PCD', value:pcdNao, color:'#f2a900'}
  ], {
    totalLabel: alunos.length === 1 ? 'ALUNO' : 'ALUNOS',
    summaryKicker: 'Perfil PCD',
    emptyTitle: 'Sem alunos cadastrados',
    emptyMeta: 'Cadastre alunos para visualizar o indicador PCD.'
  });

  var turnos = { 'Manhã':0, 'Tarde':0, 'Noite':0 };
  alunos.forEach(function(a){
    var t = Validators.normalizeTurno(a.turnoCurso || a.turno);
    if (t === 'manhã') turnos['Manhã'] += 1;
    else if (t === 'tarde') turnos['Tarde'] += 1;
    else if (t === 'noite') turnos['Noite'] += 1;
  });
  renderIndicativoBars('chart-turnos', [
    {label:'Manhã', value:turnos['Manhã'], color:'#2d7ff9'},
    {label:'Tarde', value:turnos['Tarde'], color:'#f2a900'},
    {label:'Noite', value:turnos['Noite'], color:'#1b2a4a'}
  ], {title:'Turnos', showPercent:true});

  var tipos = agruparTiposAtendimento(atendimentos);
  renderIndicativoPizza('chart-tipos', tipos, {
    totalLabel: atendimentos.length === 1 ? 'ATENDIMENTO' : 'ATENDIMENTOS',
    summaryKicker: 'Tipo mais frequente',
    emptyTitle: 'Sem atendimentos cadastrados',
    emptyMeta: 'Os tipos aparecerão conforme os atendimentos forem registrados.'
  });
}

function agruparTiposAtendimento(atendimentos) {
  var grupos = CATEGORIAS_ATENDIMENTO.map(function(item){
    return { label:item.label, value:0, color:item.color, valueKey:item.value };
  });
  (atendimentos || []).forEach(function(c){
    // Este gráfico deve ser alimentado somente pela escolha manual da psicóloga.
    // Não usamos mais motivo, título ou texto livre para classificar automaticamente.
    var categoria = String((c && c.categoriaAtendimento) || '').trim();
    if (!categoria) return;
    var achou = grupos.find(function(g){ return g.valueKey === categoria; });
    if (achou) achou.value += 1;
  });
  return grupos;
}

function renderIndicativoPizza(canvasId, itens, opts) {
  opts = opts || {};
  var canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  var allItens = (itens || []).slice();
  var chartItens = allItens.map(function(i, idx){ var copy = Object.assign({}, i); copy._legendIndex = idx; return copy; }).filter(function(i){ return Number(i.value || 0) > 0; });
  var total = chartItens.reduce(function(s,i){ return s + Number(i.value || 0); }, 0);
  var dpr = window.devicePixelRatio || 1;
  var box = canvas.getBoundingClientRect();
  var size = Math.round(Math.min(box.width || canvas.offsetWidth || 280, box.height || canvas.offsetHeight || 280));
  size = Math.max(220, Math.min(size, canvasId === 'chart-tipos' ? 360 : 300));
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,size,size);

  function hexToRgb(hex) {
    hex = (hex || '').replace('#','');
    if (hex.length === 3) hex = hex.split('').map(function(x){ return x+x; }).join('');
    var n = parseInt(hex, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function lightenLocal(hex, amt) {
    var c = hexToRgb(hex);
    var r = Math.min(255, Math.round(c.r + (255-c.r)*amt));
    var g = Math.min(255, Math.round(c.g + (255-c.g)*amt));
    var b = Math.min(255, Math.round(c.b + (255-c.b)*amt));
    return 'rgb('+r+','+g+','+b+')';
  }
  var style = getComputedStyle(document.documentElement);
  function cssVar(name, fallback) { return (style.getPropertyValue(name) || fallback).trim() || fallback; }
  var surface = cssVar('--white', '#ffffff');
  var ink = cssVar('--ink', '#0f172a');
  var muted = cssVar('--gray-400', '#94a3b8');
  var track = cssVar('--gray-100', '#eef2f7');
  var cx = size/2, cy = size/2, radius = size/2 - 48, ring = 32;
  var segments = [];

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius+ring/2+8, 0, Math.PI*2);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.strokeStyle = track;
  ctx.lineWidth = ring;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (!total) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI/2, Math.PI*1.5);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = ring;
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '800 13px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sem dados', cx, cy);
  } else {
    var gap = Math.PI / 90;
    var ang = -Math.PI/2;
    chartItens.forEach(function(it,i){
      var frac = Number(it.value || 0) / total;
      var sweep = frac * Math.PI * 2;
      var start = ang + gap/2;
      var end = ang + sweep - gap/2;
      if (end < start) end = start + Math.max(sweep*.7, .018);
      var color = it.color || '#2d7ff9';
      segments.push({ nome:it.label, valor:Number(it.value || 0), frac:frac, start:start, end:end, color:color, legendIndex: it._legendIndex });
      var grad = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
      grad.addColorStop(0, lightenLocal(color, .25));
      grad.addColorStop(.6, color);
      grad.addColorStop(1, color);
      ctx.save();
      ctx.shadowColor = color + '55';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, end);
      ctx.strokeStyle = grad;
      ctx.lineWidth = ring;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
      if (frac >= .10) {
        var mid = start + (end-start)/2;
        var lx = cx + Math.cos(mid) * (radius + ring*.78);
        var ly = cy + Math.sin(mid) * (radius + ring*.78);
        ctx.beginPath();
        ctx.arc(lx, ly, 14, 0, Math.PI*2);
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font = '900 10px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(frac*100)+'%', lx, ly);
      }
      ang += sweep;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, radius-ring*.68, 0, Math.PI*2);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "DM Sans", sans-serif';
    ctx.fillText(total, cx, cy-10);
    ctx.font = '900 10px "DM Sans", sans-serif';
    ctx.fillStyle = muted;
    ctx.fillText(opts.totalLabel || 'TOTAL', cx, cy+18);
  }

  var tip = document.getElementById(canvasId + '-tooltip');
  canvas._indicativoPizzaHit = { segments: segments, radius: radius, ring: ring, size: size, canvasId: canvasId };
  if (!canvas._indicativoPizzaBound) {
    canvas._indicativoPizzaBound = true;
    canvas.addEventListener('mousemove', function(e){
      var hit = canvas._indicativoPizzaHit;
      if (!hit) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left, y = e.clientY - rect.top;
      var dx = x - rect.width/2, dy = y - rect.height/2;
      var dist = Math.sqrt(dx*dx + dy*dy) * (hit.size / rect.width);
      var angle = Math.atan2(dy, dx);
      if (angle < -Math.PI/2) angle += Math.PI*2;
      var active = -1;
      hit.segments.forEach(function(s,i){
        var a = angle;
        if (a < s.start) a += Math.PI*2;
        if (dist >= hit.radius-hit.ring*.78 && dist <= hit.radius+hit.ring*.9 && a >= s.start && a <= s.end) active = i;
      });
      document.querySelectorAll('[data-pizza-chart="'+hit.canvasId+'"]').forEach(function(el){
        var seg = active >= 0 ? hit.segments[active] : null;
        el.classList.toggle('active', !!seg && Number(el.getAttribute('data-i')) === seg.legendIndex);
      });
      if (tip && active >= 0 && hit.segments[active]) {
        var s = hit.segments[active];
        tip.innerHTML = '<strong>'+escape(s.nome)+'</strong><span>'+s.valor+' registro'+(s.valor!==1?'s':'')+' · '+Math.round(s.frac*100)+'%</span>';
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.style.display = 'block';
      } else if (tip) tip.style.display = 'none';
    });
    canvas.addEventListener('mouseleave', function(){
      if (tip) tip.style.display = 'none';
      document.querySelectorAll('[data-pizza-chart="'+canvasId+'"]').forEach(function(el){ el.classList.remove('active'); });
    });
  }

  var summary = document.getElementById(canvasId + '-summary');
  if (summary) {
    if (chartItens.length && total) {
      var top = chartItens.slice().sort(function(a,b){ return Number(b.value||0)-Number(a.value||0); })[0];
      var topPct = Math.round(Number(top.value || 0) / total * 100);
      summary.innerHTML = '<div class="pizza-summary-kicker">' + escape(opts.summaryKicker || 'Maior concentração') + '</div>'
        + '<div class="pizza-summary-title">' + escape(top.label) + '</div>'
        + '<div class="pizza-summary-meta">' + top.value + ' registro' + (Number(top.value)!==1?'s':'') + ' · ' + topPct + '% do total</div>';
    } else {
      summary.innerHTML = '<div class="pizza-summary-kicker">Indicador</div>'
        + '<div class="pizza-summary-title">' + escape(opts.emptyTitle || 'Sem dados para exibir') + '</div>'
        + '<div class="pizza-summary-meta">' + escape(opts.emptyMeta || 'Os dados aparecerão conforme os registros forem criados.') + '</div>';
    }
  }
  var leg = document.getElementById(canvasId + '-legend');
  if (leg) {
    leg.innerHTML = allItens.length ? allItens.map(function(it,i){
      var n = Number(it.value || 0), pct = total ? Math.round(n/total*100) : 0, color = it.color || '#2d7ff9';
      return '<div class="pizza-legend-item" data-pizza-chart="'+canvasId+'" data-i="'+i+'">'
        + '<div class="pizza-legend-swatch" style="background:linear-gradient(180deg,'+lightenLocal(color,.22)+','+color+')"></div>'
        + '<div style="min-width:0"><div class="pizza-legend-name">'+escape(it.label)+'</div>'
        + '<div class="pizza-legend-meta">'+n+' registro'+(n!==1?'s':'')+'</div>'
        + '<div class="pizza-legend-track"><div class="pizza-legend-fill" style="--pct:'+pct+'%;--c:'+color+'"></div></div></div>'
        + '<div class="pizza-legend-value">'+pct+'%<span class="pizza-legend-pct">'+n+'/'+(total||0)+'</span></div>'
        + '</div>';
    }).join('') : '<div class="pizza-legend-item"><div class="pizza-legend-swatch" style="background:#cbd5e1"></div><div><div class="pizza-legend-name">Sem dados</div><div class="pizza-legend-meta">Nenhum registro encontrado.</div></div><div class="pizza-legend-value">0%</div></div>';
  }
}

function renderIndicativoDonut(canvasId, itens, title) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.offsetWidth || 360, cssH = parseInt(canvas.style.height,10) || 260;
  canvas.width = Math.floor(cssW*dpr); canvas.height = Math.floor(cssH*dpr);
  var ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH);
  var total = itens.reduce(function(s,i){ return s+i.value; },0);
  var cx = Math.min(110, cssW*.34), cy = cssH/2, r = Math.min(76, cssH*.32), ring = 24;
  ctx.lineWidth = ring; ctx.lineCap = 'round';
  ctx.strokeStyle = '#e5e7eb'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  if (total) {
    var a=-Math.PI/2, gap=Math.PI/70;
    itens.forEach(function(it){
      if (!it.value) return;
      var sweep = Math.PI*2*(it.value/total);
      ctx.strokeStyle = it.color;
      ctx.beginPath(); ctx.arc(cx,cy,r,a+gap/2,a+sweep-gap/2); ctx.stroke();
      a += sweep;
    });
  }
  ctx.fillStyle = '#0f172a'; ctx.font='900 32px "DM Sans", Arial, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(total, cx, cy-6);
  ctx.fillStyle = '#64748b'; ctx.font='800 10px "DM Sans", Arial, sans-serif'; ctx.fillText('ALUNOS', cx, cy+20);
  var lx = Math.min(220, cssW*.58), y = 58;
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#0f172a'; ctx.font='900 14px "DM Sans", Arial, sans-serif'; ctx.fillText(title || 'Indicativo', lx, 30);
  itens.forEach(function(it){
    var pct = total ? Math.round(it.value/total*100) : 0;
    ctx.fillStyle = it.color; roundCanvasRect(ctx,lx,y-12,10,28,5,true,false);
    ctx.fillStyle = '#0f172a'; ctx.font='800 13px "DM Sans", Arial, sans-serif'; ctx.fillText(it.label, lx+18, y);
    ctx.fillStyle = '#64748b'; ctx.font='700 11px "DM Sans", Arial, sans-serif'; ctx.fillText(it.value + ' aluno' + (it.value!==1?'s':'') + ' · ' + pct + '%', lx+18, y+18);
    y += 48;
  });
}

function renderIndicativoBars(canvasId, itens, opts) {
  opts = opts || {};
  var canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var computed = window.getComputedStyle ? getComputedStyle(canvas) : null;
  var cssW = Math.round(rect.width || canvas.offsetWidth || 420);
  var cssH = Math.round(rect.height || (computed ? parseFloat(computed.height) : 0) || canvas.offsetHeight || parseInt(canvas.style.height,10) || 270);
  // Mantém o canvas com a mesma proporção exibida pelo CSS.
  // Isso evita o efeito borrado/esticado quando a altura do card muda.
  canvas.width = Math.floor(cssW*dpr); canvas.height = Math.floor(cssH*dpr);
  var ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH);
  var total = itens.reduce(function(s,i){ return s+i.value; },0);
  var max = Math.max.apply(null, itens.map(function(i){return i.value;})) || 1;

  // v2.3.1 - Corrige contraste do gráfico de barras no modo escuro.
  // O canvas não herda as cores do CSS automaticamente; por isso as letras
  // ficavam pretas/apagadas no card "Turno do Curso" quando o tema escuro estava ativo.
  var root = document.documentElement;
  var theme = root.getAttribute('data-theme') || document.body.getAttribute('data-theme') || '';
  var isDark = theme === 'dark';
  var titleColor = isDark ? '#FDC180' : '#0f172a';
  var labelColor = isDark ? '#f8fafc' : '#0f172a';
  var mutedColor = isDark ? '#cbd5e1' : '#64748b';
  var trackColor = isDark ? 'rgba(226,232,240,.16)' : '#eef2f7';

  ctx.fillStyle = titleColor; ctx.font='900 14px "DM Sans", Arial, sans-serif'; ctx.textAlign='left'; ctx.fillText(opts.title || 'Indicativo', 18, 28);
  if (!itens.length || !total) {
    ctx.fillStyle = mutedColor; ctx.font='700 13px "DM Sans", Arial, sans-serif'; ctx.textAlign='center'; ctx.fillText('Sem dados para exibir', cssW/2, cssH/2); return;
  }
  var top = 54, left = 18, right = 54, rowH = Math.max(34, Math.min(42, (cssH-top-16)/itens.length));
  itens.forEach(function(it,idx){
    var y = top + idx*rowH;
    var pct = total ? Math.round(it.value/total*100) : 0;
    ctx.fillStyle = labelColor; ctx.font='800 12px "DM Sans", Arial, sans-serif'; ctx.textAlign='left'; ctx.fillText(it.label, left, y+2);
    ctx.fillStyle = mutedColor; ctx.font='800 11px "DM Sans", Arial, sans-serif'; ctx.textAlign='right';
    ctx.fillText(it.value + (opts.showPercent?' · '+pct+'%':''), cssW-18, y+2);
    var bw = cssW-left-right, bh = 10, by = y+13;
    ctx.fillStyle = trackColor; roundCanvasRect(ctx,left,by,bw,bh,999,true,false);
    ctx.fillStyle = it.color || '#2d7ff9'; roundCanvasRect(ctx,left,by,Math.max(4,bw*(it.value/max)),bh,999,true,false);
  });
}

function roundCanvasRect(ctx,x,y,w,h,r,fill,stroke){
  if (w<=0||h<=0) return;
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  if(fill)ctx.fill(); if(stroke)ctx.stroke();
}


/* ── Atendimentos ── */
function renderAtendimentos() {
  var store  = getStore();
  var busca  = document.getElementById('busca-c')      ? document.getElementById('busca-c').value.toLowerCase() : '';
  var filtro = document.getElementById('filtro-status') ? document.getElementById('filtro-status').value : '';
  var lista  = Permissions.getAtendimentosVisiveis(_sess, store.atendimentos, store.alunos);
  if (filtro) lista = lista.filter(function(c){ return c.status===filtro; });
  if (busca)  lista = lista.filter(function(c){
    var a = getAluno(c.idAluno);
    return (a&&a.nome||'').toLowerCase().indexOf(busca)>=0
        || (a&&a.matricula||'').indexOf(busca)>=0
        || c.motivoSolicitação.toLowerCase().indexOf(busca)>=0;
  });
  lista.sort(function(a,b){ return new Date(b.criacao)-new Date(a.criacao); });
  var tb = document.getElementById('tbody-atendimentos');
  if (!tb) return;
  if (!lista.length) { tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:44px;color:var(--gray-400)">Nenhum atendimento encontrada</td></tr>'; return; }
  tb.innerHTML = lista.map(function(c){
    var a = getAluno(c.idAluno);
    var tipoAtend = c.tipoAtendimento || '';
    var isRemoto = (tipoAtend === 'remoto' || c.turno === 'remoto');
    var turnoCurso = a ? Validators.normalizeTurno(a.turnoCurso) : '';
    var turnoAtendimento = Validators.normalizeTurno(c.turno);
    var isForaHorario = !isRemoto && (tipoAtend === 'fora' || (turnoCurso && turnoAtendimento && turnoCurso !== turnoAtendimento));
    var rowStyle = '';
    if (isRemoto) rowStyle = ' style="background:rgba(37,99,235,0.06);border-left:3px solid #3b82f6"';
    else if (isForaHorario) rowStyle = ' style="background:rgba(247,163,0,0.06);border-left:3px solid #f5c518"';
    var tipoTag = '';
    if (isRemoto) tipoTag = ' <span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:10px;margin-left:4px">📱 Remoto</span>';
    else if (isForaHorario) tipoTag = ' <span style="font-size:10px;font-weight:700;background:#fef3dc;color:#c87f00;padding:2px 7px;border-radius:10px;margin-left:4px">⚠️ Fora do horário</span>';
    var tLabel = isRemoto ? '<span style="color:#1d4ed8;font-weight:600">Remoto</span>' : turnoLabel(c.turno);
    var telInfo = isRemoto && a && a.telefone ? '<span class="td-sub" style="color:#1d4ed8;font-weight:600">📞 '+escape(a.telefone)+'</span>' : '';
    return '<tr'+rowStyle+'>'
      + '<td><strong>' + escape(a&&a.nome||'—') + '</strong><span class="td-sub">' + escape(a&&a.matricula||'') + ' · ' + escape(a ? alunoCursoNome(a, getStore()) : '') + '</span>'+telInfo+'</td>'
      + '<td>' + escape(c.motivoSolicitação.length>38?c.motivoSolicitação.slice(0,38)+'…':c.motivoSolicitação) + '</td>'
      + '<td>' + tLabel + tipoTag + '<span class="td-sub">' + escape(c.horarioPreferencial||'—') + ' · ' + fmtDate(c.dataPreferencial) + '</span></td>'
      + '<td>' + escape(solicitanteNome(c)) + '</td>'
      + '<td>' + escape(profissionalAtendimentoNome(c)) + '</td>'
      + '<td>' + statusBadge(c.status) + '</td>'
      + '<td class="td-actions"><button class="btn btn-outline btn-sm" onclick="abrirModalAtendimento(\''+c.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Detalhes</button></td>'
      + '</tr>';
  }).join('');
}

/* ── Modal Atendimento ── */
function abrirModalAtendimento(id) {
  var store  = getStore();
  var c      = store.atendimentos.find(function(x){ return x.id===id; });
  if (!c) return;
  _atendimentoSel = id;
  var aluno  = getAluno(c.idAluno);
  var mcBody = document.getElementById('mc-body');
  var mcTitle= document.getElementById('mc-title');
  var mcObs  = document.getElementById('mc-obs');
  var mcBtns = document.getElementById('mc-status-btns');
  if (!mcBody) return;
  if (mcTitle) mcTitle.textContent = aluno ? aluno.nome : 'Atendimento';

  /* Compatibilidade de turno — CORREÇÃO #7 */
  var turnoCurso    = aluno ? Validators.normalizeTurno(aluno.turnoCurso) : '';
  var turnoAtendimento = Validators.normalizeTurno(c.turno);
  var compat = aluno ? validarTipoHorarioPsicologo(aluno, c.tipoAtendimento || 'dentro', c.turno, c.horarioPreferencial) : {ok:true,motivo:''};
  var compatHtml = '';
  if (!compat.ok) {
    compatHtml = '<div style="background:#fef3dc;border:1px solid #f5c518;border-radius:var(--r-sm);padding:10px 14px;margin-bottom:12px;display:flex;gap:9px;align-items:flex-start">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="#c87f00" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      + '<span style="font-size:12.5px;color:#7a4800"><strong>Atenção:</strong> ' + escape(compat.motivo) + '</span>'
      + '</div>';
  } else if (turnoCurso) {
    var faixa = turnoHoraConfig(turnoCurso);
    compatHtml = '<div style="background:#e8f8ef;border:1px solid #82e0aa;border-radius:var(--r-sm);padding:10px 14px;margin-bottom:12px;display:flex;gap:9px;align-items:center">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="#1e8449" stroke-width="2.5" style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>'
      + '<span style="font-size:12.5px;color:#155724">Turno compatível com o curso do aluno (' + turnoLabel(turnoCurso) + (faixa?' · '+faixa.inicio+' às '+faixa.fim:'') + ')</span>'
      + '</div>';
  }

  /* Bloco de confirmação com data/hora/turno */
  var confirmHtml = '';
  if (c.status === 'aguardando' || c.status === 'confirmada') {
    var modoReagendamento = c.status === 'confirmada';
    var dispDesc = modoReagendamento ? 'Confira a data e o horário para reagendar este atendimento.' : descricaoDisponibilidadeAluno(aluno);
    /* O campo de horário não recebe min/max dinâmico.
       Alguns navegadores apagam o valor parcial do input type="time" quando
       min/max são alterados durante a digitação. A validação continua antes de salvar. */
    /* Opções de turno — pré-seleciona o turno do curso do aluno */
    var turnoOpts = ['manhã','tarde','noite'].map(function(t) {
      var sel = (t === (turnoCurso || turnoAtendimento)) ? ' selected' : '';
      return '<option value="' + t + '"' + sel + '>' + (t.charAt(0).toUpperCase()+t.slice(1)) + '</option>';
    }).join('');
    var painelDisplay = modoReagendamento ? 'display:none;' : '';
    confirmHtml = '<div id="mc-agendamento-panel" style="' + painelDisplay + 'background:var(--green-soft);border:1px solid var(--green-mid);border-radius:var(--r-sm);padding:13px 15px;margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--green-d);margin-bottom:10px">' + (modoReagendamento ? 'Reagendar atendimento' : 'Definir data e horário para confirmar') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
      + '<div><label class="form-label" style="font-size:11px">Data do Atendimento</label><input type="date" class="form-control" id="mc-data" value="' + escape(c.dataPreferencial || '') + '" onchange="verificarHorarioModal()"></div>'
      + '<div><label class="form-label" style="font-size:11px">Turno</label>'
      + '<select class="form-control" id="mc-turno-confirm" onchange="verificarHorarioModal()">'
      + '<option value="">Selecione...</option>' + turnoOpts
      + '</select></div>'
      + '<div><label class="form-label" style="font-size:11px">Horário</label>'
      + '<input type="time" class="form-control" id="mc-hora" value="' + escape(c.horarioPreferencial || '') + '" oninput="verificarHorarioModal()" onchange="verificarHorarioModal()"></div>'
      + '</div>'
      + '<div style="margin-top:10px"><label class="form-label" style="font-size:11px">Tipo de Atendimento</label>'
      + '<select class="form-control" id="mc-tipo-atendimento" onchange="ajustarTipoAtendimentoModal()">' + tipoAtendimentoSelectOptions(c.tipoAtendimento) + '</select>'
      + '<div style="font-size:11.5px;color:var(--gray-500);margin-top:5px">A psicóloga pode ajustar o tipo de atendimento antes de confirmar ou reagendar.</div></div>'
      + '<div id="mc-hora-hint" style="margin-top:8px;font-size:12px;color:var(--green-d)">' + escape(dispDesc) + '</div>'
      + (modoReagendamento ? '<button type="button" class="btn btn-confirm btn-sm" style="margin-top:12px;width:100%;justify-content:center" onclick="mudarStatusConfirmar(\'' + id + '\')">Salvar reagendamento</button>' : '')
      + '</div>';
  }

  mcBody.innerHTML =
    '<div style="background:var(--gray-50);border-radius:var(--r-sm);padding:12px 14px;margin-bottom:14px">'
    + '<div style="font-size:13px;font-weight:700;color:var(--senac-navy)">' + escape(aluno&&aluno.nome||'—') + '</div>'
    + '<div style="font-size:12px;color:var(--gray-500)">' + escape(aluno&&aluno.matricula||'') + ' · ' + escape(aluno&&aluno.curso||'') + ' · ' + escape(aluno&&aluno.turma||'') + '</div>'
    + '<div style="font-size:11px;color:var(--gray-400);margin-top:3px">Turno do curso: <strong>' + turnoLabel(aluno&&aluno.turnoCurso) + '</strong>' + (aluno&&aluno.pcd?' · PCD':'') + '</div>'
    + '</div>'
    + compatHtml
    + '<div class="detail-section"><div class="detail-label">Motivo</div><div class="detail-value">' + escape(c.motivoSolicitação) + '</div></div>'
    + '<div class="detail-grid">'
    + '<div class="detail-section"><div class="detail-label">Data Preferencial</div><div class="detail-value">' + fmtDate(c.dataPreferencial) + '</div></div>'
    + '<div class="detail-section"><div class="detail-label">Horário / Turno solicitado</div><div class="detail-value">' + escape(c.horarioPreferencial||'—') + ' · ' + turnoLabel(c.turno) + '</div></div>'
    + '</div>'
    + (c.obsResponsavel ? '<div class="detail-section"><div class="detail-label">Obs. do Responsável</div><div class="alert alert-info" style="margin:0;font-size:13px"><div>' + escape(c.obsResponsavel) + '</div></div></div>' : '')
    + '<div class="detail-grid">'
    + '<div class="detail-section"><div class="detail-label">Solicitado por</div><div class="detail-value">' + escape(solicitanteNome(c)) + '</div></div>'
    + '<div class="detail-section"><div class="detail-label">Profissional responsável</div><div class="detail-value">' + escape(profissionalAtendimentoNome(c)) + '</div></div>'
    + '</div>'
    + '<div class="detail-section"><div class="detail-label">Tipo de atendimento solicitado/agendado</div><div class="detail-value">' + tipoAtendimentoBadge(c.tipoAtendimento) + '</div></div>'
    + '<div class="detail-section"><div class="detail-label">Tipo de atendimento realizado</div><div class="detail-value">' + categoriaAtendimentoBadge(c.categoriaAtendimento) + '</div></div>'
    + (c.relatorioConsulta ? '<div class="detail-section"><div class="detail-label">Relatório já registrado</div><div class="alert alert-info" style="margin:0;font-size:13px;white-space:pre-wrap">' + escape(c.relatorioConsulta) + '</div></div>' : '')
    + '<div class="detail-section"><div class="detail-label">Status Atual</div>' + statusBadge(c.status) + '</div>'
    + confirmHtml;

  if (mcObs) mcObs.value = c.obsPsicologa || '';
  var mcRel = document.getElementById('mc-relatorio');
  var mcRelWrap = document.getElementById('mc-relatorio-wrap');
  if (mcRel) mcRel.value = c.relatorioConsulta || '';
  if (mcRelWrap) mcRelWrap.style.display = c.relatorioConsulta ? 'block' : 'none';
  var mcCat = document.getElementById('mc-categoria-atendimento');
  var mcCatWrap = document.getElementById('mc-categoria-wrap');
  if (mcCat) {
    mcCat.innerHTML = categoriaAtendimentoSelectOptions(c.categoriaAtendimento);
    mcCat.value = c.categoriaAtendimento || '';
  }
  if (mcCatWrap) mcCatWrap.style.display = c.categoriaAtendimento ? 'block' : 'none';
  if (mcBtns) {
    var btns = '<button class="btn btn-outline btn-sm" onclick="agendarOutraConsultaAtendimento(\'' + id + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="9" y1="17" x2="15" y2="17"/></svg>Agendar outra consulta</button>';
    if (c.status!=='confirmada') btns += '<button class="btn btn-confirm btn-sm" onclick="mudarStatusConfirmar(\'' + id + '\')">'  
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Confirmar</button>';
    if (c.status==='confirmada') btns += '<button class="btn btn-confirm btn-sm" onclick="mostrarReagendamento()">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>Reagendar</button>';
    if (c.status!=='realizada')  btns += '<button class="btn btn-success btn-sm" onclick="mudarStatus(\'' + id + '\',\'realizada\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>Realizada</button>';
    if (c.status!=='falta')      btns += '<button class="btn btn-miss btn-sm" onclick="mudarStatus(\'' + id + '\',\'falta\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>Não compareceu</button>';
    if (c.status!=='cancelada')  btns += '<button class="btn btn-danger btn-sm" onclick="mudarStatus(\'' + id + '\',\'cancelada\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancelar</button>';
    mcBtns.innerHTML = btns;
  }
  openModal('modal-cons');
  setTimeout(ajustarTipoAtendimentoModal, 0);
}

function toggleRelatorioConsulta() {
  var wrap = document.getElementById('mc-relatorio-wrap');
  if (!wrap) return;
  var aberto = wrap.style.display !== 'none';
  wrap.style.display = aberto ? 'none' : 'block';
  if (!aberto) {
    var campo = document.getElementById('mc-relatorio');
    if (campo) campo.focus();
  }
}


function toggleTipoAtendimentoRealizado() {
  var wrap = document.getElementById('mc-categoria-wrap');
  if (!wrap) return;
  var aberto = wrap.style.display !== 'none';
  wrap.style.display = aberto ? 'none' : 'block';
  if (!aberto) {
    var campo = document.getElementById('mc-categoria-atendimento');
    if (campo) campo.focus();
  }
}

function salvarRelatorioNoHistoricoAluno(store, atendimento, relatorio) {
  relatorio = String(relatorio || '').trim();
  if (!store || !atendimento || !relatorio) return;
  var aluno = store.alunos.find(function(a){ return a.id === atendimento.idAluno; });
  if (!aluno) return;
  var marcador = 'Relatório da consulta #' + (atendimento.apiId || atendimento.id);
  var obs = aluno.observacoes || '';
  if (obs.indexOf(marcador) >= 0) return;
  var data = atendimento.dataPreferencial ? fmtDate(atendimento.dataPreferencial) : fmtDate(new Date().toISOString());
  var profissional = (_sess && _sess.nome) ? _sess.nome : 'Psicologia';
  var bloco = '\n\n[' + marcador + ' - ' + data + ' - ' + profissional + ']\n' + relatorio;
  aluno.observacoes = obs + bloco;
}

function agendarOutraConsultaAtendimento(id) {
  var store = getStore();
  var c = store.atendimentos.find(function(x){ return x.id === id; });
  if (!c) return;
  closeModal('modal-cons');
  setTimeout(function(){
    abrirModalAgendar(c.idAluno);
    var motivoEl = document.getElementById('mag-motivo');
    if (motivoEl) motivoEl.value = 'Nova consulta de acompanhamento psicológico.';
    var tipoEl = document.getElementById('mag-tipo');
    if (tipoEl) tipoEl.value = c.tipoAtendimento || 'dentro';
    var turnoEl = document.getElementById('mag-turno');
    if (turnoEl) turnoEl.value = (c.tipoAtendimento === 'remoto') ? '' : (c.turno || turnoEl.value || '');
    magAtualizarTipo();
  }, 120);
}

function mostrarReagendamento() {
  var panel = document.getElementById('mc-agendamento-panel');
  if (panel) panel.style.display = 'block';
  verificarHorarioModal();
  if (panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth', block:'center'});
}

function mesmoProfissionalAtendimento(c, psicologoApiId, psicologoLocalId) {
  if (!c) return false;
  if (c.psicologoApiId && psicologoApiId && Number(c.psicologoApiId) === Number(psicologoApiId)) return true;
  if (c.psicologoId && psicologoLocalId && String(c.psicologoId) === String(psicologoLocalId)) return true;
  if (c.psicologo && _sess && c.psicologo === _sess.nome) return true;
  return false;
}

function detectarConflitoHorario(atendimentoId, data, hora) {
  if (!data || !hora || !_sess) return null;
  var psicologoApiId = _sess.apiId || apiLongFromCompat(_sess.id);
  var psicologoLocalId = _sess.id;
  return getStore().atendimentos.find(function(item) {
    if (!item || item.id === atendimentoId) return false;
    if (item.status !== 'confirmada') return false;
    if (item.dataPreferencial !== data || item.horarioPreferencial !== hora) return false;
    return mesmoProfissionalAtendimento(item, psicologoApiId, psicologoLocalId);
  }) || null;
}

function dataHoraAtendimentoPassou(data, hora) {
  if (!data || !hora) return false;
  var marcada = new Date(data + 'T' + hora + ':00');
  if (isNaN(marcada.getTime())) return false;
  return marcada.getTime() < Date.now();
}


function ajustarTipoAtendimentoModal() {
  var tipo = tipoAtendimentoSelecionadoModal();
  var turnoEl = document.getElementById('mc-turno-confirm');
  if (turnoEl) {
    if (tipo === 'remoto') {
      turnoEl.value = '';
      turnoEl.disabled = true;
    } else {
      turnoEl.disabled = false;
      if (_atendimentoSel) {
        var c = getStore().atendimentos.find(function(x){ return x.id === _atendimentoSel; });
        var aluno = c ? getAluno(c.idAluno) : null;
        var tc = aluno ? Validators.normalizeTurno(aluno.turnoCurso) : '';
        if (tipo === 'dentro' && tc) turnoEl.value = tc;
        if (tipo === 'fora' && tc && turnoEl.value === tc) turnoEl.value = '';
      }
    }
  }
  verificarHorarioModal();
}

/* Verifica horário em tempo real no modal */
function verificarHorarioModal() {
  if (!_atendimentoSel) return;
  var store  = getStore();
  var c      = store.atendimentos.find(function(x){ return x.id===_atendimentoSel; });
  if (!c) return;
  var aluno  = getAluno(c.idAluno);
  var data   = document.getElementById('mc-data')         ? document.getElementById('mc-data').value         : '';
  var hora   = document.getElementById('mc-hora')         ? document.getElementById('mc-hora').value         : '';
  var turnoEl= document.getElementById('mc-turno-confirm');
  var tipoAtendimento = tipoAtendimentoSelecionadoModal();
  var turnoConf = tipoAtendimento === 'remoto' ? 'remoto' : (turnoEl ? turnoEl.value : '');
  var hint   = document.getElementById('mc-hora-hint');
  var horaEl = document.getElementById('mc-hora');
  if (!hint || !aluno) return;

  /* Não altere min/max do campo enquanto o usuário digita.
     O valor digitado é preservado e a regra de turno é validada abaixo. */
  if (horaEl) {
    horaEl.removeAttribute('min');
    horaEl.removeAttribute('max');
  }

  if (tipoAtendimento === 'remoto') {
    if (turnoEl) turnoEl.disabled = true;
  } else if (turnoEl) {
    turnoEl.disabled = false;
  }
  if (!turnoConf) {
    hint.textContent = 'Selecione o turno da atendimento.';
    hint.style.color = 'var(--gray-500)';
    return;
  }
  if (!hora) {
    var faixaL = turnoHoraConfig(turnoConf);
    hint.textContent = faixaL
      ? 'Digite um horário entre ' + faixaL.inicio + ' e ' + faixaL.fim + '.'
      : 'Digite o horário da atendimento.';
    hint.style.color = 'var(--gray-500)';
    return;
  }
  /* Valida: turno escolhido deve ser compatível com o curso do aluno */
  var compat = validarTipoHorarioPsicologo(aluno, tipoAtendimento, turnoConf, hora);
  if (dataHoraAtendimentoPassou(data, hora)) {
    hint.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Escolha uma data e horário futuros para confirmar ou reagendar.</span>';
    hint.style.color = '#c87f00';
    return;
  }
  var conflito = detectarConflitoHorario(_atendimentoSel, data, hora);
  if (conflito) {
    var alunoConflito = getAluno(conflito.idAluno);
    hint.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Conflito de horário: você já tem atendimento confirmado para ' + escape(alunoConflito && alunoConflito.nome || 'outro aluno') + ' nesse mesmo dia e horário.</span>';
    hint.style.color = '#c0392b';
  } else if (compat.ok) {
    hint.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' + (tipoAtendimento === 'remoto' ? 'Atendimento remoto sem conflito para este profissional.' : 'Horário compatível e sem conflito para este profissional.') + '</span>';
    hint.style.color = 'var(--green-d)';
  } else {
    hint.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' + escape(compat.motivo) + '</span>';
    hint.style.color = '#c87f00';
  }
}

new MutationObserver(function(mutations) {
  var mudouTema = mutations.some(function(m){ return m.attributeName === 'data-theme'; });
  var indicativosAtivo = document.getElementById('panel-indicativos');
  if (mudouTema && indicativosAtivo && indicativosAtivo.classList.contains('active')) {
    setTimeout(function(){ renderIndicativos(); }, 0);
  }
}).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

function salvarAtendimento() {
  if (!_atendimentoSel) return;
  var obs = document.getElementById('mc-obs') ? document.getElementById('mc-obs').value : '';
  var relatorio = document.getElementById('mc-relatorio') ? document.getElementById('mc-relatorio').value.trim() : '';
  var categoriaAtendimento = categoriaAtendimentoSelecionadaModal();
  var store = getStore();
  var c = store.atendimentos.find(function(x){ return x.id===_atendimentoSel; });
  if (!c) return;
  c.obsPsicologa=obs;
  c.relatorioConsulta=relatorio;
  c.categoriaAtendimento=categoriaAtendimento;
  c.tipoAtendimento = tipoAtendimentoSelecionadoModal() || c.tipoAtendimento || 'dentro';
  salvarRelatorioNoHistoricoAluno(store, c, relatorio);
  saveStoreOrToast(store, relatorio ? 'Relatório/observação salvos!' : 'Observação salva!')
    .then(function(){
      closeModal('modal-cons');
      renderDashboard(); renderAtendimentos(); renderAlunos();
    });
}

function mudarStatus(id, novoStatus) {
  var obs = document.getElementById('mc-obs') ? document.getElementById('mc-obs').value : '';
  var relatorio = document.getElementById('mc-relatorio') ? document.getElementById('mc-relatorio').value.trim() : '';
  var categoriaAtendimento = categoriaAtendimentoSelecionadaModal();
  var store = getStore();
  var c = store.atendimentos.find(function(x){ return x.id===id; });
  if (!c) return;
  c.status = novoStatus;
  c.categoriaAtendimento = categoriaAtendimento || c.categoriaAtendimento || '';
  c.tipoAtendimento = tipoAtendimentoSelecionadoModal() || c.tipoAtendimento || 'dentro';
  if ((novoStatus === 'confirmada' || novoStatus === 'realizada') && _sess) {
    c.psicologoApiId = _sess.apiId || c.psicologoApiId;
    c.psicologoId = _sess.id || c.psicologoId;
    c.psicologo = _sess.nome || c.psicologo;
  }
  if (obs) c.obsPsicologa = obs;
  if (relatorio) {
    c.relatorioConsulta = relatorio;
    salvarRelatorioNoHistoricoAluno(store, c, relatorio);
  }
  var labels = { confirmada:'Confirmada', realizada:'Realizada', falta:'Não compareceu', cancelada:'Cancelada' };
  saveStoreOrToast(store, 'Status: ' + (labels[novoStatus]||novoStatus))
    .then(function(){
      closeModal('modal-cons');
      renderDashboard(); renderAtendimentos(); renderAlunos(); updateBadge();
    });
}

function mudarStatusConfirmar(id) {
  var data      = document.getElementById('mc-data')          ? document.getElementById('mc-data').value          : '';
  var hora      = document.getElementById('mc-hora')          ? document.getElementById('mc-hora').value          : '';
  var tipoAtendimento = tipoAtendimentoSelecionadoModal();
  var turnoConf = tipoAtendimento === 'remoto' ? 'remoto' : (document.getElementById('mc-turno-confirm') ? document.getElementById('mc-turno-confirm').value : '');
  if (!data)      { toast('Informe a data da atendimento.',   'warning'); return; }
  if (!tipoAtendimento) { toast('Selecione o tipo de atendimento.', 'warning'); return; }
  if (!turnoConf) { toast('Selecione o turno da atendimento.', 'warning'); return; }
  if (!hora)      { toast('Informe o horário da atendimento.', 'warning'); return; }
  var obs   = document.getElementById('mc-obs') ? document.getElementById('mc-obs').value : '';
  var relatorio = document.getElementById('mc-relatorio') ? document.getElementById('mc-relatorio').value.trim() : '';
  var categoriaAtendimento = categoriaAtendimentoSelecionadaModal();
  var store = getStore();
  var c     = store.atendimentos.find(function(x){ return x.id===id; });
  if (!c) return;
  var aluno = getAluno(c.idAluno);
  /* Valida turno escolhido pelo psicólogo contra o turno do curso do aluno */
  var compat = validarTipoHorarioPsicologo(aluno, tipoAtendimento, turnoConf, hora);
  if (!compat.ok) { toast(compat.motivo, 'warning'); return; }
  if (dataHoraAtendimentoPassou(data, hora)) {
    toast('Escolha uma data e horário futuros para confirmar ou reagendar o atendimento.', 'warning');
    verificarHorarioModal();
    return;
  }
  var conflito = detectarConflitoHorario(id, data, hora);
  if (conflito) {
    var alunoConflito = getAluno(conflito.idAluno);
    toast('Conflito de horário: já existe atendimento confirmado para ' + ((alunoConflito && alunoConflito.nome) || 'outro aluno') + ' nesse mesmo dia e horário.', 'warning');
    verificarHorarioModal();
    return;
  }
  /* Persiste turno confirmado (pode ser diferente do turno solicitado originalmente) */
  c.status             = 'confirmada';
  if (_sess) {
    c.psicologoApiId = _sess.apiId || c.psicologoApiId;
    c.psicologoId = _sess.id || c.psicologoId;
    c.psicologo = _sess.nome || c.psicologo;
  }
  c.dataPreferencial   = data;
  c.horarioPreferencial= hora;
  c.turno              = turnoConf;
  c.tipoAtendimento    = tipoAtendimento || c.tipoAtendimento || 'dentro';
  c.categoriaAtendimento = categoriaAtendimento || c.categoriaAtendimento || '';
  if (obs) c.obsPsicologa = obs;
  if (relatorio) {
    c.relatorioConsulta = relatorio;
    salvarRelatorioNoHistoricoAluno(store, c, relatorio);
  }
  saveStoreOrToast(store, 'Atendimento agendado/reagendado! ' + turnoLabel(turnoConf) + ' · ' + hora)
    .then(function(){
      closeModal('modal-cons');
      renderDashboard(); renderAtendimentos(); renderAlunos(); updateBadge();
    })
    .catch(function(){
      verificarHorarioModal();
    });
}

/* ── Aprovações ── */
function renderAprovacoes() {
  var store = getStore();
  var lista = store.alunos.filter(function(a){ return a.statusCadastro==='pendente'; });
  var tbody = document.getElementById('tbody-aprovacoes');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:44px;color:var(--gray-400)">'
      + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin:0 auto 10px;display:block;opacity:.35"><polyline points="20 6 9 17 4 12"/></svg>'
      + 'Nenhum cadastro aguardando aprovação</td></tr>'; return;
  }
  tbody.innerHTML = lista.map(function(a){
    var idade = calcIdade(a.dataNascimento), menor = isMenor(a.dataNascimento);
    var qtdC  = store.atendimentos.filter(function(c){ return c.idAluno===a.id; }).length;
    var ultC  = store.atendimentos.filter(function(c){ return c.idAluno===a.id; }).sort(function(x,y){ return new Date(y.criacao)-new Date(x.criacao); })[0];
    var pcdBadge = a.pcd
      ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;background:var(--senac-navy-soft);color:var(--senac-navy);padding:4px 10px;border-radius:20px;border:1px solid var(--senac-navy-light);white-space:nowrap">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px"><polyline points="20 6 9 17 4 12"/></svg>Sim — PCD</span>'
      : '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;background:var(--gray-50);color:var(--gray-400);padding:4px 10px;border-radius:20px;border:1px solid var(--gray-100);white-space:nowrap">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Não</span>';
    var ageBadgeRow = menor
      ? '<span class="age-badge menor" style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><circle cx="12" cy="5" r="3"/><path d="M8 10h8l1 7H7l1-7z"/></svg>Menor · '+idade+'a</span>'
      : '<span class="age-badge maior" style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Maior · '+idade+'a</span>';
    return '<tr>'
      + '<td><div style="display:flex;align-items:center;gap:10px">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--senac-orange),var(--senac-navy));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">'+escape(a.nome.charAt(0))+'</div>'
      + '<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:700;font-size:13.5px">'+escape(a.nome)+'</div>'+ageBadgeRow+'</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400);margin-top:1px">'+escape(a.email||'—')+'</div></div></div></td>'
      + '<td><code style="font-size:12.5px">'+escape(a.matricula)+'</code></td>'
      + '<td>'+escape(a.cpf||'—')+'</td>'
      + '<td><div style="font-weight:600;font-size:13px">'+escape(alunoCursoNome(a, getStore()))+'</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400);margin-top:2px">'+escape(a.turma)+' · <span style="font-weight:600;color:var(--senac-navy)">'+turnoLabel(a.turnoCurso)+'</span></div></td>'
      + '<td>'+(idade!==null?idade+' anos':'—')+'</td>'
      + '<td><div style="font-size:13px;font-weight:500">'+(a.telefone?escape(a.telefone):'—')+'</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400);margin-top:1px">'+fmtDate(a.dataNascimento+'T12:00:00')+'</div></td>'
      + '<td style="text-align:center">'+pcdBadge+'</td>'
      + '<td style="text-align:center"><div style="display:flex;flex-direction:column;align-items:center;gap:3px">'
      + '<strong style="font-size:17px;line-height:1">'+qtdC+'</strong>'
      + (ultC?'<div>'+statusBadge(ultC.status)+'</div>':'<div style="font-size:11px;color:var(--gray-400)">nenhuma</div>')
      + '</div></td>'
      + '<td class="td-actions"><button class="btn btn-outline btn-sm" onclick="abrirModalAgendar(\'' + a.id + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Agendar</button>'
      + '<button class="btn btn-outline btn-sm" onclick="verHistorico(\'' + a.id + '\',\'' + escape(a.nome.split(' ')[0]) + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Histórico</button></td>'
      + '</tr>';
  }).join('');
}

function aprovarCadastro(id) {
  var store = getStore();
  var aluno = store.alunos.find(function(a){ return a.id===id; });
  if (!aluno) return;
  aluno.statusCadastro = 'aprovado';
  saveStore(store);
  toast('Cadastro de ' + aluno.nome.split(' ')[0] + ' aprovado!', 'success');
  renderAprovacoes(); afterStoreReady(function(){ refreshActivePanel(); });
}

function rejeitarCadastro(id) {
  if (!confirm('Rejeitar este cadastro?')) return;
  var store = getStore();
  var aluno = store.alunos.find(function(a){ return a.id===id; });
  if (!aluno) return;
  aluno.statusCadastro = 'rejeitado';
  saveStore(store);
  toast('Cadastro de ' + aluno.nome.split(' ')[0] + ' rejeitado.', 'warning');
  renderAprovacoes(); afterStoreReady(function(){ refreshActivePanel(); });
}

/* ── Alunos ── */
function renderAlunos() {
  var store    = getStore();
  var busca    = (document.getElementById('busca-pac') ? document.getElementById('busca-pac').value : '').toLowerCase();
  var aprovados = Permissions.getAlunosVisiveis(_sess, store.alunos);
  var lista    = aprovados.slice();
  if (_tabPac==='menores') lista = lista.filter(function(a){ return isMenor(a.dataNascimento); });
  if (_tabPac==='maiores') lista = lista.filter(function(a){ return !isMenor(a.dataNascimento); });
  if (_cursoPacFiltro!=='todos') lista = lista.filter(function(a){ return alunoCursoNome(a, getStore())===_cursoPacFiltro; });
  if (busca) lista = lista.filter(function(a){ return a.nome.toLowerCase().indexOf(busca)>=0 || a.matricula.indexOf(busca)>=0; });

  var tcT=document.getElementById('tc-todos'), tcM=document.getElementById('tc-menores'), tcA=document.getElementById('tc-maiores');
  if (tcT) tcT.textContent = aprovados.length;
  if (tcM) tcM.textContent = aprovados.filter(function(a){ return isMenor(a.dataNascimento); }).length;
  if (tcA) tcA.textContent = aprovados.filter(function(a){ return !isMenor(a.dataNascimento); }).length;

  var cursos = aprovados.map(function(a){ return alunoCursoNome(a, getStore()); }).filter(function(v,i,arr){ return arr.indexOf(v)===i; }).sort();
  var ctEl = document.getElementById('curso-tabs');
  if (ctEl) ctEl.innerHTML = '<button class="curso-btn ' + (_cursoPacFiltro==='todos'?'active':'') + '" onclick="setCursoPac(\'todos\')">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Todos<span class="curso-count">'+cursos.length+'</span></button>'
    + cursos.map(function(c){ return '<button class="curso-btn ' + (_cursoPacFiltro===c?'active':'') + '" onclick="setCursoPac(\'' + escape(c) + '\')">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
        + escape(c) + '<span class="curso-count">' + aprovados.filter(function(a){ return alunoCursoNome(a, getStore())===c; }).length + '</span></button>'; }).join('');

  var tbody = document.getElementById('tbody-alunos');
  if (!tbody) return;
  if (!lista.length) { tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:44px;color:var(--gray-400)">Nenhum aluno encontrado</td></tr>'; return; }
  tbody.innerHTML = lista.map(function(a){
    var idade = calcIdade(a.dataNascimento), menor = isMenor(a.dataNascimento);
    var qtdC  = store.atendimentos.filter(function(c){ return c.idAluno===a.id; }).length;
    var ultC  = store.atendimentos.filter(function(c){ return c.idAluno===a.id; }).sort(function(x,y){ return new Date(y.criacao)-new Date(x.criacao); })[0];
    var pcdBadge = a.pcd
      ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;background:var(--senac-navy-soft);color:var(--senac-navy);padding:4px 10px;border-radius:20px;border:1px solid var(--senac-navy-light);white-space:nowrap">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px"><polyline points="20 6 9 17 4 12"/></svg>Sim — PCD</span>'
      : '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;background:var(--gray-50);color:var(--gray-400);padding:4px 10px;border-radius:20px;border:1px solid var(--gray-100);white-space:nowrap">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Não</span>';
    var ageBadgeRow = menor
      ? '<span class="age-badge menor" style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><circle cx="12" cy="5" r="3"/><path d="M8 10h8l1 7H7l1-7z"/></svg>Menor · '+idade+'a</span>'
      : '<span class="age-badge maior" style="display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Maior · '+idade+'a</span>';
    return '<tr>'
      + '<td><div style="display:flex;align-items:center;gap:10px">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--senac-orange),var(--senac-navy));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">'+escape(a.nome.charAt(0))+'</div>'
      + '<div><div style="font-weight:700;font-size:13.5px">'+escape(a.nome)+'</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400);margin-top:1px">'+escape(a.email||'—')+'</div></div></div></td>'
      + '<td><code style="font-size:12.5px">'+escape(a.matricula)+'</code></td>'
      + '<td><div style="font-weight:600;font-size:13px">'+escape(alunoCursoNome(a, getStore()))+'</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400);margin-top:2px">'+escape(a.turma)+' · <span style="font-weight:600;color:var(--senac-navy)">'+turnoLabel(a.turnoCurso)+'</span></div></td>'
      + '<td>'+ageBadgeRow+'</td>'
      + '<td><div style="font-size:13px;font-weight:500">'+fmtDate(a.dataNascimento+'T12:00:00')+'</div>'
      + (a.telefone?'<div style="font-size:11.5px;color:var(--gray-400);margin-top:1px">'+escape(a.telefone)+'</div>':'')+'</td>'
      + '<td style="text-align:center">'+pcdBadge+'</td>'
      + '<td style="text-align:center"><div style="display:flex;flex-direction:column;align-items:center;gap:3px">'
      + '<strong style="font-size:17px;line-height:1">'+qtdC+'</strong>'
      + (ultC?'<div>'+statusBadge(ultC.status)+'</div>':'<div style="font-size:11px;color:var(--gray-400)">nenhuma</div>')
      + '</div></td>'
      + '<td class="td-actions"><button class="btn btn-outline btn-sm" onclick="verHistorico(\'' + a.id + '\',\'' + escape(a.nome.split(' ')[0]) + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Histórico</button></td>'
      + '</tr>';
  }).join('');
}

function setTabPac(tab, el) {
  _tabPac = tab;
  document.querySelectorAll('.tab-btn').forEach(function(t){ t.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderAlunos();
}
function setCursoPac(curso) { _cursoPacFiltro = curso; renderAlunos(); }

function verHistorico(idAluno, nome) {
  var store = getStore();
  var cons  = store.atendimentos.filter(function(c){ return c.idAluno===idAluno; }).sort(function(a,b){ return new Date(b.criacao)-new Date(a.criacao); });
  var tEl   = document.getElementById('mh-title'), bEl = document.getElementById('mh-body');
  if (tEl) tEl.textContent = 'Histórico — ' + nome;
  if (!bEl) return;
  bEl.innerHTML = '<p style="font-size:13px;color:var(--gray-500);margin-bottom:16px">'+cons.length+' atendimento(s)</p>'
    + (!cons.length ? '<div class="empty-state" style="padding:24px"><div class="empty-state-title">Nenhum atendimento</div></div>'
      : cons.map(function(c){
          return '<div style="border:1.5px solid var(--gray-100);border-radius:var(--r-sm);padding:13px 15px;margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">'
            + '<strong style="font-size:13.5px">'+escape(c.motivoSolicitação.length>55?c.motivoSolicitação.slice(0,55)+'…':c.motivoSolicitação)+'</strong>'
            + statusBadge(c.status)+'</div>'
            + '<div style="font-size:12px;color:var(--gray-400)">'+fmtDate(c.dataPreferencial)+' · '+turnoLabel(c.turno)+' · Solicitado por: '+escape(solicitanteNome(c))+'</div>'
            + (c.obsPsicologa?'<div class="ci-obs" style="margin-top:7px">'+escape(c.obsPsicologa)+'</div>':'')
            + (c.relatorioConsulta?'<div class="ci-obs" style="margin-top:7px;border-color:var(--green-mid);background:var(--green-soft)"><strong>Relatório da consulta:</strong><br>'+escape(c.relatorioConsulta)+'</div>':'')
            + '</div>';
        }).join(''));
  openModal('modal-hist');
}


function agendarAlunoDireto(idAluno) {
  var store = getStore();
  var aluno = store.alunos.find(function(a){ return a.id===idAluno && a.unidadeId===_sess.unidadeId; });
  if (!aluno) { toast('Aluno não encontrado para esta unidade.', 'warning'); return; }
  var nova = {
    id: genId('c'),
    idAluno: idAluno,
    motivoSolicitação: 'Atendimento criado diretamente pela psicóloga.',
    obsResponsavel: '',
    dataPreferencial: new Date().toISOString().slice(0,10),
    horarioPreferencial: '',
    turno: Validators.normalizeTurno(aluno.turnoCurso) || '',
    agendadoPor: _sess.id,
    unidadeId: _sess.unidadeId,
    tipoAtendimento: 'dentro',
    categoriaAtendimento: '',
    psicologoId: _sess.id,
    psicologoApiId: _sess.apiId || null,
    psicologo: _sess.nome || '',
    status: 'confirmada',
    obsPsicologa: '',
    criacao: new Date().toISOString()
  };
  store.atendimentos.push(nova);
  saveStore(store);
  renderDashboard(); renderIndicativos(); renderAtendimentos(); renderAlunos(); renderCalendario(); updateBadge();
  abrirModalAtendimento(nova.id);
}

/* ── Chat ── */
var _chatExtras = [];

function roleChatLabel(u) {
  var r = (u && u.role) || '';
  if (r === 'psicologa') return 'Psicóloga';
  if (r === 'instrutor') return 'Instrutor';
  if (r === 'coordenacao') return 'Coordenação';
  if (r === 'administrador') return 'Administrador';
  return 'Usuário';
}
function iniciaisChat(nome) {
  var partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length-1].charAt(0) : '')).toUpperCase();
}
function usuariosChatDisponiveis() {
  var store = getStore();
  return allUsuarios(store).filter(function(u){
    if (!u || u.id === _sess.id) return false;
    if (u.statusCadastro === 'inativo' || u.ativo === false) return false;
    return !u.unidadeId || !_sess.unidadeId || u.unidadeId === _sess.unidadeId || u.role === 'administrador';
  }).sort(function(a,b){ return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
}
function usuarioChatPorId(uid) {
  return usuariosChatDisponiveis().find(function(u){ return u.id === uid || u.apiId === uid || u.id === apiIdCompat('usr', uid); }) || null;
}
function mensagensComContato(uid) {
  var store = getStore();
  return (store.mensagens || []).filter(function(m){
    return (m.de === _sess.id && m.para === uid) || (m.de === uid && m.para === _sess.id);
  }).sort(function(a,b){ return new Date(a.criacao || 0) - new Date(b.criacao || 0); });
}
function chatMetaWhatsApp(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return fmtDatetime(iso);
  var hoje = new Date();
  var ontem = new Date(); ontem.setDate(hoje.getDate()-1);
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  var hora = d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  if (sameDay(d, hoje)) return 'Hoje às ' + hora;
  if (sameDay(d, ontem)) return 'Ontem às ' + hora;
  return d.toLocaleDateString('pt-BR') + ' às ' + hora;
}
function chatDateKey(iso) {
  var d = new Date(iso || '');
  if (isNaN(d.getTime())) return 'Sem data';
  return d.toISOString().slice(0,10);
}
function chatDateLabel(iso) {
  if (!iso) return 'Sem data';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return 'Sem data';
  var hoje = new Date();
  var ontem = new Date(); ontem.setDate(hoje.getDate()-1);
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  if (sameDay(d, hoje)) return 'Hoje';
  if (sameDay(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'});
}
function contatosChatAtuais() {
  var ids = [];
  (getStore().mensagens || []).forEach(function(m){
    if (m.de === _sess.id && m.para) ids.push(m.para);
    if (m.para === _sess.id && m.de) ids.push(m.de);
  });
  (_chatExtras || []).forEach(function(id){ ids.push(id); });
  ids = Array.from(new Set(ids));
  var usuarios = usuariosChatDisponiveis();
  return ids.map(function(id){ return usuarios.find(function(u){ return u.id === id; }); }).filter(Boolean).sort(function(a,b){
    var ma = mensagensComContato(a.id).slice(-1)[0];
    var mb = mensagensComContato(b.id).slice(-1)[0];
    return new Date((mb && mb.criacao) || 0) - new Date((ma && ma.criacao) || 0);
  });
}
function renderChatTabs() {
  var tabsEl = document.getElementById('chat-tabs');
  if (!tabsEl) return;
  var contatos = contatosChatAtuais();
  if (!contatos.length) {
    tabsEl.innerHTML = '<div class="chat-empty-msg" style="padding:22px">Nenhuma conversa ainda.<br>Clique em <b>+ Nova</b> para iniciar.</div>';
    atualizarChatHeader(null);
    renderChatMsgs(_chatPara);
    return;
  }
  tabsEl.innerHTML = contatos.map(function(u){
    var msgs = mensagensComContato(u.id);
    var ultima = msgs[msgs.length-1];
    var unread = getStore().mensagens.filter(function(m){ return m.de===u.id && m.para===_sess.id && !m.lida; }).length;
    return '<button class="chat-tab chat-contact-item' + (_chatPara===u.id?' active':'') + '" id="sbtn-' + u.id + '" onclick="selecionarChat(\'' + u.id + '\')">'
      + '<span class="chat-contact-avatar">' + escape(iniciaisChat(u.nome)) + '</span>'
      + '<span class="chat-contact-text"><span class="chat-contact-name">' + escape(u.nome || 'Usuário') + '</span>'
      + '<span class="chat-contact-role">' + escape(roleChatLabel(u)) + '</span>'
      + '<span class="chat-contact-preview">' + escape(ultima ? String(ultima.texto || '').slice(0,44) : 'Clique para abrir conversa') + '</span></span>'
      + (unread ? '<span class="chat-unread">'+unread+'</span>' : '')
      + '</button>';
  }).join('');
  if (!_chatPara && contatos.length) selecionarChat(contatos[0].id);
  else if (_chatPara) renderChatMsgs(_chatPara);
}

function atualizarChatHeader(contato) {
  var el = document.getElementById('chat-current-header');
  if (!el) return;
  if (!contato) {
    el.innerHTML = '<div class="chat-current-avatar">?</div><div class="chat-current-info"><strong>Selecione uma conversa</strong><small>Escolha um contato na lateral ou inicie uma nova conversa</small></div>';
    return;
  }
  el.innerHTML = '<div class="chat-current-avatar">' + escape(iniciaisChat(contato.nome)) + '</div>'
    + '<div class="chat-current-info"><strong>' + escape(contato.nome || 'Usuário') + '</strong>'
    + '<small>' + escape(roleChatLabel(contato)) + '</small></div>';
}

function selecionarChat(uid) {
  _chatPara = uid;
  if (_chatExtras.indexOf(uid) < 0) _chatExtras.push(uid);
  document.querySelectorAll('.chat-tab').forEach(function(t){ t.classList.remove('active'); });
  var btn = document.getElementById('sbtn-'+uid); if (btn) btn.classList.add('active');
  apiFetch('/chat/mensagens/lidas/'+apiLongFromCompat(uid), {method:'PATCH'}).catch(function(){});
  renderChatMsgs(uid);
}

function renderChatMsgs(uid) {
  var contato = usuarioChatPorId(uid);
  atualizarChatHeader(contato);
  var msgs = contato ? mensagensComContato(uid) : [];
  var bodyEl = document.getElementById('chat-body');
  var input = document.getElementById('chat-txt');
  var btn = document.getElementById('chat-send-btn');
  if (input) input.disabled = !contato;
  if (btn) btn.disabled = !contato;
  if (!bodyEl) return;
  if (!contato) { bodyEl.innerHTML='<div class="chat-empty-msg">Selecione uma conversa na lateral ou clique em + Nova.</div>'; return; }
  if (!msgs.length) { bodyEl.innerHTML='<div class="chat-empty-msg">Nenhuma mensagem com este contato.<br>Digite abaixo para iniciar.</div>'; return; }
  var lastKey = null;
  bodyEl.innerHTML = '<div class="chat-messages-area">'
    + msgs.map(function(m){
        var key = chatDateKey(m.criacao);
        var sep = '';
        if (key !== lastKey) { lastKey = key; sep = '<div class="chat-day-separator">' + escape(chatDateLabel(m.criacao)) + '</div>'; }
        return sep + '<div class="chat-msg '+(m.de===_sess.id?'sent':'recv')+'">'
          + '<div class="chat-bubble">'+escape(m.texto)+'</div>'
          + '<div class="chat-meta">'+escape(chatMetaWhatsApp(m.criacao))+'</div></div>';
      }).join('') + '</div>';
  var area = bodyEl.querySelector('.chat-messages-area');
  if (area) area.scrollTop = area.scrollHeight;
}

function abrirNovoChat() {
  renderNovoChatUsuarios();
  openModal('modal-novo-chat');
}
function renderNovoChatUsuarios() {
  var el = document.getElementById('chat-user-list');
  if (!el) return;
  var qEl = document.getElementById('chat-user-search');
  var q = (qEl && qEl.value ? qEl.value : '').toLowerCase();
  var usuarios = usuariosChatDisponiveis().filter(function(u){
    var texto = [u.nome, u.usuario, u.email, roleChatLabel(u)].join(' ').toLowerCase();
    return !q || texto.indexOf(q) >= 0;
  });
  if (!usuarios.length) { el.innerHTML = '<div class="empty-state" style="padding:22px"><div class="empty-state-title">Nenhum usuário encontrado</div></div>'; return; }
  el.innerHTML = usuarios.map(function(u){
    return '<button type="button" class="chat-user-option" onclick="iniciarConversaComUsuario(\'' + u.id + '\')">'
      + '<span class="chat-contact-avatar">' + escape(iniciaisChat(u.nome)) + '</span>'
      + '<span><strong>' + escape(u.nome || 'Usuário') + '</strong><small>' + escape(u.email || u.usuario || '') + '</small></span>'
      + '<span class="chat-user-role-pill">' + escape(roleChatLabel(u)) + '</span>'
      + '</button>';
  }).join('');
}
function iniciarConversaComUsuario(uid) {
  if (_chatExtras.indexOf(uid) < 0) _chatExtras.push(uid);
  closeModal('modal-novo-chat');
  renderChatTabs();
  selecionarChat(uid);
}

function enviarMsgPsi() {
  var input = document.getElementById('chat-txt');
  var texto = input ? input.value.trim() : '';
  if (!texto || !_chatPara) { toast('Selecione um contato e escreva a mensagem.','warning'); return; }
  var store = getStore();
  store.mensagens.push({ id:genId('m'), de:_sess.id, para:_chatPara, unidadeId:_sess.unidadeId, texto:texto, criacao:new Date().toISOString(), lida:false });
  saveStore(store).catch(function(err){ toast(err && err.message ? err.message : 'Não foi possível enviar a mensagem.', 'error'); });
  if (input) input.value='';
  renderChatTabs();
  renderChatMsgs(_chatPara);
}

document.addEventListener('keydown', function(e){
  if (e.key==='Enter' && !e.shiftKey && document.activeElement && document.activeElement.id==='chat-txt') { e.preventDefault(); enviarMsgPsi(); }
});


/* ── Calendário ── */
var _calView = 'mes';
var _calDate = new Date();
var _agendaEventos = [];
var _agendaEventosCarregados = false;
var _agendaEventosCarregando = false;
var _agendaEventoSelecionado = null;
var _agendaEventoEditando = null;

function agendaEventoTipoLabel(tipo) {
  var t = String(tipo || '').toUpperCase();

  if (t === 'REUNIAO') return 'Reunião';
  if (t === 'LEMBRETE') return 'Lembrete';
  if (t === 'BLOQUEIO') return 'Bloqueio';
  if (t === 'OBSERVACAO') return 'Observação';
  if (t === 'ATENDIMENTO') return 'Atendimento';

  return 'Outro';
}

function agendaEventoCor(tipo) {
  var t = String(tipo || '').toUpperCase();

  if (t === 'REUNIAO') return '#c87f00';
  if (t === 'LEMBRETE') return '#2f7a5e';
  if (t === 'BLOQUEIO') return '#c0392b';
  if (t === 'OBSERVACAO') return '#1b4e9b';

  return '#6b7280';
}

function agendaEventoDataKey(ev) {
  if (!ev || !ev.dataInicio) return '';
  return String(ev.dataInicio).slice(0, 10);
}

function agendaEventoHora(data) {
  if (!data) return '';
  var texto = String(data);

  if (texto.indexOf('T') >= 0) {
    return texto.split('T')[1].slice(0, 5);
  }

  var d = new Date(texto);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function agendaEventoPeriodo(ev) {
  if (!ev) return '';

  var inicio = agendaEventoHora(ev.dataInicio);
  var fim = agendaEventoHora(ev.dataFim);

  if (inicio && fim) return inicio + ' às ' + fim;
  if (inicio) return inicio;

  return 'Dia inteiro';
}

function agendaEventoDataInput(ev) {
  return agendaEventoDataKey(ev) || new Date().toISOString().slice(0, 10);
}

function agendaEventoSetModalModo(edicao) {
  var modal = document.getElementById('modal-agenda-evento');
  if (!modal) return;

  var tituloModal = modal.querySelector('h3');
  if (tituloModal) tituloModal.textContent = edicao ? 'Editar evento' : 'Novo evento';

  var kicker = modal.querySelector('div[style*="letter-spacing"]');
  if (kicker) kicker.textContent = edicao ? 'Agenda da Psicóloga · Edição' : 'Agenda da Psicóloga';

  var btnSalvar = modal.querySelector('button[onclick="salvarAgendaEvento()"]');
  if (btnSalvar) {
    btnSalvar.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>' +
        '<polyline points="17 21 17 13 7 13 7 21"/>' +
      '</svg>' +
      (edicao ? 'Salvar alterações' : 'Salvar evento');
  }
}

function preencherModalAgendaEvento(ev) {
  var titulo = document.getElementById('mev-titulo');
  var tipo = document.getElementById('mev-tipo');
  var dataEl = document.getElementById('mev-data');
  var inicio = document.getElementById('mev-inicio');
  var fim = document.getElementById('mev-fim');
  var desc = document.getElementById('mev-descricao');

  if (titulo) titulo.value = ev && ev.titulo ? ev.titulo : '';
  if (tipo) tipo.value = ev && ev.tipo ? ev.tipo : 'REUNIAO';
  if (dataEl) dataEl.value = ev ? agendaEventoDataInput(ev) : _calDate.toISOString().slice(0, 10);
  if (inicio) inicio.value = ev ? (agendaEventoHora(ev.dataInicio) || '09:00') : '09:00';
  if (fim) fim.value = ev ? (agendaEventoHora(ev.dataFim) || '10:00') : '10:00';
  if (desc) desc.value = ev && ev.descricao ? ev.descricao : '';
}


function carregarAgendaEventos(force) {
  if (_agendaEventosCarregando) return Promise.resolve(_agendaEventos);
  if (_agendaEventosCarregados && !force) return Promise.resolve(_agendaEventos);

  _agendaEventosCarregando = true;

  return apiFetch('/agenda-eventos')
    .then(function(lista) {
      _agendaEventos = Array.isArray(lista) ? lista : [];
      _agendaEventosCarregados = true;
      return _agendaEventos;
    })
    .catch(function(err) {
      console.warn('Não foi possível carregar eventos da agenda:', err.message || err);
      return _agendaEventos;
    })
    .finally(function() {
      _agendaEventosCarregando = false;
    });
}

function abrirModalAgendaEvento(dataPreSel) {
  _agendaEventoEditando = null;
  _agendaEventoSelecionado = null;
  agendaEventoSetModalModo(false);

  var data = dataPreSel || _calDate.toISOString().slice(0, 10);

  var fakeEvento = {
    titulo: '',
    tipo: 'REUNIAO',
    dataInicio: data + 'T09:00:00',
    dataFim: data + 'T10:00:00',
    descricao: ''
  };

  preencherModalAgendaEvento(fakeEvento);

  openModal('modal-agenda-evento');
}

function abrirModalEditarAgendaEvento(id) {
  var ev = _agendaEventos.find(function(item) {
    return String(item.id) === String(id);
  });

  if (!ev) {
    toast('Evento não encontrado.', 'warning');
    return;
  }

  _agendaEventoEditando = ev;
  _agendaEventoSelecionado = ev;
  agendaEventoSetModalModo(true);
  preencherModalAgendaEvento(ev);

  closeModal('modal-agenda-detalhe');
  setTimeout(function() {
    openModal('modal-agenda-evento');
  }, 120);
}

function montarDataHoraAgenda(data, hora) {
  if (!data) return '';
  if (!hora) return data + 'T00:00:00';
  return data + 'T' + hora + ':00';
}

function salvarAgendaEvento() {
  var titulo = document.getElementById('mev-titulo')?.value.trim();
  var tipo = document.getElementById('mev-tipo')?.value || 'OUTRO';
  var data = document.getElementById('mev-data')?.value;
  var inicio = document.getElementById('mev-inicio')?.value;
  var fim = document.getElementById('mev-fim')?.value;
  var descricao = document.getElementById('mev-descricao')?.value.trim();

  if (!titulo) {
    toast('Informe o título do evento.', 'warning');
    return;
  }

  if (!data) {
    toast('Informe a data do evento.', 'warning');
    return;
  }

  var payload = {
    titulo: titulo,
    descricao: descricao || null,
    tipo: tipo,
    dataInicio: montarDataHoraAgenda(data, inicio),
    dataFim: fim ? montarDataHoraAgenda(data, fim) : null,
    diaInteiro: !inicio,
    cor: agendaEventoCor(tipo),
    psicologoId: apiLongFromCompat(_sess.apiId || _sess.id),
    unidadeId: apiLongFromCompat(_sess.unidadeId)
  };

  var editando = _agendaEventoEditando && _agendaEventoEditando.id;
  var url = editando ? ('/agenda-eventos/' + _agendaEventoEditando.id) : '/agenda-eventos';
  var method = editando ? 'PUT' : 'POST';

  apiFetch(url, {
    method: method,
    body: JSON.stringify(payload)
  })
    .then(function(eventoSalvo) {
      if (editando) {
        _agendaEventos = _agendaEventos.map(function(ev) {
          return String(ev.id) === String(eventoSalvo.id) ? eventoSalvo : ev;
        });

        toast('Evento atualizado no calendário!', 'success');
      } else {
        _agendaEventos.push(eventoSalvo);
        toast('Evento salvo no calendário!', 'success');
      }

      _agendaEventoEditando = null;
      _agendaEventoSelecionado = null;

      agendaEventoSetModalModo(false);
      closeModal('modal-agenda-evento');
      renderCalendario();
    })
    .catch(function(err) {
      toast(err.message || 'Não foi possível salvar o evento.', 'error');
    });
}

function abrirDetalheAgendaEvento(id) {
  var ev = _agendaEventos.find(function(item) {
    return String(item.id) === String(id);
  });

  if (!ev) {
    toast('Evento não encontrado.', 'warning');
    return;
  }

  _agendaEventoSelecionado = ev;
  _agendaEventoEditando = null;

  var title = document.getElementById('mae-title');
  var body = document.getElementById('mae-body');

  if (title) title.textContent = ev.titulo || 'Evento';

  if (body) {
    body.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
        '<span style="width:10px;height:10px;border-radius:999px;background:' + agendaEventoCor(ev.tipo) + ';display:inline-block"></span>' +
        '<strong style="font-size:13px;color:var(--senac-navy)">' + escape(agendaEventoTipoLabel(ev.tipo)) + '</strong>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="detail-label">Data e horário</div>' +
        '<div class="detail-value">' + escape(fmtDate(agendaEventoDataKey(ev)) + ' · ' + agendaEventoPeriodo(ev)) + '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="detail-label">Descrição</div>' +
        '<div class="detail-value">' + escape(ev.descricao || 'Nenhuma descrição informada.') + '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<div class="detail-label">Unidade</div>' +
        '<div class="detail-value">' + escape(ev.unidade || nomeUnidade(_sess.unidadeId)) + '</div>' +
      '</div>' +

      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">' +
        '<button class="btn btn-orange" onclick="abrirModalEditarAgendaEvento(\'' + ev.id + '\')" style="flex:1;justify-content:center">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 20h9"/>' +
            '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' +
          '</svg>' +
          'Editar' +
        '</button>' +
      '</div>';
  }

  openModal('modal-agenda-detalhe');
}

function excluirAgendaEventoSelecionado() {
  if (!_agendaEventoSelecionado || !_agendaEventoSelecionado.id) {
    closeModal('modal-agenda-detalhe');
    return;
  }

  if (!confirm('Deseja excluir este evento da agenda?')) {
    return;
  }

  apiFetch('/agenda-eventos/' + _agendaEventoSelecionado.id, {
    method: 'DELETE'
  })
    .then(function() {
      _agendaEventos = _agendaEventos.filter(function(ev) {
        return String(ev.id) !== String(_agendaEventoSelecionado.id);
      });

      _agendaEventoSelecionado = null;
      _agendaEventoEditando = null;

      closeModal('modal-agenda-detalhe');
      toast('Evento excluído da agenda.', 'success');
      renderCalendario();
    })
    .catch(function(err) {
      toast(err.message || 'Não foi possível excluir o evento.', 'error');
    });
}

function agendaEventoCard(ev, compact) {
  var cor = agendaEventoCor(ev.tipo);
  var hora = agendaEventoPeriodo(ev);
  var titulo = escape(ev.titulo || 'Evento');
  var tipo = escape(agendaEventoTipoLabel(ev.tipo));
  var desc = escape((ev.descricao || tipo).slice(0, compact ? 30 : 80));

  if (compact) {
    return '<button class="cal-event-pill" onclick="event.stopPropagation();abrirDetalheAgendaEvento(\'' + ev.id + '\')" style="border-left:3px solid ' + cor + ';background:rgba(27,78,155,0.06)">' +
      '<strong>' + escape(hora) + ' · ' + titulo + '</strong>' +
      '<span>' + tipo + '</span>' +
    '</button>';
  }

  return '<div class="cal-day-event" onclick="event.stopPropagation();abrirDetalheAgendaEvento(\'' + ev.id + '\')" style="background:rgba(27,78,155,0.06)">' +
    '<div class="cal-day-time" style="border-left:3px solid ' + cor + ';padding-left:8px">' +
      '<strong>' + escape(hora) + '</strong>' +
      '<span>' + tipo + '</span>' +
    '</div>' +
    '<div class="cal-day-body">' +
      '<h4>' + titulo + '</h4>' +
      '<p>' + desc + '</p>' +
      '<div><span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:var(--gray-50);color:var(--senac-navy);padding:4px 9px;border-radius:999px;border:1px solid var(--gray-100)">Evento da agenda</span></div>' +
    '</div>' +
  '</div>';
}


function setCalView(v, el) {
  _calView = v;
  document.querySelectorAll('#panel-calendario .tab-btn').forEach(function(b){ b.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderCalendario();
}
function calNavPrev() {
  if (_calView==='mes') { _calDate.setMonth(_calDate.getMonth()-1); }
  else if (_calView==='semana') { _calDate.setDate(_calDate.getDate()-7); }
  else { _calDate.setDate(_calDate.getDate()-1); }
  renderCalendario();
}
function calNavNext() {
  if (_calView==='mes') { _calDate.setMonth(_calDate.getMonth()+1); }
  else if (_calView==='semana') { _calDate.setDate(_calDate.getDate()+7); }
  else { _calDate.setDate(_calDate.getDate()+1); }
  renderCalendario();
}
function calHoje() { _calDate = new Date(); renderCalendario(); }

function renderCalendario() {
  if (!_agendaEventosCarregados && !_agendaEventosCarregando) {
    carregarAgendaEventos().then(function() {
      renderCalendario();
    });
  }

  var store = getStore();

  var atendimentos = store.atendimentos
    .filter(function(c) {
      return c.unidadeId === _sess.unidadeId &&
        ['confirmada', 'realizada', 'falta', 'aguardando'].indexOf(c.status) >= 0;
    })
    .sort(function(a, b) {
      var da = (a.dataPreferencial || '') + ' ' + (a.horarioPreferencial || '');
      var db = (b.dataPreferencial || '') + ' ' + (b.horarioPreferencial || '');
      return da.localeCompare(db);
    });

  var eventos = (_agendaEventos || []).filter(function(ev) {
    if (ev.psicologoId && _sess.apiId) {
      return Number(ev.psicologoId) === Number(_sess.apiId);
    }

    if (ev.unidadeId && _sess.unidadeId) {
      return unidadeIdCompat(ev.unidadeId) === _sess.unidadeId ||
        Number(ev.unidadeId) === Number(apiLongFromCompat(_sess.unidadeId));
    }

    return true;
  });

  var tit = document.getElementById('cal-titulo');
  var cont = document.getElementById('cal-container');

  if (!cont) return;

  var meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  var dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var hojeIso = new Date().toISOString().slice(0, 10);

  function atendimentoCard(c, compact) {
    var a = getAluno(c.idAluno);
    var nome = escape(a && a.nome || '—');
    var primeiroNome = escape(a ? a.nome.split(' ')[0] : '—');
    var hora = escape(c.horarioPreferencial || '--:--');
    var motivoBase = c.motivoSolicitação || 'Sem motivo informado';
    var motivo = escape(
      motivoBase.slice(0, compact ? 30 : 80) +
      (motivoBase.length > (compact ? 30 : 80) ? '…' : '')
    );

    var tipoAtend = c.tipoAtendimento || '';
    var isRemoto = tipoAtend === 'remoto' || c.turno === 'remoto';
    var turnoCurso = a ? Validators.normalizeTurno(a.turnoCurso) : '';
    var isForaHorario =
      !isRemoto &&
      (
        tipoAtend === 'fora' ||
        (
          turnoCurso &&
          Validators.normalizeTurno(c.turno) &&
          turnoCurso !== Validators.normalizeTurno(c.turno)
        )
      );

    var borderColor =
      isRemoto ? '#3b82f6' :
      isForaHorario ? '#f5c518' :
      c.status === 'confirmada' ? '#1e8449' :
      c.status === 'realizada' ? '#154360' :
      c.status === 'falta' ? '#c0392b' :
      '#c87f00';

    var bgCard =
      isRemoto ? 'rgba(37,99,235,0.06)' :
      isForaHorario ? 'rgba(247,163,0,0.06)' :
      '';

    var tipoLabel =
      isRemoto ? '📱 Remoto' :
      isForaHorario ? '⚠️ Fora do horário' :
      turnoLabel(c.turno);

    var telSpan =
      isRemoto && a && a.telefone
        ? '<span style="font-size:10px;color:#1d4ed8;font-weight:600">📞 ' + escape(a.telefone) + '</span>'
        : '';

    if (compact) {
      return '<button class="cal-event-pill" onclick="event.stopPropagation();abrirModalAtendimento(\'' + c.id + '\')" style="border-left:3px solid ' + borderColor + ';' + (bgCard ? 'background:' + bgCard : '') + '">' +
        '<strong>' + hora + ' · ' + primeiroNome + '</strong>' +
        '<span>' + escape(tipoLabel) + ' · ' + statusBadge(c.status) + '</span>' +
      '</button>';
    }

    return '<div class="cal-day-event" onclick="event.stopPropagation();abrirModalAtendimento(\'' + c.id + '\')" style="' + (bgCard ? 'background:' + bgCard + ';' : '') + '">' +
      '<div class="cal-day-time" style="border-left:3px solid ' + borderColor + ';padding-left:8px">' +
        '<strong>' + hora + '</strong>' +
        '<span>' + escape(tipoLabel) + '</span>' +
      '</div>' +
      '<div class="cal-day-body">' +
        '<h4>' + nome + '</h4>' +
        '<p>' + motivo + '</p>' +
        telSpan +
        '<div>' + statusBadge(c.status) + '</div>' +
        '<div class="cal-day-meta">' +
          '<span>Data: ' + fmtDate(c.dataPreferencial) + '</span>' +
          '<span>Solicitado por: ' + escape(solicitanteNome(c)) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function itensPorData(iso) {
    var cons = atendimentos.filter(function(c) {
      return c.dataPreferencial === iso;
    });

    var evs = eventos.filter(function(ev) {
      return agendaEventoDataKey(ev) === iso;
    });

    return { atendimentos: cons, eventos: evs };
  }

  if (_calView === 'mes') {
    if (tit) {
      tit.textContent = meses[_calDate.getMonth()] + ' ' + _calDate.getFullYear();
    }

    var ano = _calDate.getFullYear();
    var mes = _calDate.getMonth();
    var primeiro = new Date(ano, mes, 1).getDay();
    var totalDias = new Date(ano, mes + 1, 0).getDate();

    var html = '<div class="cal-grid-month">';

    dias.forEach(function(d) {
      html += '<div class="cal-weekday">' + d + '</div>';
    });

    for (var i = 0; i < primeiro; i++) {
      html += '<div></div>';
    }

    for (var d = 1; d <= totalDias; d++) {
      var dt = new Date(ano, mes, d);
      var iso = dt.toISOString().slice(0, 10);
      var itens = itensPorData(iso);
      var totalItens = itens.atendimentos.length + itens.eventos.length;
      var isHoje = iso === hojeIso;

      html += '<div class="cal-day-card' + (isHoje ? ' today' : '') + '" onclick="calDiaClick(\'' + iso + '\')" role="button" tabindex="0" title="Clique para ver a agenda de ' + d + '">';
      html += '<div class="cal-day-head">';
      html += '<div class="cal-day-number">' + d + '</div>';
      html += '<div class="cal-day-count">' + totalItens + ' item(ns)</div>';
      html += '</div>';

      html += '<div class="cal-events-list">';

      if (!totalItens) {
        html += '<div style="font-size:11px;color:var(--gray-300);padding:6px 2px">Nada marcado</div>';
      }

      itens.atendimentos.forEach(function(c) {
        html += atendimentoCard(c, true);
      });

      itens.eventos.forEach(function(ev) {
        html += agendaEventoCard(ev, true);
      });

      html += '</div></div>';
    }

    html += '</div>';

    cont.innerHTML = html;

    cont.querySelectorAll('.cal-day-card[role="button"]').forEach(function(card) {
      card.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          card.click();
        }
      });
    });

  } else if (_calView === 'semana') {
    var dow = _calDate.getDay();
    var inicio = new Date(_calDate);
    inicio.setDate(_calDate.getDate() - dow);

    if (tit) {
      var fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);

      tit.textContent =
        inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' — ' +
        fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    var htmlSemana = '<div class="cal-week-grid">';

    for (var w = 0; w < 7; w++) {
      var dtW = new Date(inicio);
      dtW.setDate(inicio.getDate() + w);

      var isoW = dtW.toISOString().slice(0, 10);
      var itensW = itensPorData(isoW);
      var totalW = itensW.atendimentos.length + itensW.eventos.length;
      var isHojeW = isoW === hojeIso;

      htmlSemana += '<div class="cal-week-col' + (isHojeW ? ' today' : '') + '">';
      htmlSemana += '<div class="cal-week-head">';
      htmlSemana += '<div style="font-size:11px;font-weight:800;color:var(--gray-400)">' + dias[dtW.getDay()] + '</div>';
      htmlSemana += '<div style="font-size:20px;font-weight:800;color:var(--ink)">' + dtW.getDate() + '</div>';
      htmlSemana += '<div style="font-size:11px;color:var(--gray-400)">' + totalW + ' item(ns)</div>';
      htmlSemana += '</div>';

      htmlSemana += '<div class="cal-week-body">';

      if (!totalW) {
        htmlSemana += '<div style="font-size:11px;color:var(--gray-300);text-align:center;padding:16px 0">Nada marcado</div>';
      }

      itensW.atendimentos.forEach(function(c) {
        var a = getAluno(c.idAluno);

        htmlSemana += '<div class="cal-week-event" onclick="abrirModalAtendimento(\'' + c.id + '\')" style="border-left:3px solid #c87f00">';
        htmlSemana += '<div class="cal-week-event-time" style="font-weight:800;color:#c87f00">' + escape(c.horarioPreferencial || '--:--') + '</div>';
        htmlSemana += '<div class="cal-week-event-name" style="font-weight:700">' + escape(a && a.nome || '—') + '</div>';
        htmlSemana += '<div style="font-size:10px;color:var(--gray-400);margin-top:2px">Atendimento</div>';
        htmlSemana += '</div>';
      });

      itensW.eventos.forEach(function(ev) {
        var cor = agendaEventoCor(ev.tipo);

        htmlSemana += '<div class="cal-week-event" onclick="abrirDetalheAgendaEvento(\'' + ev.id + '\')" style="border-left:3px solid ' + cor + ';background:rgba(27,78,155,0.06)">';
        htmlSemana += '<div class="cal-week-event-time" style="font-weight:800;color:' + cor + '">' + escape(agendaEventoPeriodo(ev)) + '</div>';
        htmlSemana += '<div class="cal-week-event-name" style="font-weight:700">' + escape(ev.titulo || 'Evento') + '</div>';
        htmlSemana += '<div style="font-size:10px;color:var(--gray-400);margin-top:2px">' + escape(agendaEventoTipoLabel(ev.tipo)) + '</div>';
        htmlSemana += '</div>';
      });

      htmlSemana += '</div></div>';
    }

    htmlSemana += '</div>';

    cont.innerHTML = htmlSemana;

  } else {
    var isoDia = _calDate.toISOString().slice(0, 10);

    if (tit) {
      tit.textContent = _calDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }

    var itensD = itensPorData(isoDia);
    var totalD = itensD.atendimentos.length + itensD.eventos.length;

    var htmlDia = '<div class="cal-day-agenda">';

    if (!totalD) {
      htmlDia += '<div class="cal-day-empty">';
      htmlDia += '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin:0 auto 10px;display:block;opacity:.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
      htmlDia += 'Nada marcado neste dia';

      htmlDia += '<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
      htmlDia += '<button class="btn btn-outline btn-sm" onclick="abrirModalAgendaEvento(\'' + isoDia + '\')">+ Novo evento</button>';
      htmlDia += '<button class="btn btn-orange btn-sm" onclick="abrirModalAgendar(null,\'' + isoDia + '\')">+ Atendimento</button>';
      htmlDia += '</div></div>';
    } else {
      itensD.atendimentos.forEach(function(c) {
        htmlDia += atendimentoCard(c, false);
      });

      itensD.eventos.forEach(function(ev) {
        htmlDia += agendaEventoCard(ev, false);
      });
    }

    htmlDia += '</div>';

    cont.innerHTML = htmlDia;
  }
}

function calDiaClick(iso) {
  _calDate = new Date(iso+'T12:00:00');
  setCalView('dia', document.getElementById('cal-btn-dia'));
}


/* ── Modal Novo Agendamento ── */
var _magAlunoId = null;

function abrirModalAgendar(idAluno, dataPreSel) {
  var store = getStore();
  var alunos = Permissions.getAlunosVisiveis(_sess, store.alunos);
  var sel = document.getElementById('mag-aluno-sel');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione o aluno...</option>'
      + alunos.map(function(a){ return '<option value="'+a.id+'">'+ a.nome +' — '+ a.matricula +'</option>'; }).join('');
  }
  _magAlunoId = null;
  var infoEl = document.getElementById('mag-aluno-info');
  if (infoEl) infoEl.style.display = 'none';
  var wrapEl = document.getElementById('mag-select-wrap');
  if (wrapEl) wrapEl.style.display = '';

  // Se já veio com aluno pré-selecionado
  if (idAluno) {
    if (sel) sel.value = idAluno;
    magSelecionarAluno();
  } else {
    _magAlunoId = null;
  }

  // Preenche a data atual no campo de data
  var dataEl = document.getElementById('mag-data');
  if (dataEl) dataEl.value = dataPreSel || new Date().toISOString().slice(0,10);

  // Limpa campos
  var motivoEl = document.getElementById('mag-motivo');
  if (motivoEl) motivoEl.value = '';
  var horaEl = document.getElementById('mag-hora');
  if (horaEl) horaEl.value = '';
  var turnoEl = document.getElementById('mag-turno');
  if (turnoEl) turnoEl.value = '';
  var tipoEl = document.getElementById('mag-tipo');
  if (tipoEl) tipoEl.value = '';
  var tipoInfoEl = document.getElementById('mag-tipo-info');
  if (tipoInfoEl) tipoInfoEl.style.display = 'none';

  openModal('modal-agendar');
}

function magSelecionarAluno() {
  var sel = document.getElementById('mag-aluno-sel');
  if (!sel || !sel.value) { _magAlunoId = null; return; }
  _magAlunoId = sel.value;
  var store = getStore();
  var a = store.alunos.find(function(x){ return x.id === _magAlunoId; });
  var infoEl = document.getElementById('mag-aluno-info');
  var nomeEl = document.getElementById('mag-aluno-nome');
  var detalheEl = document.getElementById('mag-aluno-detalhe');
  if (a && infoEl) {
    infoEl.style.display = '';
    if (nomeEl) nomeEl.textContent = a.nome;
    if (detalheEl) detalheEl.textContent = a.matricula + ' · ' + alunoCursoNome(a, getStore()) + ' · ' + turnoLabel(a.turnoCurso)
      + (a.telefone ? ' · 📞 ' + a.telefone : '');
    // Pré-seleciona o turno do aluno
    var turnoEl = document.getElementById('mag-turno');
    if (turnoEl && a.turnoCurso) {
      var t = Validators.normalizeTurno(a.turnoCurso);
      if (t) turnoEl.value = t;
    }
  }
  magAtualizarTipo();
}

function magAtualizarTipo() {
  var tipoEl = document.getElementById('mag-tipo');
  var infoEl = document.getElementById('mag-tipo-info');
  var turnoEl = document.getElementById('mag-turno');
  if (!tipoEl || !infoEl) return;
  var tipo = tipoEl.value;
  var store = getStore();
  var a = _magAlunoId ? store.alunos.find(function(x){ return x.id===_magAlunoId; }) : null;
  var tc = a ? Validators.normalizeTurno(a.turnoCurso) : '';
  if (!tipo) { infoEl.style.display='none'; return; }
  if (tipo==='remoto') {
    infoEl.style.display='';
    infoEl.style.background='#eff6ff';
    infoEl.style.border='1px solid #93c5fd';
    infoEl.style.color='#1d4ed8';
    var tel = a && a.telefone ? ' Contato do aluno: <strong>'+escape(a.telefone)+'</strong>' : ' (telefone não cadastrado)';
    infoEl.innerHTML = '📱 <strong>Atendimento Remoto</strong> — O psicólogo deve entrar em contato com o aluno para realizar a sessão.'+tel;
  } else if (tipo==='fora') {
    infoEl.style.display='';
    infoEl.style.background='#fefce8';
    infoEl.style.border='1px solid #fde047';
    infoEl.style.color='#854d0e';
    infoEl.innerHTML = '⚠️ <strong>Fora do horário do curso</strong> — Este atendimento será sinalizado como fora do turno do aluno'+(tc?' ('+turnoLabel(tc)+')':'')+'.'
  } else {
    infoEl.style.display='';
    infoEl.style.background='#f0fdf4';
    infoEl.style.border='1px solid #86efac';
    infoEl.style.color='#166534';
    infoEl.innerHTML = '✅ <strong>Dentro do horário do curso</strong>'+(tc?' — Turno: '+turnoLabel(tc):'')+'.'
    if (tc && turnoEl) turnoEl.value = tc;
  }
}

function confirmarNovoAgendamento() {
  if (!_magAlunoId) { toast('Selecione um aluno.', 'warning'); return; }
  var dataEl   = document.getElementById('mag-data');
  var turnoEl  = document.getElementById('mag-turno');
  var horaEl   = document.getElementById('mag-hora');
  var motivoEl = document.getElementById('mag-motivo');
  var tipoEl   = document.getElementById('mag-tipo');
  var data     = dataEl   ? dataEl.value.trim()   : '';
  var turno    = turnoEl  ? turnoEl.value.trim()  : '';
  var hora     = horaEl   ? horaEl.value.trim()   : '';
  var motivo   = motivoEl ? motivoEl.value.trim() : '';
  var tipo     = tipoEl   ? tipoEl.value.trim()   : '';
  if (!data)   { toast('Informe a data do atendimento.', 'warning'); return; }
  if (!tipo)   { toast('Selecione o tipo de atendimento.', 'warning'); return; }
  if (tipo!=='remoto' && !turno)  { toast('Selecione o turno.', 'warning'); return; }
  if (!hora)   { toast('Informe o horário da sessão.', 'warning'); return; }
  if (!motivo) { toast('Informe o motivo ou observação.', 'warning'); return; }

  var store = getStore();
  var alunoSelecionado = store.alunos.find(function(x){ return x.id === _magAlunoId; });
  if (tipo === 'dentro') {
    var compat = getCompatibilidadeAtendimento(alunoSelecionado, turno, hora);
    if (!compat.ok) {
      toast(compat.motivo + ' Para agendar fora do horário, altere o tipo para “Fora do horário do curso”.', 'warning');
      return;
    }
  }

  var nova = {
    id: genId('c'),
    idAluno: _magAlunoId,
    motivoSolicitação: motivo,
    obsResponsavel: '',
    dataPreferencial: data,
    horarioPreferencial: hora,
    turno: tipo==='remoto' ? 'remoto' : turno,
    tipoAtendimento: tipo,
    categoriaAtendimento: '',
    agendadoPor: _sess.id,
    psicologoId: _sess.id,
    psicologoApiId: _sess.apiId || null,
    psicologo: _sess.nome || '',
    unidadeId: _sess.unidadeId,
    status: 'confirmada',
    obsPsicologa: '',
    criacao: new Date().toISOString()
  };
  store.atendimentos.push(nova);

  var a = store.alunos.find(function(x){ return x.id === _magAlunoId; });
  saveStoreOrToast(store, 'Atendimento de ' + (a ? a.nome.split(' ')[0] : 'aluno') + ' criado para ' + data.split('-').reverse().join('/') + ' às ' + hora + '!')
    .then(function(){
      closeModal('modal-agendar');
      renderDashboard(); renderAtendimentos(); renderAlunos(); renderCalendario(); updateBadge();
    });
}

/* Inicializa */
afterStoreReady(function(){ refreshActivePanel(); updateBadge(); });
/* ── Gráficos Dashboard ── */
function renderGraficos(alunos, opts) {
  opts = opts || {};
  var store = getStore();
  if (!alunos) alunos = store.alunos.filter(function(a){ return a.unidadeId===_sess.unidadeId && a.statusCadastro==='ativo'; });
  var cores = ['#2d7ff9','#f97316','#10b981','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899','#84cc16','#6366f1'];
  var cursosMap = {};
  alunos.forEach(function(a){ var c=alunoCursoNome(a, getStore()); cursosMap[c]=(cursosMap[c]||0)+1; });
  var cursos = Object.keys(cursosMap).sort(function(a,b){ return cursosMap[b]-cursosMap[a] || a.localeCompare(b); });
  var total = alunos.length;
  function hexToRgb(hex) {
    hex = (hex || '').replace('#','');
    if (hex.length === 3) hex = hex.split('').map(function(x){ return x+x; }).join('');
    var n = parseInt(hex, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function lighten(hex, amt) {
    var c = hexToRgb(hex);
    var r = Math.min(255, Math.round(c.r + (255-c.r)*amt));
    var g = Math.min(255, Math.round(c.g + (255-c.g)*amt));
    var b = Math.min(255, Math.round(c.b + (255-c.b)*amt));
    return 'rgb('+r+','+g+','+b+')';
  }
  var canvas = document.getElementById('chart-pizza');
  if (canvas && canvas.getContext) {
    var style = getComputedStyle(document.documentElement);
    function cssVar(name, fallback) { return (style.getPropertyValue(name) || fallback).trim() || fallback; }
    function drawArc(ctx, cx, cy, radius, start, end, color, width, active) {
      var grad = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
      grad.addColorStop(0, lighten(color, active ? .34 : .24));
      grad.addColorStop(.55, color);
      grad.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, end);
      ctx.strokeStyle = grad;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    var box = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var size = Math.round(Math.min(box.width || 300, box.height || 300));
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);

    var W=size, H=size, cx=W/2, cy=H/2, radius=Math.min(cx,cy)-42, ring=34;
    var surface = cssVar('--white', '#ffffff');
    var ink = cssVar('--ink', '#0f172a');
    var muted = cssVar('--gray-400', '#94a3b8');
    var track = cssVar('--gray-100', '#eef2f7');
    var tip = document.getElementById('chart-pizza-tooltip');
    var segments = [];

    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,.20)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, radius+ring/2+9, 0, Math.PI*2);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.restore();

    var halo = ctx.createRadialGradient(cx, cy, radius-ring, cx, cy, radius+ring);
    halo.addColorStop(0, 'rgba(247,163,0,0)');
    halo.addColorStop(1, 'rgba(247,163,0,.08)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius+ring/2+10, 0, Math.PI*2);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.strokeStyle = track;
    ctx.lineWidth = ring;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (!total) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI/2, Math.PI*1.5);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = ring;
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sem dados', cx, cy);
    } else {
      var gap = Math.PI / 90;
      var ang = -Math.PI/2;
      segments = [];
      cursos.forEach(function(nome,i){
        var frac = cursosMap[nome] / total;
        var sweep = frac * Math.PI * 2;
        var start = ang + gap/2;
        var end = ang + sweep - gap/2;
        if (end < start) end = start + Math.max(sweep * .7, .018);
        segments.push({ nome:nome, valor:cursosMap[nome], frac:frac, start:start, end:end, color:cores[i%cores.length] });

        ctx.save();
        ctx.shadowColor = cores[i%cores.length] + '66';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
        drawArc(ctx, cx, cy, radius, start, end, cores[i%cores.length], ring, false);
        ctx.restore();

        if (frac >= .10) {
          var mid = start + (end-start)/2;
          var lx = cx + Math.cos(mid) * (radius + ring*.78);
          var ly = cy + Math.sin(mid) * (radius + ring*.78);
          ctx.beginPath();
          ctx.arc(lx, ly, 15, 0, Math.PI*2);
          ctx.fillStyle = surface;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = cores[i%cores.length];
          ctx.stroke();
          ctx.fillStyle = ink;
          ctx.font = '900 10px "DM Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(Math.round(frac*100)+'%', lx, ly);
        }
        ang += sweep;
      });

      ctx.beginPath();
      ctx.arc(cx, cy, radius-ring*.68, 0, Math.PI*2);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 38px "DM Sans", sans-serif';
      ctx.fillText(total, cx, cy-11);
      ctx.font = '900 10.5px "DM Sans", sans-serif';
      ctx.fillStyle = muted;
      ctx.fillText(opts.totalLabel || (total === 1 ? 'ALUNO ATIVO' : 'ALUNOS ATIVOS'), cx, cy+19);
    }
    canvas._pizzaHit = { segments: segments, radius: radius, ring: ring, size: size };
    if (!canvas._pizzaBound) {
      canvas._pizzaBound = true;
      canvas.addEventListener('mousemove', function(e){
        var hit = canvas._pizzaHit;
        if (!hit) return;
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var dx = x - rect.width/2, dy = y - rect.height/2;
        var dist = Math.sqrt(dx*dx + dy*dy) * (hit.size / rect.width);
        var angle = Math.atan2(dy, dx);
        if (angle < -Math.PI/2) angle += Math.PI*2;
        var active = -1;
        hit.segments.forEach(function(s,i){
          var a = angle;
          if (a < s.start) a += Math.PI*2;
          if (dist >= hit.radius-hit.ring*.78 && dist <= hit.radius+hit.ring*.9 && a >= s.start && a <= s.end) active = i;
        });
        document.querySelectorAll('#chart-pizza-legend .pizza-legend-item').forEach(function(el){
          el.classList.toggle('active', Number(el.getAttribute('data-i')) === active);
        });
        if (tip && active >= 0 && hit.segments[active]) {
          var s = hit.segments[active];
          tip.innerHTML = '<strong>'+escape(s.nome)+'</strong><span>'+s.valor+' aluno'+(s.valor!==1?'s':'')+' · '+Math.round(s.frac*100)+'%</span>';
          tip.style.left = x + 'px';
          tip.style.top = y + 'px';
          tip.style.display = 'block';
        } else if (tip) {
          tip.style.display = 'none';
        }
      });
      canvas.addEventListener('mouseleave', function(){
        if (tip) tip.style.display = 'none';
        document.querySelectorAll('.pizza-legend-item').forEach(function(el){ el.classList.remove('active'); });
      });
    }
  }
  var summary = document.getElementById('chart-pizza-summary');
  if (summary) {
    if (cursos.length && total) {
      var top = cursos[0], topN = cursosMap[top], topPct = Math.round(topN/total*100);
      summary.innerHTML = '<div class="pizza-summary-kicker">Maior concentracao</div>'
        + '<div class="pizza-summary-title">' + escape(top) + '</div>'
        + '<div class="pizza-summary-meta">' + topN + ' aluno' + (topN!==1?'s':'') + ' · ' + topPct + '% ' + escape(opts.baseLabel || 'da base ativa') + '</div>';
    } else {
      summary.innerHTML = '<div class="pizza-summary-kicker">Distribuicao</div>'
        + '<div class="pizza-summary-title">Sem dados para exibir</div>'
        + '<div class="pizza-summary-meta">' + escape(opts.emptyMeta || 'Cadastre alunos ativos para popular o grafico.') + '</div>';
    }
  }
  var leg=document.getElementById('chart-pizza-legend');
  if (leg) {
    leg.innerHTML = cursos.length ? cursos.map(function(nome,i){
      var n=cursosMap[nome], pct=total?Math.round(n/total*100):0;
      return '<div class="pizza-legend-item" data-i="'+i+'">'
        +'<div class="pizza-legend-swatch" style="background:linear-gradient(180deg,'+lighten(cores[i%cores.length],.22)+','+cores[i%cores.length]+')"></div>'
        +'<div style="min-width:0"><div class="pizza-legend-name">'+escape(nome)+'</div>'
        +'<div class="pizza-legend-meta">'+n+' aluno'+(n!==1?'s':'')+'</div>'
        +'<div class="pizza-legend-track"><div class="pizza-legend-fill" style="--pct:'+pct+'%;--c:'+cores[i%cores.length]+'"></div></div></div>'
        +'<div class="pizza-legend-value">'+pct+'%<span class="pizza-legend-pct">'+n+'/'+total+'</span></div>'
        +'</div>';
    }).join('') : '<div class="pizza-legend-item"><div class="pizza-legend-swatch" style="background:#cbd5e1"></div><div><div class="pizza-legend-name">Sem cursos no período</div><div class="pizza-legend-meta">Não há alunos atendidos para visualizar a distribuição.</div></div><div class="pizza-legend-value">0%</div></div>';
  }
  var idadesMap={};
  alunos.forEach(function(a){ var id=calcIdade(a.dataNascimento); if(id!==null) idadesMap[id]=(idadesMap[id]||0)+1; });
  var idades=Object.keys(idadesMap).map(Number).sort(function(a,b){return a-b;});
  var canvas2=document.getElementById('chart-linha');
  if (canvas2 && canvas2.getContext) {
    canvas2.width=canvas2.offsetWidth||460; canvas2.height=240;
    var ctx2=canvas2.getContext('2d');
    var PL=44,PR=16,PT=16,PB=36,W2=canvas2.width,H2=canvas2.height;
    ctx2.clearRect(0,0,W2,H2);
    if (!idades.length) {
      ctx2.fillStyle='#94a3b8'; ctx2.font='13px sans-serif'; ctx2.textAlign='center';
      ctx2.fillText('Nenhum dado de idade cadastrado', W2/2, H2/2); return;
    }
    var vals=idades.map(function(id){return idadesMap[id];}), maxV=Math.max.apply(null,vals)||1;
    var xStep=idades.length>1?(W2-PL-PR)/(idades.length-1):0;
    function px(i){return PL+i*xStep;} function py(v){return PT+(H2-PT-PB)*(1-v/maxV);}
    ctx2.strokeStyle='rgba(100,116,139,0.12)'; ctx2.lineWidth=1;
    for(var g=0;g<=4;g++){
      var gy=PT+(H2-PT-PB)*g/4;
      ctx2.beginPath(); ctx2.moveTo(PL,gy); ctx2.lineTo(W2-PR,gy); ctx2.stroke();
      ctx2.fillStyle='#94a3b8'; ctx2.font='10px sans-serif'; ctx2.textAlign='right';
      ctx2.fillText(Math.round(maxV*(1-g/4)),PL-5,gy+3);
    }
    ctx2.beginPath(); ctx2.moveTo(px(0),py(vals[0]));
    vals.forEach(function(v,i){if(i>0)ctx2.lineTo(px(i),py(v));});
    ctx2.lineTo(px(vals.length-1),H2-PB); ctx2.lineTo(px(0),H2-PB); ctx2.closePath();
    ctx2.fillStyle='rgba(45,127,249,0.1)'; ctx2.fill();
    ctx2.beginPath(); ctx2.moveTo(px(0),py(vals[0]));
    vals.forEach(function(v,i){if(i>0)ctx2.lineTo(px(i),py(v));});
    ctx2.strokeStyle='#2d7ff9'; ctx2.lineWidth=2.5; ctx2.lineJoin='round'; ctx2.stroke();
    vals.forEach(function(v,i){
      ctx2.beginPath(); ctx2.arc(px(i),py(v),4,0,Math.PI*2);
      ctx2.fillStyle='#2d7ff9'; ctx2.strokeStyle='var(--surface,#fff)'; ctx2.lineWidth=2; ctx2.fill(); ctx2.stroke();
    });
    var step=idades.length>12?Math.ceil(idades.length/12):1;
    ctx2.fillStyle='#64748b'; ctx2.font='11px sans-serif'; ctx2.textAlign='center';
    idades.forEach(function(id,i){if(i%step===0)ctx2.fillText(id+' anos',px(i),H2-PB+16);});
    ctx2.save(); ctx2.translate(11,PT+(H2-PT-PB)/2); ctx2.rotate(-Math.PI/2);
    ctx2.font='10px sans-serif'; ctx2.fillStyle='#94a3b8'; ctx2.textAlign='center';
    ctx2.fillText('nº de alunos',0,0); ctx2.restore();
    if (typeof renderAgeDistributionChart === 'function') renderAgeDistributionChart(alunos, 'chart-linha');
  }
}


/* Atualização quase em tempo real: usa polling seguro para manter chat/dashboards sincronizados. */
if (!window.__sapRealtimeSyncStarted) {
  window.__sapRealtimeSyncStarted = true;
  setInterval(function(){
    if (getSession && getSession() && typeof syncStoreFromApi === 'function') {
      syncStoreFromApi().then(function(){
        if (document.querySelector('.nav-link.active[data-panel="panel-chat"]')) {
          if (typeof renderChat === 'function') renderChat();
          if (typeof renderChatTabs === 'function') renderChatTabs();
        }
      });
    }
  }, 5000);
}


/* v2.3.0 - Relatório anual PDF refeito: capa, indicativos anuais e resumo mensal */
var SAP_SENAC_LOGO_JPG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAGQAyADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACo7m8s7NDJd3UcSgZLSOFH615x8fP2qfhH+z/4Zuta8Y+LbKCeGItFbSzAFyB0r8Y/+ChX/BdLxt8aNSufB/wsjn0eG0dolubWUgOM4zwa+hyThrMs8qWpRtHrJ7f8E8HOeIsvyanepK8ukVufunYeNfCWqO8Vj4jspGQ4ZVuVz/Orqappkn3NRgb6TKf61/J9afthftU2WqPqdt8b9aTe+4oLtsV6z8Nv+Cq/7R3gYodV8c6lfbMZ33Dc/rX11bwyx0I3p1k/kfKUfEfBTdp0Wvmf02pPDJ/q5lb6MDTq/Bj4Wf8ABxV8Qvh/5Y1fwlcX+zGd8mc/rX0R8LP+DmTwt4znSy174VpZNwGkeQjP614GJ4G4hw92qfMvJo93D8aZFWS5p8r80z9X6K+Rfg3/AMFef2e/iV5Q1nxHp+meZjPmXAGPzNe++H/2ov2fPFCI+g/FvRbkuAQsd2Ca+exGWY/CytVptfI97D5lgcVHmp1E/md7RVPSPEGi6/F5+janFcpjO6JsirlcLTTsztTTV0FFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABR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';
var SAP_COR_AZUL = '#004A8D';
var SAP_COR_LARANJA = '#F7941D';
var SAP_COR_PESSEGO = '#FDC180';

function agruparPorCampoRelatorio(items, getLabel, cores) {
  var mapa = {};
  (items || []).forEach(function(item){
    var label = getLabel(item) || 'Não informado';
    mapa[label] = (mapa[label] || 0) + 1;
  });
  return Object.keys(mapa).sort(function(a,b){ return mapa[b]-mapa[a]; }).map(function(k, idx){
    return { label:k, value:mapa[k], color:(cores && cores[idx % cores.length]) || SAP_COR_AZUL };
  });
}

function gerarDadosRelatorioAnual(ano) {
  var store = getStore();
  ano = Number(ano || new Date().getFullYear());
  var atendAno = atendimentosDoPeriodo(ano, 'todos');
  var alunosAno = alunosDosAtendimentos(atendAno);
  var cores = [SAP_COR_AZUL, SAP_COR_LARANJA, '#21B573', '#7C3AED', '#F2A900', '#E94E77', '#64748B'];

  var cursos = agruparPorCampoRelatorio(alunosAno, function(a){ return alunoCursoNome(a, store) || a.curso || 'Sem curso'; }, cores);
  var tiposCursoQtd = { 'Aprendizagem':0, 'Técnico no Ensino Médio':0, 'Técnico':0, 'Outros':0 };
  alunosAno.forEach(function(a){ var t = tipoCursoDoAluno(a, store); tiposCursoQtd[t] = (tiposCursoQtd[t] || 0) + 1; });
  var tiposCurso = ['Aprendizagem','Técnico no Ensino Médio','Técnico','Outros'].map(function(k,idx){ return {label:k,value:tiposCursoQtd[k]||0,color:cores[idx]}; });
  var pcd = [
    {label:'Alunos PCD', value:alunosAno.filter(function(a){return !!a.pcd;}).length, color:SAP_COR_AZUL},
    {label:'Alunos não PCD', value:alunosAno.filter(function(a){return !a.pcd;}).length, color:'#F2A900'}
  ];
  var faixas = [
    {label:'Até 17 anos', value:0, color:SAP_COR_AZUL},
    {label:'18 a 21 anos', value:0, color:'#7C3AED'},
    {label:'22 a 25 anos', value:0, color:'#21B573'},
    {label:'26 a 29 anos', value:0, color:'#F2A900'},
    {label:'30 anos ou mais', value:0, color:'#E94E77'}
  ];
  alunosAno.forEach(function(a){
    var idade = calcIdade(a.dataNascimento);
    if (idade === null) return;
    if (idade <= 17) faixas[0].value++;
    else if (idade <= 21) faixas[1].value++;
    else if (idade <= 25) faixas[2].value++;
    else if (idade <= 29) faixas[3].value++;
    else faixas[4].value++;
  });
  var turnos = {'Manhã':0,'Tarde':0,'Noite':0};
  alunosAno.forEach(function(a){
    var t=Validators.normalizeTurno(a.turnoCurso || a.turno);
    if(t==='manhã') turnos['Manhã']++; else if(t==='tarde') turnos['Tarde']++; else if(t==='noite') turnos['Noite']++;
  });
  var turnosArr = ['Manhã','Tarde','Noite'].map(function(k,idx){ return {label:k,value:turnos[k],color:cores[idx]}; });
  var tiposAtendimentoAno = agruparTiposAtendimento(atendAno);

  var meses = mesesIndicativos().map(function(nome, idx){
    var lista = atendimentosDoPeriodo(ano, String(idx+1));
    var alunosMes = alunosDosAtendimentos(lista);
    var realizados = lista.filter(function(c){ return normalizarStatusAtendimento(c.status)==='realizada'; }).length;
    var emAberto = lista.filter(function(c){ var s=normalizarStatusAtendimento(c.status); return s==='aguardando'||s==='confirmada'||s==='pendente'; }).length;
    var faltas = lista.filter(function(c){ var s=normalizarStatusAtendimento(c.status); return s==='falta'||s==='nao compareceu'||s==='nao_compareceu'; }).length;
    var cancelados = lista.filter(function(c){ return normalizarStatusAtendimento(c.status)==='cancelada'; }).length;
    return { nome:nome, numero:idx+1, atendimentos:lista.length, alunos:alunosMes.length, realizados:realizados, emAberto:emAberto, faltas:faltas, cancelados:cancelados };
  });
  return { ano:ano, unidade:nomeUnidade(_sess.unidadeId), geradoEm:new Date(), atendimentos:atendAno, alunos:alunosAno, cursos:cursos, tiposCurso:tiposCurso, pcd:pcd, faixas:faixas, turnos:turnosArr, tiposAtendimentoAno:tiposAtendimentoAno, meses:meses };
}

function criarPDFInstitucionalSenac() {
  var pages = [], current = [];
  var W = 595.28, H = 841.89;
  var font = 'F1', fontBold = 'F2';
  var pageNumber = 0;
  var images = {};

  function normalizarTextoPDF(text) {
    return String(text == null ? '' : text)
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
      .replace(/…/g, '...').replace(/•/g, '-').replace(/\u00A0/g, ' ');
  }
  function byteForChar(ch) {
    var code = ch.charCodeAt(0);
    if (code <= 255) return code;
    var mapa = {8211:45,8212:45,8216:39,8217:39,8220:34,8221:34,8226:149,8230:133};
    return mapa[code] || 63;
  }
  function escStr(text) {
    text = normalizarTextoPDF(text);
    var out = '(';
    for (var i=0;i<text.length;i++) {
      var b = byteForChar(text[i]);
      if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += '\\' + ('000' + b.toString(8)).slice(-3);
      else out += String.fromCharCode(b);
    }
    return out + ')';
  }
  function col(hex) {
    hex = String(hex || '#000000').replace('#','');
    if (hex.length === 3) hex = hex.split('').map(function(x){return x+x;}).join('');
    var r=parseInt(hex.slice(0,2),16)/255, g=parseInt(hex.slice(2,4),16)/255, b=parseInt(hex.slice(4,6),16)/255;
    return [r.toFixed(3),g.toFixed(3),b.toFixed(3)].join(' ');
  }
  function b64ToBinary(b64) {
    if (typeof atob === 'function') return atob(b64);
    var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='; var str=String(b64).replace(/=+$/,''); var output='';
    for (var bc=0, bs, buffer, idx=0; buffer=str.charAt(idx++); ~buffer && (bs=bc%4 ? bs*64+buffer : buffer, bc++%4) ? output+=String.fromCharCode(255 & bs >> (-2*bc & 6)) : 0) buffer=chars.indexOf(buffer);
    return output;
  }
  function binaryToUint8(str) { var arr = new Uint8Array(str.length); for (var i=0;i<str.length;i++) arr[i] = str.charCodeAt(i) & 255; return arr; }
  function newContentPage() { if (current.length) pages.push(current.join('\n')); current = []; pageNumber++; }
  function addPage() { newContentPage(); }
  function rect(x,y,w,h,fill,stroke,lineW) { current.push((fill?col(fill)+' rg ':'') + (stroke?col(stroke)+' RG '+(lineW||1)+' w ':'') + f(x)+' '+f(H-y-h)+' '+f(w)+' '+f(h)+' re ' + (fill && stroke?'B':fill?'f':'S')); }
  function line(x1,y1,x2,y2,color,w) { current.push(col(color||'#e5e7eb')+' RG '+(w||1)+' w '+f(x1)+' '+f(H-y1)+' m '+f(x2)+' '+f(H-y2)+' l S'); }
  function text(txt,x,y,size,color,bold) { current.push('BT /'+(bold?fontBold:font)+' '+f(size)+' Tf '+col(color||'#0f172a')+' rg '+f(x)+' '+f(H-y)+' Td '+escStr(txt)+' Tj ET'); }
  function centerText(txt,x,y,w,size,color,bold) { var approx = normalizarTextoPDF(txt).length * size * 0.48; text(txt, x + Math.max(0,(w-approx)/2), y, size, color, bold); }
  function f(n) { return Number(n).toFixed(2).replace(/\.00$/,''); }
  function bar(x,y,w,h,pct,color) { rect(x,y,w,h,'#EAF0F6'); rect(x,y,Math.max(0,Math.min(w,w*(pct||0))),h,color||SAP_COR_AZUL); }
  function registerJpeg(name, b64, width, height) { images[name] = {b64:b64,width:width,height:height,binary:null,objId:null}; }
  function image(name, x, y, w, h) { if (!images[name]) return; current.push('q '+f(w)+' 0 0 '+f(h)+' '+f(x)+' '+f(H-y-h)+' cm /'+name+' Do Q'); }
  function footer(label) { line(42,806,553,806,'#D8E1EA',1); text(label || 'Relatório gerencial SAP SENAC',42,824,7.5,'#64748B'); text('Página ' + pageNumber,520,824,7.5,'#64748B',true); }
  function circle(cx, cy, r, fill, stroke, lineW) {
    var k = 0.5522847498;
    var x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
    var cmd = f(cx)+' '+f(H-y0)+' m '
      + f(cx + k*r)+' '+f(H-y0)+' '+f(x1)+' '+f(H-(cy-k*r))+' '+f(x1)+' '+f(H-cy)+' c '
      + f(x1)+' '+f(H-(cy+k*r))+' '+f(cx+k*r)+' '+f(H-y1)+' '+f(cx)+' '+f(H-y1)+' c '
      + f(cx-k*r)+' '+f(H-y1)+' '+f(x0)+' '+f(H-(cy+k*r))+' '+f(x0)+' '+f(H-cy)+' c '
      + f(x0)+' '+f(H-(cy-k*r))+' '+f(cx-k*r)+' '+f(H-y0)+' '+f(cx)+' '+f(H-y0)+' c h ';
    current.push((fill?col(fill)+' rg ':'') + (stroke?col(stroke)+' RG '+(lineW||1)+' w ':'') + cmd + (fill && stroke?'B':fill?'f':'S'));
  }
  function sector(cx, cy, r, startDeg, endDeg, fill) {
    var a0 = startDeg * Math.PI / 180, a1 = endDeg * Math.PI / 180;
    var total = a1 - a0;
    if (Math.abs(total) < 0.001) return;
    var segs = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI/2)));
    var da = total / segs;
    function px(a){ return cx + Math.cos(a) * r; }
    function py(a){ return cy + Math.sin(a) * r; }
    var cmd = f(cx)+' '+f(H-cy)+' m '+f(px(a0))+' '+f(H-py(a0))+' l ';
    for (var i=0;i<segs;i++) {
      var sA = a0 + da*i, eA = sA + da;
      var k = 4/3 * Math.tan((eA-sA)/4);
      var p0x = px(sA), p0y = py(sA), p3x = px(eA), p3y = py(eA);
      var c1x = p0x + (-Math.sin(sA) * r * k);
      var c1y = p0y + ( Math.cos(sA) * r * k);
      var c2x = p3x - (-Math.sin(eA) * r * k);
      var c2y = p3y - ( Math.cos(eA) * r * k);
      cmd += f(c1x)+' '+f(H-c1y)+' '+f(c2x)+' '+f(H-c2y)+' '+f(p3x)+' '+f(H-p3y)+' c ';
    }
    cmd += 'h';
    current.push(col(fill || SAP_COR_AZUL)+' rg '+cmd+' f');
  }
  function wrapText(txt, x, y, maxW, size, color, bold, leading, maxLines) {
    txt = normalizarTextoPDF(txt); leading = leading || size + 4;
    var words = txt.split(/\s+/), lines = [], lineTxt = ''; var maxChars = Math.max(8, Math.floor(maxW / (size * 0.48)));
    words.forEach(function(w){ var test = lineTxt ? lineTxt + ' ' + w : w; if (test.length > maxChars && lineTxt) { lines.push(lineTxt); lineTxt = w; } else { lineTxt = test; } });
    if (lineTxt) lines.push(lineTxt);
    if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[lines.length-1] = lines[lines.length-1].replace(/\s+$/,'') + '...'; }
    lines.forEach(function(l,idx){ text(l, x, y + idx*leading, size, color, bold); });
    return y + lines.length * leading;
  }
  function save() {
    if (current.length) pages.push(current.join('\n'));
    var objs=[]; function obj(s){objs.push(s);return objs.length;}
    var font1=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var font2=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    Object.keys(images).forEach(function(name){ var im=images[name]; im.binary=b64ToBinary(im.b64); im.objId=obj('<< /Type /XObject /Subtype /Image /Width '+im.width+' /Height '+im.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+im.binary.length+' >>\nstream\n'+im.binary+'\nendstream'); });
    var xObj = Object.keys(images).map(function(name){ return '/'+name+' '+images[name].objId+' 0 R'; }).join(' ');
    var pageIds=[];
    pages.forEach(function(content){ var stream='<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'; var cid=obj(stream); var pid=obj(''); pageIds.push({pid:pid,cid:cid}); });
    var pagesId=obj('');
    pageIds.forEach(function(p){ objs[p.pid-1]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /'+font+' '+font1+' 0 R /'+fontBold+' '+font2+' 0 R >> '+(xObj?'/XObject << '+xObj+' >>':'')+' >> /Contents '+p.cid+' 0 R >>'; });
    objs[pagesId-1]='<< /Type /Pages /Kids ['+pageIds.map(function(p){return p.pid+' 0 R';}).join(' ')+'] /Count '+pageIds.length+' >>';
    var catalogId=obj('<< /Type /Catalog /Pages '+pagesId+' 0 R >>'); var out='%PDF-1.4\n'; var xref=[0];
    objs.forEach(function(o,i){ xref.push(out.length); out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'; });
    var start=out.length; out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'; for(var i=1;i<xref.length;i++) out+=('0000000000'+xref[i]).slice(-10)+' 00000 n \n';
    out+='trailer << /Size '+(objs.length+1)+' /Root '+catalogId+' 0 R >>\nstartxref\n'+start+'\n%%EOF'; return new Blob([binaryToUint8(out)], {type:'application/pdf'});
  }
  newContentPage();
  registerJpeg('LogoSenac', SAP_SENAC_LOGO_JPG_B64, 200, 120);
  return {W:W,H:H,addPage:addPage,rect:rect,text:text,centerText:centerText,line:line,bar:bar,circle:circle,sector:sector,wrapText:wrapText,footer:footer,save:save,image:image};
}


function desenharLogoSenacPDF(pdf, x, y, w) {
  var h = w * 0.50;
  pdf.image('LogoSenac', x, y, w, h);
}

function desenharCabecalhoInternoPDF(pdf, titulo, subtitulo, secao) {
  pdf.rect(0,0,595.28,92,'#FFFFFF');
  pdf.rect(0,0,595.28,9,SAP_COR_AZUL);
  pdf.rect(0,9,595.28,4,SAP_COR_LARANJA);
  pdf.rect(0,13,595.28,3,SAP_COR_PESSEGO);
  desenharLogoSenacPDF(pdf, 38, 25, 78);
  if (secao) pdf.text(String(secao).toUpperCase(), 148, 32, 7.5, SAP_COR_LARANJA, true);
  pdf.text(titulo, 148, 50, 17, SAP_COR_AZUL, true);
  pdf.text(subtitulo, 148, 70, 8.8, '#475569');
  pdf.rect(36, 92, 523, 1, '#E5EAF0');
}

function desenharCartaoMetricaPDF(pdf, x, y, w, titulo, valor, cor, subtitulo) {
  pdf.rect(x, y, w, 64, '#FFFFFF', '#D8E1EA');
  pdf.rect(x, y, 7, 64, cor || SAP_COR_AZUL);
  pdf.text(String(valor), x+18, y+25, 19, '#0F172A', true);
  pdf.text(titulo, x+18, y+43, 8.4, SAP_COR_AZUL, true);
  if (subtitulo) pdf.text(subtitulo, x+18, y+56, 7.2, '#64748B');
}

function textoPercentualRelatorio(value, total) { return total ? Math.round(Number(value||0) / total * 100) : 0; }

function formatarTituloIndicadorPDF(label, maxLen) {
  label = String(label || 'Não informado').trim();
  var abreviacoes = [
    [/Técnico em Desenvolvimento de Sistemas/gi, 'Téc. Desenv. Sistemas'],
    [/Técnico em Administração/gi, 'Téc. Administração'],
    [/Técnico em Enfermagem/gi, 'Téc. Enfermagem'],
    [/Assistente de Recursos Humanos/gi, 'Assist. RH'],
    [/Técnico no Ensino Médio/gi, 'Téc. Ensino Médio'],
    [/Saída de Campo\/Oficinas e Palestras/gi, 'Saída/Oficinas/Palestras'],
    [/Acompanhamento do Aluno/gi, 'Acomp. do Aluno'],
    [/Atendimento presencial/gi, 'Atend. presencial'],
    [/Atendimento online/gi, 'Atend. online'],
    [/Atendimento família/gi, 'Atend. família']
  ];
  abreviacoes.forEach(function(regra){ label = label.replace(regra[0], regra[1]); });
  maxLen = maxLen || 28;
  return label.length > maxLen ? label.slice(0, Math.max(4, maxLen - 3)) + '...' : label;
}




/* v2.4.0 - PDF anual no modelo aprovado: sem pizza, blocos com barras e altura adaptada */
function desenharGraficoCardPDF(pdf, titulo, subtitulo, itens, x, y, w, h, opcoes) {
  opcoes = opcoes || {};
  itens = (itens || []).slice(0, opcoes.maxItens || 10);
  var total = itens.reduce(function(s,i){ return s + Number(i.value||0); },0) || 0;
  var max = Math.max.apply(null, itens.map(function(i){ return Number(i.value||0); }).concat([1]));
  var accent = opcoes.accent || SAP_COR_AZUL;

  pdf.rect(x, y, w, h, '#FFFFFF', '#D8E1EA');
  pdf.rect(x, y, w, 48, '#F8FAFC');
  pdf.rect(x, y, 7, 48, accent);
  pdf.text(titulo, x+17, y+20, 11.2, SAP_COR_AZUL, true);
  if (subtitulo) pdf.text(subtitulo, x+17, y+37, 7.1, '#64748B');
  pdf.text('Total: ' + total, x+w-62, y+20, 7.4, '#475569', true);

  if (!itens.length) {
    pdf.text('Sem dados registrados para este indicador.', x+17, y+78, 8, '#94A3B8');
    return;
  }

  var top = y + 66;
  var bottom = y + h - 16;
  var available = Math.max(28, bottom - top);
  var lineGap = Math.max(16, Math.min(26, available / Math.max(1, itens.length)));
  var barH = lineGap < 18 ? 3.5 : 5;
  var fontSize = lineGap < 18 ? 6.1 : 7.1;
  var labelX = x + 26;
  var valueX = x + w - 63;
  var barX = labelX;
  var barW = w - 58;

  itens.forEach(function(it, idx){
    var value = Number(it.value || 0);
    var pct = textoPercentualRelatorio(value, total);
    var color = it.color || accent;
    var rowY = top + idx * lineGap;
    var labelSpace = Math.max(70, valueX - labelX - 10);
    var maxChars = Math.max(16, Math.floor(labelSpace / (fontSize * 0.50)));
    var label = formatarTituloIndicadorPDF(it.label, maxChars);

    pdf.rect(labelX-11, rowY-8, 5, 14, color);
    pdf.text(label, labelX, rowY, fontSize, '#1F2937', true);
    pdf.text(String(value) + ' | ' + pct + '%', valueX, rowY, fontSize, '#475569', true);
    pdf.rect(barX, rowY + 7, barW, barH, '#E8EEF5');
    pdf.rect(barX, rowY + 7, Math.max(0, barW * (max ? value / max : 0)), barH, color);
  });
}

function desenharBlocoTextoPDF(pdf, x, y, w, titulo, texto, cor) {
  pdf.rect(x, y, w, 78, '#FFF7ED', '#FDC180');
  pdf.rect(x, y, 6, 78, cor || SAP_COR_LARANJA);
  pdf.text(titulo, x+18, y+23, 11, '#9A3412', true);
  pdf.wrapText(texto, x+18, y+42, w-34, 7.8, '#7C2D12', false, 10.5, 3);
}

function desenharCapaRelatorioAnual(pdf, dados) {
  pdf.rect(0,0,595.28,841.89,'#FFFFFF');
  pdf.rect(0,0,595.28,28,SAP_COR_AZUL);
  pdf.rect(0,28,595.28,8,SAP_COR_LARANJA);
  pdf.rect(0,36,595.28,5,SAP_COR_PESSEGO);
  pdf.rect(0,790,595.28,10,SAP_COR_LARANJA);
  pdf.rect(0,800,595.28,42,SAP_COR_AZUL);
  desenharLogoSenacPDF(pdf, 220, 95, 155);
  pdf.centerText('RELATÓRIO ANUAL ' + dados.ano, 56, 288, 483, 25, SAP_COR_AZUL, true);
  pdf.centerText('Área da Psicologia', 56, 326, 483, 13, '#334155', true);
  pdf.centerText('Sistema de Agendamento Psicológico - SAP', 56, 350, 483, 11, '#64748B');
  pdf.rect(150, 388, 295, 2, SAP_COR_LARANJA);
  pdf.centerText('Unidade: ' + dados.unidade, 56, 430, 483, 11, '#334155', true);
  pdf.centerText('Relatório gerencial com indicativos anuais e resumo mensal dos atendimentos.', 70, 462, 455, 9.5, '#475569');
  pdf.centerText('Documento sem exposição de dados sensíveis individuais.', 70, 484, 455, 9.5, '#475569');
  pdf.centerText('Brasília - DF', 70, 720, 455, 10, '#475569');
  pdf.centerText(String(dados.ano), 70, 742, 455, 10, '#475569');
  pdf.centerText('SENAC', 70, 822, 455, 10, '#FFFFFF', true);
}

function desenharPaginaResumoAnualPDF(pdf, dados) {
  var realizadosAno = dados.atendimentos.filter(function(c){return normalizarStatusAtendimento(c.status)==='realizada';}).length;
  var emAbertoAno = dados.atendimentos.filter(function(c){var s=normalizarStatusAtendimento(c.status); return s==='aguardando'||s==='confirmada'||s==='pendente';}).length;
  var faltasAno = dados.atendimentos.filter(function(c){var s=normalizarStatusAtendimento(c.status); return s==='falta'||s==='nao compareceu'||s==='nao_compareceu';}).length;
  var canceladosAno = dados.atendimentos.filter(function(c){return normalizarStatusAtendimento(c.status)==='cancelada';}).length;
  pdf.rect(0,0,595.28,841.89,'#F4F7FB');
  desenharCabecalhoInternoPDF(pdf, 'Indicativos anuais consolidados', 'Ano de ' + dados.ano + ' | Base anual: todos os meses | Unidade: ' + dados.unidade, 'Relatório anual');
  desenharBlocoTextoPDF(pdf, 36, 112, 523, 'Resumo gerencial', 'Esta seção apresenta o perfil anual dos alunos atendidos e os principais volumes da movimentação psicológica. Os gráficos foram consolidados por ano, evitando distorções por meses com poucos registros.', SAP_COR_LARANJA);
  var y = 214;
  var cards = [
    ['Atendimentos', dados.atendimentos.length, SAP_COR_AZUL, 'registros no ano'],
    ['Alunos atendidos', dados.alunos.length, '#21B573', 'alunos distintos'],
    ['Realizados', realizadosAno, SAP_COR_LARANJA, 'atendimentos concluídos'],
    ['Em aberto', emAbertoAno, '#7C3AED', 'pendentes/confirmados'],
    ['Faltas', faltasAno, '#B45309', 'não comparecimento'],
    ['Cancelados', canceladosAno, '#B91C1C', 'cancelamentos']
  ];
  cards.forEach(function(c,idx){ desenharCartaoMetricaPDF(pdf, 36+(idx%3)*174, y+Math.floor(idx/3)*72, 155, c[0], c[1], c[2], c[3]); });
  y = 386;
  desenharGraficoCardPDF(pdf, 'Distribuição por curso', 'Alunos atendidos por curso no ano', dados.cursos, 36, y, 252, 176, {accent:SAP_COR_AZUL,totalLabel:'Total'});
  desenharGraficoCardPDF(pdf, 'Tipo de curso', 'Perfil anual por tipo de curso', dados.tiposCurso, 307, y, 252, 176, {accent:SAP_COR_LARANJA,totalLabel:'Total'});
  y += 198;
  desenharGraficoCardPDF(pdf, 'Alunos PCD', 'Perfil PCD dos alunos atendidos no ano', dados.pcd, 36, y, 252, 142, {accent:'#F2A900',totalLabel:'Total'});
  desenharGraficoCardPDF(pdf, 'Faixa etária', 'Distribuição etária anual dos alunos atendidos', dados.faixas, 307, y, 252, 184, {accent:'#21B573',totalLabel:'Total'});
  pdf.footer('Indicativos anuais consolidados - Parte 1');
}

function desenharPaginaIndicativosComplementaresPDF(pdf, dados) {
  pdf.rect(0,0,595.28,841.89,'#F4F7FB');
  desenharCabecalhoInternoPDF(pdf, 'Indicativos anuais complementares', 'Ano de ' + dados.ano + ' | Turnos e tipos de atendimento consolidados no ano', 'Relatório anual');
  desenharBlocoTextoPDF(pdf, 36, 112, 523, 'Leitura dos dados', 'Tipos de atendimento aparecem somente no consolidado anual. Os relatórios mensais mostram a movimentação do mês, sem repetir a classificação por tipo.', SAP_COR_AZUL);
  desenharGraficoCardPDF(pdf, 'Turno do curso', 'Turno dos alunos atendidos durante o ano', dados.turnos, 36, 214, 252, 170, {accent:SAP_COR_AZUL,totalLabel:'Total'});
  desenharGraficoCardPDF(pdf, 'Status dos atendimentos', 'Situação geral dos registros do ano', [
    {label:'Realizados', value:dados.atendimentos.filter(function(c){return normalizarStatusAtendimento(c.status)==='realizada';}).length, color:'#21B573'},
    {label:'Em aberto', value:dados.atendimentos.filter(function(c){var s=normalizarStatusAtendimento(c.status); return s==='aguardando'||s==='confirmada'||s==='pendente';}).length, color:'#7C3AED'},
    {label:'Faltas', value:dados.atendimentos.filter(function(c){var s=normalizarStatusAtendimento(c.status); return s==='falta'||s==='nao compareceu'||s==='nao_compareceu';}).length, color:'#B45309'},
    {label:'Cancelados', value:dados.atendimentos.filter(function(c){return normalizarStatusAtendimento(c.status)==='cancelada';}).length, color:'#B91C1C'}
  ], 36, 404, 252, 174, {accent:'#7C3AED',totalLabel:'Total'});
  desenharGraficoCardPDF(pdf, 'Tipos de atendimento no ano', 'Classificação anual feita pela Psicologia', dados.tiposAtendimentoAno, 307, 214, 252, 284, {accent:SAP_COR_LARANJA,totalLabel:'Total',maxItens:7});
  pdf.rect(307, 522, 252, 92, '#FFFFFF', '#D8E1EA');
  pdf.rect(307, 522, 6, 92, SAP_COR_LARANJA);
  pdf.text('Observação metodológica', 326, 548, 12, SAP_COR_AZUL, true);
  pdf.wrapText('Os números representam registros gerenciais do SAP. A interpretação deve considerar encaminhamentos, ausências, reagendamentos e atendimentos criados diretamente pela psicologia.', 326, 572, 205, 7.8, '#475569', false, 10.5, 4);
  pdf.footer('Indicativos anuais consolidados - Parte 2');
}

function desenharPaginaMensalPDF(pdf, dados, inicio, fim, tituloContinua) {
  pdf.rect(0,0,595.28,841.89,'#F4F7FB');
  desenharCabecalhoInternoPDF(pdf, tituloContinua ? 'Relatório mensal - continuação' : 'Relatório mensal', 'Ano de ' + dados.ano + ' | Movimentação de atendimentos por mês', 'Resumo mensal');
  var y = 116;
  dados.meses.slice(inicio, fim).forEach(function(m, idx){
    var cor = (idx % 2 === 0) ? SAP_COR_AZUL : SAP_COR_LARANJA;
    var texto = m.atendimentos > 0
      ? (m.atendimentos + ' atendimento(s) registrados, com ' + m.alunos + ' aluno(s) atendido(s).')
      : 'Não há atendimentos registrados neste mês.';
    pdf.rect(36, y, 523, 142, '#FFFFFF', '#D8E1EA');
    pdf.rect(36, y, 8, 142, cor);
    pdf.text(m.nome, 58, y+26, 15, SAP_COR_AZUL, true);
    pdf.text(texto, 58, y+48, 8.5, '#475569');
    desenharMiniMetricaMensal(pdf, 58, y+70, 'Atendimentos', m.atendimentos, SAP_COR_AZUL);
    desenharMiniMetricaMensal(pdf, 160, y+70, 'Alunos', m.alunos, '#21B573');
    desenharMiniMetricaMensal(pdf, 262, y+70, 'Realizados', m.realizados, SAP_COR_LARANJA);
    desenharMiniMetricaMensal(pdf, 364, y+70, 'Em aberto', m.emAberto, '#7C3AED');
    desenharMiniMetricaMensal(pdf, 466, y+70, 'Faltas/Cancel.', (m.faltas + m.cancelados), '#B91C1C');
    var maxMes = Math.max(m.atendimentos, m.realizados, m.emAberto, m.faltas + m.cancelados, 1);
    pdf.text('Resumo visual do mês', 58, y+112, 7.5, '#64748B', true);
    pdf.bar(160, y+106, 90, 5, m.realizados/maxMes, '#21B573');
    pdf.text('Realizados', 255, y+111, 6.8, '#64748B');
    pdf.bar(318, y+106, 90, 5, m.emAberto/maxMes, '#7C3AED');
    pdf.text('Em aberto', 413, y+111, 6.8, '#64748B');
    y += 158;
  });
  pdf.footer('Relatórios mensais sem detalhamento por tipo de atendimento');
}

function desenharMiniMetricaMensal(pdf, x, y, label, valor, cor) {
  pdf.rect(x, y, 84, 28, '#F8FAFC', '#E5E7EB');
  pdf.rect(x, y, 4, 28, cor || SAP_COR_AZUL);
  pdf.text(String(valor), x+10, y+16, 10.5, '#111827', true);
  pdf.text(label, x+10, y+25, 6.3, '#64748B', true);
}

function gerarRelatorioAnualPDF(ano) {
  try {
    var dados = gerarDadosRelatorioAnual(ano);
    var pdf = criarPDFInstitucionalSenac();

    desenharCapaRelatorioAnual(pdf, dados);
    pdf.addPage();
    desenharPaginaResumoAnualPDF(pdf, dados);
    pdf.addPage();
    desenharPaginaIndicativosComplementaresPDF(pdf, dados);
    pdf.addPage();
    desenharPaginaMensalPDF(pdf, dados, 0, 4, false);
    pdf.addPage();
    desenharPaginaMensalPDF(pdf, dados, 4, 8, true);
    pdf.addPage();
    desenharPaginaMensalPDF(pdf, dados, 8, 12, true);

    var blob = pdf.save();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio_sap_' + dados.ano + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 500);
    toast('Relatório PDF do ano de ' + dados.ano + ' gerado.', 'success');
  } catch (e) {
    console.error(e);
    toast('Não foi possível gerar o PDF. Verifique os dados do ano.', 'error');
  }
}

