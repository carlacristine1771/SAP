import { useEffect } from "react";
import { api } from "../../api/client.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import Icon from "./Icon.jsx";

const NAV_ITEMS = [
  ["dashboard", "dashboard", "Dashboard"],
  ["indicativos", "chart", "Indicativos"],
  ["historico", "calendar", "Histórico"],
  ["atendimentos", "clipboard", "Atendimentos"],
  ["alunos", "user", "Alunos"],
  ["calendario", "calendar", "Calendário"],
  ["chat", "chat", "Chat"],
];

export default function PsychologistShell({
  session,
  activePanel,
  pending,
  onNavigate,
  children,
}) {
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    document.title = "Painel Psicólogo(a) — SAP SENAC DF";
  }, []);
  useEffect(() => {
    if (
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(max-width: 900px)").matches
    )
      return;
    document
      .querySelector(".sidebar-nav .nav-link.active")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activePanel]);
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* o redirecionamento encerra o fluxo */
    }
    window.location.assign("/");
  };
  return (
    <>
      <link rel="stylesheet" href="/css/global.css" />
      <link rel="stylesheet" href="/css/painel.css" />
      <link rel="stylesheet" href="/css/painel-psicologo.css" />
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
            <div className="sidebar-tagline">Área do Psicólogo(a)</div>
          </div>
          <nav className="sidebar-nav" aria-label="Menu principal">
            <div className="nav-section">Menu</div>
            {NAV_ITEMS.map(([id, icon, label]) => (
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
                <span className="nav-label">{label}</span>
                {id === "atendimentos" && pending > 0 && (
                  <span className="nav-badge">{pending}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="user-avatar">
                {session.nome?.charAt(0)?.toUpperCase() || "P"}
              </div>
              <div className="user-details">
                <div className="user-name">
                  {session.nome || "Psicólogo(a)"}
                </div>
                <div className="user-role">Psicólogo(a)</div>
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
              <div className="topbar-page-title">
                {NAV_ITEMS.find(([id]) => id === activePanel)?.[2]}
              </div>
              <div className="topbar-breadcrumb">
                SAP · Psicólogo(a) · {session.unidade || "SENAC DF"}
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
                className="mobile-logout"
                onClick={logout}
                title="Sair"
                aria-label="Sair"
              >
                <Icon name="logout" />
              </button>
            </div>
          </header>
          <div className="page-body">{children}</div>
        </div>
      </div>
    </>
  );
}
