// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiRequest } from "../api/client.ts";
import { login } from "./login.ts";

const session = {
  token: "new-fictional-token",
  id: 1,
  nome: "Teste",
  tipoUsuario: "ADMINISTRADOR",
  senhaTemporaria: true,
};
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(() => {
    throw new Error("Unexpected request: this test must mock every response");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("first access authentication", () => {
  it("clears the session when the backend rejects reuse of the temporary password", async () => {
    const message =
      "A nova senha deve ser diferente da senha temporária atual.";
    fetchMock
      .mockResolvedValueOnce(ok(session))
      .mockResolvedValueOnce(ok({ message }, 400))
      .mockResolvedValueOnce(ok({}));

    await expect(
      login(
        "test@example.invalid",
        "temporary-test",
        () => {},
        () => "temporary-test",
      ),
    ).rejects.toThrow(message);

    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      senhaAtual: "temporary-test",
      novaSenha: "temporary-test",
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("Authorization"),
    ).toBe(`Bearer ${session.token}`);
    expect(localStorage.getItem("sap_token")).toBeNull();
    expect(fetchMock.mock.calls[2][0]).toMatch(/auth\/logout$/);
  });

  it("changes password with the new token and supports the next login", async () => {
    localStorage.setItem("sap_token", "previous-fictional-token");
    let password = "temporary-test";
    let temporary = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url.endsWith("/auth/logout")) return ok({});
      if (url.endsWith("/auth/login")) {
        expect(body.senha).toBe(password);
        expect(new Headers(options.headers).has("Authorization")).toBe(false);
        return ok({ ...session, senhaTemporaria: temporary });
      }
      expect(url.endsWith("/auth/change-password")).toBe(true);
      expect(new Headers(options.headers).get("Authorization")).toBe(
        `Bearer ${session.token}`,
      );
      expect(localStorage.getItem("sap_token")).toBeNull();
      expect(body.senhaAtual).toBe(password);
      password = body.novaSenha;
      temporary = false;
      return ok("Senha alterada com sucesso");
    });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const prompt = vi.fn(() => "new-password-test");
    await login("test@example.invalid", password, () => {}, prompt);
    expect(writes).toHaveBeenCalledExactlyOnceWith("sap_token", session.token);
    await api.post("/auth/logout", {});
    fetchMock.mockClear();
    await login("test@example.invalid", password, () => {}, prompt);
    expect(prompt).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("honors an explicit bearer even when an old session exists", async () => {
    localStorage.setItem("sap_token", "old-token");
    fetchMock.mockImplementation(async () => ok({}));
    await apiRequest("/auth/change-password", {
      headers: { Authorization: "Bearer explicit-token" },
    });
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer explicit-token");
    await api.get("/auth/me");
    expect(
      new Headers(fetchMock.mock.calls[1][1].headers).get("Authorization"),
    ).toBe("Bearer old-token");
  });

  it.each([null, "", "short", "      "])(
    "clears session when password is cancelled or invalid: %s",
    async (password) => {
      localStorage.setItem("sap_token", "old-token");
      fetchMock
        .mockResolvedValueOnce(ok(session))
        .mockResolvedValueOnce(ok({}));
      await expect(
        login(
          "test@example.invalid",
          "temporary-test",
          () => {},
          () => password,
        ),
      ).rejects.toThrow("6 caracteres");
      expect(localStorage.getItem("sap_token")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toMatch(/auth\/logout$/);
    },
  );

  it.each([400, 401, 500])(
    "cleans up after password change fails with %s",
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(ok(session))
        .mockResolvedValueOnce(ok({ message: "Change failed" }, status))
        .mockResolvedValueOnce(ok({}));
      await expect(
        login(
          "test@example.invalid",
          "temporary-test",
          () => {},
          () => "new-password-test",
        ),
      ).rejects.toThrow("Change failed");
      expect(localStorage.getItem("sap_token")).toBeNull();
      expect(fetchMock.mock.calls[2][0]).toMatch(/auth\/logout$/);
    },
  );

  it("preserves network errors even if logout also fails", async () => {
    fetchMock
      .mockResolvedValueOnce(ok(session))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockRejectedValueOnce(new Error("Cleanup failed"));
    await expect(
      login(
        "test@example.invalid",
        "temporary-test",
        () => {},
        () => "new-password-test",
      ),
    ).rejects.toThrow("Offline");
    expect(localStorage.getItem("sap_token")).toBeNull();
  });

  it("does not persist a token after invalid credentials", async () => {
    localStorage.setItem("sap_token", "old-token");
    fetchMock
      .mockResolvedValueOnce(ok({ message: "Invalid credentials" }, 401))
      .mockResolvedValueOnce(ok({}));
    await expect(
      login(
        "test@example.invalid",
        "wrong-test",
        () => {},
        () => null,
      ),
    ).rejects.toThrow("Invalid credentials");
    expect(localStorage.getItem("sap_token")).toBeNull();
  });

  it("rejects a response without a token", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ ...session, token: undefined }))
      .mockResolvedValueOnce(ok({}));
    await expect(
      login(
        "test@example.invalid",
        "temporary-test",
        () => {},
        () => null,
      ),
    ).rejects.toThrow();
    expect(localStorage.getItem("sap_token")).toBeNull();
  });

  it.each(["profile", "unit"])(
    "cleans up after a %s mismatch",
    async (reason) => {
      fetchMock
        .mockResolvedValueOnce(ok(session))
        .mockResolvedValueOnce(ok({}));
      const prompt = vi.fn();
      await expect(
        login(
          "test@example.invalid",
          "temporary-test",
          () => {
            throw new Error(reason);
          },
          prompt,
        ),
      ).rejects.toThrow(reason);
      expect(prompt).not.toHaveBeenCalled();
      expect(localStorage.getItem("sap_token")).toBeNull();
      expect(fetchMock.mock.calls[1][0]).toMatch(/auth\/logout$/);
    },
  );

  it.each([false, undefined])(
    "keeps established accounts working (temporary flag: %s)",
    async (flag) => {
      fetchMock.mockResolvedValueOnce(
        ok({ ...session, senhaTemporaria: flag }),
      );
      const prompt = vi.fn();
      await login(
        "test@example.invalid",
        "existing-password-test",
        () => {},
        prompt,
      );
      expect(prompt).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(localStorage.getItem("sap_token")).toBe(session.token);
    },
  );
});
