// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperationalPage from "./OperationalPage.jsx";
import PsychologistPage from "./PsychologistPage.jsx";
import AdminPage from "./AdminPage.jsx";

const emptyEndpoints = {
  "/alunos": [],
  "/atendimentos": [],
  "/cursos": [],
  "/turmas": [],
  "/usuarios": [],
  "/chat/mensagens": [],
  "/agenda-eventos": [],
};
let queryClient;

function mockApi(role) {
  globalThis.fetch = vi.fn(async (input) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const body =
      path === "/auth/me"
        ? {
            id: 10,
            nome: "Usuário de Teste",
            tipoUsuario: role,
            unidadeId: role === "ADMINISTRADOR" ? null : 1,
            unidade: role === "ADMINISTRADOR" ? null : "Unidade Teste",
          }
        : (emptyEndpoints[path] ?? []);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
    );
  });
  await waitFor(() =>
    expect(container.querySelector(".app-shell")).toBeTruthy(),
  );
  return { container, root };
}

async function clickMenu(label) {
  const button = [...document.querySelectorAll(".nav-link")].find((item) =>
    item.textContent.includes(label),
  );
  expect(button, `item de menu ${label}`).toBeTruthy();
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function expectNoStructuralAccessibilityViolations(container) {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toHaveLength(0);
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  HTMLCanvasElement.prototype.getContext = () =>
    new Proxy(
      {},
      { get: (target, property) => target[property] || (() => {}) },
    );
  window.scrollTo = vi.fn();
});

afterEach(() => {
  queryClient.clear();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

describe("painéis React nativos", () => {
  it("renderiza e navega no painel de Administração", async () => {
    mockApi("ADMINISTRADOR");
    const { container, root } = await render(<AdminPage />);
    await expectNoStructuralAccessibilityViolations(container);
    for (const label of ["Unidades", "Usuários", "Criar Login", "Chat"])
      await clickMenu(label);
    expect(document.querySelector(".topbar-page-title").textContent).toBe(
      "Chat",
    );
    await act(async () => root.unmount());
  });

  it("renderiza e navega no painel da Coordenação sem scripts legados", async () => {
    mockApi("COORDENACAO");
    const { container, root } = await render(
      <OperationalPage profile="coordenacao" />,
    );
    await expectNoStructuralAccessibilityViolations(container);
    for (const label of [
      "Alunos",
      "Encaminhar Aluno",
      "Cursos e Turmas",
      "Instrutores",
      "Atendimentos",
      "Chat",
    ])
      await clickMenu(label);
    expect(document.querySelector(".topbar-page-title").textContent).toBe(
      "Chat",
    );
    expect(
      document.querySelectorAll('script[src*="painel-coordenacao.js"]'),
    ).toHaveLength(0);
    await act(async () => root.unmount());
  });

  it("renderiza e navega no painel do Instrutor", async () => {
    mockApi("INSTRUTOR");
    const { container, root } = await render(
      <OperationalPage profile="instrutor" />,
    );
    await expectNoStructuralAccessibilityViolations(container);
    for (const label of ["Alunos", "Encaminhar Aluno", "Atendimentos", "Chat"])
      await clickMenu(label);
    expect(document.querySelector(".topbar-page-title").textContent).toBe(
      "Chat",
    );
    await act(async () => root.unmount());
  });

  it("renderiza todos os módulos do painel de Psicologia sem controlador legado", async () => {
    mockApi("PSICOLOGO");
    const { container, root } = await render(<PsychologistPage />);
    await expectNoStructuralAccessibilityViolations(container);
    for (const label of ["Indicativos", "Histórico", "Atendimentos", "Alunos"])
      await clickMenu(label);
    await clickMenu("Calendário");
    const calendarTab = (label) =>
      [...document.querySelectorAll(".tab-btn")].find(
        (item) => item.textContent.trim() === label,
      );
    expect(calendarTab("Mês")).toBeTruthy();
    await act(async () => calendarTab("Semana").click());
    expect(document.querySelector(".cal-week-grid")).toBeTruthy();
    await act(async () => calendarTab("Dia").click());
    expect(document.querySelector(".cal-day-agenda")).toBeTruthy();
    await clickMenu("Chat");
    expect(document.querySelector(".topbar-page-title").textContent).toBe(
      "Chat",
    );
    expect(
      document.querySelectorAll('script[src*="painel-psicologo.js"]'),
    ).toHaveLength(0);
    await act(async () => root.unmount());
  });
});
