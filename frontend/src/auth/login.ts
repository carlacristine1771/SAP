import { api } from "../api/client.ts";
import type { Session } from "../types/domain.ts";

interface LoginResponse extends Session {
  token: string;
  senhaTemporaria?: boolean;
}

// Keep the new token in memory until every first-access step succeeds.
export async function login(
  email: string,
  senha: string,
  validateSession: (session: LoginResponse) => void,
  requestPassword: () => string | null,
): Promise<LoginResponse> {
  localStorage.removeItem("sap_token");
  try {
    const session = await api.post<LoginResponse>("/auth/login", {
      email,
      senha,
    });
    if (!session.token) throw new Error("Não foi possível iniciar a sessão.");
    validateSession(session);
    if (session.senhaTemporaria) {
      const novaSenha = requestPassword();
      if (!novaSenha || novaSenha.length < 6) {
        throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
      }
      await api.patch(
        "/auth/change-password",
        { senhaAtual: senha, novaSenha },
        {
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );
    }
    localStorage.setItem("sap_token", session.token);
    return session;
  } catch (error) {
    localStorage.removeItem("sap_token");
    // Login sets HttpOnly cookies too; clear them on cancellation or failure.
    // A failed cleanup must not hide the original error.
    try {
      await api.post("/auth/logout", {});
    } catch {
      /* best effort */
    }
    throw error;
  }
}
