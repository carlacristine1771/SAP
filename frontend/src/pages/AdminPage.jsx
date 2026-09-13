import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { api } from "../api/client.ts";
import {
  usePanelMutation,
  usePanelQuery,
  useSessionQuery,
} from "../api/panelQueries.ts";
import { backendRoleToFrontend } from "../auth/session.ts";
import { usePanelRoute } from "../hooks/usePanelRoute.ts";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges.ts";
import {
  createUserSchema,
  unitSchema,
  userSchema,
  validationMessage,
} from "../validation/schemas.ts";
import ChatPanel from "../components/panel/ChatPanel.jsx";
import DashboardCharts from "../components/panel/DashboardCharts.jsx";
import Icon from "../components/panel/Icon.jsx";
import PanelShell from "../components/panel/PanelShell.jsx";
import AccessibleModal from "../components/ui/AccessibleModal.tsx";
import {
  ErrorMessage,
  FatalScreen,
  LoadingScreen,
  ToastRegion,
} from "../components/ui/Feedback.tsx";

const EMPTY_DATA = {
  units: [],
  users: [],
  students: [],
  appointments: [],
  messages: [],
};
const ADMIN_PANELS = ["dashboard", "unidades", "usuarios", "chat", "criar"];
async function fetchAdminData() {
  const [units, users, students, appointments, messages] = await Promise.all([
    api.get("/unidades"),
    api.get("/usuarios"),
    api.get("/alunos"),
    api.get("/atendimentos"),
    api.get("/chat/mensagens"),
  ]);
  return {
    units: units || [],
    users: users || [],
    students: students || [],
    appointments: appointments || [],
    messages: messages || [],
  };
}
const ROLE_META = {
  administrador: {
    label: "Administrador Geral",
    subtitle: "Todas as unidades",
    className: "admin",
    icon: "shield",
    backend: "ADMINISTRADOR",
  },
  admin_unidade: {
    label: "Admin. da Unidade",
    subtitle: "Somente uma unidade",
    className: "admin",
    icon: "home",
    backend: "ADMIN_UNIDADE",
  },
  psicologa: {
    label: "Psicólogo(a)",
    subtitle: "Atendimento",
    className: "psico",
    icon: "heart",
    backend: "PSICOLOGO",
  },
  instrutor: {
    label: "Instrutor",
    subtitle: "Sala de Aula",
    className: "inst",
    icon: "monitor",
    backend: "INSTRUTOR",
  },
  coordenacao: {
    label: "Coordenação",
    subtitle: "Gestão Pedagógica",
    className: "coord",
    icon: "users",
    backend: "COORDENACAO",
  },
};

function roleKey(user) {
  if (String(user?.tipoUsuario).toUpperCase() === "ADMINISTRADOR")
    return user?.unidade?.id ? "admin_unidade" : "administrador";
  if (String(user?.tipoUsuario).toUpperCase() === "ADMIN_UNIDADE")
    return "admin_unidade";
  return backendRoleToFrontend(user?.tipoUsuario);
}

function StatCard({ accent, background, icon, value, label }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className={`stat-icon-wrap ${background}`}>
        <Icon name={icon} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Dashboard({ session, data, onNavigate }) {
  const activeStudents = data.students.filter(
    (student) => student.ativo !== false,
  );
  const usersByRole = (role) =>
    data.users.filter((user) => String(user.tipoUsuario).toUpperCase() === role)
      .length;
  const appointmentsByUnit = useMemo(() => {
    const studentUnit = new Map(
      data.students.map((student) => [
        Number(student.id),
        Number(student.unidadeId),
      ]),
    );
    return data.appointments.reduce((result, appointment) => {
      const unitId = studentUnit.get(Number(appointment.alunoId));
      if (unitId) result[unitId] = (result[unitId] || 0) + 1;
      return result;
    }, {});
  }, [data.appointments, data.students]);
  const visibleUnits = session.unidadeId
    ? data.units.filter((unit) => Number(unit.id) === Number(session.unidadeId))
    : data.units;

  return (
    <div className="panel-section active fade-up">
      <div
        className="welcome-banner"
        style={{
          background:
            "linear-gradient(135deg,#071629 0%,#10345f 60%,#1b4e9b 100%)",
        }}
      >
        <div className="wb-content">
          <div
            className="wb-tag"
            style={{
              background: "rgba(45,127,249,.16)",
              borderColor: "rgba(45,127,249,.35)",
              color: "#cfe2ff",
            }}
          >
            <Icon name="shield" size={13} />
            Controle Total
          </div>
          <h2 className="wb-title">
            Olá, {(session.nome || "Admin").split(" ")[0]}!
          </h2>
          <p className="wb-sub">
            {session.unidadeId
              ? `${session.unidade} · administrador da unidade`
              : "SENAC DF"}
          </p>
        </div>
        <div className="wb-actions">
          <button
            type="button"
            className="btn btn-outline"
            style={{ borderColor: "rgba(255,255,255,.3)", color: "#fff" }}
            onClick={() => onNavigate("usuarios")}
          >
            Ver Usuários
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: "linear-gradient(135deg,#2d7ff9,#1B4E9B)",
              color: "#fff",
              marginLeft: 8,
            }}
            onClick={() => onNavigate("criar")}
          >
            Criar Login
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard
          accent="accent-orange"
          background="bg-orange"
          icon="home"
          value={visibleUnits.length}
          label="Unidades"
        />
        <StatCard
          accent="accent-navy"
          background="bg-navy"
          icon="heart"
          value={usersByRole("PSICOLOGO")}
          label="Psicólogos"
        />
        <StatCard
          accent="accent-ok"
          background="bg-ok"
          icon="monitor"
          value={usersByRole("INSTRUTOR")}
          label="Instrutores"
        />
        <StatCard
          accent="accent-wait"
          background="bg-wait"
          icon="users"
          value={usersByRole("COORDENACAO")}
          label="Coordenadores"
        />
        <StatCard
          accent="accent-done"
          background="bg-done"
          icon="user"
          value={activeStudents.length}
          label="Alunos Ativos"
        />
      </div>
      <DashboardCharts students={activeStudents} />
      <div className="data-table-wrap" style={{ marginTop: 20 }}>
        <div className="data-table-head">
          <div className="data-table-title">Visão Geral por Unidade</div>
        </div>
        <div className="unidade-cards">
          {visibleUnits.map((unit) => {
            const unitUsers = data.users.filter(
              (user) => Number(user.unidade?.id) === Number(unit.id),
            );
            const students = data.students.filter(
              (student) => Number(student.unidadeId) === Number(unit.id),
            ).length;
            const psychologistCount = unitUsers.filter(
              (user) => user.tipoUsuario === "PSICOLOGO",
            ).length;
            const instructorCount = unitUsers.filter(
              (user) => user.tipoUsuario === "INSTRUTOR",
            ).length;
            return (
              <div className="unidade-card" key={unit.id}>
                <div className="unidade-card-name">{unit.nome}</div>
                <div className="unidade-card-region">{unit.endereco}</div>
                <div className="unidade-card-stats">
                  {psychologistCount > 0 && (
                    <span className="us-chip">{psychologistCount} psic.</span>
                  )}
                  {instructorCount > 0 && (
                    <span className="us-chip">{instructorCount} instr.</span>
                  )}
                  {students > 0 && (
                    <span className="us-chip">{students} alunos</span>
                  )}
                  {appointmentsByUnit[unit.id] > 0 && (
                    <span className="us-chip">
                      {appointmentsByUnit[unit.id]} atend.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {!visibleUnits.length && (
            <div className="dash-empty">Nenhuma unidade cadastrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function UnitsPanel({ data, onEdit, onCreate }) {
  const count = (unitId, role) =>
    data.users.filter(
      (user) =>
        Number(user.unidade?.id) === Number(unitId) &&
        user.tipoUsuario === role,
    ).length;
  const studentCount = (unitId) =>
    data.students.filter(
      (student) => Number(student.unidadeId) === Number(unitId),
    ).length;
  const appointmentsByStudent = new Map(
    data.students.map((student) => [
      Number(student.id),
      Number(student.unidadeId),
    ]),
  );
  const appointmentCount = (unitId) =>
    data.appointments.filter(
      (appointment) =>
        appointmentsByStudent.get(Number(appointment.alunoId)) ===
        Number(unitId),
    ).length;
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Unidades SENAC DF</div>
          <div className="data-table-filters">
            <button
              type="button"
              className="btn btn-sm admin-blue-btn"
              onClick={onCreate}
            >
              <Icon name="plus" strokeWidth={2.2} />
              Nova Unidade
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Região</th>
              <th>Psicólogos</th>
              <th>Instrutores</th>
              <th>Coordenadores</th>
              <th>Alunos</th>
              <th>Atendimentos</th>
              <th style={{ textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.units.map((unit) => (
              <tr key={unit.id}>
                <td>
                  <strong>{unit.nome}</strong>
                </td>
                <td>{unit.endereco}</td>
                <td style={{ textAlign: "center" }}>
                  {count(unit.id, "PSICOLOGO")}
                </td>
                <td style={{ textAlign: "center" }}>
                  {count(unit.id, "INSTRUTOR")}
                </td>
                <td style={{ textAlign: "center" }}>
                  {count(unit.id, "COORDENACAO")}
                </td>
                <td style={{ textAlign: "center" }}>{studentCount(unit.id)}</td>
                <td style={{ textAlign: "center" }}>
                  {appointmentCount(unit.id)}
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onEdit(unit)}
                  >
                    <Icon name="edit" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {!data.units.length && (
              <tr>
                <td
                  colSpan="8"
                  style={{
                    textAlign: "center",
                    padding: 36,
                    color: "var(--gray-400)",
                  }}
                >
                  Nenhuma unidade cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersPanel({ users, units, onEdit }) {
  const [nameFilter, setNameFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const visibleUsers = users
    .filter((user) => roleKey(user) !== "administrador")
    .filter((user) => !roleFilter || roleKey(user) === roleFilter)
    .filter((user) =>
      String(user.nome).toLowerCase().includes(nameFilter.trim().toLowerCase()),
    );
  const unitNames = new Map(units.map((unit) => [Number(unit.id), unit.nome]));
  const color = {
    psicologa: "#E8EFF8",
    instrutor: "#FEF3DC",
    coordenacao: "#FEF3DC",
    admin_unidade: "#E8EFF8",
  };
  const textColor = {
    psicologa: "#1B3A6B",
    instrutor: "#C87F00",
    coordenacao: "#C87F00",
    admin_unidade: "#1B3A6B",
  };
  return (
    <div className="panel-section active fade-up">
      <div className="data-table-wrap">
        <div className="data-table-head">
          <div className="data-table-title">Usuários da Unidade</div>
          <div className="data-table-filters">
            <input
              className="filter-select"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Filtrar por nome..."
              style={{ minWidth: 180 }}
            />
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">Todos os perfis</option>
              <option value="psicologa">Psicólogos</option>
              <option value="instrutor">Instrutores</option>
              <option value="coordenacao">Coordenação</option>
              <option value="admin_unidade">Administradores da unidade</option>
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Perfil</th>
              <th>Usuário</th>
              <th>Unidade</th>
              <th>Detalhes</th>
              <th style={{ textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => {
              const role = roleKey(user);
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.nome}</strong>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: color[role],
                        color: textColor[role],
                        padding: "3px 9px",
                        borderRadius: 20,
                      }}
                    >
                      {ROLE_META[role]?.label}
                    </span>
                  </td>
                  <td>
                    <code>{user.usuario || "—"}</code>
                  </td>
                  <td>
                    {unitNames.get(Number(user.unidade?.id)) ||
                      "Todas as unidades"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--gray-400)" }}>
                    {role === "admin_unidade"
                      ? "Administrador da unidade"
                      : user.email}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onEdit(user)}
                    >
                      <Icon name="edit" />
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!visibleUsers.length && (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    padding: 36,
                    color: "var(--gray-400)",
                  }}
                >
                  Nenhum usuário
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserPanel({
  session,
  units,
  onSubmitUser,
  onToast,
  onDirtyChange,
}) {
  const [error, setError] = useState("");
  const defaultValues = {
    role: "",
    nome: "",
    email: "",
    usuario: "",
    senha: "",
    unidadeId: session.unidadeId ? String(session.unidadeId) : "",
  };
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(createUserSchema), defaultValues });
  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);
  const role = watch("role");
  const selectableRoles = Object.entries(ROLE_META).filter(
    ([key]) => !(session.unidadeId && key === "administrador"),
  );
  const clear = () => {
    setError("");
    reset(defaultValues);
  };
  const submit = handleSubmit(async (form) => {
    setError("");
    const unitRequired = role !== "administrador";
    try {
      await onSubmitUser({
        nome: form.nome.trim(),
        email: form.email.trim(),
        usuario: form.usuario.trim(),
        senha: form.senha,
        tipoUsuario: ROLE_META[role].backend,
        unidadeId: unitRequired
          ? Number(session.unidadeId || form.unidadeId)
          : null,
      });
      onToast(
        `✓ Login criado e salvo no banco para ${form.nome.trim()}!`,
        "success",
      );
      clear();
    } catch (requestError) {
      setError(requestError.message || "Não foi possível salvar o usuário.");
    }
  });
  const validationError = Object.values(errors).find(Boolean)?.message;
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
          Criar Login de Usuário
        </h2>
        <p
          style={{ fontSize: 13.5, color: "var(--gray-500)", marginBottom: 24 }}
        >
          Selecione o perfil e preencha os dados do novo usuário.
        </p>
        <ErrorMessage>{error || validationError}</ErrorMessage>
        <div style={{ marginBottom: 18 }}>
          <label className="form-label">
            Perfil <span style={{ color: "var(--s-cancel)" }}>*</span>
          </label>
          <div className="role-select-grid">
            {selectableRoles.map(([key, meta]) => (
              <button
                type="button"
                className={`role-option ${meta.className}${role === key ? " selected" : ""}`}
                onClick={() => {
                  setValue("role", key, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (key === "administrador")
                    setValue("unidadeId", "", { shouldDirty: true });
                }}
                key={key}
              >
                <Icon name={meta.icon} strokeWidth={1.8} />
                <strong>{meta.label}</strong>
                <span>{meta.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="admin-form-grid">
          <div className="admin-form-full">
            <label className="form-label">
              Nome completo <span style={{ color: "var(--s-cancel)" }}>*</span>
            </label>
            <input
              className="form-control"
              {...register("nome")}
              placeholder="Nome completo do usuário"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="form-label">
              E-mail <span style={{ color: "var(--s-cancel)" }}>*</span>
            </label>
            <input
              type="email"
              className="form-control"
              {...register("email")}
              placeholder="ex: profissional@sap.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="form-label">
              Usuário (login){" "}
              <span style={{ color: "var(--s-cancel)" }}>*</span>
            </label>
            <input
              className="form-control"
              {...register("usuario")}
              placeholder="ex: nome.sobrenome"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="form-label">
              Senha <span style={{ color: "var(--s-cancel)" }}>*</span>
            </label>
            <input
              type="password"
              className="form-control"
              {...register("senha")}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="form-label">
              Unidade{" "}
              {role !== "administrador" && (
                <span style={{ color: "var(--s-cancel)" }}>*</span>
              )}
            </label>
            <select
              className="form-control"
              {...register("unidadeId")}
              disabled={Boolean(session.unidadeId) || role === "administrador"}
            >
              <option value="">
                {role === "administrador"
                  ? "Todas as unidades"
                  : "Selecione a unidade..."}
              </option>
              {units.map((unit) => (
                <option value={unit.id} key={unit.id}>
                  {unit.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-login-note">
          <strong>Login individual:</strong> Cada profissional deve ter seu
          próprio usuário e senha. O CPF é usado apenas no cadastro de alunos,
          não no login de profissionais.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={clear}
            style={{ flex: 1 }}
          >
            Limpar
          </button>
          <button
            type="submit"
            className="btn admin-blue-btn"
            disabled={isSubmitting}
            style={{ flex: 2 }}
          >
            <Icon name="addUser" strokeWidth={2.2} />
            {isSubmitting ? "Criando..." : "Criar Login"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const { activePanel, navigate: navigateRoute } = usePanelRoute({
    role: "admin",
    defaultPanel: "dashboard",
    allowedPanels: ADMIN_PANELS,
  });
  const [unitModal, setUnitModal] = useState(null);
  const [unitForm, setUnitForm] = useState({ nome: "", endereco: "" });
  const [unitError, setUnitError] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({
    nome: "",
    usuario: "",
    senha: "",
    unidadeId: "",
  });
  const [userError, setUserError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [createUserDirty, setCreateUserDirty] = useState(false);

  const toast = useCallback((text, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, type }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      3500,
    );
  }, []);

  const sessionQuery = useSessionQuery();
  const session = sessionQuery.data;
  const authorized =
    backendRoleToFrontend(session?.tipoUsuario) === "administrador";
  const panelQueryName = `admin:${session?.id || "pending"}`;
  const dataQuery = usePanelQuery(
    panelQueryName,
    Boolean(session && authorized),
    fetchAdminData,
  );
  const dataMutation = usePanelMutation(panelQueryName);
  const data = dataQuery.data || EMPTY_DATA;
  const refreshPanel = dataQuery.refetch;
  const loadData = useCallback(async () => {
    await refreshPanel();
  }, [refreshPanel]);
  const unitDirty = Boolean(
    unitModal !== null &&
    (unitForm.nome !== (unitModal?.nome || "") ||
      unitForm.endereco !== (unitModal?.endereco || "")),
  );
  const userDirty = Boolean(
    editUser &&
    (userForm.nome !== (editUser.nome || "") ||
      userForm.usuario !== (editUser.usuario || "") ||
      userForm.senha ||
      userForm.unidadeId !== String(editUser.unidade?.id || "")),
  );
  const confirmDiscard = useUnsavedChanges(
    unitDirty || userDirty || createUserDirty,
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

  const navigate = (panel) => {
    if (panel === "unidades" && session?.unidadeId) return;
    if (panel !== activePanel && !confirmDiscard()) return;
    navigateRoute(panel);
  };
  const closeUnit = () => {
    if (confirmDiscard()) setUnitModal(null);
  };
  const closeUser = () => {
    if (confirmDiscard()) setEditUser(null);
  };

  const openUnit = (unit = null) => {
    setUnitModal(unit || {});
    setUnitForm({ nome: unit?.nome || "", endereco: unit?.endereco || "" });
    setUnitError("");
  };
  const saveUnit = async () => {
    setUnitError("");
    const validation = unitSchema.safeParse(unitForm);
    if (!validation.success) return setUnitError(validationMessage(validation));
    try {
      const body = {
        nome: unitForm.nome.trim(),
        endereco: unitForm.endereco.trim(),
        telefone: unitModal?.telefone || "Não informado",
      };
      if (unitModal?.id)
        await dataMutation.mutateAsync(() =>
          api.put(`/unidades/${unitModal.id}`, body),
        );
      else await dataMutation.mutateAsync(() => api.post("/unidades", body));
      setUnitModal(null);
      toast(
        unitModal?.id ? "✓ Unidade atualizada!" : "✓ Unidade criada!",
        "success",
      );
    } catch (error) {
      setUnitError(error.message || "Não foi possível salvar a unidade.");
    }
  };

  const openUser = (user) => {
    setEditUser(user);
    setUserForm({
      nome: user.nome || "",
      usuario: user.usuario || "",
      senha: "",
      unidadeId: String(user.unidade?.id || ""),
    });
    setUserError("");
  };
  const saveUser = async (event) => {
    event?.preventDefault();
    setUserError("");
    const validation = userSchema.safeParse(userForm);
    if (!validation.success) return setUserError(validationMessage(validation));
    if (roleKey(editUser) !== "administrador" && !userForm.unidadeId)
      return setUserError("Selecione a unidade do usuário.");
    try {
      await dataMutation.mutateAsync(() =>
        api.put(`/usuarios/${editUser.id}`, {
          nome: userForm.nome.trim(),
          email: editUser.email,
          usuario: userForm.usuario.trim(),
          senha: userForm.senha || null,
          tipoUsuario:
            roleKey(editUser) === "admin_unidade"
              ? "ADMIN_UNIDADE"
              : editUser.tipoUsuario,
          unidadeId: userForm.unidadeId ? Number(userForm.unidadeId) : null,
        }),
      );
      setEditUser(null);
      toast("✓ Usuário atualizado com sucesso!", "success");
    } catch (error) {
      setUserError(error.message || "Não foi possível atualizar o usuário.");
    }
  };
  const deleteUser = async () => {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.",
      )
    )
      return;
    try {
      await dataMutation.mutateAsync(() =>
        api.delete(`/usuarios/${editUser.id}`),
      );
      setEditUser(null);
      toast("Usuário removido.", "success");
    } catch (error) {
      setUserError(error.message || "Não foi possível excluir o usuário.");
    }
  };

  if (
    sessionQuery.isPending ||
    (session && !authorized) ||
    (session && authorized && dataQuery.isPending)
  )
    return <LoadingScreen />;
  const fatalError = sessionQuery.error?.message || dataQuery.error?.message;
  if (fatalError || !session)
    return (
      <FatalScreen
        message={fatalError || "Sessão indisponível."}
        onRetry={() => window.location.reload()}
      />
    );

  return (
    <PanelShell
      session={session}
      activePanel={activePanel}
      onNavigate={navigate}
    >
      {activePanel === "dashboard" && (
        <Dashboard session={session} data={data} onNavigate={navigate} />
      )}
      {activePanel === "unidades" && !session.unidadeId && (
        <UnitsPanel data={data} onEdit={openUnit} onCreate={() => openUnit()} />
      )}
      {activePanel === "usuarios" && (
        <UsersPanel users={data.users} units={data.units} onEdit={openUser} />
      )}
      {activePanel === "criar" && (
        <CreateUserPanel
          session={session}
          units={data.units}
          onSubmitUser={(body) =>
            dataMutation.mutateAsync(() => api.post("/auth/register", body))
          }
          onToast={toast}
          onDirtyChange={setCreateUserDirty}
        />
      )}
      {activePanel === "chat" && (
        <div className="panel-section active fade-up">
          <ChatPanel
            session={session}
            users={data.users}
            messages={data.messages}
            onRefresh={loadData}
            onToast={toast}
          />
        </div>
      )}

      <AccessibleModal
        open={unitModal !== null}
        title={unitModal?.id ? "Editar Unidade" : "Nova Unidade"}
        onClose={closeUnit}
        maxWidth={480}
      >
        <ErrorMessage>{unitError}</ErrorMessage>
        <div style={{ marginBottom: 14 }}>
          <label className="form-label">
            Nome da Unidade <span style={{ color: "var(--s-cancel)" }}>*</span>
          </label>
          <input
            className="form-control"
            value={unitForm.nome}
            onChange={(event) =>
              setUnitForm((current) => ({
                ...current,
                nome: event.target.value,
              }))
            }
            placeholder="Ex: Nome da unidade"
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">
            Região <span style={{ color: "var(--s-cancel)" }}>*</span>
          </label>
          <input
            className="form-control"
            value={unitForm.endereco}
            onChange={(event) =>
              setUnitForm((current) => ({
                ...current,
                endereco: event.target.value,
              }))
            }
            placeholder="Ex: Região Oeste"
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={closeUnit}
            style={{ flex: 1 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn admin-blue-btn"
            onClick={saveUnit}
            disabled={dataMutation.isPending}
            style={{ flex: 2 }}
          >
            <Icon name="save" strokeWidth={2.2} />
            Salvar
          </button>
        </div>
      </AccessibleModal>

      <AccessibleModal
        open={Boolean(editUser)}
        title="Editar Usuário"
        onClose={closeUser}
      >
        <form onSubmit={saveUser}>
          <ErrorMessage>{userError}</ErrorMessage>
          <div className="admin-form-grid">
            <div className="admin-form-full">
              <label className="form-label">Nome completo</label>
              <input
                className="form-control"
                value={userForm.nome}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    nome: event.target.value,
                  }))
                }
                placeholder="Nome completo"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="form-label">Usuário (login)</label>
              <input
                className="form-control"
                value={userForm.usuario}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    usuario: event.target.value,
                  }))
                }
                placeholder="ex: nome.sobrenome"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="form-label">
                Nova senha{" "}
                <span style={{ color: "var(--gray-400)", fontWeight: 400 }}>
                  (opcional)
                </span>
              </label>
              <input
                type="password"
                className="form-control"
                value={userForm.senha}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    senha: event.target.value,
                  }))
                }
                placeholder="Deixe vazio para manter"
                autoComplete="new-password"
              />
            </div>
            <div className="admin-form-full">
              <label className="form-label">Unidade</label>
              <select
                className="form-control"
                value={userForm.unidadeId}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    unidadeId: event.target.value,
                  }))
                }
                disabled={Boolean(session.unidadeId)}
              >
                {data.units.map((unit) => (
                  <option value={unit.id} key={unit.id}>
                    {unit.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeUser}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              style={{ padding: "10px 16px", fontSize: 13 }}
              onClick={deleteUser}
              disabled={dataMutation.isPending}
            >
              <Icon name="trash" />
              Excluir
            </button>
            <button
              type="submit"
              className="btn btn-orange"
              disabled={dataMutation.isPending}
              style={{ flex: 2 }}
            >
              <Icon name="save" strokeWidth={2.2} />
              Salvar alterações
            </button>
          </div>
        </form>
      </AccessibleModal>
      <ToastRegion toasts={toasts} />
    </PanelShell>
  );
}
