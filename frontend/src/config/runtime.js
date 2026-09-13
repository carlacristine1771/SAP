export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function configureLegacyRuntime() {
  if (API_BASE_URL) window.SAP_API_BASE = API_BASE_URL;
  else delete window.SAP_API_BASE;
}
