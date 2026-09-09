/* ============================================================
   painel-coordenacao.js (inline)
   CORREÇÃO #3: coordenação tem visão GLOBAL de todos os alunos
   e todas as atendimentos. Pode encaminhar qualquer aluno aprovado.
   ============================================================ */
'use strict';
initStore();

var _sess = getSession();
if (!_sess || _sess.role !== 'coordenacao') {
  clearSession();
  clearSession(); window.location.href = '../index.html';
}

document.getElementById('sb-nome').textContent   = _sess.nome || 'Coordenação';
document.getElementById('sb-setor').textContent  = _sess.setor || 'Coordenação';
(function(){
  var unNome = nomeUnidade(_sess.unidadeId);
  var el = document.querySelector('.topbar-breadcrumb');
  if (el) el.textContent = 'SAP · Coordenação · ' + unNome;
})();
document.getElementById('sb-avatar').textContent = (_sess.nome || 'C').charAt(0);
document.getElementById('wb-nome').textContent   = 'Olá, ' + (_sess.nome || 'Coordenação').split(' ')[0] + '!';
document.getElementById('wb-setor').textContent  = _sess.setor || 'SENAC CEP';

/* ── Navegação ── */
function navTo(panelId, navEl) {
  document.querySelectorAll('.panel-section').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(n) { n.classList.remove('active'); });
  var p = document.getElementById(panelId);
  if (p) p.classList.add('active');
  if (navEl) navEl.classList.add('active');
  var labelEl = navEl ? navEl.querySelector('.nav-label') : null;
  document.getElementById('topbar-title').textContent = labelEl ? labelEl.textContent : '';
  if (panelId === 'panel-home')       renderHome();
  if (panelId === 'panel-alunos')     popularCursosAlunoCadastro();
  renderAlunos();
  if (panelId === 'panel-atendimentos')  renderAtendimentos();
  if (panelId === 'panel-encaminhar') popularSelectAlunos();
  if (panelId === 'panel-chat')       renderChat();
  if (panelId === 'panel-cursos')     { renderCursos(); renderTurmas(); }
  if (panelId === 'panel-instrutores') renderInstrutores();
}

/* ── Home ── */
function renderHome() {
  var store = getStore();
  var atendimentosUnidade = Permissions.getAtendimentosVisiveis(_sess, store.atendimentos, store.alunos);
  var todosAlunos = Permissions.getAlunosVisiveis(_sess, store.alunos);

  document.getElementById('st-alunos').textContent = todosAlunos.length;
  document.getElementById('st-agt').textContent    = atendimentosUnidade.filter(function(c){ return c.status==='aguardando'; }).length;
  document.getElementById('st-conf').textContent   = atendimentosUnidade.filter(function(c){ return c.status==='confirmada'; }).length;
  document.getElementById('st-real').textContent   = atendimentosUnidade.filter(function(c){ return c.status==='realizada'; }).length;

  renderAlunosDashboard(todosAlunos);

  var recentes = atendimentosUnidade.slice().sort(function(a,b){ return new Date(b.criacao)-new Date(a.criacao); }).slice(0,5);
  var el = document.getElementById('home-recentes');
  if (!el) return;
  if (!recentes.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhuma solicitação ainda</div></div>';
    return;
  }
  el.innerHTML = recentes.map(function(c) {
    var al = store.alunos.find(function(a){ return a.id===c.idAluno; }) || {nome:'—'};
    return '<div class="atendimento-item">'
      + '<div class="ci-status-bar bar-' + escape(c.status) + '"></div>'
      + '<div class="ci-body">'
      + '<div class="ci-header">'
      + '<span class="ci-motivo">' + escape(c.motivoSolicitação.slice(0,60)) + (c.motivoSolicitação.length>60?'…':'') + '</span>'
      + statusBadge(c.status)
      + '</div>'
      + '<div class="ci-meta">'
      + '<span class="ci-meta-item">' + escape(al.nome) + '</span>'
      + '<span class="ci-meta-item">' + turnoLabel(c.turno) + '</span>'
      + '<span class="ci-meta-item">' + fmtDate(c.criacao) + '</span>'
      + '</div></div></div>';
  }).join('');
}


function renderCursoPizza(cursosMap, total, contextoLabel) {
  var cores = ['#2d7ff9','#f97316','#10b981','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899','#84cc16','#6366f1'];
  var cursos = Object.keys(cursosMap || {}).sort(function(a,b){ return cursosMap[b]-cursosMap[a] || a.localeCompare(b); });
  var canvas = document.getElementById('chart-pizza');
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
  if (canvas && canvas.getContext) {
    var style = getComputedStyle(document.documentElement);
    function cssVar(name, fallback) { return (style.getPropertyValue(name) || fallback).trim() || fallback; }
    function drawArc(ctx, cx, cy, radius, start, end, color, width, active) {
      var grad = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
      grad.addColorStop(0, lighten(color, active ? .34 : .24));
      grad.addColorStop(.55, color);
      grad.addColorStop(1, color);
      ctx.beginPath(); ctx.arc(cx, cy, radius, start, end);
      ctx.strokeStyle = grad; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
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
    ctx.shadowColor = 'rgba(15,23,42,.20)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 14;
    ctx.beginPath(); ctx.arc(cx, cy, radius+ring/2+9, 0, Math.PI*2); ctx.fillStyle = surface; ctx.fill();
    ctx.restore();
    var halo = ctx.createRadialGradient(cx, cy, radius-ring, cx, cy, radius+ring);
    halo.addColorStop(0, 'rgba(247,163,0,0)'); halo.addColorStop(1, 'rgba(247,163,0,.08)');
    ctx.beginPath(); ctx.arc(cx, cy, radius+ring/2+10, 0, Math.PI*2); ctx.fillStyle = halo; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.strokeStyle = track; ctx.lineWidth = ring; ctx.lineCap = 'round'; ctx.stroke();

    if (!total) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI/2, Math.PI*1.5); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = ring; ctx.stroke();
      ctx.fillStyle = muted; ctx.font = '700 13px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Sem dados', cx, cy);
    } else {
      var gap = Math.PI / 90, ang = -Math.PI/2;
      cursos.forEach(function(nome,i){
        var frac = cursosMap[nome] / total;
        var sweep = frac * Math.PI * 2;
        var start = ang + gap/2;
        var end = ang + sweep - gap/2;
        if (end < start) end = start + Math.max(sweep * .7, .018);
        segments.push({ nome:nome, valor:cursosMap[nome], frac:frac, start:start, end:end, color:cores[i%cores.length] });
        ctx.save(); ctx.shadowColor = cores[i%cores.length] + '66'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
        drawArc(ctx, cx, cy, radius, start, end, cores[i%cores.length], ring, false); ctx.restore();
        if (frac >= .10) {
          var mid = start + (end-start)/2;
          var lx = cx + Math.cos(mid) * (radius + ring*.78);
          var ly = cy + Math.sin(mid) * (radius + ring*.78);
          ctx.beginPath(); ctx.arc(lx, ly, 15, 0, Math.PI*2); ctx.fillStyle = surface; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = cores[i%cores.length]; ctx.stroke();
          ctx.fillStyle = ink; ctx.font = '900 10px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.round(frac*100)+'%', lx, ly);
        }
        ang += sweep;
      });
      ctx.beginPath(); ctx.arc(cx, cy, radius-ring*.68, 0, Math.PI*2); ctx.fillStyle = surface; ctx.fill();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 38px "DM Sans", sans-serif'; ctx.fillText(total, cx, cy-11);
      ctx.font = '900 10.5px "DM Sans", sans-serif'; ctx.fillStyle = muted; ctx.fillText(total === 1 ? 'ALUNO' : 'ALUNOS', cx, cy+19);
    }
    canvas._pizzaHit = { segments: segments, radius: radius, ring: ring, size: size };
    if (!canvas._pizzaBound) {
      canvas._pizzaBound = true;
      canvas.addEventListener('mousemove', function(e){
        var hit = canvas._pizzaHit; if (!hit) return;
        var rect = canvas.getBoundingClientRect(); var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var dx = x - rect.width/2, dy = y - rect.height/2;
        var dist = Math.sqrt(dx*dx + dy*dy) * (hit.size / rect.width);
        var angle = Math.atan2(dy, dx); if (angle < -Math.PI/2) angle += Math.PI*2;
        var active = -1;
        hit.segments.forEach(function(s,i){ var a = angle; if (a < s.start) a += Math.PI*2; if (dist >= hit.radius-hit.ring*.78 && dist <= hit.radius+hit.ring*.9 && a >= s.start && a <= s.end) active = i; });
        document.querySelectorAll('.pizza-legend-item').forEach(function(el){ el.classList.toggle('active', Number(el.getAttribute('data-i')) === active); });
        if (tip && active >= 0 && hit.segments[active]) {
          var s = hit.segments[active];
          tip.innerHTML = '<strong>'+escape(s.nome)+'</strong><span>'+s.valor+' aluno'+(s.valor!==1?'s':'')+' · '+Math.round(s.frac*100)+'%</span>';
          tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.display = 'block';
        } else if (tip) { tip.style.display = 'none'; }
      });
      canvas.addEventListener('mouseleave', function(){ if (tip) tip.style.display = 'none'; document.querySelectorAll('.pizza-legend-item').forEach(function(el){ el.classList.remove('active'); }); });
    }
  }
  var summary = document.getElementById('chart-pizza-summary');
  if (summary) {
    if (cursos.length && total) {
      var top = cursos[0], topN = cursosMap[top], topPct = Math.round(topN/total*100);
      summary.innerHTML = '<div class="pizza-summary-kicker">Maior concentração</div>'
        + '<div class="pizza-summary-title">' + escape(top) + '</div>'
        + '<div class="pizza-summary-meta">' + topN + ' aluno' + (topN!==1?'s':'') + ' · ' + topPct + '% ' + contextoLabel + '</div>';
    } else {
      summary.innerHTML = '<div class="pizza-summary-kicker">Distribuição</div><div class="pizza-summary-title">Sem dados para exibir</div><div class="pizza-summary-meta">Cadastre alunos para popular o gráfico.</div>';
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
        +'<div class="pizza-legend-value">'+pct+'%<span class="pizza-legend-pct">'+n+'/'+total+'</span></div></div>';
    }).join('') : '<div class="pizza-legend-item"><div class="pizza-legend-swatch" style="background:#cbd5e1"></div><div><div class="pizza-legend-name">Sem cursos</div><div class="pizza-legend-meta">Cadastre alunos para visualizar a distribuição.</div></div><div class="pizza-legend-value">0%</div></div>';
  }
}

function renderAlunosDashboard(alunos) {
  alunos = alunos || [];
  var total = alunos.length;
  function countBy(prop, fallback) {
    return alunos.reduce(function(acc, a) {
      var k = prop === 'curso' ? alunoCursoNome(a, getStore()) : (prop === 'turma' ? (alunoTurmaNome(a, getStore()) || fallback || 'Não informado') : (a[prop] || fallback || 'Não informado'));
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }
  function topEntries(map, limit) {
    return Object.keys(map).sort(function(a,b){ return map[b]-map[a] || a.localeCompare(b); }).slice(0, limit || 6);
  }
  function renderRows(elId, map, limit, labelSing, empty) {
    var el = document.getElementById(elId);
    if (!el) return;
    var keys = topEntries(map, limit);
    if (!keys.length) { el.innerHTML = '<div class="dash-empty">' + empty + '</div>'; return; }
    el.innerHTML = keys.map(function(k) {
      var n = map[k], pct = total ? Math.round(n / total * 100) : 0;
      return '<div class="dash-row">'
        + '<div class="dash-row-main"><div class="dash-row-title">' + escape(k) + '</div>'
        + '<div class="dash-row-sub">' + pct + '% dos alunos visíveis</div></div>'
        + '<div class="dash-row-value">' + n + '</div>'
        + '<div class="dash-row-track"><div class="dash-row-fill" style="--pct:' + pct + '%"></div></div>'
        + '</div>';
    }).join('');
  }

  renderCursoPizza(countBy('curso', 'Sem curso'), total, 'dos alunos visíveis');
  renderRows('dash-turmas', countBy('turma', 'Sem turma'), 6, 'aluno', 'Nenhuma turma cadastrada ainda.');

  var ativos = alunos.filter(function(a){ return a.statusCadastro === 'ativo' || a.statusCadastro === 'aprovado'; }).length;
  var pcd = alunos.filter(function(a){ return !!a.pcd; }).length;
  var menores = alunos.filter(function(a){ var id = calcIdade(a.dataNascimento); return id !== null && id < 18; }).length;
  var turnos = countBy('turnoCurso', 'Sem turno');
  var turnoTop = topEntries(turnos, 1)[0] || '—';
  var resumo = document.getElementById('dash-resumo');
  if (resumo) {
    resumo.innerHTML =
      '<div class="dash-mini orange"><div class="dash-mini-value">' + total + '</div><div class="dash-mini-label">Total de alunos</div></div>'
      + '<div class="dash-mini green"><div class="dash-mini-value">' + ativos + '</div><div class="dash-mini-label">Ativos/aprovados</div></div>'
      + '<div class="dash-mini navy"><div class="dash-mini-value">' + menores + '</div><div class="dash-mini-label">Menores de 18</div></div>'
      + '<div class="dash-mini blue"><div class="dash-mini-value">' + pcd + '</div><div class="dash-mini-label">Alunos PCD</div></div>'
      + '<div class="dash-mini orange"><div class="dash-mini-value">' + escape(turnoLabel(turnoTop)) + '</div><div class="dash-mini-label">Turno com mais alunos</div></div>';
  }

  var recentes = alunos.slice().sort(function(a,b){ return new Date(b.dataCadastro || 0) - new Date(a.dataCadastro || 0); }).slice(0,5);
  var recEl = document.getElementById('dash-recentes-alunos');
  if (recEl) {
    recEl.innerHTML = recentes.length ? recentes.map(function(a) {
      return '<div class="dash-row"><div class="dash-row-main"><div class="dash-row-title">' + escape(a.nome) + '</div>'
        + '<div class="dash-row-sub">' + escape(alunoCursoNome(a, getStore())) + ' · ' + escape(alunoTurmaNome(a, getStore()) || 'Sem turma') + '</div></div>'
        + '<div class="dash-row-value" style="font-size:13px">' + fmtDate(a.dataCadastro) + '</div></div>';
    }).join('') : '<div class="dash-empty">Nenhum cadastro recente.</div>';
  }
}

/* ── Lista de Alunos (visão global) ── */
function renderAlunos() {
  var store = getStore();
  var q = (document.getElementById('busca-al') ? document.getElementById('busca-al').value : '').toLowerCase();

  /* CORREÇÃO #3: coordenação vê todos */
  var lista = Permissions.getAlunosVisiveis(_sess, store.alunos).filter(function(a) {
    return !q || a.nome.toLowerCase().indexOf(q)>=0 || a.matricula.indexOf(q)>=0;
  });

  var tb = document.getElementById('tbody-alunos');
  if (!tb) return;
  if (!lista.length) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--gray-400)">Nenhum aluno</td></tr>';
    return;
  }
  tb.innerHTML = lista.map(function(a) {
    var nc = store.atendimentos.filter(function(c){ return c.idAluno===a.id; }).length;
    var statusColor = a.statusCadastro==='ativo'?'#dcfce7;color:#15803d'
                    : a.statusCadastro==='pendente'?'#FEF3DC;color:#C87F00'
                    : '#fee2e2;color:#991b1b';
    var statusLabel = a.statusCadastro==='ativo'?'Aprovado'
                    : a.statusCadastro==='pendente'?'Pendente':'Rejeitado';
    return '<tr>'
      + '<td><div style="font-weight:600">' + escape(a.nome) + '</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400)">' + escape(a.email||'') + '</div></td>'
      + '<td><code style="font-size:12px">' + escape(a.matricula) + '</code></td>'
      + '<td>' + escape(alunoCursoNome(a, getStore())) + ' / ' + escape(alunoTurmaNome(a, getStore())||'—')
      + '<div style="font-size:11px;color:var(--gray-400)">Turno: ' + turnoLabel(a.turnoCurso) + '</div></td>'
      + '<td>' + (a.pcd?'<span style="font-size:11px;font-weight:700;background:#E8EFF8;color:#1B3A6B;padding:2px 8px;border-radius:20px;">PCD</span>':'—') + '</td>'
      + '<td><span style="font-size:11px;font-weight:700;background:' + statusColor + ';padding:2px 8px;border-radius:20px;">' + statusLabel + '</span></td>'
      + '<td style="text-align:center">' + nc + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="encAluno(\'' + a.id + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
      + 'Encaminhar</button></td>'
      + '</tr>';
  }).join('');
}

function encAluno(id) {
  navTo('panel-encaminhar', document.querySelector('[data-panel="panel-encaminhar"]'));
  setTimeout(function() { document.getElementById('enc-aluno').value = id; atualizarCompatibilidade(); }, 80);
}

/* ── Select de alunos (coordenação vê todos aprovados) ── */
function popularSelectAlunos() {
  var store = getStore();
  var aprovados = Permissions.getAlunosVisiveis(_sess, store.alunos, { apenasAprovados: true });
  var sel = document.getElementById('enc-aluno');
  if (!sel) return;
  var atual = sel.value;
  var options = '<option value="">Selecione o aluno...</option>'
    + aprovados.map(function(a) {
        return '<option value="' + a.id + '">' + escape(a.nome) + ' — ' + escape(alunoTurmaNome(a, store) || a.turma || 'Sem turma') + '</option>';
      }).join('');
  if (typeof sapSetSelectOptions === 'function') sapSetSelectOptions(sel, options, atual);
  else { sel.innerHTML = options; if (atual && aprovados.some(function(a){ return a.id === atual; })) sel.value = atual; }
  atualizarCompatibilidade();
}

function atualizarCompatibilidade() {
  var store    = getStore();
  var alunoId  = document.getElementById('enc-aluno') ? document.getElementById('enc-aluno').value : '';
  var horaEl   = document.getElementById('enc-hora');
  var hora     = horaEl ? horaEl.value : '';
  var hint     = document.getElementById('enc-hint');
  var hintHora = document.getElementById('enc-hora-hint');
  var aluno    = alunoId ? store.alunos.find(function(a){ return a.id===alunoId; }) : null;
  var turnoCurso = aluno ? Validators.normalizeTurno(aluno.turnoCurso) : '';
  var tipo = document.getElementById('enc-tipo') ? document.getElementById('enc-tipo').value : '';

  if (hint) {
    hint.textContent = descricaoDisponibilidadeAluno(aluno);
    hint.style.color = aluno && !turnoCurso ? 'var(--s-cancel)' : '';
  }

  if (tipo === 'remoto') {
    var turnoRemoto = document.getElementById('enc-turno');
    if (turnoRemoto) { turnoRemoto.value = ''; turnoRemoto.disabled = true; }
    if (horaEl) { horaEl.removeAttribute('min'); horaEl.removeAttribute('max'); }
    if (hintHora) { hintHora.textContent = 'Atendimento remoto: o turno do curso nao e obrigatorio.'; hintHora.style.color = '#1d4ed8'; }
    return;
  } else {
    var turnoPresencial = document.getElementById('enc-turno');
    if (turnoPresencial) turnoPresencial.disabled = false;
  }

  var turnoSelect = document.getElementById('enc-turno');
  if (turnoSelect) {
    if (turnoCurso && tipo === 'dentro') turnoSelect.value = turnoCurso;
    else if (turnoCurso && tipo === 'fora' && turnoSelect.value === turnoCurso) turnoSelect.value = '';
    Array.from(turnoSelect.options).forEach(function(opt) {
      if (!opt.value) return;
      var disabled = tipo === 'fora'
        ? !!(turnoCurso && opt.value === turnoCurso)
        : !!(tipo === 'dentro' && turnoCurso && opt.value !== turnoCurso);
      opt.disabled = disabled;
      opt.style.color = disabled ? 'var(--gray-400)' : '';
    });
  }

  if (horaEl) {
    var turnoRef = tipo === 'fora' ? (turnoSelect ? turnoSelect.value : '') : turnoCurso;
    var faixa = turnoHoraConfig(turnoRef);
    // IMPORTANTE: não aplicamos min/max nem limpamos o campo durante a digitação.
    // Em alguns navegadores, input type="time" com min/max apaga o valor parcial
    // quando a pessoa ainda está digitando os minutos, por exemplo 09:25.
    // A validação continua existindo visualmente e no submitEnc().
    horaEl.removeAttribute('min');
    horaEl.removeAttribute('max');
  }

  if (aluno && turnoCurso) {
    var turnoHint = tipo === 'fora' ? (turnoSelect ? turnoSelect.value : '') : turnoCurso;
    var faixaLabel = turnoHoraConfig(turnoHint);
    if (hora) {
      var compat = tipo === 'fora'
        ? { ok: !!turnoHint && turnoHint !== turnoCurso && horarioDentroDoTurno(hora, turnoHint), motivo: 'Horario fora da faixa do turno escolhido.' }
        : getCompatibilidadeAtendimento(aluno, turnoCurso, hora);
      if (hintHora) {
        hintHora.textContent = compat.ok
          ? '✓ Horário dentro do turno ' + turnoLabel(turnoHint || turnoCurso) + (faixaLabel ? ' (' + faixaLabel.inicio + ' às ' + faixaLabel.fim + ')' : '') + '.'
          : '⚠ ' + compat.motivo;
        hintHora.style.color = compat.ok ? 'var(--s-done)' : 'var(--s-cancel)';
      }
    } else if (hintHora) {
      hintHora.textContent = 'Escolha um horário entre '
        + (faixaLabel ? faixaLabel.inicio + ' e ' + faixaLabel.fim : 'os horários permitidos')
        + ' (turno ' + turnoLabel(turnoCurso) + ').';
      hintHora.style.color = 'var(--gray-500)';
    }
  } else if (hintHora) {
    hintHora.textContent = 'O horário deve ser no mesmo turno do curso do aluno.';
    hintHora.style.color = '';
  }
}

function submitEnc() {
  var store   = getStore();
  var alunoId = document.getElementById('enc-aluno').value;
  var motivo  = document.getElementById('enc-motivo').value.trim();
  var data    = document.getElementById('enc-data').value;
  var turno   = document.getElementById('enc-turno').value;
  var hora    = document.getElementById('enc-hora').value;
  var obs     = document.getElementById('enc-obs').value.trim();
  var errEl   = document.getElementById('enc-err');
  var tipo = document.getElementById('enc-tipo') ? document.getElementById('enc-tipo').value : '';
  errEl.style.display = 'none';

  if (!tipo) { errEl.textContent='Selecione o tipo de atendimento.'; errEl.style.display='block'; return; }
  if (!alunoId || !motivo || (tipo !== 'remoto' && !turno)) {
    errEl.textContent = tipo === 'remoto' ? 'Preencha: aluno e motivo.' : 'Preencha: aluno, motivo e turno.'; errEl.style.display='block'; return;
  }
  var alunoObj = store.alunos.find(function(a){ return a.id===alunoId; });
  if (tipo === 'fora') {
    var turnoCursoEnc = alunoObj ? Validators.normalizeTurno(alunoObj.turnoCurso) : '';
    var turnoEnc = Validators.normalizeTurno(turno);
    if (turnoCursoEnc && turnoEnc === turnoCursoEnc) {
      errEl.textContent = 'Para atendimento fora do horario, escolha um turno diferente do curso do aluno.'; errEl.style.display='block'; return;
    }
    if (hora && !horarioDentroDoTurno(hora, turnoEnc)) {
      errEl.textContent = 'Horario fora da faixa do turno escolhido.'; errEl.style.display='block'; return;
    }
  } else if (tipo !== 'remoto' && hora) {
    var compat = getCompatibilidadeAtendimento(alunoObj, turno, hora);
    if (!compat.ok) { errEl.textContent=compat.motivo; errEl.style.display='block'; return; }
  }
  store.atendimentos.push({
    id: genId('c'), idAluno: alunoId, agendadoPor: _sess.id,
    unidadeId: _sess.unidadeId||'u1',
    motivoSolicitação: motivo, dataPreferencial: data,
    horarioPreferencial: hora,
    turno: tipo === 'remoto' ? 'remoto' : turno,
    tipoAtendimento: tipo,
    obsResponsavel: obs,
    obsPsicologa: '', status: 'aguardando', criacao: new Date().toISOString()
  });
  saveStore(store).then(function(){
    toast('Solicitação enviada!', 'success');
    ['enc-aluno','enc-motivo','enc-data','enc-hora','enc-obs'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.value='';
    });
    var ts=document.getElementById('enc-turno'); if(ts) ts.value='';
    var tt=document.getElementById('enc-tipo'); if(tt) tt.value='';
    atualizarCompatibilidade();
    refreshActivePanel();
  }).catch(function(err){
    errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar o encaminhamento no banco.';
    errEl.style.display = 'block';
  });
}

/* ── Atendimentos (visão global) ── */
function renderAtendimentos() {
  var store = getStore();
  var q   = document.getElementById('busca-cons') ? document.getElementById('busca-cons').value.toLowerCase() : '';
  var fSt = document.getElementById('filtro-st')  ? document.getElementById('filtro-st').value : '';

  /* CORREÇÃO #3: coordenação vê TODAS as atendimentos */
  var lista = Permissions.getAtendimentosVisiveis(_sess, store.atendimentos, store.alunos);
  if (fSt) lista = lista.filter(function(c){ return c.status===fSt; });
  if (q) lista = lista.filter(function(c) {
    var al = store.alunos.find(function(a){ return a.id===c.idAluno; });
    return (al&&al.nome||'').toLowerCase().indexOf(q)>=0
        || (al&&al.matricula||'').indexOf(q)>=0
        || c.motivoSolicitação.toLowerCase().indexOf(q)>=0;
  });
  lista.sort(function(a,b){ return new Date(b.criacao)-new Date(a.criacao); });

  var tb = document.getElementById('tbody-cons');
  if (!tb) return;
  if (!lista.length) {
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--gray-400)">Nenhuma atendimento</td></tr>'; return;
  }
  tb.innerHTML = lista.map(function(c) {
    var al = store.alunos.find(function(a){ return a.id===c.idAluno; }) || {nome:'—',matricula:''};
    var tipoAtend = c.tipoAtendimento || '';
    var isRemoto = (tipoAtend === 'remoto' || c.turno === 'remoto');
    var turnoCurso    = Validators.normalizeTurno(al.turnoCurso);
    var turnoAtendimento = Validators.normalizeTurno(c.turno);
    var isForaH = !isRemoto && (tipoAtend === 'fora' || (turnoCurso && turnoAtendimento && turnoCurso !== turnoAtendimento));
    var rowStyle = isRemoto ? ' style="background:rgba(37,99,235,0.06);border-left:3px solid #3b82f6"' : isForaH ? ' style="background:rgba(247,163,0,0.06);border-left:3px solid #f5c518"' : '';
    var tipoTag = isRemoto ? ' <span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:10px">📱 Remoto</span>' : isForaH ? ' <span style="font-size:10px;font-weight:700;background:#fef3dc;color:#c87f00;padding:2px 6px;border-radius:10px">⚠️ Fora do horário</span>' : (turnoCurso ? ' <span style="font-size:10px;color:var(--gray-400)">✓</span>' : '');
    var tLab = isRemoto ? '<span style="color:#1d4ed8;font-weight:600">Remoto</span>' : turnoLabel(c.turno);
    return '<tr'+rowStyle+'>'
      + '<td><div style="font-weight:600">' + escape(al.nome) + '</div>'
      + '<div style="font-size:11.5px;color:var(--gray-400)">' + escape(al.matricula) + '</div></td>'
      + '<td>' + escape(c.motivoSolicitação.length>45?c.motivoSolicitação.slice(0,45)+'…':c.motivoSolicitação) + '</td>'
      + '<td>' + tLab + tipoTag + '</td>'
      + '<td>' + escape(solicitanteNome(c)) + '</td>'
      + '<td>' + statusBadge(c.status) + '</td>'
      + '<td>' + fmtDate(c.criacao) + '</td>'
      + '</tr>';
  }).join('');
}

/* ── Chat ── */
var _chatDestinatarioId = null;

function getPsicologosDaUnidade(store) {
  store = store || getStore();
  var lista = (store.psicologos || []).filter(function(p){ return !p.unidadeId || p.unidadeId === _sess.unidadeId; });
  return lista.length ? lista : (store.psicologos || []);
}

function getPsicologaDaUnidade(store) {
  var lista = getPsicologosDaUnidade(store);
  return lista[0] || null;
}

function getChatContatoAtual(store) {
  store = store || getStore();
  if (!_chatDestinatarioId) return null;
  return (store.psicologos || []).find(function(p){ return p.id === _chatDestinatarioId; }) || null;
}

function iniciaisNome(nome) {
  nome = String(nome || '').trim();
  if (!nome) return '?';
  var partes = nome.split(/\s+/).filter(Boolean);
  return ((partes[0] || '?')[0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

function mensagensDaConversa(store, contatoId) {
  return (store.mensagens || []).filter(function(m) {
    return ((m.de === _sess.id && m.para === contatoId) || (m.de === contatoId && m.para === _sess.id))
      && (m.unidadeId === _sess.unidadeId || !m.unidadeId);
  }).sort(function(a,b){ return new Date(a.criacao) - new Date(b.criacao); });
}

function renderChatContatos() {
  var store = getStore();
  var contatos = getPsicologosDaUnidade(store);
  var el = document.getElementById('chat-contatos');
  if (!el) return;
  if (!contatos.length) {
    el.innerHTML = '<div class="chat-empty-contact">Nenhum psicólogo cadastrado para esta unidade.</div>';
    return;
  }
  el.innerHTML = contatos.map(function(p) {
    var msgs = mensagensDaConversa(store, p.id);
    var ultima = msgs[msgs.length - 1];
    var naoLidas = msgs.filter(function(m){ return m.para === _sess.id && !m.lida; }).length;
    var active = p.id === _chatDestinatarioId ? ' active' : '';
    return '<button type="button" class="chat-contact' + active + '" onclick="selecionarPsicologoChat(&quot;' + p.id + '&quot;)">'
      + '<span class="chat-contact-av">' + escape(iniciaisNome(p.nome)) + '</span>'
      + '<span class="chat-contact-body"><strong>' + escape(p.nome || 'Psicólogo(a)') + '</strong>'
      + '<small>' + escape(ultima ? ultima.texto.slice(0, 48) + (ultima.texto.length > 48 ? '…' : '') : 'Clique para abrir o chat') + '</small></span>'
      + (naoLidas ? '<span class="chat-unread">' + naoLidas + '</span>' : '')
      + '</button>';
  }).join('');
}

function selecionarPsicologoChat(id) {
  _chatDestinatarioId = id;
  renderChat();
}

function renderChat() {
  var store = getStore();
  if (!_chatDestinatarioId) {
    var primeiro = getPsicologaDaUnidade(store);
    if (primeiro && document.getElementById('panel-chat') && document.getElementById('panel-chat').classList.contains('active')) {
      // Não abre automaticamente. Mantém a escolha explícita, como solicitado.
    }
  }
  renderChatContatos();
  var contato = getChatContatoAtual(store);
  var nomeEl = document.getElementById('chat-psic-nome');
  var subEl = document.getElementById('chat-psic-sub');
  var avEl = document.getElementById('chat-dest-av');
  var txt = document.getElementById('chat-txt');
  var btn = document.getElementById('chat-send-btn');
  var area = document.getElementById('chat-area');
  if (!area) return;
  if (!contato) {
    if (nomeEl) nomeEl.textContent = 'Selecione um psicólogo';
    if (subEl) subEl.textContent = 'Clique em um contato na lateral';
    if (avEl) avEl.textContent = '?';
    if (txt) { txt.value = ''; txt.disabled = true; }
    if (btn) btn.disabled = true;
    area.innerHTML = '<div class="chat-empty-msg">Escolha um psicólogo na lista para abrir a conversa.</div>';
    return;
  }
  if (nomeEl) nomeEl.textContent = contato.nome || 'Psicólogo(a)';
  if (subEl) subEl.textContent = 'Psicologia — SENAC CEP';
  if (avEl) avEl.textContent = iniciaisNome(contato.nome);
  if (txt) txt.disabled = false;
  if (btn) btn.disabled = false;

  var msgs = mensagensDaConversa(store, contato.id);
  if (!msgs.length) {
    area.innerHTML = '<div class="chat-empty-msg">Nenhuma mensagem ainda.<br>Digite abaixo para iniciar a conversa.</div>';
    return;
  }
  area.innerHTML = msgs.map(function(m) {
    return '<div class="chat-msg ' + (m.de === _sess.id ? 'sent' : 'recv') + '">'
      + '<div class="chat-bubble">' + escape(m.texto) + '</div>'
      + '<div class="chat-meta">' + fmtDatetime(m.criacao) + '</div></div>';
  }).join('');
  area.scrollTop = area.scrollHeight;
}

function enviarMsg() {
  var input = document.getElementById('chat-txt');
  var texto = input ? input.value.trim() : '';
  if (!_chatDestinatarioId) { toast('Clique em um psicólogo antes de enviar mensagem.', 'warning'); return; }
  if (!texto) return;
  var store = getStore();
  var contato = getChatContatoAtual(store);
  if (!contato) { toast('Psicólogo não encontrado.', 'error'); return; }
  store.mensagens.push({ id:genId('m'), de:_sess.id, para:contato.id, unidadeId:_sess.unidadeId || 'u1', texto:texto, criacao:new Date().toISOString(), lida:false });
  saveStore(store).then(function(){ renderChat(); });
  input.value = '';
  renderChat();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement && document.activeElement.id === 'chat-txt') {
    e.preventDefault();
    enviarMsg();
  }
});

/* ── Cadastro de aluno ── */
function salvarAluno() {
  var nome  = document.getElementById('cad-nome').value.trim();
  var mat   = document.getElementById('cad-mat').value.trim();
  var cpf   = document.getElementById('cad-cpf').value.trim();
  var nasc  = document.getElementById('cad-nasc').value;
  var tel   = document.getElementById('cad-tel').value.trim();
  var curId = document.getElementById('cad-curso').value;
  var turId = document.getElementById('cad-turma').value;
  var turno = document.getElementById('cad-turno').value;
  var pcd   = document.getElementById('cad-pcd').value === 'sim';
  var eml   = document.getElementById('cad-email').value.trim();
  var errEl = document.getElementById('cad-err');
  errEl.style.display='none';

  if (!nome||!mat||!cpf||!nasc||!tel||!curId||!turId||!turno) {
    errEl.textContent='Preencha todos os campos obrigatórios e selecione um curso/turma cadastrados.'; errEl.style.display='block'; return;
  }
  if (!Validators.cpf(cpf)) {
    errEl.textContent='CPF inválido. Verifique os dígitos.'; errEl.style.display='block'; return;
  }
  if (eml && !Validators.email(eml)) {
    errEl.textContent='E-mail inválido.'; errEl.style.display='block'; return;
  }
  if (!Validators.telefone(tel)) {
    errEl.textContent='Telefone inválido.'; errEl.style.display='block'; return;
  }
  var dataNascValidada = Validators.data(nasc);
  if (!dataNascValidada) {
    errEl.textContent='Data de nascimento inválida.'; errEl.style.display='block'; return;
  }
  var hojeNascimento = new Date();
  hojeNascimento.setHours(23,59,59,999);
  if (dataNascValidada.getTime() > hojeNascimento.getTime()) {
    errEl.textContent='A data de nascimento não pode ser futura.'; errEl.style.display='block'; return;
  }

  var store = getStore();
  if (store.alunos.find(function(a){ return a.matricula===mat; })) {
    errEl.textContent='Matrícula já cadastrada.'; errEl.style.display='block'; return;
  }
  if (store.alunos.find(function(a){ return a.cpf.replace(/\D/g,'')===cpf.replace(/\D/g,''); })) {
    errEl.textContent='CPF já cadastrado.'; errEl.style.display='block'; return;
  }

  var cursoObj = store.cursos.find(function(c){ return c.id === curId; });
  var turmaObj = store.turmas.find(function(t){ return t.id === turId; });
  if (!cursoObj || !turmaObj) {
    errEl.textContent='Curso ou turma não encontrados. Cadastre primeiro em Cursos e Turmas.'; errEl.style.display='block'; return;
  }

  store.alunos.push({
    id:genId('al'), nome:nome, matricula:mat, cpf:cpf, dataNascimento:nasc, telefone:tel,
    curso:cursoObj.nome, turma:turmaObj.nome, cursoId:cursoObj.id, turmaId:turmaObj.id,
    cursoApiId:cursoObj.apiId || null, turmaApiId:turmaObj.apiId || null,
    turnoCurso:Validators.normalizeTurno(turmaObj.turno || turno),
    email:eml, pcd:pcd, responsavelCad:_sess.id,
    unidadeId:_sess.unidadeId||'u1',
    statusCadastro:'ativo',
    dataCadastro:new Date().toISOString()
  });
  saveStore(store).then(function(){
    closeModal('modal-cad');
    toast('Aluno cadastrado com sucesso!', 'success');
    ['cad-nome','cad-mat','cad-cpf','cad-nasc','cad-tel','cad-curso','cad-turma','cad-turno','cad-email'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.value='';
    });
    var pcdSel=document.getElementById('cad-pcd'); if(pcdSel) pcdSel.value='nao';
    popularCursosAlunoCadastro();
    renderAlunos();
  }).catch(function(err){
    errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar o aluno no banco.';
    errEl.style.display='block';
  });
}

/* ── Cursos e Turmas ── */
function cursosDaUnidade(){
  return getStore().cursos.filter(function(c){ return !c.unidadeId || c.unidadeId === _sess.unidadeId; });
}
function turmasDaUnidade(){
  return getStore().turmas.filter(function(t){ return !t.unidadeId || t.unidadeId === _sess.unidadeId; });
}

function instrutoresDaUnidade(){
  return getStore().instrutores.filter(function(i){ return !i.unidadeId || i.unidadeId === _sess.unidadeId; });
}
function renderInstrutores(){
  var s = getStore(), tb = document.getElementById('tbody-instrutores');
  if (!tb) return;
  var q = (document.getElementById('busca-instrutor') ? document.getElementById('busca-instrutor').value : '').toLowerCase().trim();
  var lista = instrutoresDaUnidade().filter(function(i){
    var texto = [i.nome, i.usuario, i.email].join(' ').toLowerCase();
    return !q || texto.indexOf(q) >= 0;
  });
  if (!lista.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--gray-400)">Nenhum instrutor cadastrado nesta unidade.</td></tr>';
    return;
  }
  tb.innerHTML = lista.map(function(i){
    var turmas = (s.turmas || []).filter(function(t){ return t.instrutorId === i.id || t.instrutorId === i.apiId || apiLongFromCompat(t.instrutorId) === i.apiId; });
    var turmasTxt = turmas.length ? turmas.map(function(t){ return t.nome; }).join(', ') : 'Sem turma vinculada';
    return '<tr>'
      + '<td><strong>' + escape(i.nome || '—') + '</strong><div style="font-size:11.5px;color:var(--gray-400)">' + escape(nomeUnidade(i.unidadeId)) + '</div></td>'
      + '<td><code style="font-size:12px">' + escape(i.usuario || '—') + '</code></td>'
      + '<td>' + escape(i.email || '—') + '</td>'
      + '<td>' + escape(turmasTxt) + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="editarInstrutor(&quot;' + i.id + '&quot;)">Editar</button></td>'
      + '</tr>';
  }).join('');
}
function abrirModalInstrutor(id){
  var s = getStore();
  var inst = id ? s.instrutores.find(function(x){ return x.id === id; }) : null;
  var idEl = document.getElementById('instrutor-modal-id');
  var nomeEl = document.getElementById('instrutor-modal-nome');
  var usuarioEl = document.getElementById('instrutor-modal-usuario');
  var emailEl = document.getElementById('instrutor-modal-email');
  var senhaEl = document.getElementById('instrutor-modal-senha');
  var senhaReq = document.getElementById('instrutor-senha-req');
  var errEl = document.getElementById('instrutor-modal-err');
  var title = document.getElementById('modal-instrutor-title');
  if (errEl) errEl.style.display = 'none';
  if (title) title.textContent = inst ? 'Editar instrutor' : 'Criar instrutor';
  if (idEl) idEl.value = inst ? inst.id : '';
  if (nomeEl) nomeEl.value = inst ? (inst.nome || '') : '';
  if (usuarioEl) usuarioEl.value = inst ? (inst.usuario || '') : '';
  if (emailEl) emailEl.value = inst ? (inst.email || '') : '';
  if (senhaEl) senhaEl.value = '';
  if (senhaReq) senhaReq.textContent = inst ? '(opcional)' : '*';
  openModal('modal-instrutor');
  setTimeout(function(){ if(nomeEl) nomeEl.focus(); }, 80);
}
function editarInstrutor(id){ abrirModalInstrutor(id); }
function salvarInstrutorModal(){
  var id = document.getElementById('instrutor-modal-id').value;
  var nome = document.getElementById('instrutor-modal-nome').value.trim();
  var usuario = document.getElementById('instrutor-modal-usuario').value.trim();
  var email = document.getElementById('instrutor-modal-email').value.trim();
  var senha = document.getElementById('instrutor-modal-senha').value;
  var errEl = document.getElementById('instrutor-modal-err');
  if (errEl) errEl.style.display = 'none';
  if (!nome || !usuario || !email) {
    if (errEl) { errEl.textContent = 'Informe nome, usuário/login e e-mail do instrutor.'; errEl.style.display = 'block'; }
    return;
  }
  if (!Validators.email(email)) {
    if (errEl) { errEl.textContent = 'Informe um e-mail válido.'; errEl.style.display = 'block'; }
    return;
  }
  if (!id && (!senha || senha.length < 6)) {
    if (errEl) { errEl.textContent = 'A senha inicial deve ter no mínimo 6 caracteres.'; errEl.style.display = 'block'; }
    return;
  }
  if (id && senha && senha.length < 6) {
    if (errEl) { errEl.textContent = 'A nova senha deve ter no mínimo 6 caracteres.'; errEl.style.display = 'block'; }
    return;
  }
  var s = getStore();
  var todos = allUsuarios(s);
  var loginDuplicado = todos.some(function(u){ return u.id !== id && String(u.usuario || '').toLowerCase() === usuario.toLowerCase(); });
  var emailDuplicado = todos.some(function(u){ return u.id !== id && String(u.email || '').toLowerCase() === email.toLowerCase(); });
  if (loginDuplicado) {
    if (errEl) { errEl.textContent = 'Já existe um usuário com esse login.'; errEl.style.display = 'block'; }
    return;
  }
  if (emailDuplicado) {
    if (errEl) { errEl.textContent = 'Já existe um usuário com esse e-mail.'; errEl.style.display = 'block'; }
    return;
  }
  if (id) {
    var inst = s.instrutores.find(function(x){ return x.id === id; });
    if (inst) {
      inst.nome = nome;
      inst.usuario = usuario;
      inst.email = email;
      inst.role = 'instrutor';
      inst.unidadeId = _sess.unidadeId;
      if (senha) inst.senha = senha;
    }
  } else {
    s.instrutores.push({ id:genId('usr'), nome:nome, usuario:usuario, email:email, senha:senha, role:'instrutor', unidadeId:_sess.unidadeId, disciplina:'', turmas:[], turmaIds:[] });
  }
  saveStore(s).then(function(){
    closeModal('modal-instrutor');
    toast('Instrutor salvo com sucesso.', 'success');
    renderInstrutores();
    popularSelectsCursosTurmas();
    renderTurmas();
  }).catch(function(err){
    if (errEl) { errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar o instrutor no banco.'; errEl.style.display = 'block'; }
  });
}

function popularSelectsCursosTurmas(){
  var s = getStore();
  var cursos = cursosDaUnidade();
  var cursoOptions = cursos.map(function(c){ return '<option value="' + c.id + '">' + escape(c.nome) + '</option>'; }).join('');

  ['turma-modal-curso'].forEach(function(id){
    var sel = document.getElementById(id);
    if (sel) {
      var html = cursoOptions || '<option value="">Cadastre um curso primeiro</option>';
      if (typeof sapSetSelectOptions === 'function') sapSetSelectOptions(sel, html);
      else sel.innerHTML = html;
    }
  });

  var instOptions = '<option value="">Sem instrutor</option>' + s.instrutores
    .filter(function(i){ return !i.unidadeId || i.unidadeId === _sess.unidadeId; })
    .map(function(i){ return '<option value="' + i.id + '">' + escape(i.nome) + '</option>'; }).join('');
  ['turma-modal-instrutor'].forEach(function(id){
    var sel = document.getElementById(id);
    if (sel) {
      if (typeof sapSetSelectOptions === 'function') sapSetSelectOptions(sel, instOptions);
      else sel.innerHTML = instOptions;
    }
  });
  popularCursosAlunoCadastro();
}

function renderCursos(){
  var s = getStore(), tb = document.getElementById('tbody-cursos'); if(!tb) return;
  popularSelectsCursosTurmas();
  var q = (document.getElementById('busca-curso') ? document.getElementById('busca-curso').value : '').toLowerCase().trim();
  var cursos = cursosDaUnidade().filter(function(c){
    var texto = [c.nome, c.tipoAprendizagem, c.descricao, nomeUnidade(c.unidadeId)].join(' ').toLowerCase();
    return !q || texto.indexOf(q) >= 0;
  });
  tb.innerHTML = cursos.map(function(c){
    return '<tr><td><strong>' + escape(c.nome) + '</strong></td>'
      + '<td>' + escape(c.tipoAprendizagem || '—') + '</td>'
      + '<td>' + escape(nomeUnidade(c.unidadeId)) + '</td>'
      + '<td>' + escape(c.descricao || '—') + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="editarCurso(&quot;' + c.id + '&quot;)">Editar</button> '
      + '<button class="btn btn-danger btn-sm" onclick="excluirCurso(&quot;' + c.id + '&quot;)">Excluir</button></td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--gray-400)">Nenhum curso encontrado.</td></tr>';
}

function abrirModalCurso(id){
  var s = getStore();
  var c = id ? s.cursos.find(function(x){ return x.id === id; }) : null;
  var idEl = document.getElementById('curso-modal-id');
  var nomeEl = document.getElementById('curso-modal-nome');
  var tipoEl = document.getElementById('curso-modal-tipo');
  var descEl = document.getElementById('curso-modal-desc');
  var errEl = document.getElementById('curso-modal-err');
  var title = document.getElementById('modal-curso-title');
  if (errEl) errEl.style.display = 'none';
  if (title) title.textContent = c ? 'Editar curso' : 'Criar curso';
  if (idEl) idEl.value = c ? c.id : '';
  if (nomeEl) nomeEl.value = c ? (c.nome || '') : '';
  if (tipoEl) tipoEl.value = c ? (c.tipoAprendizagem || '') : '';
  if (descEl) descEl.value = c ? (c.descricao || '') : '';
  openModal('modal-curso');
  setTimeout(function(){ if(nomeEl) nomeEl.focus(); }, 80);
}
function editarCurso(id){ abrirModalCurso(id); }
function salvarCursoModal(){
  var id = document.getElementById('curso-modal-id').value;
  var nome = document.getElementById('curso-modal-nome').value.trim();
  var tipo = document.getElementById('curso-modal-tipo').value.trim();
  var desc = document.getElementById('curso-modal-desc').value.trim();
  var errEl = document.getElementById('curso-modal-err');
  if (errEl) errEl.style.display = 'none';
  if (!nome || !tipo) {
    if (errEl) { errEl.textContent = 'Informe o nome do curso e o tipo de aprendizagem.'; errEl.style.display = 'block'; }
    return;
  }
  var s = getStore();
  var duplicado = cursosDaUnidade().some(function(c){ return c.id !== id && String(c.nome || '').toLowerCase() === nome.toLowerCase(); });
  if (duplicado) {
    if (errEl) { errEl.textContent = 'Já existe um curso com esse nome nesta unidade.'; errEl.style.display = 'block'; }
    return;
  }
  if (id) {
    var c = s.cursos.find(function(x){ return x.id === id; });
    if (c) { c.nome = nome; c.tipoAprendizagem = tipo; c.descricao = desc; }
  } else {
    s.cursos.push({ id:genId('cur'), nome:nome, tipoAprendizagem:tipo, descricao:desc, unidadeId:_sess.unidadeId, ativo:true });
  }
  saveStore(s).then(function(){
    closeModal('modal-curso');
    toast('Curso salvo com sucesso.', 'success');
    renderCursos(); renderTurmas(); popularCursosAlunoCadastro();
  }).catch(function(err){
    if (errEl) { errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar o curso no banco.'; errEl.style.display = 'block'; }
  });
}
function excluirCurso(id){
  var s = getStore();
  var usado = s.turmas.some(function(t){ return t.cursoId === id; });
  if (usado && !confirm('Este curso possui turmas vinculadas. Excluir mesmo assim?')) return;
  if (!usado && !confirm('Excluir este curso?')) return;
  s.cursos = s.cursos.filter(function(c){ return c.id !== id; });
  s.turmas = s.turmas.filter(function(t){ return t.cursoId !== id; });
  saveStore(s).then(function(){ renderCursos(); renderTurmas(); popularCursosAlunoCadastro(); });
}

function renderTurmas(){
  var s = getStore(), tb = document.getElementById('tbody-turmas'); if(!tb) return;
  popularSelectsCursosTurmas();
  var q = (document.getElementById('busca-turma') ? document.getElementById('busca-turma').value : '').toLowerCase().trim();
  var turmas = turmasDaUnidade().filter(function(t){
    var inst = s.instrutores.find(function(i){ return i.id === t.instrutorId; });
    var texto = [t.nome, t.curso || nomeCurso(t.cursoId), t.turno, inst ? inst.nome : ''].join(' ').toLowerCase();
    return !q || texto.indexOf(q) >= 0;
  });
  tb.innerHTML = turmas.map(function(t){
    var inst = s.instrutores.find(function(i){ return i.id === t.instrutorId; });
    return '<tr><td><strong>' + escape(t.nome) + '</strong></td>'
      + '<td>' + escape(t.curso || nomeCurso(t.cursoId)) + '</td>'
      + '<td>' + turnoLabel(t.turno) + '</td>'
      + '<td>' + escape(inst ? inst.nome : '—') + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="editarTurma(&quot;' + t.id + '&quot;)">Editar</button> '
      + '<button class="btn btn-danger btn-sm" onclick="excluirTurma(&quot;' + t.id + '&quot;)">Excluir</button></td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--gray-400)">Nenhuma turma encontrada.</td></tr>';
}
function nomeCurso(id){ var c = getStore().cursos.find(function(x){ return x.id === id; }); return c ? c.nome : '—'; }
function abrirModalTurma(id){
  popularSelectsCursosTurmas();
  var s = getStore();
  var t = id ? s.turmas.find(function(x){ return x.id === id; }) : null;
  var idEl = document.getElementById('turma-modal-id');
  var nomeEl = document.getElementById('turma-modal-nome');
  var cursoEl = document.getElementById('turma-modal-curso');
  var turnoEl = document.getElementById('turma-modal-turno');
  var instEl = document.getElementById('turma-modal-instrutor');
  var errEl = document.getElementById('turma-modal-err');
  var title = document.getElementById('modal-turma-title');
  if (errEl) errEl.style.display = 'none';
  if (title) title.textContent = t ? 'Editar turma' : 'Criar turma';
  if (idEl) idEl.value = t ? t.id : '';
  if (nomeEl) nomeEl.value = t ? (t.nome || '') : '';
  if (cursoEl) cursoEl.value = t ? (t.cursoId || '') : (cursoEl.options[0] ? cursoEl.options[0].value : '');
  if (turnoEl) turnoEl.value = t ? (t.turno || 'tarde') : 'tarde';
  if (instEl) instEl.value = t ? (t.instrutorId || '') : '';
  openModal('modal-turma');
  setTimeout(function(){ if(nomeEl) nomeEl.focus(); }, 80);
}
function editarTurma(id){ abrirModalTurma(id); }
function salvarTurmaModal(){
  var id = document.getElementById('turma-modal-id').value;
  var nome = document.getElementById('turma-modal-nome').value.trim();
  var cursoId = document.getElementById('turma-modal-curso').value;
  var turno = document.getElementById('turma-modal-turno').value;
  var instrutorId = document.getElementById('turma-modal-instrutor').value;
  var errEl = document.getElementById('turma-modal-err');
  if (errEl) errEl.style.display = 'none';
  if (!nome || !cursoId || !turno) {
    if (errEl) { errEl.textContent = 'Informe nome da turma, curso e turno.'; errEl.style.display = 'block'; }
    return;
  }
  var s = getStore();
  var curso = s.cursos.find(function(c){ return c.id === cursoId; });
  if (!curso) {
    if (errEl) { errEl.textContent = 'Curso não encontrado. Cadastre ou selecione um curso válido.'; errEl.style.display = 'block'; }
    return;
  }
  var duplicada = turmasDaUnidade().some(function(t){ return t.id !== id && String(t.nome || '').toLowerCase() === nome.toLowerCase() && t.cursoId === cursoId; });
  if (duplicada) {
    if (errEl) { errEl.textContent = 'Já existe uma turma com esse nome para este curso.'; errEl.style.display = 'block'; }
    return;
  }
  if (id) {
    var t = s.turmas.find(function(x){ return x.id === id; });
    if (t) { t.nome = nome; t.cursoId = cursoId; t.curso = curso.nome; t.turno = turno; t.instrutorId = instrutorId || null; }
  } else {
    s.turmas.push({ id:genId('tur'), nome:nome, cursoId:cursoId, curso:curso.nome, turno:turno, unidadeId:_sess.unidadeId, instrutorId:instrutorId || null, ativo:true });
  }
  saveStore(s).then(function(){
    closeModal('modal-turma');
    toast('Turma salva com sucesso.', 'success');
    renderTurmas(); popularCursosAlunoCadastro();
  }).catch(function(err){
    if (errEl) { errEl.textContent = err && err.message ? err.message : 'Não foi possível salvar a turma no banco.'; errEl.style.display = 'block'; }
  });
}
function excluirTurma(id){
  if(!confirm('Excluir esta turma?')) return;
  var s = getStore();
  s.turmas = s.turmas.filter(function(t){ return t.id !== id; });
  saveStore(s).then(function(){ renderTurmas(); popularCursosAlunoCadastro(); });
}

function popularCursosAlunoCadastro(){
  var sel = document.getElementById('cad-curso');
  if (!sel) return;
  var atual = sel.value;
  var cursos = cursosDaUnidade();
  var html = '<option value="">Selecione um curso cadastrado...</option>' + cursos.map(function(c){ return '<option value="' + c.id + '">' + escape(c.nome) + '</option>'; }).join('');
  if (typeof sapSetSelectOptions === 'function') sapSetSelectOptions(sel, html, atual);
  else { sel.innerHTML = html; if (atual && cursos.some(function(c){ return c.id === atual; })) sel.value = atual; }
  popularTurmasAlunoCadastro();
}
function popularTurmasAlunoCadastro(){
  var cursoId = document.getElementById('cad-curso') ? document.getElementById('cad-curso').value : '';
  var sel = document.getElementById('cad-turma');
  if (!sel) return;
  var atual = sel.value;
  var turmas = turmasDaUnidade().filter(function(t){ return !cursoId || t.cursoId === cursoId; });
  var html = '<option value="">Selecione uma turma cadastrada...</option>' + turmas.map(function(t){ return '<option value="' + t.id + '">' + escape(t.nome) + ' — ' + turnoLabel(t.turno) + '</option>'; }).join('');
  if (typeof sapSetSelectOptions === 'function') sapSetSelectOptions(sel, html, atual);
  else { sel.innerHTML = html; if (atual && turmas.some(function(t){ return t.id === atual; })) sel.value = atual; else sel.value = ''; }
  if (atual && !turmas.some(function(t){ return t.id === atual; })) sel.value = '';
  atualizarTurnoAlunoPelaTurma();
}
function atualizarTurnoAlunoPelaTurma(){
  var turmaId = document.getElementById('cad-turma') ? document.getElementById('cad-turma').value : '';
  var turma = getStore().turmas.find(function(t){ return t.id === turmaId; });
  var turnoEl = document.getElementById('cad-turno');
  if (turnoEl && turma && turma.turno) turnoEl.value = Validators.normalizeTurno(turma.turno);
}

function initPainelCoordenacao() {
  afterStoreReady(function(){ refreshActivePanel(); });
  popularSelectAlunos();
  popularCursosAlunoCadastro();
  renderAlunos();
  renderAtendimentos();
  renderCursos(); renderTurmas();
  renderInstrutores();
}

initPainelCoordenacao();

/* ── Modal Agendamento (Instrutor/Coord) ── */
var _magAlunoId = null;

function abrirModalAgendar(idAluno) {
  var store = getStore();
  var alunos = Permissions.getAlunosVisiveis(_sess, store.alunos);
  var sel = document.getElementById('mag-aluno-sel');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione o aluno...</option>'
      + alunos.map(function(a){ return '<option value="'+a.id+'">'+a.nome+' — '+a.matricula+'</option>'; }).join('');
  }
  _magAlunoId = null;
  var infoEl = document.getElementById('mag-aluno-info');
  if (infoEl) infoEl.style.display = 'none';
  var tipoEl = document.getElementById('mag-tipo'); if (tipoEl) tipoEl.value = '';
  var tipoInfo = document.getElementById('mag-tipo-info'); if (tipoInfo) tipoInfo.style.display = 'none';
  var dataEl = document.getElementById('mag-data'); if (dataEl) dataEl.value = new Date().toISOString().slice(0,10);
  var motivoEl = document.getElementById('mag-motivo'); if (motivoEl) motivoEl.value = '';
  var horaEl = document.getElementById('mag-hora'); if (horaEl) horaEl.value = '';
  var turnoEl = document.getElementById('mag-turno'); if (turnoEl) { turnoEl.value = ''; turnoEl.disabled = false; }
  if (idAluno) {
    if (sel) sel.value = idAluno;
    magSelecionarAluno();
  }
  openModal('modal-agendar');
}

function magSelecionarAluno() {
  var sel = document.getElementById('mag-aluno-sel');
  if (!sel || !sel.value) { _magAlunoId = null; return; }
  _magAlunoId = sel.value;
  var store = getStore();
  var a = store.alunos.find(function(x){ return x.id === _magAlunoId; });
  var infoEl = document.getElementById('mag-aluno-info');
  if (a && infoEl) {
    infoEl.style.display = '';
    var nEl = document.getElementById('mag-aluno-nome'); if (nEl) nEl.textContent = a.nome;
    var dEl = document.getElementById('mag-aluno-detalhe'); if (dEl) dEl.textContent = a.matricula+' · '+alunoCursoNome(a, getStore())+' · '+turnoLabel(a.turnoCurso)+(a.telefone?' · 📞 '+a.telefone:'');
    var turnoEl = document.getElementById('mag-turno');
    if (turnoEl && a.turnoCurso) { var t=Validators.normalizeTurno(a.turnoCurso); if(t) turnoEl.value=t; }
  }
  magAtualizarTipo();
}

function magAtualizarTipo() {
  var tipoEl = document.getElementById('mag-tipo');
  var infoEl = document.getElementById('mag-tipo-info');
  if (!tipoEl || !infoEl) return;
  var tipo = tipoEl.value;
  var store = getStore();
  var a = _magAlunoId ? store.alunos.find(function(x){ return x.id===_magAlunoId; }) : null;
  var tc = a ? Validators.normalizeTurno(a.turnoCurso) : '';
  var turnoEl = document.getElementById('mag-turno');
  var horaEl = document.getElementById('mag-hora');

  if (turnoEl) {
    turnoEl.disabled = tipo === 'remoto';
    Array.from(turnoEl.options).forEach(function(opt) {
      if (!opt.value) return;
      opt.disabled = false;
      opt.style.color = '';
      if (tipo === 'dentro' && tc && opt.value !== tc) {
        opt.disabled = true;
        opt.style.color = 'var(--gray-400)';
      }
      if (tipo === 'fora' && tc && opt.value === tc) {
        opt.disabled = true;
        opt.style.color = 'var(--gray-400)';
      }
    });
    if (tipo === 'remoto') turnoEl.value = '';
    else if (tipo === 'dentro' && tc) turnoEl.value = tc;
    else if (tipo === 'fora' && tc && turnoEl.value === tc) turnoEl.value = '';
  }

  if (horaEl) {
    var turnoRef = tipo === 'dentro' ? tc : (turnoEl ? turnoEl.value : '');
    var faixa = turnoRef ? turnoHoraConfig(turnoRef) : null;
    // Não aplica min/max dinâmico para não apagar horário enquanto digita.
    horaEl.removeAttribute('min');
    horaEl.removeAttribute('max');
  }
  if (!tipo) { infoEl.style.display='none'; return; }
  if (tipo==='remoto') {
    infoEl.style.display=''; infoEl.style.background='#eff6ff'; infoEl.style.border='1px solid #93c5fd'; infoEl.style.color='#1d4ed8';
    var tel = a && a.telefone ? ' Contato: <strong>'+escape(a.telefone)+'</strong>' : '';
    infoEl.innerHTML = '📱 <strong>Atendimento Remoto</strong> — Contato direto com o aluno necessário.'+tel;
  } else if (tipo==='fora') {
    infoEl.style.display=''; infoEl.style.background='#fefce8'; infoEl.style.border='1px solid #fde047'; infoEl.style.color='#854d0e';
    infoEl.innerHTML = '⚠️ <strong>Fora do horário do curso</strong>'+(tc?' — Turno do aluno: '+turnoLabel(tc):'')+'.'
  } else {
    infoEl.style.display=''; infoEl.style.background='#f0fdf4'; infoEl.style.border='1px solid #86efac'; infoEl.style.color='#166534';
    infoEl.innerHTML = '✅ <strong>Dentro do horário do curso</strong>'+(tc?' — Turno: '+turnoLabel(tc):'')+'.'
    var turnoEl = document.getElementById('mag-turno'); if (tc && turnoEl) turnoEl.value = tc;
  }
}

function confirmarNovoAgendamento() {
  if (!_magAlunoId) { toast('Selecione um aluno.', 'warning'); return; }
  var dataEl=document.getElementById('mag-data'), turnoEl=document.getElementById('mag-turno');
  var horaEl=document.getElementById('mag-hora'), motivoEl=document.getElementById('mag-motivo');
  var tipoEl=document.getElementById('mag-tipo');
  var data=dataEl?dataEl.value.trim():'', turno=turnoEl?turnoEl.value.trim():'';
  var hora=horaEl?horaEl.value.trim():'', motivo=motivoEl?motivoEl.value.trim():'';
  var tipo=tipoEl?tipoEl.value.trim():'';
  if (!data)   { toast('Informe a data da sessão.','warning'); return; }
  if (!tipo)   { toast('Selecione o tipo de atendimento.','warning'); return; }
  if (tipo!=='remoto' && !turno) { toast('Selecione o turno.','warning'); return; }
  if (!hora)   { toast('Informe o horário da sessão.','warning'); return; }
  if (!motivo) { toast('Informe o motivo ou observação.','warning'); return; }
  var store = getStore();
  var alunoAg = store.alunos.find(function(x){ return x.id===_magAlunoId; });
  var turnoCursoAg = alunoAg ? Validators.normalizeTurno(alunoAg.turnoCurso) : '';
  var turnoAg = Validators.normalizeTurno(turno);
  if (tipo === 'dentro' && turnoCursoAg && turnoAg !== turnoCursoAg) { toast('Para atendimento dentro do horario, use o turno do curso do aluno.', 'warning'); return; }
  if (tipo === 'fora' && turnoCursoAg && turnoAg === turnoCursoAg) { toast('Para atendimento fora do horario, escolha um turno diferente do curso do aluno.', 'warning'); return; }
  var nova = {
    id: genId('c'), idAluno: _magAlunoId, motivoSolicitação: motivo, obsResponsavel: '',
    dataPreferencial: data, horarioPreferencial: hora,
    turno: tipo==='remoto'?'remoto':turno, tipoAtendimento: tipo,
    agendadoPor: _sess.id, unidadeId: _sess.unidadeId,
    status: 'confirmada', obsPsicologa: '', criacao: new Date().toISOString()
  };
  store.atendimentos.push(nova);
  saveStore(store).then(function(){
    var a = getStore().alunos.find(function(x){ return x.id===_magAlunoId; });
    toast('Sessão de '+(a?a.nome.split(' ')[0]:'aluno')+' agendada para '+data.split('-').reverse().join('/')+' às '+hora+'!','success');
    closeModal('modal-agendar');
    if (typeof renderAtendimentos==='function') renderAtendimentos();
    if (typeof renderHome==='function') renderHome();
  }).catch(function(err){
    toast(err && err.message ? err.message : 'Não foi possível salvar o agendamento no banco.', 'error');
  });
}


/* ── Gráficos Dashboard ── */
function renderGraficos(alunos) {
  if (!alunos) {
    var store = getStore();
    alunos = Permissions.getAlunosVisiveis(_sess, store.alunos);
  }
  var cores = ['#2d7ff9','#f97316','#10b981','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899','#84cc16','#6366f1'];
  /* Pizza - distribuição por curso */
  var cursosMap = {};
  alunos.forEach(function(a){ var c=alunoCursoNome(a, getStore()); cursosMap[c]=(cursosMap[c]||0)+1; });
  var cursos = Object.keys(cursosMap).sort();
  var total = alunos.length;
  var canvas = document.getElementById('chart-pizza');
  if (canvas && canvas.getContext) {
    var ctx=canvas.getContext('2d'), W=canvas.width, H=canvas.height, cx=W/2, cy=H/2, r=Math.min(cx,cy)-18;
    var rootStyle = getComputedStyle(document.documentElement);
    function resolveChartColor(name, fallback) { return (rootStyle.getPropertyValue(name) || fallback).trim() || fallback; }
    var surfaceColor = resolveChartColor('--white', '#ffffff');
    var inkColor = resolveChartColor('--ink', '#0f172a');
    var mutedColor = resolveChartColor('--gray-500', '#6b7280');
    ctx.clearRect(0,0,W,H);
    if (!total) { ctx.fillStyle=resolveChartColor ? resolveChartColor('--gray-100', '#e2e8f0') : '#e2e8f0'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); }
    else {
      var ang=-Math.PI/2;
      cursos.forEach(function(nome,i){
        var frac=cursosMap[nome]/total, end=ang+frac*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,ang,end); ctx.closePath();
        ctx.fillStyle=cores[i%cores.length]; ctx.fill();
        ctx.strokeStyle=surfaceColor; ctx.lineWidth=3; ctx.stroke();
        ang=end;
      });
      ctx.save();
      ctx.shadowColor='rgba(15,23,42,.16)';
      ctx.shadowBlur=18;
      ctx.shadowOffsetY=7;
      ctx.beginPath(); ctx.arc(cx,cy,r*0.50,0,Math.PI*2); ctx.fillStyle=surfaceColor; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx,cy,r*0.50,0,Math.PI*2); ctx.strokeStyle='rgba(148,163,184,.16)'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle=inkColor; ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(total, cx, cy-8);
      ctx.font='11px sans-serif'; ctx.fillStyle=mutedColor; ctx.fillText('alunos', cx, cy+14);
    }
  }
  var leg=document.getElementById('chart-pizza-legend');
  if (leg) {
    leg.innerHTML = cursos.map(function(nome,i){
      var n=cursosMap[nome], pct=total?Math.round(n/total*100):0;
      return '<div style="display:flex;align-items:center;gap:8px">'
        +'<div style="width:12px;height:12px;border-radius:3px;background:'+cores[i%cores.length]+';flex-shrink:0"></div>'
        +'<div style="flex:1;font-weight:600;color:var(--ink,#0f172a)">'+escape(nome)+'</div>'
        +'<div style="color:#6b7280">'+n+' aluno'+(n!==1?'s':'')+'</div>'
        +'<div style="font-weight:700;color:'+cores[i%cores.length]+';min-width:38px;text-align:right">'+pct+'%</div>'
        +'</div>';
    }).join('');
  }
  /* Linha - alunos por idade */
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
