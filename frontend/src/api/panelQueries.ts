import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.ts";
import { queryKeys } from "./queryClient.ts";
import type { Session } from "../types/domain.ts";

export function useSessionQuery() {
  const token = localStorage.getItem("sap_token");

  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => api.get<Session>("/auth/me"),
    enabled: Boolean(token),
    retry: false,
  });
}

export function usePanelQuery<T>(
  name: string,
  enabled: boolean,
  queryFn: () => Promise<T>,
) {
  return useQuery({ queryKey: queryKeys.panel(name), queryFn, enabled });
}

export function usePanelMutation(name: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["panel-mutation", name],
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.panel(name) }),
        client.invalidateQueries({ queryKey: ["paginated-panel"] }),
      ]),
  });
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export function usePaginatedPanelQuery<T>(
  resource: "alunos" | "atendimentos",
  page: number,
  search: string,
  status = "",
) {
  return useQuery({
    queryKey: ["paginated-panel", resource, page, search.trim(), status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        size: "20",
        busca: search.trim(),
      });
      if (status) params.set("status", status);
      const response = await api.get<PageResponse<T> | T[]>(
        `/${resource}/paginados?${params}`,
      );
      if (!Array.isArray(response)) return response;
      return {
        content: response,
        page: 0,
        size: response.length,
        totalElements: response.length,
        totalPages: response.length ? 1 : 0,
        first: true,
        last: true,
      } satisfies PageResponse<T>;
    },
    placeholderData: (previous) => previous,
  });
}
