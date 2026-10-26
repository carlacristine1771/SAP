// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage.jsx";

// All data below is fictional.
const units = [
  { id: 7, nome: "Unidade Fictícia Norte", endereco: "Endereço fictício" },
  { id: 8, nome: "Unidade Fictícia Sul", endereco: "Endereço fictício" },
];
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let fetchMock;

function unitsRequests() {
  return fetchMock.mock.calls.filter(([input]) =>
    new URL(String(input)).pathname.endsWith("/unidades"),
  );
}

function renderLanding() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LandingPage />
    </QueryClientProvider>,
  );
}

async function openInstructorLogin(user) {
  const card = screen
    .getByText("Instrutor", { selector: ".card-name" })
    .closest("article");
  await user.click(card.querySelector("button"));
  const select = document.getElementById("f-unidade");
  await waitFor(() =>
    expect(
      [...select.options].map((option) => option.textContent),
    ).toContain("Unidade Fictícia Norte (Endereço fictício)"),
  );
  return select;
}

beforeEach(() => {
  localStorage.clear();
  // A session left in the browser: expired token in localStorage.
  localStorage.setItem("sap_token", "expired-fictional-token");
  fetchMock = vi.fn(async (input, init = {}) => {
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init.headers);
    if (path === "/unidades") {
      // Behaves like a backend that processes any credential it receives.
      if (headers.has("Authorization") || init.credentials !== "omit") {
        return json({ message: "Sessão expirada. Entre novamente." }, 401);
      }
      return json(units);
    }
    if (path === "/auth/me") {
      return json({ message: "Sessão expirada. Entre novamente." }, 401);
    }
    if (path === "/auth/login") {
      return json({
        token: "new-fictional-token",
        id: 30,
        nome: "Instrutor Fictício",
        tipoUsuario: "INSTRUTOR",
        unidadeId: 7,
        senhaTemporaria: false,
      });
    }
    if (path === "/auth/logout") return new Response(null, { status: 204 });
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  // jsdom does not implement navigation after a successful login.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("login screen with a stale browser session", () => {
  it("loads the public unit list without sending the stored token or cookies", async () => {
    const user = userEvent.setup();
    renderLanding();
    const select = await openInstructorLogin(user);

    expect([...select.options].map((option) => option.value)).toEqual(
      expect.arrayContaining(["u7", "u8"]),
    );
    expect(screen.queryByText(/Nenhuma unidade cadastrada/)).toBeNull();
    expect(unitsRequests().length).toBeGreaterThan(0);
    for (const [, init] of unitsRequests()) {
      expect(new Headers(init.headers).has("Authorization")).toBe(false);
      expect(init.credentials).toBe("omit");
    }
  });

  it("lets the user select the correct unit and sign in", async () => {
    const user = userEvent.setup();
    renderLanding();
    const select = await openInstructorLogin(user);

    await user.selectOptions(select, "u7");
    expect(select.value).toBe("u7");
    await user.type(document.getElementById("f-user"), "instrutor.ficticio");
    await user.type(document.getElementById("f-pw"), "fictional-test");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() =>
      expect(localStorage.getItem("sap_token")).toBe("new-fictional-token"),
    );
    expect(screen.queryByText(/Selecione a unidade/)).toBeNull();
    expect(screen.queryByText(/não pertence à unidade/)).toBeNull();
  });

  it("still rejects a unit the user does not belong to", async () => {
    const user = userEvent.setup();
    renderLanding();
    const select = await openInstructorLogin(user);

    await user.selectOptions(select, "u8");
    await user.type(document.getElementById("f-user"), "instrutor.ficticio");
    await user.type(document.getElementById("f-pw"), "fictional-test");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/não pertence à unidade selecionada/),
    ).toBeTruthy();
    expect(localStorage.getItem("sap_token")).toBeNull();
  });

  it("keeps sending the stored token to private endpoints", async () => {
    renderLanding();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).endsWith("/auth/me"),
        ),
      ).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/auth/me"),
    );
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer expired-fictional-token",
    );
    expect(init.credentials).toBe("include");
  });
});
