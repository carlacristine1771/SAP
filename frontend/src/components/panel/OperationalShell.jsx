import { useEffect } from "react";
import { api } from "../../api/client.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import Icon from "./Icon.jsx";

export default function OperationalShell({
  profile,
  session,
  activePanel,
  onNavigate,
  onNewStudent,
  children,
}) {
  const { theme, toggleTheme } = useTheme();
  const coordinator = profile === "coordenacao";
  const label = coordinator ? "Coordenação" : "Instrutor";
  const navItems = [
    ["home", "home", "Início"],
    ["alunos", "user", "Alunos"],
    ["encaminhar", "arrow", "Encaminhar Aluno"],
    ...(coordinator
      ? [
          ["cursos", "book", "Cursos e Turmas"],
          ["instrutores", "users", "Instrutores"],
        ]
      : []),
    ["atendimentos", "clipboard", "Atendimentos"],
    ["chat", "chat", "Chat"],
  ];
  const titles = Object.fromEntries(
    navItems.map(([id, , title]) => [id, title]),
  );
  useEffect(() => {
    document.title = `Painel ${label} — SAP SENAC DF`;
  }, [label]);
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* redirecionamento encerra o fluxo */
    }
    window.location.assign("/");
  };
  return (
    <>
      <link rel="stylesheet" href="/css/global.css" />
      <link rel="stylesheet" href="/css/painel.css" />
      <link rel="stylesheet" href={`/css/painel-${profile}.css`} />
      <div className="app-shell">
        <aside className="sidebar sidebar-pastel">
          <div className="sidebar-brand">
            <div className="sidebar-brand-top">
              <img src="/senasc.png" className="senac-logo-img" alt="SENAC" />
              <div className="sidebar-senac-text">
                <div className="sidebar-senac-name">SENAC</div>
                <div className="sidebar-senac-sub">DF</div>
              </div>
            </div>
            <div className="sidebar-tagline">
              {coordinator ? "Coordenação Pedagógica" : "Instrutor"}
            </div>
          </div>
          <nav className="sidebar-nav" aria-label="Menu principal">
            <div className="nav-section">Menu</div>
            {navItems.map(([id, icon, title]) => (
              <button
                type="button"
                className={`nav-link${activePanel === id ? " active" : ""}`}
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
                onClick={() => onNavigate(id)}
                key={id}
              >
                <span className="nav-icon">
                  <Icon name={icon} strokeWidth={1.8} />
                </span>
                <span className="nav-label">{title}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="user-avatar">
                {session.nome?.charAt(0)?.toUpperCase() || label.charAt(0)}
              </div>
              <div className="user-details">
                <div className="user-name">{session.nome || label}</div>
                <div className="user-role">{session.unidade || "SENAC DF"}</div>
              </div>
              <button
                type="button"
                className="btn-logout"
                onClick={logout}
                title="Sair"
                aria-label="Sair"
              >
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-page-title">{titles[activePanel]}</div>
              <div className="topbar-breadcrumb">
                SAP · {label} · {session.unidade || "SENAC DF"}
              </div>
            </div>
            <div className="topbar-right">
              <button
                type="button"
                className="btn-theme"
                onClick={toggleTheme}
                title="Alternar tema"
                aria-label="Alternar tema claro e escuro"
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onNewStudent}
              >
                <Icon name="addUser" />
                Novo Aluno
              </button>
              <button
                type="button"
                className="btn btn-orange btn-sm"
                onClick={() => onNavigate("encaminhar")}
              >
                <Icon name="arrow" />
                Encaminhar
              </button>
            </div>
          </header>
          <div className="page-body">{children}</div>
        </div>
      </div>
    </>
  );
}
