'use strict';
initStore();
var _sess = getSession();
if (!_sess || _sess.role !== 'administrador') { clearSession(); window.location.href = "../index.html"; }

document.getElementById('sb-nome').textContent   = _sess.nome || 'Admin';
document.getElementById('sb-avatar').textContent = (_sess.nome||'A').charAt(0);
document.getElementById('wb-nome').textContent   = 'Olá, ' + (_sess.nome||'Admin').split(' ')[0] + '!';

var store = getStore();
var u = store.unidades.find(function(x){ return x.id===_sess.unidadeId; });
var nomUnid = u ? u.nome : _sess.unidadeId;
document.getElementById('sb-unidade').textContent = nomUnid;
document.getElementById('wb-unidade').textContent = 'SENAC DF · ' + nomUnid;
var topEl = document.querySelector('.topbar-breadcrumb');
if (topEl) topEl.textContent = 'SAP · Administrador · ' + nomUnid;

var _roleSelected = '';

function navTo(panelId, navEl) {
  document.querySelectorAll('.panel-section').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(n){ n.classList.remove('active'); });
  var p = document.getElementById(panelId); if (p) p.classList.add('active');
  if (navEl) navEl.classList.add('active');
  var lEl = navEl ? navEl.querySelector('.nav-label') : null;
  document.getElementById('topbar-title').textContent = lEl ? lEl.textContent : '';
  if (panelId==='panel-dashboard')  renderDashboard();
  if (panelId==='panel-unidades')   renderUnidades();
  if (panelId==='panel-usuarios')   renderUsuarios();
  if (panelId==='panel-criar')      initFormCriar();
  if (panelId==='panel-chat' && typeof renderChat === 'function') renderChat();
}

function renderGraficos() {
  var s = getStore();
  var alunos = s.alunos.filter(function(a){ return a.statusCadastro==='ativo'; });
  /* ── Gráfico de Pizza: distribuição por curso ── */
  var cursosMap = {};
  alunos.forEach(function(a){ var c=alunoCursoNome(a, getStore()); cursosMap[c]=(cursosMap[c]||0)+1; });
  var cursos = Object.keys(cursosMap).sort();
  var total = alunos.length;
  var cores = ['#2d7ff9','#f97316','#10b981','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899','#84cc16','#6366f1'];
  var canvas = document.getElementById('chart-pizza');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, cx = W/2, cy = H/2, r = Math.min(cx,cy)-18;
    var rootStyle = getComputedStyle(document.documentElement);
    function resolveChartColor(name, fallback) { return (rootStyle.getPropertyValue(name) || fallback).trim() || fallback; }
    var surfaceColor = resolveChartColor('--white', '#ffffff');
    var inkColor = resolveChartColor('--ink', '#0f172a');
    var mutedColor = resolveChartColor('--gray-500', '#6b7280');
    ctx.clearRect(0,0,W,H);
    if (!total) { ctx.fillStyle='#ccc'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); }
    else {
      var ang = -Math.PI/2;
      cursos.forEach(function(nome,i){
        var frac = cursosMap[nome]/total;
        var end = ang + frac*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,ang,end); ctx.closePath();
        ctx.fillStyle = cores[i%cores.length]; ctx.fill();
        ctx.strokeStyle=surfaceColor; ctx.lineWidth=3; ctx.stroke();
        ang = end;
      });
      /* centro do donut */
      ctx.save();
      ctx.shadowColor='rgba(15,23,42,.16)';
      ctx.shadowBlur=18;
      ctx.shadowOffsetY=7;
      ctx.beginPath(); ctx.arc(cx,cy,r*0.50,0,Math.PI*2); ctx.fillStyle=surfaceColor; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx,cy,r*0.50,0,Math.PI*2); ctx.strokeStyle='rgba(148,163,184,.16)'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle=inkColor; ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(total, cx, cy-8);
      ctx.font='11px sans-serif'; ctx.fillStyle=mutedColor;
      ctx.fillText('alunos', cx, cy+14);
    }
  }
  var leg = document.getElementById('chart-pizza-legend');
  if (leg) {
    leg.innerHTML = cursos.map(function(nome,i){
      var n = cursosMap[nome], pct = total?Math.round(n/total*100):0;
      return '<div style="display:flex;align-items:center;gap:8px">'
        +'<div style="width:12px;height:12px;border-radius:3px;background:'+cores[i%cores.length]+';flex-shrink:0"></div>'
        +'<div style="flex:1;font-weight:600;color:var(--ink,#0f172a)">'+escape(nome)+'</div>'
        +'<div style="color:#6b7280">'+n+' aluno'+(n>1?'s':'')+'</div>'
        +'<div style="font-weight:700;color:'+cores[i%cores.length]+';min-width:38px;text-align:right">'+pct+'%</div>'
        +'</div>';
    }).join('');
  }
  /* ── Gráfico de Linha: alunos por idade ── */
  var idadesMap = {};
  alunos.forEach(function(a){
    var id = calcIdade(a.dataNascimento);
    if (id!==null) idadesMap[id]=(idadesMap[id]||0)+1;
  });
  var idades = Object.keys(idadesMap).map(Number).sort(function(a,b){return a-b;});
  var canvas2 = document.getElementById('chart-linha');
  if (canvas2 && canvas2.getContext && idades.length) {
    canvas2.width = canvas2.offsetWidth||460;
    canvas2.height = 240;
    var ctx2 = canvas2.getContext('2d');
    var PL=44,PR=16,PT=16,PB=36;
    var W2=canvas2.width, H2=canvas2.height;
    var vals = idades.map(function(id){ return idadesMap[id]; });
    var maxV = Math.max.apply(null,vals)||1;
    var xStep = idades.length>1?(W2-PL-PR)/(idades.length-1):0;
    function px(i){ return PL+i*xStep; }
    function py(v){ return PT+(H2-PT-PB)*(1-v/maxV); }
    ctx2.clearRect(0,0,W2,H2);
    /* grade */
    ctx2.strokeStyle='rgba(100,116,139,0.12)'; ctx2.lineWidth=1;
    for(var g=0;g<=4;g++){
      var gy=PT+(H2-PT-PB)*g/4;
      ctx2.beginPath(); ctx2.moveTo(PL,gy); ctx2.lineTo(W2-PR,gy); ctx2.stroke();
      ctx2.fillStyle='#94a3b8'; ctx2.font='10px sans-serif'; ctx2.textAlign='right';
      ctx2.fillText(Math.round(maxV*(1-g/4)), PL-5, gy+3);
    }
    /* área preenchida */
    ctx2.beginPath(); ctx2.moveTo(px(0),py(vals[0]));
    vals.forEach(function(v,i){ if(i>0) ctx2.lineTo(px(i),py(v)); });
    ctx2.lineTo(px(vals.length-1),H2-PB); ctx2.lineTo(px(0),H2-PB); ctx2.closePath();
    ctx2.fillStyle='rgba(45,127,249,0.1)'; ctx2.fill();
    /* linha */
    ctx2.beginPath(); ctx2.moveTo(px(0),py(vals[0]));
    vals.forEach(function(v,i){ if(i>0) ctx2.lineTo(px(i),py(v)); });
    ctx2.strokeStyle='#2d7ff9'; ctx2.lineWidth=2.5; ctx2.lineJoin='round'; ctx2.stroke();
    /* pontos */
    vals.forEach(function(v,i){
      ctx2.beginPath(); ctx2.arc(px(i),py(v),4,0,Math.PI*2);
      ctx2.fillStyle='#2d7ff9'; ctx2.strokeStyle='#fff'; ctx2.lineWidth=2; ctx2.fill(); ctx2.stroke();
    });
    /* labels eixo X */
    ctx2.fillStyle='#64748b'; ctx2.font='11px sans-serif'; ctx2.textAlign='center';
    var step = idades.length>12 ? Math.ceil(idades.length/12) : 1;
    idades.forEach(function(id,i){ if(i%step===0) ctx2.fillText(id+' anos', px(i), H2-PB+16); });
    /* label eixo Y */
    ctx2.save(); ctx2.translate(11,PT+(H2-PT-PB)/2); ctx2.rotate(-Math.PI/2);
    ctx2.font='10px sans-serif'; ctx2.fillStyle='#94a3b8'; ctx2.textAlign='center';
    ctx2.fillText('nº de alunos',0,0); ctx2.restore();
    if (typeof renderAgeDistributionChart === 'function') renderAgeDistributionChart(alunos, 'chart-linha');
  } else if (canvas2 && canvas2.getContext && !idades.length) {
    var ctx2=canvas2.getContext('2d'); ctx2.clearRect(0,0,canvas2.width,canvas2.height);
    ctx2.fillStyle='#94a3b8'; ctx2.font='13px sans-serif'; ctx2.textAlign='center';
    ctx2.fillText('Nenhum dado de idade cadastrado', (canvas2.width||460)/2, 120);
  }
}

function aplicarModoAdminUnidade() {
  var sess = getSession && getSession();
  if (!sess || !sess.adminUnidade) return;
  document.querySelectorAll('[data-panel="panel-unidades"]').forEach(function(el){ el.style.display = 'none'; });
  var top = document.getElementById('wb-unidade');
  if (top) top.textContent = nomeUnidade(sess.unidadeId) + ' · administrador da unidade';
  var btnNovo = document.querySelector('[onclick*="panel-criar"]');
  if (btnNovo) btnNovo.textContent = ' Novo Usuário da Unidade';
}

function renderDashboard() {
  aplicarModoAdminUnidade();
  var s = getStore();
  document.getElementById('ds-unidades').textContent = s.unidades.length;
  document.getElementById('ds-psicos').textContent   = s.psicologos.length;
  document.getElementById('ds-insts').textContent    = s.instrutores.length;
  document.getElementById('ds-coords').textContent   = s.coordenadores.length;
  var alunosEl = document.getElementById('ds-alunos');
  if (alunosEl) alunosEl.textContent = s.alunos.filter(function(a){ return a.statusCadastro==='ativo'; }).length;
  /* Renderiza gráficos */
  setTimeout(renderGraficos, 0);
  var el = document.getElementById('ds-unidades-lista');
  el.innerHTML = s.unidades.map(function(un) {
    var alunos   = s.alunos.filter(function(a){ return a.unidadeId===un.id; }).length;
    var atendimentos= s.atendimentos.filter(function(c){ return c.unidadeId===un.id; }).length;
    var psicos   = s.psicologos.filter(function(p){ return p.unidadeId===un.id; }).length;
    var insts    = s.instrutores.filter(function(i){ return i.unidadeId===un.id; }).length;
    return '<div class="unidade-card">'
      + '<div class="unidade-card-name">'+escape(un.nome)+'</div>'
      + '<div class="unidade-card-region">'+escape(un.regiao)+'</div>'
      + '<div class="unidade-card-stats">'
      + (psicos?'<span class="us-chip">'+psicos+' psic.</span>':'')
      + (insts?'<span class="us-chip">'+insts+' instr.</span>':'')
      + (alunos?'<span class="us-chip">'+alunos+' alunos</span>':'')
      + (atendimentos?'<span class="us-chip">'+atendimentos+' consul.</span>':'')
      + '</div></div>';
  }).join('');
}

function renderUnidades() {
  var s = getStore();
  var tb = document.getElementById('tbody-unidades');
  tb.innerHTML = s.unidades.map(function(un) {
    var psicos  = s.psicologos.filter(function(p){ return p.unidadeId===un.id; }).length;
    var insts   = s.instrutores.filter(function(i){ return i.unidadeId===un.id; }).length;
    var coords  = s.coordenadores.filter(function(c){ return c.unidadeId===un.id; }).length;
    var alunos  = s.alunos.filter(function(a){ return a.unidadeId===un.id; }).length;
    var conss   = s.atendimentos.filter(function(c){ return c.unidadeId===un.id; }).length;
    return '<tr>'
      + '<td><strong>'+escape(un.nome)+'</strong></td>'
      + '<td>'+escape(un.regiao)+'</td>'
      + '<td style="text-align:center">'+psicos+'</td>'
      + '<td style="text-align:center">'+insts+'</td>'
      + '<td style="text-align:center">'+coords+'</td>'
      + '<td style="text-align:center">'+alunos+'</td>'
      + '<td style="text-align:center">'+conss+'</td>'
      + '<td style="text-align:center"><button class="btn btn-outline btn-sm" onclick="abrirEditarUnidade(\''+un.id+'\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + 'Editar</button></td>'
      + '</tr>';
  }).join('');
}

function renderUsuarios() {
  var s = getStore();
  var filtro = document.getElementById('filtro-role').value;
  var lista = [];
  if (!filtro||filtro==='psicologa') s.psicologos.forEach(function(p){ lista.push({id:p.id,nome:p.nome,role:'psicologa',usuario:p.usuario,unidadeId:p.unidadeId,extra:p.crp||''});  });
  if (!filtro||filtro==='instrutor') s.instrutores.forEach(function(i){ lista.push({id:i.id,nome:i.nome,role:'instrutor',usuario:i.usuario,unidadeId:i.unidadeId,extra:i.disciplina||''}); });
  if (!filtro||filtro==='coordenacao') s.coordenadores.forEach(function(c){ lista.push({id:c.id,nome:c.nome,role:'coordenacao',usuario:c.usuario,unidadeId:c.unidadeId,extra:c.setor||''}); });
  if (!filtro||filtro==='admin_unidade') s.administradores.forEach(function(a){ if(a.tipoBackend==='ADMIN_UNIDADE') lista.push({id:a.id,nome:a.nome,role:'admin_unidade',usuario:a.usuario,unidadeId:a.unidadeId,extra:'Administrador da unidade'}); });
  var nomeFiltroEl = document.getElementById('filtro-nome');
  var nomeFiltro = nomeFiltroEl ? nomeFiltroEl.value.toLowerCase().trim() : '';
  if (nomeFiltro) lista = lista.filter(function(u){ return String(u.nome||'').toLowerCase().indexOf(nomeFiltro) >= 0; });
  var roleLabel = {psicologa:'Psicólogo(a)',instrutor:'Instrutor',coordenacao:'Coordenação',admin_unidade:'Admin. da Unidade',administrador:'Administrador Geral'};
  var roleColor = {psicologa:'#E8EFF8;color:#1B3A6B',instrutor:'#FEF3DC;color:#C87F00',coordenacao:'#FEF3DC;color:#C87F00',admin_unidade:'#E8EFF8;color:#1B3A6B',administrador:'#E8EFF8;color:#1B3A6B'};
  var tb = document.getElementById('tbody-usuarios');
  tb.innerHTML = lista.map(function(u) {
    return '<tr>'
      + '<td><strong>'+escape(u.nome)+'</strong></td>'
      + '<td><span style="font-size:11.5px;font-weight:700;background:'+roleColor[u.role]+';padding:3px 9px;border-radius:20px">'+roleLabel[u.role]+'</span></td>'
      + '<td><code>'+escape(u.usuario)+'</code></td>'
      + '<td>'+escape(nomeUnidade(u.unidadeId))+'</td>'
      + '<td style="font-size:12px;color:var(--gray-400)">'+escape(u.extra)+'</td>'
      + '<td style="text-align:center"><button class="btn btn-outline btn-sm" onclick="abrirEditarUsuario(\''+escape(u.id)+'\',\''+escape(u.role)+'\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + 'Editar</button></td>'
      + '</tr>';
  }).join('');
  if (!lista.length) tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--gray-400)">Nenhum usuário</td></tr>';
}

function initFormCriar() {
  var s = getStore();
  var sel = document.getElementById('c-unidade');
  sel.innerHTML = '<option value="">Selecione a unidade...</option>'
    + s.unidades.map(function(u){ return '<option value="'+u.id+'"'+(u.id===_sess.unidadeId?' selected':'')+'>'+escape(u.nome)+'</option>'; }).join('');
  if (_sess && _sess.adminUnidade) { sel.value = _sess.unidadeId; sel.disabled = true; }
}

function selectRole(role) {
  _roleSelected = role;
  document.querySelectorAll('.role-option').forEach(function(el){ el.classList.remove('selected'); });
  var el = document.getElementById('role-'+role); if (el) el.classList.add('selected');
  var ef = document.getElementById('extra-field');
  var tf = document.getElementById('turmas-field');
  if (role==='admin_unidade') {
    ef.innerHTML = '<label class="form-label">Observação</label><input type="text" class="form-control" id="c-extra" value="Administrador da unidade" disabled>';
    tf.style.display = 'none';
  } else if (role==='instrutor') {
    ef.innerHTML = '<label class="form-label">Disciplina</label><input type="text" class="form-control" id="c-extra" placeholder="Ex: Administração">';
    tf.style.display = 'block';
  } else if (role==='coordenacao') {
    ef.innerHTML = '<label class="form-label">Setor</label><input type="text" class="form-control" id="c-extra" placeholder="Ex: Coordenação Pedagógica">';
    tf.style.display = 'none';
  } else {
    ef.innerHTML = '';
    tf.style.display = 'none';
  }
}

function criarLogin() {
  var errEl = document.getElementById('criar-err');
  errEl.style.display = 'none';
  var role    = _roleSelected;
  var nome    = document.getElementById('c-nome').value.trim();
  var email   = document.getElementById('c-email').value.trim();
  var usuario = document.getElementById('c-user').value.trim();
  var senha   = document.getElementById('c-senha').value.trim();
  var unidade = document.getElementById('c-unidade').value;

  if (!role) { errEl.textContent='Selecione um perfil.'; errEl.style.display='block'; return; }
  var sessAtual = getSession && getSession();
  if (sessAtual && sessAtual.adminUnidade && role==='administrador') { errEl.textContent='Administrador da unidade não pode criar administrador geral.'; errEl.style.display='block'; return; }
  if (sessAtual && sessAtual.adminUnidade) { unidade = sessAtual.unidadeId; }
  if (!nome||!email||!usuario||!senha||!unidade) {
    errEl.textContent = 'Preencha todos os campos obrigatórios.';
    errEl.style.display = 'block'; return;
  }
  if (!Validators.email(email)) { errEl.textContent='Informe um e-mail válido.'; errEl.style.display='block'; return; }
  if (senha.length < 6) { errEl.textContent='Senha deve ter ao menos 6 caracteres.'; errEl.style.display='block'; return; }

  var s = getStore();
  var todos = s.psicologos.concat(s.instrutores).concat(s.coordenadores).concat(s.administradores);
  if (role==='aluno') {
    errEl.textContent = 'O cadastro de novos alunos foi removido do painel do administrador.';
    errEl.style.display = 'block';
    return;
  }
  if (todos.find(function(u){ return u.usuario===usuario; })) {
    errEl.textContent = 'Nome de usuário já está em uso. Escolha outro.'; errEl.style.display='block'; return;
  }
  if (todos.find(function(u){ return u.email===email; })) {
    errEl.textContent = 'E-mail já está em uso. Escolha outro.'; errEl.style.display='block'; return;
  }
  var extra = document.getElementById('c-extra') ? document.getElementById('c-extra').value.trim() : '';
  var turmasEl = document.getElementById('c-turmas');
  var turmas = turmasEl && turmasEl.value ? turmasEl.value.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : [];
  var newId = genId(role.charAt(0));

  var novoUsuario = { id:newId, usuario:usuario, email:email, senha:senha, nome:nome, unidadeId:unidade, role:role };
  if (role==='psicologa') {
    novoUsuario.crp = extra;
    s.psicologos.push(novoUsuario);
  } else if (role==='admin_unidade') {
    novoUsuario.tipoBackend = 'ADMIN_UNIDADE'; // salvo no banco como ADMINISTRADOR + unidade
    novoUsuario.extra = 'Administrador da unidade';
    s.administradores.push(novoUsuario);
  } else if (role==='instrutor') {
    novoUsuario.disciplina = extra;
    novoUsuario.turmas = turmas;
    s.instrutores.push(novoUsuario);
  } else if (role==='coordenacao') {
    novoUsuario.setor = extra;
    s.coordenadores.push(novoUsuario);
  } else if (role==='administrador') {
    s.administradores.push(novoUsuario);
  }

  saveStore(s).then(function(){
    toast('✓ Login criado no sistema e salvo no banco para '+nome+'!', 'success');
    limparFormCriar();
    return syncStoreFromApi();
  }).then(function(){
    afterStoreReady(function(){ refreshActivePanel(); });
    renderUsuarios();
  }).catch(function(err){
    errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar o usuário no banco.';
    errEl.style.display = 'block';
    afterStoreReady(function(){ renderUsuarios(); });
  });
}

function limparFormCriar() {
  ['c-nome','c-email','c-user','c-senha','c-turmas'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('criar-err').style.display = 'none';
  document.querySelectorAll('.role-option').forEach(function(el){ el.classList.remove('selected'); });
  _roleSelected = '';
  document.getElementById('extra-field').innerHTML = '';
  document.getElementById('turmas-field').style.display = 'none';
}

/* ── EDITAR / CRIAR UNIDADE ── */
function abrirModalNovaUnidade() {
  document.getElementById('mu-title').textContent = 'Nova Unidade';
  document.getElementById('mu-nome').value = '';
  document.getElementById('mu-regiao').value = '';
  document.getElementById('mu-id').value = '';
  document.getElementById('mu-err').style.display = 'none';
  openModal('modal-unidade');
}

function abrirEditarUnidade(id) {
  var s = getStore();
  var un = s.unidades.find(function(u){ return u.id===id; });
  if (!un) return;
  document.getElementById('mu-title').textContent = 'Editar Unidade';
  document.getElementById('mu-nome').value = un.nome;
  document.getElementById('mu-regiao').value = un.regiao;
  document.getElementById('mu-id').value = id;
  document.getElementById('mu-err').style.display = 'none';
  openModal('modal-unidade');
}

function salvarUnidade() {
  var nome   = document.getElementById('mu-nome').value.trim();
  var regiao = document.getElementById('mu-regiao').value.trim();
  var id     = document.getElementById('mu-id').value;
  var errEl  = document.getElementById('mu-err');
  errEl.style.display = 'none';
  if (!nome || !regiao) { errEl.textContent = 'Preencha nome e região.'; errEl.style.display='block'; return; }
  var s = getStore();
  if (id) {
    var un = s.unidades.find(function(u){ return u.id===id; });
    if (un) { un.nome = nome; un.regiao = regiao; }
  } else {
    s.unidades.push({ id:'u'+Date.now(), nome:nome, regiao:regiao });
  }
  saveStore(s);
  closeModal('modal-unidade');
  toast(id ? '✓ Unidade atualizada!' : '✓ Unidade criada!', 'success');
  afterStoreReady(function(){ refreshActivePanel(); }); renderUnidades();
}

/* ── EDITAR USUÁRIO ── */
function abrirEditarUsuario(id, role) {
  var s = getStore();
  var listaMap = { psicologa:s.psicologos, instrutor:s.instrutores, coordenacao:s.coordenadores, aluno:s.alunos, admin_unidade:s.administradores, administrador:s.administradores };
  var arr = listaMap[role]; if (!arr) return;
  var u = arr.find(function(x){ return x.id===id; }); if (!u) return;
  document.getElementById('eu-id').value = id;
  document.getElementById('eu-role').value = role;
  document.getElementById('eu-nome').value = u.nome || '';
  document.getElementById('eu-user').value = u.usuario || '';
  document.getElementById('eu-senha').value = '';
  document.getElementById('eu-err').style.display = 'none';
  var sel = document.getElementById('eu-unidade');
  sel.innerHTML = s.unidades.map(function(un){ return '<option value="'+un.id+'"'+(un.id===u.unidadeId?' selected':'')+'>'+escape(un.nome)+'</option>'; }).join('');
  var extraWrap = document.getElementById('eu-extra-wrap');
  if (role==='psicologa')   extraWrap.innerHTML = '<label class="form-label">CRP</label><input type="text" class="form-control" id="eu-extra" value="'+escape(u.crp||'')+'" placeholder="Ex: 01/12345">';
  else if (role==='instrutor')   extraWrap.innerHTML = '<label class="form-label">Disciplina</label><input type="text" class="form-control" id="eu-extra" value="'+escape(u.disciplina||'')+'" placeholder="Ex: Administração">';
  else if (role==='coordenacao') extraWrap.innerHTML = '<label class="form-label">Setor</label><input type="text" class="form-control" id="eu-extra" value="'+escape(u.setor||'')+'" placeholder="Ex: Coordenação Pedagógica">';
  else if (role==='admin_unidade') extraWrap.innerHTML = '<label class="form-label">Perfil</label><input type="text" class="form-control" value="Administrador da unidade" disabled>'; 
  else if (role==='aluno') extraWrap.innerHTML = '<label class="form-label">Curso</label><input type="text" class="form-control" id="eu-extra" value="'+escape(u.curso||'')+'" placeholder="Ex: Técnico em Informática">';
  else extraWrap.innerHTML = '';
  openModal('modal-edit-user');
}

function salvarUsuario() {
  var id      = document.getElementById('eu-id').value;
  var role    = document.getElementById('eu-role').value;
  var nome    = document.getElementById('eu-nome').value.trim();
  var usuario = document.getElementById('eu-user').value.trim();
  var senha   = document.getElementById('eu-senha').value.trim();
  var unidade = document.getElementById('eu-unidade').value;
  var errEl   = document.getElementById('eu-err');
  errEl.style.display = 'none';
  if (!nome || !usuario || !unidade) { errEl.textContent='Preencha todos os campos obrigatórios.'; errEl.style.display='block'; return; }
  if (senha && senha.length < 8)     { errEl.textContent='Senha deve ter ao menos 8 caracteres.'; errEl.style.display='block'; return; }
  var s = getStore();
  var listaMap = { psicologa:s.psicologos, instrutor:s.instrutores, coordenacao:s.coordenadores, aluno:s.alunos, admin_unidade:s.administradores, administrador:s.administradores };
  var arr = listaMap[role]; if (!arr) return;
  var u = arr.find(function(x){ return x.id===id; }); if (!u) return;
  var todos = s.psicologos.concat(s.instrutores).concat(s.coordenadores).concat(s.administradores);
  if (todos.find(function(x){ return x.usuario===usuario && x.id!==id; })) {
    errEl.textContent='Nome de usuário já está em uso.'; errEl.style.display='block'; return;
  }
  u.nome = nome; u.usuario = usuario; u.unidadeId = unidade;
  if (senha) u.senha = senha;
  var extraEl = document.getElementById('eu-extra');
  if (extraEl) {
    if (role==='psicologa')   u.crp        = extraEl.value.trim();
    if (role==='instrutor')   u.disciplina = extraEl.value.trim();
    if (role==='coordenacao') u.setor      = extraEl.value.trim();
    if (role==='aluno')       u.curso      = extraEl.value.trim();
  }
  saveStore(s).then(function(){
    closeModal('modal-edit-user');
    toast('✓ Usuário atualizado com sucesso!', 'success');
    return syncStoreFromApi();
  }).then(function(){
    renderUsuarios();
    refreshActivePanel();
  }).catch(function(err){
    errEl.textContent = err && err.message ? err.message : 'Não foi possível atualizar o usuário.';
    errEl.style.display = 'block';
  });
}

function excluirUsuario() {
  var id   = document.getElementById('eu-id').value;
  var role = document.getElementById('eu-role').value;
  if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
  var s = getStore();
  if (role==='psicologa')   s.psicologos   = s.psicologos.filter(function(x){ return x.id!==id; });
  if (role==='instrutor')   s.instrutores  = s.instrutores.filter(function(x){ return x.id!==id; });
  if (role==='coordenacao') s.coordenadores= s.coordenadores.filter(function(x){ return x.id!==id; });
  if (role==='admin_unidade' || role==='administrador') s.administradores= s.administradores.filter(function(x){ return x.id!==id; });
  if (role==='aluno')       s.alunos        = s.alunos.filter(function(x){ return x.id!==id; });
  saveStore(s).then(function(){
    closeModal('modal-edit-user');
    toast('Usuário removido.', 'success');
    return syncStoreFromApi();
  }).then(function(){
    renderUsuarios();
    refreshActivePanel();
  }).catch(function(err){
    toast(err && err.message ? err.message : 'Não foi possível excluir o usuário.', 'error');
    renderUsuarios();
  });
}

afterStoreReady(function(){ refreshActivePanel(); });