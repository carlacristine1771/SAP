import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client.ts";
import { queryClient } from "./queryClient.ts";

describe("cache e cliente da API", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("reutiliza dados ainda válidos sem repetir a requisição", async () => {
    const queryFn = vi.fn().mockResolvedValue({ nome: "SAP" });
    const options = { queryKey: ["test", "cache"] as const, queryFn };
    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("converte respostas inválidas do backend em erro tipado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Dados inválidos" }), {
          status: 422,
        }),
      ),
    );
    await expect(api.get("/teste")).rejects.toMatchObject<ApiError>({
      name: "ApiError",
      status: 422,
      message: "Dados inválidos",
      data: { message: "Dados inválidos" },
    });
  });
});
