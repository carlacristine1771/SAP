import { useQuery } from "@tanstack/react-query";
import { api } from "./client.ts";
import { queryKeys } from "./queryClient.ts";
import type { Session } from "../types/domain.ts";

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => api.get<Session>("/auth/me"),
  });
}

export function usePanelQuery<T>(
  name: string,
  enabled: boolean,
  queryFn: () => Promise<T>,
) {
  return useQuery({ queryKey: queryKeys.panel(name), queryFn, enabled });
}
