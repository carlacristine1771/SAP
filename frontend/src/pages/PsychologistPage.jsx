import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.ts";
import { usePanelQuery, useSessionQuery } from "../api/panelQueries.ts";
import { backendRoleToFrontend } from "../auth/session.ts";
import ChatPanel from "../components/panel/ChatPanel.jsx";
import DashboardCharts from "../components/panel/DashboardCharts.jsx";
import Icon from "../components/panel/Icon.jsx";
import PsychologistShell from "../components/panel/PsychologistShell.jsx";
import PsychologyCalendar from "../components/psychologist/PsychologyCalendar.tsx";
import AccessibleModal from "../components/ui/AccessibleModal.tsx";
import {
  ErrorMessage,
  FatalScreen,
  LoadingScreen,
  ToastRegion,
} from "../components/ui/Feedback.tsx";

const STATUS = {
  PENDENTE: ["Aguardando", "badge-wait", "aguardando"],
  EM_ANDAMENTO: ["Confirmada", "badge-ok", "confirmada"],
  FINALIZADO: ["Realizada", "badge-done", "realizada"],
  CANCELADO: ["Cancelada", "badge-cancel", "cancelada"],
};
const CATEGORY = {
  atendimento_online: "Atendimento Online",
  atendimento_presencial: "Atendimento Presencial",
  atendimento_familia: "Atendimento Família",
  acompanhamento_do_aluno: "Acompanhamento do Aluno",
  dinamica_de_grupo: "Dinâmica de Grupo",
  saida_campo_oficinas_palestras: "Saída de Campo, Oficinas e Palestras",
  outros_atendimentos: "Outros Atendimentos",
};
const EVENT_TYPES = {
  REUNIAO: "Reunião",
  LEMBRETE: "Lembrete",
  BLOQUEIO: "Bloqueio de horário",
  OBSERVACAO: "Observação",
  OUTRO: "Outro",
};
const EMPTY = {
  students: [],
  appointments: [],
  users: [],
  messages: [],
  events: [],
};
async function fetchPsychologistData() {
  const [students, appointments, users, messages, events] = await Promise.all([
    api.get("/alunos"),
    api.get("/atendimentos"),
    api.get("/usuarios"),
    api.get("/chat/mensagens"),
    api.get("/agenda-eventos"),
  ]);
  return {
    students: students || [],
    appointments: appointments || [],
    users: users || [],
    messages: messages || [],
    events: events || [],
  };
}
const COLORS = [
  "#1B4E9B",
  "#F7A300",
  "#2f7a5e",
  "#4a7fa5",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

function dateTimeLocal(value) {
  return value ? String(value).slice(0, 16) : "";
}
function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function age(value) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`),
    today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    years--;
  return years;
}
function nextAppointment(baseDate) {
  const date = baseDate ? new Date(baseDate) : new Date(Date.now() + 86400000);
  date.setHours(8, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T08:00`;
}
function appointmentPayload(form, session) {
  return {
    titulo: form.titulo || "Atendimento SAP",
    descricao: form.descricao.trim(),
    dataAtendimento: `${form.dataAtendimento}:00`,
    observacoes: form.observacoes?.trim() || "",
    relatorioConsulta: form.relatorioConsulta?.trim() || "",
    tipoAtendimento: form.tipoAtendimento || "dentro",
    categoriaAtendimento: form.categoriaAtendimento || "",
    alunoId: Number(form.alunoId),
    psicologoId: Number(session.id),
    solicitanteId: form.solicitanteId
      ? Number(form.solicitanteId)
      : Number(session.id),
  };
}

function Stat({ accent, bg, icon, value, label }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className={`stat-icon-wrap ${bg}`}>
        <Icon name={icon} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
function AppointmentItems({ items, onOpen, empty = "Nenhuma solicitação." }) {
  return (
    <div>
      {items.map((item) => (
        <button
          type="button"
          className="atendimento-item psychologist-item-button"
          onClick={() => onOpen(item)}
          key={item.id}
        >
          <div
            className={`ci-status-bar bar-${STATUS[item.status]?.[2] || "aguardando"}`}
          />
          <div className="ci-body">
            <div className="ci-header">
              <div className="ci-motivo">
                {item.aluno} — {item.descricao}
              </div>
              <span className={`badge ${STATUS[item.status]?.[1]}`}>
                {STATUS[item.status]?.[0] || item.status}
              </span>
            </div>
            <div className="ci-meta">
              <span>{fmtDate(item.dataAtendimento)}</span>
              <span>{item.tipoAtendimento || "Atendimento"}</span>
            </div>
          </div>
        </button>
      ))}
      {!items.length && <div className="dash-empty">{empty}</div>}
    </div>
  );
}

function Dashboard({ session, data, onOpen }) {
  const [view, setView] = useState("geral");
  const now = new Date();
  const items =
    view === "mensal"
      ? data.appointments.filter((item) => {
          const d = new Date(item.dataAtendimento);
          return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );
        })
      : data.appointments;
  const count = (status) =>
    items.filter((item) => item.status === status).length;
  return (
    <div className="panel-section active fade-up">
      <div className="welcome-banner">
        <div className="wb-content">
          <div className="wb-tag">
            <Icon name="shield" />
            Psicólogo(a)
          </div>
          <h2 className="wb-title">
            Olá, {(session.nome || "Psicólogo(a)").split(" ")[0]}!
          </h2>
          <p className="wb-sub">
            {session.unidade || "SENAC DF"} · gerencie atendimentos e
            comunicações.
          </p>
        </div>
        <div className="wb-actions">
          <button
            className="btn btn-outline"
            style={{ borderColor: "rgba(255,255,255,.4)", color: "#fff" }}
            onClick={() => setView("geral")}
          >
            Geral
          </button>
          <button className="btn btn-orange" onClick={() => setView("mensal")}>
            Este Mês
          </button>
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--gray-400)",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {view === "mensal"
          ? now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          : "Todos os períodos"}
      </div>
      <div className="stats-grid">
        <Stat
          accent="accent-wait"
          bg="bg-wait"
          icon="clock"
          value={count("PENDENTE")}
          label="Aguardando"
        />
        <Stat
          accent="accent-ok"
          bg="bg-ok"
          icon="check"
          value={count("EM_ANDAMENTO")}
          label="Confirmadas"
        />
        <Stat
          accent="accent-done"
          bg="bg-done"
          icon="check"
          value={count("FINALIZADO")}
          label="Realizadas"
        />
        <Stat
          accent="accent-navy"
          bg="bg-navy"
          icon="user"
          value={data.students.filter((item) => item.ativo !== false).length}
          label="Alunos Ativos"
        />
      </div>
      <div className="data-table-wrap" style={{ marginTop: 20 }}>
        <div className="data-table-head">
          <div className="data-table-title">Solicitações Recentes</div>
        </div>
        <AppointmentItems
          items={[...items]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 8)}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function Breakdown({ title, entries }) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0),
    max = Math.max(...entries.map(([, value]) => value), 1);
  return (
    <div className="data-table-wrap">
      <div className="data-table-head">
        <div className="data-table-title">{title}</div>
      </div>
      <div className="psych-breakdown">
        {entries.map(([label, value], index) => (
          <div className="psych-breakdown-row" key={label}>
            <span
              className="psych-dot"
              style={{ background: COLORS[index % COLORS.length] }}
            />
            <strong>{label}</strong>
            <div className="psych-track">
              <i
                style={{
                  width: `${(value / max) * 100}%`,
                  background: COLORS[index % COLORS.length],
                }}
              />
            </div>
            <b>{value}</b>
            <small>{total ? Math.round((value / total) * 100) : 0}%</small>
          </div>
        ))}
        {!entries.length && (
          <div className="dash-empty">Sem dados neste período.</div>
        )}
      </div>
    </div>
  );
}
function group(items, getLabel) {
  const result = {};
  items.forEach((item) => {
    const label = getLabel(item) || "Não informado";
    result[label] = (result[label] || 0) + 1;
  });
  return Object.entries(result).sort((a, b) => b[1] - a[1]);
}

function Indicators({ data, initialYear, onInitialYearConsumed }) {
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          data.appointments
            .map((item) => new Date(item.dataAtendimento).getFullYear())
            .filter(Boolean),
        ),
      ).sort((a, b) => b - a),
    [data.appointments],
  );
  const [year, setYear] = useState(new Date().getFullYear()),
    [month, setMonth] = useState("");
  useEffect(() => {
    if (initialYear) {
      setYear(initialYear);
      onInitialYearConsumed();
    }
  }, [initialYear, onInitialYearConsumed]);
  const annual = data.appointments.filter(
    (item) => new Date(item.dataAtendimento).getFullYear() === Number(year),
  );
  const filtered = annual.filter(
    (item) =>
      month === "" ||
      new Date(item.dataAtendimento).getMonth() === Number(month),
  );
  const annualStudentIds = new Set(annual.map((item) => Number(item.alunoId)));
  const annualStudents = data.students.filter((item) =>
    annualStudentIds.has(Number(item.id)),
  );
  return (
    <div className="panel-section active fade-up">
      <div className="indicativos-hero">
        <div>
          <div className="indicativos-kicker">Painel analítico</div>
          <h2>Indicativos da Psicologia</h2>
          <p>
            Visualize os dados por ano e mês, sem misturar períodos antigos com
            o ano atual.
          </p>
        </div>
        <div className="indicativos-total">
          <span>{annualStudents.length}</span>
          <small>alunos atendidos no ano</small>
        </div>
      </div>
      <div className="periodo-filtros-card">
        <div className="periodo-filtros-texto">
          <strong>Período dos indicativos</strong>
          <span>
            {year} ·{" "}
            {month === ""
              ? "Todos os meses"
              : new Date(2020, Number(month)).toLocaleDateString("pt-BR", {
                  month: "long",
                })}
          </span>
        </div>
        <div className="periodo-filtros-campos">
          <label>
            Ano
            <select
              className="filter-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from(new Set([new Date().getFullYear(), ...years])).map(
                (item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Mês
            <select
              className="filter-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option value={index} key={index}>
                  {new Date(2020, index).toLocaleDateString("pt-BR", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="indicativos-info-card">
        <strong>Como os filtros funcionam</strong>
        <span>
          O ano atualiza o perfil dos alunos; o mês refina a movimentação e os
          tipos de atendimento.
        </span>
      </div>
      <div className="indicativos-movimento-grid">
        <div className="movimento-card">
          <span>Total no período</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="movimento-card">
          <span>Realizados</span>
          <strong>
            {filtered.filter((item) => item.status === "FINALIZADO").length}
          </strong>
        </div>
        <div className="movimento-card">
          <span>Em aberto</span>
          <strong>
            {
              filtered.filter((item) =>
                ["PENDENTE", "EM_ANDAMENTO"].includes(item.status),
              ).length
            }
          </strong>
        </div>
        <div className="movimento-card">
          <span>Cancelados</span>
          <strong>
            {filtered.filter((item) => item.status === "CANCELADO").length}
          </strong>
        </div>
      </div>
      <DashboardCharts students={annualStudents} />
      <div className="indicativos-grid">
        <Breakdown
          title="Turno do Curso"
          entries={group(
            annualStudents,
            (item) =>
              ({ MATUTINO: "Manhã", VESPERTINO: "Tarde", NOTURNO: "Noite" })[
                item.turno
              ],
          )}
        />
        <Breakdown
          title="Tipos de Atendimento"
          entries={group(
            filtered,
            (item) =>
              CATEGORY[item.categoriaAtendimento] || item.tipoAtendimento,
          )}
        />
        <Breakdown
          title="Tipo de Curso"
          entries={group(annualStudents, (item) => item.curso?.split(" ")[0])}
        />
        <Breakdown
          title="Alunos PCD"
          entries={group(annualStudents, (item) =>
            /PCD:\s*Sim/i.test(item.observacoes || "") ? "Sim" : "Não",
          )}
        />
      </div>
    </div>
  );
}

function printAnnualReport(year, appointments) {
  const items = appointments.filter(
    (item) => new Date(item.dataAtendimento).getFullYear() === Number(year),
  );
  const count = (status) =>
    items.filter((item) => item.status === status).length;
  const months = Array.from({ length: 12 }, (_, month) => ({
    label: new Date(2020, month).toLocaleDateString("pt-BR", { month: "long" }),
    items: items.filter(
      (item) => new Date(item.dataAtendimento).getMonth() === month,
    ),
  }));
  const report = window.open("", "_blank", "width=980,height=760");
  if (!report) return;
  report.opener = null;
  report.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório SAP ${year}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#172033;margin:0}header{border-bottom:5px solid #f7a300;padding-bottom:18px;margin-bottom:28px}h1{font-size:27px;color:#154273;margin:4px 0}header p{color:#64748b;margin:0}.brand{font-weight:900;letter-spacing:.12em;color:#f28c00}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0 28px}.card{border:1px solid #dbe3ec;border-radius:10px;padding:13px}.card strong{display:block;font-size:22px;color:#154273}.card span{font-size:11px;color:#64748b}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#154273;color:#fff;text-align:left;padding:9px}td{border-bottom:1px solid #e5e7eb;padding:9px;text-transform:capitalize}footer{margin-top:30px;font-size:10px;color:#94a3b8}@media print{button{display:none}}</style></head><body><header><div class="brand">SENAC · SAP</div><h1>Relatório anual de Psicologia — ${year}</h1><p>Resumo institucional de atendimentos registrado no sistema.</p></header><section class="cards"><div class="card"><strong>${items.length}</strong><span>Total de atendimentos</span></div><div class="card"><strong>${count("FINALIZADO")}</strong><span>Realizados</span></div><div class="card"><strong>${count("PENDENTE") + count("EM_ANDAMENTO")}</strong><span>Em aberto</span></div><div class="card"><strong>${count("CANCELADO")}</strong><span>Cancelados</span></div></section><table><thead><tr><th>Mês</th><th>Total</th><th>Realizados</th><th>Em aberto</th><th>Cancelados</th></tr></thead><tbody>${months.map(({ label, items: monthItems }) => `<tr><td>${label}</td><td>${monthItems.length}</td><td>${monthItems.filter((item) => item.status === "FINALIZADO").length}</td><td>${monthItems.filter((item) => ["PENDENTE", "EM_ANDAMENTO"].includes(item.status)).length}</td><td>${monthItems.filter((item) => item.status === "CANCELADO").length}</td></tr>`).join("")}</tbody></table><footer>Documento gerado pelo Sistema de Apoio Psicopedagógico em ${new Date().toLocaleString("pt-BR")}.</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`,
  );
  report.document.close();
}

function History({ appointments, onSelectYear }) {
  const groups = Object.entries(
    appointments.reduce((result, item) => {
      const year = String(new Date(item.dataAtendimento).getFullYear());
      result[year] = (result[year] || 0) + 1;
      return result;
    }, {}),
  ).sort((a, b) => Number(b[0]) - Number(a[0]));
  return (
    <div className="panel-section active fade-up">
      <div className="historico-hero">
        <div>
          <div className="indicativos-kicker">Histórico anual</div>
          <h2>Indicadores por Ano</h2>
          <p>
            Escolha um ano para abrir os mesmos gráficos da aba Indicativos.
          </p>
        </div>
      </div>
      <div className="historico-anos-grid">
        {groups.map(([year, total]) => (
          <div
            className="historico-ano-card"
            role="button"
            tabIndex="0"
            key={year}
            onClick={() => onSelectYear(Number(year))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectYear(Number(year));
              }
            }}
          >
            <div className="historico-card-main">
              <span className="historico-ano-kicker">Histórico</span>
              <strong>Ano de {year}</strong>
              <span>
                {total} atendimento{total !== 1 ? "s" : ""}
              </span>
              <small>
                {
                  appointments.filter(
                    (item) =>
                      new Date(item.dataAtendimento).getFullYear() ===
                        Number(year) && item.status === "FINALIZADO",
                  ).length
                }{" "}
                realizados ·{" "}
                {
                  appointments.filter(
                    (item) =>
                      new Date(item.dataAtendimento).getFullYear() ===
                        Number(year) &&
                      ["PENDENTE", "EM_ANDAMENTO"].includes(item.status),
                  ).length
                }{" "}
                em aberto
              </small>
            </div>
            <button
              type="button"
              className="btn-relatorio-ano"
              onClick={(event) => {
                event.stopPropagation();
                printAnnualReport(year, appointments);
              }}
              title="Abrir relatório anual para salvar em PDF"
            >
              <Icon name="download" />
              Gerar relatório PDF
            </button>
          </div>
        ))}
        {!groups.length && (
          <div className="historico-empty">
            Nenhum histórico anual disponível.
          </div>
        )}
      </div>
    </div>
  );
}

function Appointments({ items, onOpen, onNew }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const visible = items
    .filter((item) => !status || item.status === status)
    .filter((item) =>
      [item.aluno, item.descricao, item.solicitante, item.psicologo]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap mobile-record-list">
        <div className="data-table-head">
          <div className="data-table-title">Gerenciar Atendimentos</div>
          <div className="data-table-filters">
            <button className="btn btn-orange btn-sm" onClick={onNew}>
              <Icon name="plus" />
              Novo Atendimento
            </button>
            <div className="search-box">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar aluno..."
              />
            </div>
            <select
              className="filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([key, [label]]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <table className="mobile-record-table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Motivo</th>
              <th>Tipo / Data</th>
              <th>Solicitado por</th>
              <th>Profissional responsável</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td data-label="Aluno">
                  <strong>{item.aluno}</strong>
                </td>
                <td data-label="Motivo">{item.descricao}</td>
                <td data-label="Tipo / Data">
                  {item.tipoAtendimento || "—"}
                  <div className="td-sub">{fmtDate(item.dataAtendimento)}</div>
                </td>
                <td data-label="Solicitado por">{item.solicitante || "—"}</td>
                <td data-label="Profissional responsável">
                  {item.psicologo || "Não definido"}
                </td>
                <td data-label="Status">
                  <span className={`badge ${STATUS[item.status]?.[1]}`}>
                    {STATUS[item.status]?.[0]}
                  </span>
                </td>
                <td className="record-actions-cell" data-label="Ações">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onOpen(item)}
                  >
                    <Icon name="edit" />
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr className="record-empty-row">
                <td
                  colSpan="7"
                  className="psych-empty-cell record-empty-cell"
                  data-label=""
                >
                  Nenhum atendimento
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Students({ students, appointments, onHistory, onSchedule }) {
  const [search, setSearch] = useState(""),
    [tab, setTab] = useState("todos");
  const visible = students
    .filter((item) => {
      const years = age(item.dataNascimento);
      return tab === "todos" || (tab === "menores" ? years < 18 : years >= 18);
    })
    .filter((item) =>
      [item.nome, item.cpf, item.curso, item.turma]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap mobile-record-list">
        <div className="data-table-head">
          <div className="data-table-title">Tabela de Alunos</div>
          <div className="search-box">
            <Icon name="search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno..."
            />
          </div>
        </div>
        <div className="alunos-toolbar">
          <div className="tab-group">
            {[
              ["todos", "Todos"],
              ["menores", "Menores de 18"],
              ["maiores", "Maiores de 18"],
            ].map(([key, label]) => (
              <button
                className={`tab-btn${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
                key={key}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <table className="mobile-record-table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Matrícula</th>
              <th>Curso / Turma</th>
              <th>Idade</th>
              <th>Nascimento</th>
              <th>PCD</th>
              <th>Atendimentos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td data-label="Aluno">
                  <strong>{item.nome}</strong>
                  <div className="td-sub">{item.cpf}</div>
                </td>
                <td data-label="Matrícula">
                  <code>{String(item.id).padStart(6, "0")}</code>
                </td>
                <td data-label="Curso / Turma">
                  {item.curso || "—"}
                  <div className="td-sub">{item.turma || "—"}</div>
                </td>
                <td data-label="Idade">{age(item.dataNascimento)} anos</td>
                <td data-label="Nascimento">
                  {new Date(
                    `${item.dataNascimento}T12:00:00`,
                  ).toLocaleDateString("pt-BR")}
                </td>
                <td data-label="PCD">
                  {/PCD:\s*Sim/i.test(item.observacoes || "") ? "Sim" : "Não"}
                </td>
                <td data-label="Atendimentos">
                  {
                    appointments.filter(
                      (entry) => Number(entry.alunoId) === Number(item.id),
                    ).length
                  }
                </td>
                <td className="record-actions-cell" data-label="Ações">
                  <div className="record-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onHistory(item)}
                    >
                      Histórico
                    </button>
                    <button
                      className="btn btn-orange btn-sm"
                      onClick={() => onSchedule(item.id)}
                    >
                      Agendar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr className="record-empty-row">
                <td
                  colSpan="8"
                  className="psych-empty-cell record-empty-cell"
                  data-label=""
                >
                  Nenhum aluno
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PsychologistPage() {
  const [panel, setPanel] = useState("dashboard"),
    [toasts, setToasts] = useState([]),
    [appointment, setAppointment] = useState(null),
    [appointmentForm, setAppointmentForm] = useState({}),
    [appointmentError, setAppointmentError] = useState(""),
    [historyStudent, setHistoryStudent] = useState(null),
    [event, setEvent] = useState(null),
    [eventForm, setEventForm] = useState({}),
    [eventError, setEventError] = useState(""),
    [indicatorYear, setIndicatorYear] = useState(null);
  const toast = useCallback((text, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, type }]);
    setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      3500,
    );
  }, []);
  const sessionQuery = useSessionQuery();
  const session = sessionQuery.data;
  const authorized =
    backendRoleToFrontend(session?.tipoUsuario) === "psicologa";
  const dataQuery = usePanelQuery(
    `psicologia:${session?.id || "pending"}`,
    Boolean(session && authorized),
    fetchPsychologistData,
  );
  const data = dataQuery.data || EMPTY;
  const refreshPanel = dataQuery.refetch;
  const loadData = useCallback(async () => {
    await refreshPanel();
  }, [refreshPanel]);
  useEffect(() => {
    const error = sessionQuery.error;
    if (
      error?.status === 401 ||
      error?.status === 404 ||
      (session && !authorized)
    )
      window.location.replace("/");
  }, [authorized, session, sessionQuery.error]);
  const scoped = useMemo(() => {
    if (!session?.unidadeId) return data;
    const unitId = Number(session.unidadeId),
      students = data.students.filter(
        (item) => Number(item.unidadeId) === unitId,
      ),
      ids = new Set(students.map((item) => Number(item.id)));
    return {
      ...data,
      students,
      appointments: data.appointments.filter((item) =>
        ids.has(Number(item.alunoId)),
      ),
      users: data.users.filter(
        (item) => !item.unidade?.id || Number(item.unidade.id) === unitId,
      ),
      events: data.events.filter(
        (item) => Number(item.psicologoId) === Number(session.id),
      ),
    };
  }, [data, session]);
  const openAppointment = (item = null, studentId = "", initialDate = null) => {
    setAppointment(item || {});
    setAppointmentError("");
    setAppointmentForm(
      item
        ? { ...item, dataAtendimento: dateTimeLocal(item.dataAtendimento) }
        : {
            titulo: "Atendimento SAP",
            descricao: "",
            dataAtendimento: nextAppointment(initialDate),
            observacoes: "",
            relatorioConsulta: "",
            tipoAtendimento: "dentro",
            categoriaAtendimento: "",
            alunoId: studentId,
            solicitanteId: session.id,
          },
    );
  };
  const saveAppointment = async (eventObject) => {
    eventObject.preventDefault();
    setAppointmentError("");
    if (
      !appointmentForm.alunoId ||
      !appointmentForm.descricao?.trim() ||
      !appointmentForm.dataAtendimento
    )
      return setAppointmentError(
        "Preencha aluno, motivo e data do atendimento.",
      );
    if (
      !appointment?.id &&
      new Date(appointmentForm.dataAtendimento) < new Date()
    )
      return setAppointmentError(
        "A data de um novo atendimento não pode estar no passado.",
      );
    try {
      const body = appointmentPayload(appointmentForm, session);
      if (appointment?.id)
        await api.put(`/atendimentos/${appointment.id}`, body);
      else await api.post("/atendimentos", body);
      setAppointment(null);
      toast("Atendimento salvo com sucesso!", "success");
      await loadData();
    } catch (error) {
      setAppointmentError(
        error.message || "Não foi possível salvar o atendimento.",
      );
    }
  };
  const changeStatus = async (status) => {
    try {
      await api.patch(`/atendimentos/${appointment.id}/status`, { status });
      setAppointment(null);
      toast("Status atualizado.", "success");
      await loadData();
    } catch (error) {
      setAppointmentError(
        error.message || "Não foi possível atualizar o status.",
      );
    }
  };
  const openEvent = (item = null, initialDate = null) => {
    setEvent(item || {});
    setEventError("");
    setEventForm(
      item
        ? {
            ...item,
            dataInicio: dateTimeLocal(item.dataInicio),
            dataFim: dateTimeLocal(item.dataFim),
          }
        : {
            titulo: "",
            descricao: "",
            tipo: "LEMBRETE",
            dataInicio: nextAppointment(initialDate),
            dataFim: "",
            diaInteiro: false,
            cor: "#1B4E9B",
          },
    );
  };
  const saveEvent = async (eventObject) => {
    eventObject.preventDefault();
    setEventError("");
    if (!eventForm.titulo.trim() || !eventForm.dataInicio)
      return setEventError("Informe título e início do evento.");
    if (
      eventForm.dataFim &&
      new Date(eventForm.dataFim) < new Date(eventForm.dataInicio)
    )
      return setEventError("O fim do evento não pode ser anterior ao início.");
    try {
      const body = {
        ...eventForm,
        dataInicio: `${eventForm.dataInicio}:00`,
        dataFim: eventForm.dataFim ? `${eventForm.dataFim}:00` : null,
        psicologoId: Number(session.id),
        unidadeId: session.unidadeId ? Number(session.unidadeId) : null,
      };
      if (event?.id) await api.put(`/agenda-eventos/${event.id}`, body);
      else await api.post("/agenda-eventos", body);
      setEvent(null);
      toast("Evento salvo.", "success");
      await loadData();
    } catch (error) {
      setEventError(error.message || "Não foi possível salvar o evento.");
    }
  };
  const deleteEvent = async () => {
    if (!window.confirm("Excluir este evento da agenda?")) return;
    try {
      await api.delete(`/agenda-eventos/${event.id}`);
      setEvent(null);
      toast("Evento excluído.", "success");
      await loadData();
    } catch (error) {
      setEventError(error.message);
    }
  };
  if (
    sessionQuery.isPending ||
    (session && !authorized) ||
    (session && authorized && dataQuery.isPending)
  )
    return <LoadingScreen />;
  const fatal = sessionQuery.error?.message || dataQuery.error?.message;
  if (fatal || !session)
    return (
      <FatalScreen
        message={fatal || "Sessão indisponível."}
        onRetry={() => window.location.reload()}
      />
    );
  const navigate = (next) => {
    setPanel(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <PsychologistShell
      session={session}
      activePanel={panel}
      pending={
        scoped.appointments.filter((item) => item.status === "PENDENTE").length
      }
      onNavigate={navigate}
    >
      {panel === "dashboard" && (
        <Dashboard session={session} data={scoped} onOpen={openAppointment} />
      )}{" "}
      {panel === "indicativos" && (
        <Indicators
          data={scoped}
          initialYear={indicatorYear}
          onInitialYearConsumed={() => setIndicatorYear(null)}
        />
      )}{" "}
      {panel === "historico" && (
        <History
          appointments={scoped.appointments}
          onSelectYear={(year) => {
            setIndicatorYear(year);
            navigate("indicativos");
          }}
        />
      )}{" "}
      {panel === "atendimentos" && (
        <Appointments
          items={scoped.appointments}
          onOpen={openAppointment}
          onNew={() => openAppointment()}
        />
      )}{" "}
      {panel === "alunos" && (
        <Students
          students={scoped.students}
          appointments={scoped.appointments}
          onHistory={setHistoryStudent}
          onSchedule={(id) => openAppointment(null, id)}
        />
      )}{" "}
      {panel === "calendario" && (
        <PsychologyCalendar
          appointments={scoped.appointments}
          events={scoped.events}
          statusMeta={STATUS}
          eventTypes={EVENT_TYPES}
          onAppointment={openAppointment}
          onEvent={openEvent}
          onNewEvent={(date) => openEvent(null, date)}
          onNewAppointment={(date) => openAppointment(null, "", date)}
        />
      )}{" "}
      {panel === "chat" && (
        <div className="panel-section active fade-up">
          <ChatPanel
            session={session}
            users={scoped.users}
            messages={data.messages}
            onRefresh={loadData}
            onToast={toast}
          />
        </div>
      )}
      <AccessibleModal
        open={appointment !== null}
        title={appointment?.id ? "Gerenciar Atendimento" : "Novo Atendimento"}
        onClose={() => setAppointment(null)}
      >
        <form onSubmit={saveAppointment}>
          <ErrorMessage text={appointmentError} />
          <div className="admin-form-grid">
            <div className="admin-form-full">
              <label className="form-label">Aluno *</label>
              <select
                className="form-control"
                value={appointmentForm.alunoId || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    alunoId: e.target.value,
                  })
                }
                disabled={Boolean(appointment?.id)}
              >
                <option value="">Selecione...</option>
                {scoped.students.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-full">
              <label className="form-label">Motivo *</label>
              <textarea
                className="form-control"
                rows="3"
                value={appointmentForm.descricao || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    descricao: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="form-label">Data e horário *</label>
              <input
                type="datetime-local"
                className="form-control"
                value={appointmentForm.dataAtendimento || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    dataAtendimento: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select
                className="form-control"
                value={appointmentForm.tipoAtendimento || "dentro"}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    tipoAtendimento: e.target.value,
                  })
                }
              >
                <option value="dentro">Dentro do horário do curso</option>
                <option value="fora">Fora do horário do curso</option>
                <option value="remoto">Atendimento remoto</option>
              </select>
            </div>
            <div className="admin-form-full">
              <label className="form-label">Categoria da consulta</label>
              <select
                className="form-control"
                value={appointmentForm.categoriaAtendimento || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    categoriaAtendimento: e.target.value,
                  })
                }
              >
                <option value="">Selecione após a consulta...</option>
                {Object.entries(CATEGORY).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-full">
              <label className="form-label">Observações da psicologia</label>
              <textarea
                className="form-control"
                rows="3"
                value={appointmentForm.observacoes || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    observacoes: e.target.value,
                  })
                }
              />
            </div>
            <div className="admin-form-full">
              <label className="form-label">Relatório da consulta</label>
              <textarea
                className="form-control"
                rows="5"
                value={appointmentForm.relatorioConsulta || ""}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    relatorioConsulta: e.target.value,
                  })
                }
                placeholder="Informações importantes, orientações e encaminhamentos..."
              />
            </div>
          </div>
          {appointment?.id && (
            <div className="status-btn-group">
              <button
                type="button"
                className="btn btn-confirm"
                onClick={() => changeStatus("EM_ANDAMENTO")}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => changeStatus("FINALIZADO")}
              >
                Realizado
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => changeStatus("CANCELADO")}
              >
                Cancelar
              </button>
            </div>
          )}
          <div className="modal-action-row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setAppointment(null)}
            >
              Fechar
            </button>
            <button type="submit" className="btn btn-orange">
              <Icon name="save" />
              Salvar alterações
            </button>
          </div>
        </form>
      </AccessibleModal>
      <AccessibleModal
        open={Boolean(historyStudent)}
        title={`Histórico — ${historyStudent?.nome || ""}`}
        onClose={() => setHistoryStudent(null)}
      >
        <AppointmentItems
          items={scoped.appointments.filter(
            (item) => Number(item.alunoId) === Number(historyStudent?.id),
          )}
          onOpen={(item) => {
            setHistoryStudent(null);
            openAppointment(item);
          }}
          empty="Nenhum atendimento para este aluno."
        />
        <div className="detail-section" style={{ marginTop: 16 }}>
          <div className="detail-label">Observações do cadastro</div>
          <div className="detail-value psych-report-text">
            {historyStudent?.observacoes || "Sem observações."}
          </div>
        </div>
      </AccessibleModal>
      <AccessibleModal
        open={event !== null}
        title={event?.id ? "Editar Evento" : "Novo Evento"}
        onClose={() => setEvent(null)}
        maxWidth={560}
      >
        <form onSubmit={saveEvent}>
          <ErrorMessage text={eventError} />
          <div className="admin-form-grid">
            <div className="admin-form-full">
              <label className="form-label">Título *</label>
              <input
                className="form-control"
                value={eventForm.titulo || ""}
                onChange={(e) =>
                  setEventForm({ ...eventForm, titulo: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select
                className="form-control"
                value={eventForm.tipo || "LEMBRETE"}
                onChange={(e) =>
                  setEventForm({ ...eventForm, tipo: e.target.value })
                }
              >
                {Object.entries(EVENT_TYPES).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Cor</label>
              <input
                type="color"
                className="form-control"
                value={eventForm.cor || "#1B4E9B"}
                onChange={(e) =>
                  setEventForm({ ...eventForm, cor: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Início *</label>
              <input
                type="datetime-local"
                className="form-control"
                value={eventForm.dataInicio || ""}
                onChange={(e) =>
                  setEventForm({ ...eventForm, dataInicio: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Fim</label>
              <input
                type="datetime-local"
                className="form-control"
                value={eventForm.dataFim || ""}
                onChange={(e) =>
                  setEventForm({ ...eventForm, dataFim: e.target.value })
                }
              />
            </div>
            <label className="admin-form-full psych-all-day">
              <input
                type="checkbox"
                checked={Boolean(eventForm.diaInteiro)}
                onChange={(e) =>
                  setEventForm({ ...eventForm, diaInteiro: e.target.checked })
                }
              />
              <span>Evento de dia inteiro</span>
            </label>
            <div className="admin-form-full">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-control"
                rows="3"
                value={eventForm.descricao || ""}
                onChange={(e) =>
                  setEventForm({ ...eventForm, descricao: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-action-row">
            {event?.id && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={deleteEvent}
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setEvent(null)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-orange">
              Salvar evento
            </button>
          </div>
        </form>
      </AccessibleModal>
      <ToastRegion toasts={toasts} />
    </PsychologistShell>
  );
}
