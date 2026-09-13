import { API_BASE_URL } from "../config/runtime.ts";
import type { ApiErrorBody } from "../types/domain.ts";

export class ApiError extends Error {
  status: number;
  data: ApiErrorBody | null;

  constructor(message: string, status: number, data: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function parseResponse(text: string): ApiErrorBody | unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function errorMessage(data: ApiErrorBody | null, status: number): string {
  if (data?.message) return data.message;
  if (data?.messages) return Object.values(data.messages).join(" | ");
  if (data?.error) return data.error;
  if (status === 401) return "Usuário ou senha incorretos.";
  return `Erro HTTP ${status}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const parsed = parseResponse(await response.text());
  if (!response.ok) {
    const body =
      parsed && typeof parsed === "object" ? (parsed as ApiErrorBody) : null;
    throw new ApiError(
      errorMessage(body, response.status),
      response.status,
      body,
    );
  }
  return parsed as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiRequest<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) =>
    apiRequest<T>(path, { method: "DELETE" }),
};
