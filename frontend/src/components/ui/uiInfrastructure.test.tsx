// @vitest-environment jsdom
import { act, StrictMode, useState } from "react";
import userEvent from "@testing-library/user-event";
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

  it("mantém o foco na nova senha e usa o callback atual ao fechar", async () => {
    const close = vi.fn();
    function Form() {
      const [password, setPassword] = useState("");
      return (
        <AccessibleModal
          open
          title="Editar usuário"
          onClose={() => close(password)}
        >
          <input aria-label="Nome" />
          <input
            aria-label="Nova senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </AccessibleModal>
      );
    }
    await act(async () =>
      root.render(
        <StrictMode>
          <Form />
        </StrictMode>,
      ),
    );
    await act(
      async () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    const password = container.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    await act(async () =>
      userEvent.setup({ delay: 20 }).type(password, "senha de teste"),
    );
    await act(
      async () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    expect(password.value).toBe("senha de teste");
    expect(document.activeElement).toBe(password);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(close).toHaveBeenCalledExactlyOnceWith("senha de teste");
  });

  it("respeita o campo selecionado antes de executar o foco inicial", async () => {
    let focusFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      focusFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    await act(async () =>
      root.render(
        <AccessibleModal open title="Editar usuário" onClose={() => {}}>
          <input aria-label="Nome" />
          <input aria-label="Nova senha" type="password" />
        </AccessibleModal>,
      ),
    );
    const password = container.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    password.focus();
    await act(async () => focusFrame!(0));
    expect(document.activeElement).toBe(password);
  });

  it("cancela o foco pendente ao fechar e restaura o botão de abertura", async () => {
    const pending = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pending.set(++frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      pending.delete(id);
    });
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const draw = (open: boolean) =>
      root.render(
        <StrictMode>
          <AccessibleModal
            open={open}
            title="Editar usuário"
            onClose={() => {}}
          >
            <input aria-label="Nome" />
          </AccessibleModal>
        </StrictMode>,
      );
    await act(async () => draw(true));
    expect(pending.size).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => draw(false));
    expect(pending.size).toBe(0);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
    await act(async () => draw(true));
    await act(async () => {
      for (const callback of pending.values()) callback(0);
      pending.clear();
    });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Nome");
    await act(async () => draw(false));
    expect(document.activeElement).toBe(opener);
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
