import type { FrontendRole } from "../types/domain.ts";

export const ROLE_ROUTES: Record<FrontendRole, string> = {
  administrador: "/painel/admin",
  psicologa: "/painel/psicologo",
  coordenacao: "/painel/coordenacao",
  instrutor: "/painel/instrutor",
};

export function backendRoleToFrontend(role: unknown): FrontendRole | "" {
  switch (String(role || "").toUpperCase()) {
    case "ADMINISTRADOR":
    case "ADMIN_UNIDADE":
      return "administrador";
    case "PSICOLOGO":
      return "psicologa";
    case "COORDENACAO":
      return "coordenacao";
    case "INSTRUTOR":
      return "instrutor";
    default:
      return "";
  }
}

export function unitCompatibilityId(id: unknown): string | null {
  return id ? `u${id}` : null;
}
