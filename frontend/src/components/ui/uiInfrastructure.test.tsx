// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccessibleModal from "./AccessibleModal.tsx";
import { ToastRegion } from "./Feedback.tsx";
import AppErrorBoundary from "../system/AppErrorBoundary.tsx";

describe("infraestrutura acessível da interface", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("identifica o modal, move o foco e fecha com Escape", async () => {
    const close = vi.fn();
    await act(async () => {
      root.render(
        <AccessibleModal open title="Editar cadastro" onClose={close}>
          <input aria-label="Nome" />
          <button>Salvar</button>
        </AccessibleModal>,
      );
    });
    await act(
      async () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    expect(
      document
        .querySelector('[role="dialog"]')
        ?.getAttribute("aria-labelledby"),
    ).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Nome");
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("expõe mensagens transitórias para tecnologias assistivas", async () => {
    await act(async () => {
      root.render(
        <ToastRegion toasts={[{ id: 1, text: "Salvo", type: "success" }]} />,
      );
    });
    expect(
      document.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain("Salvo");
  });

  it("não apresenta violações estruturais no modal compartilhado", async () => {
    await act(async () => {
      root.render(
        <main>
          <h1>SAP</h1>
          <AccessibleModal open title="Novo evento" onClose={() => {}}>
            <label htmlFor="event-name">Nome</label>
            <input id="event-name" />
            <button>Salvar</button>
          </AccessibleModal>
        </main>,
      );
    });
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toHaveLength(0);
  });

  it("recupera a interface quando um componente falha ao renderizar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function BrokenComponent(): never {
      throw new Error("falha simulada");
    }
    await act(async () => {
      root.render(
        <AppErrorBoundary>
          <BrokenComponent />
        </AppErrorBoundary>,
      );
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "erro inesperado",
    );
    expect(document.querySelector("button")?.textContent).toContain(
      "Tentar novamente",
    );
  });
});
