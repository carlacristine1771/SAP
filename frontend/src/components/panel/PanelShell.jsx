import { useEffect } from "react";
import { useTheme } from "../../hooks/useTheme.ts";
import Icon from "./Icon.jsx";

export default function PanelShell({
  session,
  activePanel,
  onNavigate,
  children,
}) {
  const { theme, toggleTheme } = useTheme();
  const adminUnit = Boolean(session?.unidadeId);
  const unitName =
    session?.unidade || (adminUnit ? "Unidade vinculada" : "SENAC DF");
  const panelTitles = {
    dashboard: "Dashboard",
    unidades: "Unidades",
    usuarios: "Usuários",
    chat: "Chat",
    criar: "Criar Login",
  };
  const navItems = [
    ["dashboard", "dashboard", "Dashboard"],
    ...(!adminUnit ? [["unidades", "home", "Unidades"]] : []),
    ["usuarios", "user", "Usuários"],
    ["chat", "chat", "Chat"],
    ["criar", "addUser", "Criar Login"],
  ];

  useEffect(() => {
    document.title = "Painel Administrador — SAP SENAC DF";
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

  const logout = (event) => {
    event.preventDefault();
    event.stopPropagation();

    localStorage.removeItem("sap_token");
    window.location.replace("/?logout=1");
 };

  return (
    <>
      <link rel="stylesheet" href="/css/global.css" />
      <link rel="stylesheet" href="/css/painel.css" />
      <link rel="stylesheet" href="/css/painel-admin.css" />
      <div className="app-shell">
        <aside className="sidebar sidebar-admin" id="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-top">
              <img
                src="/senasc.png"
                className="senac-logo-img"
                alt="SENAC DF"
              />
              <div className="sidebar-senac-text">
                <div className="sidebar-senac-name">SENAC</div>
                <div className="sidebar-senac-sub">DF</div>
              </div>
            </div>
            <div className="sidebar-tagline">Administrador</div>
          </div>
          <nav className="sidebar-nav" aria-label="Menu principal">
            <div className="nav-section">Menu</div>
            {navItems.map(([id, icon, label]) => (
              <button
                type="button"
                className={`nav-link${activePanel === id ? " active" : ""}`}
                onClick={() => onNavigate(id)}
                key={id}
                style={{
                  width: "100%",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span className="nav-icon">
                  <Icon name={icon} strokeWidth={1.8} />
                </span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div
                className="user-avatar"
                style={{
                  background: "linear-gradient(135deg,#2d7ff9,#1B4E9B)",
                }}
              >
                {session?.nome?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div className="user-details">
                <div className="user-name">{session?.nome || "Admin"}</div>
                <div className="user-role">{unitName}</div>
              </div>
              <button
                type="button"
                className="btn-logout"
                onClick={logout}
                title="Sair"
                aria-label="Sair"
              >
                <Icon name="logout" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-page-title">
                {panelTitles[activePanel]}
              </div>
              <div className="topbar-breadcrumb">
                SAP · Administrador · {unitName}
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
                <Icon name="logout" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "linear-gradient(135deg,#2d7ff9,#1B4E9B)",
                  color: "#fff",
                  border: "none",
                }}
                onClick={() => onNavigate("criar")}
              >
                <Icon name="plus" strokeWidth={2.2} />
                Novo Usuário
              </button>
            </div>
          </header>
          <div className="page-body">{children}</div>
        </div>
      </div>
    </>
  );
}
