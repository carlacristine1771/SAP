import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { useSessionQuery } from "../api/panelQueries.ts";
import {
  backendRoleToFrontend,
  ROLE_ROUTES,
  unitCompatibilityId,
} from "../auth/session.ts";
import { useTheme } from "../hooks/useTheme.ts";

const PROFILES = {
  administrador: {
    label: "Administrador",
    subtitle: "Acesse a gestão completa do sistema",
    requiresUnit: false,
    color: "#1B4E9B",
  },
  psicologa: {
    label: "Psicólogo(a)",
    subtitle:
      "Selecione uma unidade cadastrada e entre com seu login individual",
    requiresUnit: true,
    color: "#0D2240",
  },
  coordenacao: {
    label: "Coordenação",
    subtitle:
      "Selecione uma unidade cadastrada e entre com seu login individual",
    requiresUnit: true,
    color: "#C87F00",
  },
  instrutor: {
    label: "Instrutor",
    subtitle:
      "Selecione uma unidade cadastrada e entre com seu login individual",
    requiresUnit: true,
    color: "#C87F00",
  },
};

const roleCards = [
  {
    role: "administrador",
    kicker: "Controle geral",
    name: "Administrador",
    cardClass: "card-admin",
    iconClass: "icon-admin",
    buttonClass: "btn-navy",
    description:
      "Controla acessos, unidades do Senac DF, logins por perfil e mantém cada unidade separada com seus próprios dados.",
   icon: (
  <>
    {/* Cabeça */}
    <path d="M9.3 4.3C7.4 4.3 5.9 5.8 5.9 7.7C5.9 9.6 7.4 11.1 9.3 11.1C11.2 11.1 12.7 9.6 12.7 7.7C12.7 5.8 11.2 4.3 9.3 4.3Z" />

    {/* Ombros/corpo */}
    <path d="M2.5 19.6C2.5 14.7 5.4 12.3 9.3 12.3C13.2 12.3 16.1 14.7 16.1 19.6" />

    {/* Engrenagem (badge de admin) */}
    <path d="M16.76 14.86L16.57 13.98L18.03 13.98L17.84 14.86L18.65 15.19L19.13 14.44L20.16 15.47L19.41 15.95L19.74 16.76L20.62 16.57L20.62 18.03L19.74 17.84L19.41 18.65L20.16 19.13L19.13 20.16L18.65 19.41L17.84 19.74L18.03 20.62L16.57 20.62L16.76 19.74L15.95 19.41L15.47 20.16L14.44 19.13L15.19 18.65L14.86 17.84L13.98 18.03L13.98 16.57L14.86 16.76L15.19 15.95L14.44 15.47L15.47 14.44L15.95 15.19Z" />
    <path d="M18.60 17.30A1.30 1.30 0 1 1 16.00 17.30A1.30 1.30 0 1 1 18.60 17.30Z" />
  </>
),
  },
  {
    role: "psicologa",
    kicker: "Atendimento",
    name: "Psicólogo(a)",
    cardClass: "card-psico",
    iconClass: "icon-psico",
    buttonClass: "btn-navy",
    description:
      "Gerencia todos os atendimentos, alunos, solicitações e se comunica com instrutores e coordenação.",
    icon: (
  <>
    {/* Coração */}
    <path d="M12 11.5C10.5 9.3 7 8.5 7 5.8A2.8 2.8 0 0 1 12 4.4a2.8 2.8 0 0 1 5 1.4c0 2.7-3.5 3.5-5 5.7z" />

    {/* Mão esquerda */}
    <path d="M2.5 14.5c2.2-.8 4.4-.4 6.2 1.1l1.8 1.5c.8.7 2 .7 2.8 0l.7-.7" />
    <path d="M2.5 14.5V19c2.4 1.7 5.1 2.5 7.9 2.5h1.1c1.5 0 2.9-.6 3.9-1.7l1.1-1.3" />

    {/* Mão direita */}
    <path d="M21.5 14.5c-2.2-.8-4.4-.4-6.2 1.1l-1.8 1.5c-.8.7-2 .7-2.8 0l-.7-.7" />
    <path d="M21.5 14.5V19c-2.4 1.7-5.1 2.5-7.9 2.5h-1.1c-1.5 0-2.9-.6-3.9-1.7l-1.1-1.3" />
  </>
),
  },
  {
    role: "coordenacao",
    kicker: "Gestão",
    name: "Coordenação",
    cardClass: "card-coord",
    iconClass: "icon-coord",
    buttonClass: "btn-orange",
    description:
      "Cadastra alunos, solicita atendimentos psicológicos e se comunica com a psicóloga pelo chat integrado.",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    role: "instrutor",
    kicker: "Sala de Aula",
    name: "Instrutor",
    cardClass: "card-coord",
    iconClass: "icon-inst",
    buttonClass: "btn-orange",
    description:
      "Registra alunos de sua turma, encaminha para atendimentos e acompanha o status dos atendimentos.",
    icon: (
  <>
    <path d="M3 5h18v12H3z" />
    <path d="M7 9h10M7 13h6" />
    <path d="M9 21h6M12 17v4" />
  </>
),
  },
];

const features = [
  [
    "Acesso seguro por perfil",
    "Cada usuário entra com login individual. Sem compartilhamento de credenciais entre áreas.",
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  ],
  [
    "Chat integrado",
    "Psicóloga, coordenação e instrutores se comunicam em tempo real dentro da plataforma.",
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  ],
  [
    "Agenda e calendário",
    "Visualize e gerencie atendimentos por mês, semana ou dia. Controle completo de disponibilidade.",
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>,
  ],
  [
    "Gestão de alunos",
    "Cadastro completo, histórico de atendimentos e acompanhamento por curso e unidade.",
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </>,
  ],
  [
    "Unidades personalizáveis",
    "Cadastre somente as unidades reais da instituição. O sistema não vem com dados de exemplo.",
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  ],
  [
    "Indicadores em tempo real",
    "Dashboard com estatísticas de solicitações, atendimentos realizados e alunos ativos.",
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  ],
];

const steps = [
  [
    "Solicitação",
    "Instrutor ou coordenador solicita atendimento para o aluno na plataforma.",
    "var(--navy)",
  ],
  [
    "Agendamento",
    "A psicóloga confirma o atendimento e define data e horário adequados ao turno do aluno.",
    "var(--orange)",
  ],
  [
    "Acompanhamento",
    "Instrutor e coordenação acompanham o status e a psicóloga registra as observações.",
    "var(--navy-mid)",
  ],
];

const iconBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
};

function ArrowIcon() {
  return (
    <svg {...iconBase} width="16" height="16" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ThemeButton({ theme, onToggle }) {
  return (
    <button
      className="btn-theme"
      onClick={onToggle}
      title="Alternar tema"
      aria-label="Alternar tema claro e escuro"
    >
      {theme === "dark" ? (
        <svg {...iconBase}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
        </svg>
      ) : (
        <svg {...iconBase}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function LoginModal({ profile, units, onClose, onSuccess }) {
  const config = PROFILES[profile];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [unitId, setUnitId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef(null);

  const submit = useCallback(
    async (event) => {
      event?.preventDefault();
      setError("");
      if (!username.trim() || !password)
        return setError("Preencha usuário e senha.");
      if (config.requiresUnit && !unitId)
        return setError("Selecione a unidade antes de entrar.");

      setSubmitting(true);
      try {
        const response = await api.post("/auth/login", {
          email: username.trim(),
          senha: password,
        });
        const actualRole = backendRoleToFrontend(response.tipoUsuario);
        if (actualRole !== profile) {
          await api.post("/auth/logout");
          return setError(
            `Este usuário existe, mas pertence ao perfil ${actualRole || "desconhecido"}. Entre pelo card correto.`,
          );
        }
        if (
          config.requiresUnit &&
          unitCompatibilityId(response.unidadeId) !== unitId
        ) {
          await api.post("/auth/logout");
          return setError(
            "Acesso negado: este usuário não pertence à unidade selecionada.",
          );
        }
        if (response.senhaTemporaria) {
          const nextPassword = window.prompt(
            "Este é seu primeiro acesso. Crie uma nova senha com pelo menos 6 caracteres:",
          );
          if (!nextPassword || nextPassword.length < 6)
            return setError("A nova senha deve ter pelo menos 6 caracteres.");
          await api.patch("/auth/change-password", {
            senhaAtual: password,
            novaSenha: nextPassword,
          });
        }
        localStorage.setItem("sap_token", response.token);
        onSuccess(actualRole);
      } catch (requestError) {
        setError(requestError.message || "Não foi possível entrar.");
      } finally {
        setSubmitting(false);
      }
    },
    [config.requiresUnit, onSuccess, password, profile, unitId, username],
  );

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [
        ...modalRef.current.querySelectorAll(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      id="modal-perfil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        display: "flex",
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(10,10,8,.55)",
        backdropFilter: "blur(6px)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: "var(--bg)",
          borderRadius: 24,
          padding: 40,
          maxWidth: 480,
          width: "90%",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/senasc.png"
              alt="Logo SENAC"
              style={{
                height: 42,
                width: "auto",
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            <h2
              id="modal-title"
              style={{
                fontFamily: "var(--serif)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {config.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-soft)",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg {...iconBase} width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form id="modal-body" onSubmit={submit}>
          <p
            style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}
          >
            {config.subtitle}
          </p>
          {error && (
            <div
              id="login-err"
              role="alert"
              style={{
                display: "block",
                padding: "10px 14px",
                background: "#fef0f0",
                border: "1px solid #f5c6c6",
                borderRadius: 8,
                color: "#c0392b",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}
          {config.requiresUnit && (
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="f-unidade"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-mid)",
                  marginBottom: 7,
                }}
              >
                Unidade *
              </label>
              <select
                id="f-unidade"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                style={inputStyle}
                autoFocus
              >
                <option value="">Selecione sua unidade...</option>
                {units.map((unit) => (
                  <option key={unit.id} value={`u${unit.id}`}>
                    {unit.nome} ({unit.endereco || "SENAC DF"})
                  </option>
                ))}
                {!units.length && (
                  <option value="" disabled>
                    Nenhuma unidade cadastrada. Entre como admin e cadastre uma
                    unidade.
                  </option>
                )}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="f-user" style={labelStyle}>
              Usuário *
            </label>
            <input
              id="f-user"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              style={inputStyle}
              placeholder="Seu usuário"
              autoComplete="username"
              autoFocus={!config.requiresUnit}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="f-pw" style={labelStyle}>
              Senha *
            </label>
            <input
              type="password"
              id="f-pw"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={inputStyle}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: 14,
              background: `linear-gradient(135deg,${config.color},${config.color}cc)`,
              color: "#fff",
              fontFamily: "var(--font)",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              borderRadius: 12,
              transition: "all .2s",
              boxShadow: "0 4px 18px rgba(0,0,0,.18)",
            }}
          >
            {submitting ? (
              "Entrando..."
            ) : (
              <>
                <span>Entrar no sistema</span>
                <ArrowIcon />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--ink-mid)",
  marginBottom: 7,
};
const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid var(--border)",
  borderRadius: 10,
  fontFamily: "var(--font)",
  fontSize: 14,
  color: "var(--ink)",
  background: "var(--bg)",
  outline: "none",
};

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const unitsQuery = useQuery({
    queryKey: ["public", "units"],
    queryFn: async () => {
      const data = await api.get("/unidades");
      return Array.isArray(data) ? data : [];
    },
  });
  const sessionQuery = useSessionQuery();
  const units = unitsQuery.data || [];

  useEffect(() => {
    document.title = "SAP SENAC DF — Sistema de Apoio Psicopedagógico";
    const requestedProfile = new URLSearchParams(window.location.search).get(
      "perfil",
    );
    if (PROFILES[requestedProfile]) {
      setProfile(requestedProfile);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

useEffect(() => {
  const token = localStorage.getItem("sap_token");
  const isLoggingOut =
    new URLSearchParams(window.location.search).get("logout") === "1";

  if (!token || isLoggingOut) return;

  const role = backendRoleToFrontend(sessionQuery.data?.tipoUsuario);

  if (role && ROLE_ROUTES[role]) {
    window.location.replace(ROLE_ROUTES[role]);
  }
}, [sessionQuery.data]);

  const closeModal = useCallback(() => setProfile(null), []);
  const completeLogin = useCallback((role) => {
    const target = ROLE_ROUTES[role];
    if (target) window.location.assign(target);
  }, []);

  return (
    <>
      <link rel="stylesheet" href="/css/index.css" />
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="topnav-logo">
            <img
              className="topnav-senac-svg"
              src="/senasc.png"
              alt="Logo do Senac"
            />
            <div>
              <div className="topnav-name">SENAC</div>
              <div className="topnav-sub">Distrito Federal</div>
            </div>
          </div>
          <div className="topnav-divider" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-soft)",
              letterSpacing: ".5px",
            }}
          >
            SAP
          </span>
        </div>
        <div className="topnav-links">
          <a className="topnav-link" href="#sobre">
            Sobre
          </a>
          <a className="topnav-link" href="#como-funciona">
            Como funciona
          </a>
          <ThemeButton theme={theme} onToggle={toggleTheme} />
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />
          <div className="hero-blob hero-blob-3" />
        </div>
        <div className="hero-inner">
          <div className="hero-logo-wrap">
            <img
              className="hero-logo-svg"
              src="/senasc.png"
              alt="Logo do Senac"
            />
          </div>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Sistema de Agendamento do SAP
          </div>
          <h1 className="hero-title">
            Cuidar começa com<em>quem se importa.</em>
          </h1>
          <p className="hero-title-line2">
            Plataforma institucional SENAC DF · Serviço Nacional de Aprendizagem
            Comercial
          </p>
          <p className="hero-desc">
            Instrutores e coordenadores encaminham alunos ao SAP (Serviço de
            Apoio Psicopedagógico), onde a psicóloga realiza o atendimento e
            acompanhamento com sigilo, agilidade e cuidado.
          </p>
        </div>
      </section>

      <section className="cards-section">
        <p className="cards-label">Acesso por perfil</p>
        <div className="cards-grid">
          {roleCards.map((card) => (
            <article className={`role-card ${card.cardClass}`} key={card.role}>
              <div className={`card-icon-wrap ${card.iconClass}`}>
                <svg {...iconBase}>{card.icon}</svg>
              </div>
              <div className="card-kicker">{card.kicker}</div>
              <div className="card-name">{card.name}</div>
              <div className="card-desc">{card.description}</div>
              <button
                className={`card-btn ${card.buttonClass}`}
                onClick={() => setProfile(card.role)}
              >
                Acessar painel <ArrowIcon />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="features" id="sobre">
        <div className="features-grid">
          {features.map(([title, description, icon]) => (
            <article className="feat-item" key={title}>
              <div className="feat-icon">
                <svg {...iconBase}>{icon}</svg>
              </div>
              <div className="feat-txt">
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="section"
        id="como-funciona"
        style={{ paddingBottom: 80 }}
      >
        <h2 className="section-title">Como funciona</h2>
        <p className="section-sub">
          Em apenas três passos simples, o aluno recebe o suporte psicológico
          que precisa.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 20,
            marginTop: 16,
          }}
        >
          {steps.map(([title, description, color], index) => (
            <article
              key={title}
              style={{
                textAlign: "center",
                padding: "28px 20px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 20,
              }}
            >
              <div
                className="step-num"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: color,
                  color: "#fff",
                  fontFamily: "var(--font)",
                  fontSize: 22,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                {index + 1}
              </div>
              <strong
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 6,
                }}
              >
                {title}
              </strong>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  lineHeight: 1.7,
                }}
              >
                {description}
              </span>
            </article>
          ))}
        </div>
      </section>

      <footer className="foot">
        © 2026 SENAC CEP · Taguatinga · Turma - 2025.08.179 - Instrutora Rayssa
        Paiva - Alunos: Carla, Kauã e João
      </footer>
      {profile && (
        <LoginModal
          key={profile}
          profile={profile}
          units={units}
          onClose={closeModal}
          onSuccess={completeLogin}
        />
      )}
    </>
  );
}
