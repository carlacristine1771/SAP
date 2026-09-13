import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.ts";
import {
  usePanelMutation,
  usePaginatedPanelQuery,
  usePanelQuery,
  useSessionQuery,
} from "../api/panelQueries.ts";
import { backendRoleToFrontend } from "../auth/session.ts";
import { usePanelRoute } from "../hooks/usePanelRoute.ts";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.ts";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import {
  appointmentSchema,
  studentSchema,
  validationMessage,
} from "../validation/schemas.ts";
import ChatPanel from "../components/panel/ChatPanel.jsx";
import Icon from "../components/panel/Icon.jsx";
import OperationalShell from "../components/panel/OperationalShell.jsx";
import AccessibleModal from "../components/ui/AccessibleModal.tsx";
import Pagination from "../components/ui/Pagination.tsx";
import {
  ErrorMessage,
  FatalScreen,
  LoadingScreen,
  ToastRegion,
} from "../components/ui/Feedback.tsx";

const STATUS = {
  PENDENTE: ["Aguardando", "badge-wait"],
  EM_ANDAMENTO: ["Confirmada", "badge-ok"],
  FINALIZADO: ["Realizada", "badge-done"],
  CANCELADO: ["Cancelada", "badge-cancel"],
};
const TURN = { MATUTINO: "Manhã", VESPERTINO: "Tarde", NOTURNO: "Noite" };
const EMPTY = {
  students: [],
  appointments: [],
  courses: [],
  classes: [],
  users: [],
  messages: [],
};
const COORDINATION_PANELS = [
  "home",
  "alunos",
  "encaminhar",
  "cursos",
  "instrutores",
  "atendimentos",
  "chat",
];
const INSTRUCTOR_PANELS = [
  "home",
  "alunos",
  "encaminhar",
  "atendimentos",
  "chat",
];
async function fetchOperationalData() {
  const [students, appointments, courses, classes, users, messages] =
    await Promise.all([
      api.get("/alunos"),
      api.get("/atendimentos"),
      api.get("/cursos"),
      api.get("/turmas"),
      api.get("/usuarios"),
      api.get("/chat/mensagens"),
    ]);
  return {
    students: students || [],
    appointments: appointments || [],
    courses: courses || [],
    classes: classes || [],
    users: users || [],
    messages: messages || [],
  };
}
const blankStudent = {
  nome: "",
  matricula: "",
  cpf: "",
  dataNascimento: "",
  telefone: "",
  email: "",
  cursoId: "",
  turmaId: "",
  turno: "",
  pcd: "nao",
};

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function futureDefault() {
  const date = new Date(Date.now() + 86400000);
  date.setHours(8, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function Home({ profile, session, data, onNavigate, onNewStudent }) {
  const statusCount = (status) =>
    data.appointments.filter((item) => item.status === status).length;
  const courseCounts = data.students.reduce((result, student) => {
    const name = student.curso || "Sem curso";
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
  const classCounts = data.students.reduce((result, student) => {
    const name = student.turma || "Sem turma";
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
  const maxClass = Math.max(...Object.values(classCounts), 1);
  return (
    <div className="panel-section active fade-up">
      <div className="welcome-banner">
        <div className="wb-content">
          <div className="wb-tag">
            <Icon name="user" />
            Bem-vindo(a)
          </div>
          <h2 className="wb-title">
            Olá,{" "}
            {
              (
                session.nome ||
                (profile === "coordenacao" ? "Coordenação" : "Instrutor")
              ).split(" ")[0]
            }
            !
          </h2>
          <p className="wb-sub">{session.unidade || "SENAC DF"}</p>
        </div>
        <div className="wb-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onNewStudent}
          >
            <Icon name="addUser" />
            Novo Aluno
          </button>
          <button
            type="button"
            className="btn btn-orange"
            onClick={() => onNavigate("encaminhar")}
          >
            <Icon name="arrow" />
            Nova Solicitação
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card accent-orange">
          <div className="stat-icon-wrap bg-orange">
            <Icon name="user" />
          </div>
          <div className="stat-value">{data.students.length}</div>
          <div className="stat-label">Alunos cadastrados</div>
        </div>
        <div className="stat-card accent-wait">
          <div className="stat-icon-wrap bg-wait">
            <Icon name="clock" />
          </div>
          <div className="stat-value">{statusCount("PENDENTE")}</div>
          <div className="stat-label">Aguardando</div>
        </div>
        <div className="stat-card accent-ok">
          <div className="stat-icon-wrap bg-ok">
            <Icon name="check" />
          </div>
          <div className="stat-value">{statusCount("EM_ANDAMENTO")}</div>
          <div className="stat-label">Confirmadas</div>
        </div>
        <div className="stat-card accent-done">
          <div className="stat-icon-wrap bg-done">
            <Icon name="check" />
          </div>
          <div className="stat-value">{statusCount("FINALIZADO")}</div>
          <div className="stat-label">Realizadas</div>
        </div>
      </div>
      <div className="dash-alunos-grid">
        <div className="data-table-wrap">
          <div className="data-table-head">
            <div className="data-table-title">Distribuição por Curso</div>
          </div>
          <div className="dash-list">
            {Object.entries(courseCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <div className="dash-row" key={name}>
                  <div className="dash-row-main">
                    <div className="dash-row-title">{name}</div>
                    <div className="dash-row-sub">Alunos matriculados</div>
                  </div>
                  <div className="dash-row-value">{count}</div>
                  <div className="dash-row-track">
                    <div
                      className="dash-row-fill"
                      style={{
                        "--pct": `${data.students.length ? (count / data.students.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            {!data.students.length && (
              <div className="dash-empty">Nenhum aluno cadastrado.</div>
            )}
          </div>
        </div>
        <div className="data-table-wrap">
          <div className="data-table-head">
            <div className="data-table-title">Resumo dos Alunos</div>
          </div>
          <div className="dash-resumo-grid">
            <div className="dash-mini orange">
              <div className="dash-mini-value">{data.students.length}</div>
              <div className="dash-mini-label">Total de alunos</div>
            </div>
            <div className="dash-mini navy">
              <div className="dash-mini-value">
                {Object.keys(courseCounts).length}
              </div>
              <div className="dash-mini-label">Cursos ativos</div>
            </div>
            <div className="dash-mini green">
              <div className="dash-mini-value">
                {Object.keys(classCounts).length}
              </div>
              <div className="dash-mini-label">Turmas</div>
            </div>
            <div className="dash-mini blue">
              <div className="dash-mini-value">{data.appointments.length}</div>
              <div className="dash-mini-label">Solicitações</div>
            </div>
          </div>
        </div>
        <div className="data-table-wrap">
          <div className="data-table-head">
            <div className="data-table-title">Turmas com Mais Alunos</div>
          </div>
          <div className="dash-list">
            {Object.entries(classCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, count]) => (
                <div className="dash-row" key={name}>
                  <div className="dash-row-main">
                    <div className="dash-row-title">{name}</div>
                  </div>
                  <div className="dash-row-value">{count}</div>
                  <div className="dash-row-track">
                    <div
                      className="dash-row-fill"
                      style={{ "--pct": `${(count / maxClass) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="data-table-wrap">
          <div className="data-table-head">
            <div className="data-table-title">Cadastros Recentes</div>
          </div>
          <div className="dash-list">
            {[...data.students]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 5)
              .map((student) => (
                <div className="dash-row" key={student.id}>
                  <div className="dash-row-main">
                    <div className="dash-row-title">{student.nome}</div>
                    <div className="dash-row-sub">
                      {student.curso || "Sem curso"} ·{" "}
                      {student.turma || "Sem turma"}
                    </div>
                  </div>
                </div>
              ))}
            {!data.students.length && (
              <div className="dash-empty">Nenhum cadastro recente.</div>
            )}
          </div>
        </div>
      </div>
      <div className="data-table-wrap" style={{ marginTop: 20 }}>
        <div className="data-table-head">
          <div className="data-table-title">Últimas Solicitações</div>
        </div>
        <div>
          {data.appointments.slice(0, 5).map((item) => (
            <div className="atendimento-item" key={item.id}>
              <div
                className={`ci-status-bar bar-${item.status === "PENDENTE" ? "aguardando" : item.status === "EM_ANDAMENTO" ? "confirmada" : item.status === "FINALIZADO" ? "realizada" : "cancelada"}`}
              />
              <div className="ci-body">
                <div className="ci-header">
                  <div className="ci-motivo">
                    {item.aluno} — {item.descricao}
                  </div>
                  <span className={`badge ${STATUS[item.status]?.[1]}`}>
                    {STATUS[item.status]?.[0]}
                  </span>
                </div>
                <div className="ci-meta">{fmtDate(item.dataAtendimento)}</div>
              </div>
            </div>
          ))}
          {!data.appointments.length && (
            <div className="dash-empty">Nenhuma solicitação enviada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Students({ students, appointments, onNew, onRefer }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  useEffect(() => setPage(0), [search]);
  const pageQuery = usePaginatedPanelQuery("alunos", page, debouncedSearch);
  const localVisible = students.filter((student) =>
    [student.nome, student.cpf, student.curso, student.turma]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const visible = pageQuery.data?.content ?? localVisible;
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap mobile-record-list">
        <div className="data-table-head">
          <div className="data-table-title">Alunos Cadastrados</div>
          <button className="btn btn-orange btn-sm" onClick={onNew}>
            <Icon name="arrow" />
            Cadastrar Aluno
          </button>
        </div>
        <div className="data-table-filters">
          <div className="search-box">
            <Icon name="search" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar aluno..."
            />
          </div>
        </div>
        <table className="mobile-record-table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Matrícula</th>
              <th>Curso / Turma</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Atendimentos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.id}>
                <td data-label="Aluno">
                  <strong>{student.nome}</strong>
                  <div className="td-sub">{student.cpf}</div>
                </td>
                <td data-label="Matrícula">
                  <code>{String(student.id).padStart(6, "0")}</code>
                </td>
                <td data-label="Curso / Turma">
                  {student.curso || "—"}
                  <div className="td-sub">
                    {student.turma || "—"} · {TURN[student.turno]}
                  </div>
                </td>
                <td data-label="Status">
                  <span
                    className={`badge ${student.ativo === false ? "badge-cancel" : "badge-done"}`}
                  >
                    {student.ativo === false ? "Inativo" : "Ativo"}
                  </span>
                </td>
                <td data-label="Responsável">{student.responsavel || "—"}</td>
                <td data-label="Atendimentos">
                  {
                    appointments.filter(
                      (item) => Number(item.alunoId) === Number(student.id),
                    ).length
                  }
                </td>
                <td className="record-actions-cell" data-label="Ações">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onRefer(student.id)}
                  >
                    Encaminhar
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr className="record-empty-row">
                <td
                  className="record-empty-cell"
                  data-label=""
                  colSpan="7"
                  style={{
                    textAlign: "center",
                    padding: 36,
                    color: "var(--gray-400)",
                  }}
                >
                  Nenhum aluno
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={pageQuery.data?.page || 0}
          totalPages={pageQuery.data?.totalPages || 0}
          totalElements={pageQuery.data?.totalElements || visible.length}
          loading={pageQuery.isFetching}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

function Referral({
  students,
  selectedStudentId,
  session,
  onSubmitReferral,
  onToast,
  onDirtyChange,
}) {
  const [form, setForm] = useState({
    alunoId: selectedStudentId || "",
    descricao: "",
    data: futureDefault(),
    tipo: "",
    observacoes: "",
  });
  const [error, setError] = useState("");
  const initialForm = useRef(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (selectedStudentId)
      setForm((current) => ({ ...current, alunoId: selectedStudentId }));
  }, [selectedStudentId]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const validation = appointmentSchema.safeParse({
      alunoId: form.alunoId,
      descricao: form.descricao,
      dataAtendimento: form.data,
    });
    if (!validation.success) return setError(validationMessage(validation));
    if (!form.tipo) return setError("Selecione o tipo de atendimento.");
    try {
      await onSubmitReferral({
        titulo: "Atendimento SAP",
        descricao: form.descricao.trim(),
        dataAtendimento: `${form.data}:00`,
        observacoes: form.observacoes.trim(),
        tipoAtendimento: form.tipo,
        categoriaAtendimento: "",
        alunoId: Number(form.alunoId),
        psicologoId: null,
        solicitanteId: Number(session.id),
      });
      onToast("Solicitação enviada!", "success");
      setForm({
        alunoId: "",
        descricao: "",
        data: futureDefault(),
        tipo: "",
        observacoes: "",
      });
    } catch (requestError) {
      setError(
        requestError.message || "Não foi possível enviar a solicitação.",
      );
    }
  };
  return (
    <div className="panel-section active fade-up">
      <form className="form-card" onSubmit={submit}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--senac-navy)",
            marginBottom: 6,
          }}
        >
          Nova Solicitação
        </h2>
        <p
          style={{ fontSize: 13.5, color: "var(--gray-500)", marginBottom: 24 }}
        >
          Preencha para solicitar atendimento psicológico para o aluno.
        </p>
        <ErrorMessage text={error} />
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <label className="form-label">Aluno *</label>
            <select
              className="form-control"
              value={form.alunoId}
              onChange={(event) =>
                setForm({ ...form, alunoId: event.target.value })
              }
            >
              <option value="">Selecione o aluno...</option>
              {students.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.nome} — {student.curso || "Sem curso"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Motivo da Solicitação *</label>
            <textarea
              className="form-control"
              rows="3"
              value={form.descricao}
              onChange={(event) =>
                setForm({ ...form, descricao: event.target.value })
              }
              placeholder="Descreva o motivo, comportamentos observados e contexto..."
            />
          </div>
          <div className="admin-form-grid">
            <div>
              <label className="form-label">
                Data e Horário Preferenciais *
              </label>
              <input
                type="datetime-local"
                className="form-control"
                value={form.data}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(event) =>
                  setForm({ ...form, data: event.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Tipo de Atendimento *</label>
              <select
                className="form-control"
                value={form.tipo}
                onChange={(event) =>
                  setForm({ ...form, tipo: event.target.value })
                }
              >
                <option value="">Selecione o tipo...</option>
                <option value="dentro">Dentro do horário do curso</option>
                <option value="fora">Fora do horário do curso</option>
                <option value="remoto">Atendimento Remoto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Observações</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.observacoes}
              onChange={(event) =>
                setForm({ ...form, observacoes: event.target.value })
              }
              placeholder="Informações complementares para a psicóloga..."
            />
          </div>
          <button className="btn btn-orange btn-full" type="submit">
            <Icon name="send" />
            Enviar Solicitação
          </button>
        </div>
      </form>
    </div>
  );
}

function Appointments({ appointments }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  useEffect(() => setPage(0), [search, status]);
  const pageQuery = usePaginatedPanelQuery(
    "atendimentos",
    page,
    debouncedSearch,
    status,
  );
  const localVisible = appointments
    .filter((item) => !status || item.status === status)
    .filter((item) =>
      [item.aluno, item.descricao, item.solicitante]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const visible = pageQuery.data?.content ?? localVisible;
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap mobile-record-list">
        <div className="data-table-head">
          <div className="data-table-title">Atendimentos Encaminhados</div>
          <div className="data-table-filters">
            <div className="search-box">
              <Icon name="search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
              />
            </div>
            <select
              className="filter-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
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
              <th>Tipo</th>
              <th>Agendado por</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td data-label="Aluno">
                  <strong>{item.aluno}</strong>
                </td>
                <td data-label="Motivo">{item.descricao}</td>
                <td data-label="Tipo">{item.tipoAtendimento || "—"}</td>
                <td data-label="Agendado por">{item.solicitante || "—"}</td>
                <td data-label="Status">
                  <span className={`badge ${STATUS[item.status]?.[1]}`}>
                    {STATUS[item.status]?.[0] || item.status}
                  </span>
                </td>
                <td data-label="Data">{fmtDate(item.dataAtendimento)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr className="record-empty-row">
                <td
                  className="record-empty-cell"
                  data-label=""
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    padding: 36,
                    color: "var(--gray-400)",
                  }}
                >
                  Nenhum atendimento
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={pageQuery.data?.page || 0}
          totalPages={pageQuery.data?.totalPages || 0}
          totalElements={pageQuery.data?.totalElements || visible.length}
          loading={pageQuery.isFetching}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

function Courses({ data, onEdit }) {
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap" style={{ marginBottom: 18 }}>
        <div className="data-table-head">
          <div className="data-table-title">Gestão de Cursos</div>
          <button className="btn btn-sm" onClick={() => onEdit("course")}>
            Criar curso
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Curso</th>
              <th>Tipo de aprendizagem</th>
              <th>Unidade</th>
              <th>Descrição</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <strong>{course.nome}</strong>
                </td>
                <td>{course.tipoAprendizagem || "—"}</td>
                <td>{course.unidade || "—"}</td>
                <td>{course.descricao || "—"}</td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onEdit("course", course)}
                  >
                    <Icon name="edit" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Gestão de Turmas</div>
          <button className="btn btn-sm" onClick={() => onEdit("class")}>
            Criar turma
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Turma</th>
              <th>Curso</th>
              <th>Turno</th>
              <th>Instrutor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                </td>
                <td>{item.curso}</td>
                <td>{TURN[item.turno] || item.turno}</td>
                <td>{item.instrutor || "Não vinculado"}</td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onEdit("class", item)}
                  >
                    <Icon name="edit" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Instructors({ users, classes, onEdit }) {
  const instructors = users.filter((user) => user.tipoUsuario === "INSTRUTOR");
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Instrutores da Unidade</div>
          <button
            className="btn btn-orange btn-sm"
            onClick={() => onEdit("instructor")}
          >
            <Icon name="addUser" />
            Novo Instrutor
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Instrutor</th>
              <th>Login</th>
              <th>E-mail</th>
              <th>Turmas vinculadas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.nome}</strong>
                </td>
                <td>
                  <code>{user.usuario}</code>
                </td>
                <td>{user.email}</td>
                <td>
                  {classes
                    .filter(
                      (item) => Number(item.instrutorId) === Number(user.id),
                    )
                    .map((item) => item.nome)
                    .join(", ") || "—"}
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onEdit("instructor", user)}
                  >
                    <Icon name="edit" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OperationalPage({ profile }) {
  const { activePanel: panel, navigate: navigateRoute } = usePanelRoute({
    role: profile,
    defaultPanel: "home",
    allowedPanels:
      profile === "coordenacao" ? COORDINATION_PANELS : INSTRUCTOR_PANELS,
  });
  const [studentModal, setStudentModal] = useState(false),
    [studentForm, setStudentForm] = useState(blankStudent),
    [studentError, setStudentError] = useState(""),
    [selectedStudent, setSelectedStudent] = useState("");
  const [editor, setEditor] = useState(null),
    [editorForm, setEditorForm] = useState({}),
    [editorInitial, setEditorInitial] = useState({}),
    [editorError, setEditorError] = useState(""),
    [toasts, setToasts] = useState([]);
  const [referralDirty, setReferralDirty] = useState(false);
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
  const authorized = backendRoleToFrontend(session?.tipoUsuario) === profile;
  const panelQueryName = `${profile}:${session?.id || "pending"}`;
  const dataQuery = usePanelQuery(
    panelQueryName,
    Boolean(session && authorized),
    fetchOperationalData,
  );
  const dataMutation = usePanelMutation(panelQueryName);
  const data = dataQuery.data || EMPTY;
  const refreshPanel = dataQuery.refetch;
  const loadData = useCallback(async () => {
    await refreshPanel();
  }, [refreshPanel]);
  const studentDirty = Boolean(
    studentModal &&
    JSON.stringify(studentForm) !== JSON.stringify(blankStudent),
  );
  const editorDirty = Boolean(
    editor && JSON.stringify(editorForm) !== JSON.stringify(editorInitial),
  );
  const confirmDiscard = useUnsavedChanges(
    studentDirty || editorDirty || referralDirty,
  );
  useEffect(() => {
    const error = sessionQuery.error;
    if (
      error?.status === 401 ||
      error?.status === 404 ||
      (session && !authorized)
    )
      window.location.replace("/");
  }, [authorized, session, sessionQuery.error]);
  const navigate = (next) => {
    if (next !== panel && !confirmDiscard()) return;
    navigateRoute(next);
  };
  const refer = (id) => {
    setSelectedStudent(id);
    navigate("encaminhar");
  };
  const scoped = useMemo(() => {
    if (!session?.unidadeId) return data;
    const unitId = Number(session.unidadeId);
    const students = data.students.filter(
      (item) => Number(item.unidadeId) === unitId,
    );
    const studentIds = new Set(students.map((item) => Number(item.id)));
    return {
      ...data,
      students,
      appointments: data.appointments.filter((item) =>
        studentIds.has(Number(item.alunoId)),
      ),
      courses: data.courses.filter((item) => Number(item.unidadeId) === unitId),
      classes: data.classes.filter((item) => Number(item.unidadeId) === unitId),
      users: data.users.filter(
        (item) => !item.unidade?.id || Number(item.unidade.id) === unitId,
      ),
    };
  }, [data, session]);
  const currentClasses = useMemo(
    () =>
      scoped.classes.filter(
        (item) =>
          !studentForm.cursoId ||
          Number(item.cursoId) === Number(studentForm.cursoId),
      ),
    [scoped.classes, studentForm.cursoId],
  );
  const saveStudent = async (event) => {
    event.preventDefault();
    setStudentError("");
    const validation = studentSchema.safeParse(studentForm);
    if (!validation.success)
      return setStudentError(validationMessage(validation));
    const selectedClass = scoped.classes.find(
      (item) => Number(item.id) === Number(studentForm.turmaId),
    );
    try {
      await dataMutation.mutateAsync(() =>
        api.post("/alunos", {
          nome: studentForm.nome.trim(),
          cpf: studentForm.cpf.trim(),
          dataNascimento: studentForm.dataNascimento,
          telefone: studentForm.telefone.trim(),
          email: studentForm.email.trim() || null,
          responsavel: session.nome,
          turno: selectedClass?.turno || studentForm.turno,
          observacoes: `Matrícula: ${studentForm.matricula || "Não informada"} | PCD: ${studentForm.pcd === "sim" ? "Sim" : "Não"}`,
          unidadeId: Number(session.unidadeId),
          cursoId: Number(studentForm.cursoId),
          turmaId: Number(studentForm.turmaId),
        }),
      );
      setStudentModal(false);
      setStudentForm(blankStudent);
      toast("Aluno cadastrado com sucesso!", "success");
    } catch (error) {
      setStudentError(error.message || "Não foi possível cadastrar o aluno.");
    }
  };
  const openEditor = (kind, item = {}) => {
    setEditor({ kind, item });
    setEditorError("");
    let nextForm = {};
    if (kind === "course")
      nextForm = {
        nome: item.nome || "",
        tipoAprendizagem: item.tipoAprendizagem || "",
        descricao: item.descricao || "",
      };
    if (kind === "class")
      nextForm = {
        nome: item.nome || "",
        cursoId: String(item.cursoId || ""),
        turno: item.turno || "MATUTINO",
        instrutorId: String(item.instrutorId || ""),
      };
    if (kind === "instructor")
      nextForm = {
        nome: item.nome || "",
        usuario: item.usuario || "",
        email: item.email || "",
        senha: "",
      };
    setEditorForm(nextForm);
    setEditorInitial(nextForm);
  };
  const closeStudent = () => {
    if (confirmDiscard()) {
      setStudentModal(false);
      setStudentForm(blankStudent);
      setStudentError("");
    }
  };
  const closeEditor = () => {
    if (confirmDiscard()) {
      setEditor(null);
      setEditorForm({});
      setEditorInitial({});
      setEditorError("");
    }
  };
  const saveEditor = async (event) => {
    event.preventDefault();
    setEditorError("");
    const { kind, item } = editor;
    try {
      if (kind === "course") {
        if (!editorForm.nome.trim())
          return setEditorError("Informe o nome do curso.");
        const body = {
          ...editorForm,
          nome: editorForm.nome.trim(),
          unidadeId: Number(session.unidadeId),
          ativo: true,
        };
        if (item.id)
          await dataMutation.mutateAsync(() =>
            api.put(`/cursos/${item.id}`, body),
          );
        else await dataMutation.mutateAsync(() => api.post("/cursos", body));
      }
      if (kind === "class") {
        if (!editorForm.nome.trim() || !editorForm.cursoId)
          return setEditorError("Informe nome e curso.");
        const body = {
          nome: editorForm.nome.trim(),
          turno: editorForm.turno,
          cursoId: Number(editorForm.cursoId),
          unidadeId: Number(session.unidadeId),
          instrutorId: editorForm.instrutorId
            ? Number(editorForm.instrutorId)
            : null,
          ativo: true,
        };
        if (item.id)
          await dataMutation.mutateAsync(() =>
            api.put(`/turmas/${item.id}`, body),
          );
        else await dataMutation.mutateAsync(() => api.post("/turmas", body));
      }
      if (kind === "instructor") {
        if (
          !editorForm.nome.trim() ||
          !editorForm.usuario.trim() ||
          !editorForm.email.trim() ||
          (!item.id && !editorForm.senha)
        )
          return setEditorError("Preencha todos os campos obrigatórios.");
        if (item.id)
          await dataMutation.mutateAsync(() =>
            api.put(`/usuarios/${item.id}`, {
              nome: editorForm.nome.trim(),
              usuario: editorForm.usuario.trim(),
              email: editorForm.email.trim(),
              senha: editorForm.senha || null,
              tipoUsuario: "INSTRUTOR",
              unidadeId: Number(session.unidadeId),
            }),
          );
        else
          await dataMutation.mutateAsync(() =>
            api.post("/auth/register", {
              ...editorForm,
              nome: editorForm.nome.trim(),
              usuario: editorForm.usuario.trim(),
              email: editorForm.email.trim(),
              tipoUsuario: "INSTRUTOR",
              unidadeId: Number(session.unidadeId),
            }),
          );
      }
      setEditor(null);
      toast("Dados salvos com sucesso!", "success");
    } catch (error) {
      setEditorError(error.message || "Não foi possível salvar.");
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
  return (
    <OperationalShell
      profile={profile}
      session={session}
      activePanel={panel}
      onNavigate={navigate}
      onNewStudent={() => setStudentModal(true)}
    >
      {panel === "home" && (
        <Home
          profile={profile}
          session={session}
          data={scoped}
          onNavigate={navigate}
          onNewStudent={() => setStudentModal(true)}
        />
      )}{" "}
      {panel === "alunos" && (
        <Students
          students={scoped.students}
          appointments={scoped.appointments}
          onNew={() => setStudentModal(true)}
          onRefer={refer}
        />
      )}{" "}
      {panel === "encaminhar" && (
        <Referral
          students={scoped.students}
          selectedStudentId={selectedStudent}
          session={session}
          onSubmitReferral={(body) =>
            dataMutation.mutateAsync(() => api.post("/atendimentos", body))
          }
          onToast={toast}
          onDirtyChange={setReferralDirty}
        />
      )}{" "}
      {panel === "atendimentos" && (
        <Appointments appointments={scoped.appointments} />
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
      )}{" "}
      {profile === "coordenacao" && panel === "cursos" && (
        <Courses data={scoped} onEdit={openEditor} />
      )}{" "}
      {profile === "coordenacao" && panel === "instrutores" && (
        <Instructors
          users={scoped.users}
          classes={scoped.classes}
          onEdit={openEditor}
        />
      )}
      <AccessibleModal
        open={studentModal}
        title="Cadastrar Aluno"
        onClose={closeStudent}
      >
        <form onSubmit={saveStudent}>
          <ErrorMessage text={studentError} />
          <div className="admin-form-grid">
            <div className="admin-form-full">
              <label className="form-label">Nome completo *</label>
              <input
                className="form-control"
                value={studentForm.nome}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, nome: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Matrícula</label>
              <input
                className="form-control"
                value={studentForm.matricula}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, matricula: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">CPF *</label>
              <input
                className="form-control"
                value={studentForm.cpf}
                maxLength="14"
                onChange={(e) =>
                  setStudentForm({ ...studentForm, cpf: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Nascimento *</label>
              <input
                type="date"
                className="form-control"
                value={studentForm.dataNascimento}
                onChange={(e) =>
                  setStudentForm({
                    ...studentForm,
                    dataNascimento: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="form-label">Telefone *</label>
              <input
                className="form-control"
                value={studentForm.telefone}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, telefone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="form-label">Curso *</label>
              <select
                className="form-control"
                value={studentForm.cursoId}
                onChange={(e) =>
                  setStudentForm({
                    ...studentForm,
                    cursoId: e.target.value,
                    turmaId: "",
                  })
                }
              >
                <option value="">Selecione...</option>
                {data.courses.map((course) => (
                  <option value={course.id} key={course.id}>
                    {course.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Turma *</label>
              <select
                className="form-control"
                value={studentForm.turmaId}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, turmaId: e.target.value })
                }
              >
                <option value="">Selecione...</option>
                {currentClasses.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.nome} · {TURN[item.turno]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Aluno é PCD?</label>
              <select
                className="form-control"
                value={studentForm.pcd}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, pcd: e.target.value })
                }
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div className="admin-form-full">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-control"
                value={studentForm.email}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, email: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-action-row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeStudent}
            >
              Cancelar
            </button>
            <button
              className="btn btn-orange"
              type="submit"
              disabled={dataMutation.isPending}
            >
              <Icon name="addUser" />
              Cadastrar Aluno
            </button>
          </div>
        </form>
      </AccessibleModal>
      <AccessibleModal
        open={Boolean(editor)}
        title={
          editor?.kind === "course"
            ? editor.item.id
              ? "Editar curso"
              : "Criar curso"
            : editor?.kind === "class"
              ? editor.item.id
                ? "Editar turma"
                : "Criar turma"
              : editor?.item.id
                ? "Editar instrutor"
                : "Criar instrutor"
        }
        onClose={closeEditor}
      >
        <form onSubmit={saveEditor}>
          <ErrorMessage text={editorError} />
          {editor?.kind === "course" && (
            <div style={{ display: "grid", gap: 14 }}>
              <input
                className="form-control"
                placeholder="Nome do curso"
                value={editorForm.nome || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, nome: e.target.value })
                }
              />
              <input
                className="form-control"
                placeholder="Tipo de aprendizagem"
                value={editorForm.tipoAprendizagem || ""}
                onChange={(e) =>
                  setEditorForm({
                    ...editorForm,
                    tipoAprendizagem: e.target.value,
                  })
                }
              />
              <textarea
                className="form-control"
                placeholder="Descrição"
                value={editorForm.descricao || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, descricao: e.target.value })
                }
              />
            </div>
          )}
          {editor?.kind === "class" && (
            <div className="admin-form-grid">
              <input
                className="form-control"
                placeholder="Nome da turma"
                value={editorForm.nome || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, nome: e.target.value })
                }
              />
              <select
                className="form-control"
                value={editorForm.cursoId || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, cursoId: e.target.value })
                }
              >
                <option value="">Curso...</option>
                {data.courses.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
              <select
                className="form-control"
                value={editorForm.turno || "MATUTINO"}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, turno: e.target.value })
                }
              >
                {Object.entries(TURN).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="form-control"
                value={editorForm.instrutorId || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, instrutorId: e.target.value })
                }
              >
                <option value="">Sem instrutor</option>
                {data.users
                  .filter((u) => u.tipoUsuario === "INSTRUTOR")
                  .map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {editor?.kind === "instructor" && (
            <div className="admin-form-grid">
              <input
                className="form-control admin-form-full"
                placeholder="Nome completo"
                value={editorForm.nome || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, nome: e.target.value })
                }
              />
              <input
                className="form-control"
                placeholder="Usuário/login"
                value={editorForm.usuario || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, usuario: e.target.value })
                }
              />
              <input
                type="email"
                className="form-control"
                placeholder="E-mail"
                value={editorForm.email || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, email: e.target.value })
                }
              />
              <input
                type="password"
                autoComplete="new-password"
                className="form-control admin-form-full"
                placeholder={
                  editor.item.id ? "Nova senha (opcional)" : "Senha inicial"
                }
                value={editorForm.senha || ""}
                onChange={(e) =>
                  setEditorForm({ ...editorForm, senha: e.target.value })
                }
              />
            </div>
          )}
          <div className="modal-action-row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeEditor}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-orange"
              disabled={dataMutation.isPending}
            >
              Salvar
            </button>
          </div>
        </form>
      </AccessibleModal>
      <ToastRegion toasts={toasts} />
    </OperationalShell>
  );
}
