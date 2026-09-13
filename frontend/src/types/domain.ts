export type FrontendRole =
  "administrador" | "psicologa" | "coordenacao" | "instrutor";
export type BackendRole =
  "ADMINISTRADOR" | "ADMIN_UNIDADE" | "PSICOLOGO" | "COORDENACAO" | "INSTRUTOR";

export interface UnitSummary {
  id: number;
  nome: string;
  endereco?: string;
}

export interface Session {
  id: number;
  nome: string;
  email?: string;
  usuario?: string;
  tipoUsuario: BackendRole;
  unidadeId?: number | null;
  unidade?: string;
}

export interface ApiErrorBody {
  message?: string;
  messages?: Record<string, string>;
  error?: string;
}

export interface ToastMessage {
  id: number;
  text: string;
  type: "info" | "success" | "error" | "warning" | string;
}
