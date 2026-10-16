import { expect, test, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:4186";
const unit = { id: 1, nome: "Unidade Ficticia A" };
const profiles = [
  {
    name: "geral",
    id: 1,
    tipoUsuario: "ADMINISTRADOR",
    unidadeId: null,
    route: "admin",
  },
  {
    name: "unidade",
    id: 2,
    tipoUsuario: "ADMIN_UNIDADE",
    unidadeId: 1,
    route: "admin",
  },
  {
    name: "coordenacao",
    id: 3,
    tipoUsuario: "COORDENACAO",
    unidadeId: 1,
    route: "coordenacao",
  },
  {
    name: "instrutor",
    id: 4,
    tipoUsuario: "INSTRUTOR",
    unidadeId: 1,
    route: "instrutor",
  },
  {
    name: "psicologo",
    id: 5,
    tipoUsuario: "PSICOLOGO",
    unidadeId: 1,
    route: "psicologo",
  },
];
type Profile = (typeof profiles)[number];

async function fixtures(page: Page, profile: Profile, rejectWrite = false) {
  await page.addInitScript(() =>
    localStorage.setItem("sap_token", "fictional-p0-token"),
  );
  const users = profiles.map((p) => ({
    ...p,
    nome: `Ficticio ${p.name}`,
    email: `${p.name}@example.invalid`,
    usuario: `ficticio-${p.name}`,
    ativo: true,
    unidade: p.unidadeId ? unit : null,
  }));
  users.push({
    ...users[3],
    id: 6,
    nome: "Instrutor Outra Unidade",
    unidade: { id: 2, nome: "Unidade Ficticia B" },
  });
  const directory = () =>
    profile.name === "unidade"
      ? users.filter((u) => u.unidade?.id === 1)
      : users;
  const messages: Record<string, unknown>[] = [];
  const writes: { method: string; path: string; body: any }[] = [];
  const unexpected: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const students = [
    {
      id: 1,
      nome: "Aluno Ficticio",
      ativo: true,
      unidadeId: 1,
      cursoId: 1,
      turmaId: 1,
      curso: "Curso Ficticio",
      turma: "Turma Ficticia",
      dataNascimento: "2007-05-10",
      turno: "MATUTINO",
    },
  ];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      // Fonts are declared by the existing CSS; serve an empty local response.
      if (url.origin === "https://fonts.googleapis.com")
        return route.fulfill({ contentType: "text/css", body: "" });
      unexpected.push(url.origin);
      return route.abort();
    }
    if (
      !["xhr", "fetch"].includes(request.resourceType()) ||
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/node_modules/") ||
      url.pathname.startsWith("/@")
    )
      return route.continue();
    const path = url.pathname;
    const method = request.method();
    if (method !== "GET") {
      const body = request.postData() ? request.postDataJSON() : null;
      writes.push({ method, path, body });
      if (path === "/auth/register" || /^\/usuarios\/\d+$/.test(path)) {
        if (rejectWrite)
          return route.fulfill({
            status: 403,
            json: {
              status: 403,
              message: "Sem permissão para gerenciar este usuário ou unidade.",
            },
          });
        expect(body.tipoUsuario).toBe("INSTRUTOR");
        expect(body.unidadeId).toBe(1);
        const saved = {
          ...body,
          id: method === "POST" ? 20 : Number(path.split("/").at(-1)),
          ativo: true,
          unidade: unit,
        };
        if (method === "POST") users.push(saved);
        else
          Object.assign(
            users.find((u) => u.id === saved.id)!,
            saved,
          );
        return route.fulfill({ json: saved });
      }
      if (path === "/chat/mensagens") {
        messages.push({
          ...body,
          id: messages.length + 1,
          remetenteId: profile.id,
          createdAt: "2026-10-16T12:00:00",
          lida: false,
        });
        return route.fulfill({ json: messages.at(-1) });
      }
      if (path.startsWith("/chat/mensagens/lidas/"))
        return route.fulfill({ status: 204 });
      unexpected.push(`${method} ${path}`);
      return route.abort();
    }
    const pages = (content: unknown[]) => ({
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: 1,
      first: true,
      last: true,
    });
    const responses: Record<string, unknown> = {
      "/auth/me": {
        ...profile,
        nome: `Ficticio ${profile.name}`,
        unidade: profile.unidadeId ? unit.nome : null,
        senhaTemporaria: false,
      },
      "/usuarios": directory(),
      "/unidades": [unit, { id: 2, nome: "Unidade Ficticia B" }],
      "/alunos": students,
      "/alunos/paginados": pages(students),
      "/atendimentos": [],
      "/atendimentos/paginados": pages([]),
      "/cursos": [{ id: 1, nome: "Curso Ficticio", unidadeId: 1 }],
      "/turmas": [
        {
          id: 1,
          nome: "Turma Ficticia",
          unidadeId: 1,
          cursoId: 1,
          turno: "MATUTINO",
          instrutorId: 4,
        },
      ],
      "/chat/mensagens": messages,
      "/agenda-eventos": [],
    };
    if (path in responses) return route.fulfill({ json: responses[path] });
    unexpected.push(`${method} ${path}`);
    return route.abort();
  });
  return { writes, unexpected, errors, users };
}

for (const profile of profiles) {
  test(`${profile.name}: painel, listagens, contatos e envio de chat`, async ({
    page,
  }) => {
    const api = await fixtures(page, profile);
    await page.goto(`/painel/${profile.route}`);
    await expect(page.locator(".topbar-page-title")).toBeVisible();
    if (profile.route === "admin") {
      await page.goto("/painel/admin/usuarios");
      await expect(
        page.getByRole("row").filter({ hasText: "Ficticio instrutor" }),
      ).toBeVisible();
      await page
        .getByPlaceholder("Filtrar por nome...")
        .fill("Ficticio instrutor");
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await page
        .locator("select")
        .filter({ has: page.locator('option[value="instrutor"]') })
        .selectOption("instrutor");
      await expect(page.locator("tbody tr")).toHaveCount(1);
    } else {
      await page.goto(`/painel/${profile.route}/alunos`);
      await expect(
        page.getByRole("row").filter({ hasText: "Aluno Ficticio" }),
      ).toBeVisible();
    }
    await page.goto(`/painel/${profile.route}/chat`);
    await page.getByRole("button", { name: "+ Nova" }).click();
    const options = page.locator(".chat-user-option");
    await expect(
      options.filter({ hasText: `Ficticio ${profile.name}` }),
    ).toHaveCount(0);
    await expect(
      options.filter({ hasText: "Instrutor Outra Unidade" }),
    ).toHaveCount(profile.name === "geral" ? 1 : 0);
    if (["coordenacao", "instrutor", "psicologo"].includes(profile.name))
      await expect(options.filter({ hasText: "Ficticio geral" })).toBeVisible();
    const contact =
      profile.name === "instrutor"
        ? "Ficticio coordenacao"
        : "Ficticio instrutor";
    await page.getByRole("textbox", { name: "Buscar usuário" }).fill(contact);
    await expect(options).toHaveCount(1);
    await options.click();
    await expect(page.locator(".chat-current-info strong")).toHaveText(contact);
    await page
      .getByRole("textbox", { name: "Mensagem", exact: true })
      .fill("Mensagem ficticia P0");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.locator(".chat-bubble")).toHaveText(
      "Mensagem ficticia P0",
    );
    expect(
      api.writes.some((w) => w.path.startsWith("/chat/mensagens/lidas/")),
    ).toBe(true);
    expect(api.errors).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });
}

test("coordenacao: cadastra, edita instrutor e preserva seletor de turma", async ({
  page,
}) => {
  const api = await fixtures(page, profiles[2]);
  api.users.push(
    { ...api.users[3], id: 7, nome: "Inativo Ficticio", ativo: false },
    {
      ...api.users[3],
      id: 8,
      nome: "Sem Unidade Ficticio",
      unidade: null as any,
    },
  );
  await page.goto("/painel/coordenacao/instrutores");
  await expect(
    page.getByRole("row").filter({ hasText: "Ficticio instrutor" }),
  ).toBeVisible();
  await expect(
    page.getByText("Instrutor Outra Unidade", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Novo Instrutor" }).click();
  await page.getByPlaceholder("Nome completo").fill("Novo Instrutor Ficticio");
  await page.getByPlaceholder("Usuário/login").fill("novo-ficticio");
  await page
    .getByPlaceholder("E-mail", { exact: true })
    .fill("novo@example.invalid");
  await page.getByPlaceholder("Senha inicial").fill("fictional-password");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Novo Instrutor Ficticio" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Editar" }).click();
  await page
    .getByPlaceholder("Nome completo")
    .fill("Instrutor Editado Ficticio");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Instrutor Editado Ficticio" }),
  ).toBeVisible();
  expect(api.writes.find((w) => w.method === "PUT")?.body.senha).toBeNull();
  await page
    .getByRole("row")
    .filter({ hasText: "Instrutor Editado Ficticio" })
    .getByRole("button", { name: "Editar" })
    .click();
  await page.getByPlaceholder("Nova senha (opcional)").fill("fictional-reset");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.filter((w) => w.method === "PUT").at(-1)?.body.senha).toBe(
    "fictional-reset",
  );
  await page.goto("/painel/coordenacao/cursos");
  await page.getByRole("button", { name: "Criar turma" }).click();
  const selector = page
    .locator("select")
    .filter({ has: page.locator('option[value="20"]') });
  await expect(selector.locator("option")).toHaveText([
    "Sem instrutor",
    "Ficticio instrutor",
    "Instrutor Editado Ficticio",
  ]);
  await selector.selectOption("20");
  await expect(selector).toHaveValue("20");
  expect(api.errors).toEqual([]);
  expect(api.unexpected).toEqual([]);
});

test("coordenacao: edicao de turma oferece apenas instrutores ativos da propria unidade", async ({
  page,
}) => {
  const api = await fixtures(page, profiles[2]);
  api.users.push(
    { ...api.users[3], id: 7, nome: "Inativo Ficticio", ativo: false },
    {
      ...api.users[3],
      id: 8,
      nome: "Sem Unidade Ficticio",
      unidade: null as any,
    },
  );
  await page.goto("/painel/coordenacao/cursos");
  await page
    .getByRole("row")
    .filter({ hasText: "Turma Ficticia" })
    .getByRole("button", { name: "Editar" })
    .click();
  const selector = page
    .locator("select")
    .filter({ has: page.locator('option[value="4"]') });
  await expect(selector.locator("option")).toHaveText([
    "Sem instrutor",
    "Ficticio instrutor",
  ]);
  await expect(selector).toHaveValue("4");
  await selector.selectOption("");
  await expect(selector).toHaveValue("");
  expect(api.errors).toEqual([]);
  expect(api.unexpected).toEqual([]);
});

test("coordenacao sem unidade: seletor nao oferece instrutores do diretorio", async ({
  page,
}) => {
  const api = await fixtures(page, { ...profiles[2], unidadeId: null });
  await page.goto("/painel/coordenacao/cursos");
  await page.getByRole("button", { name: "Criar turma" }).click();
  const selector = page
    .locator("select")
    .filter({
      has: page.locator('option[value=""]', { hasText: "Sem instrutor" }),
    });
  await expect(selector.locator("option")).toHaveText(["Sem instrutor"]);
  expect(api.errors).toEqual([]);
  expect(api.unexpected).toEqual([]);
});

test("coordenacao: exibe erro 403 e conserva formulario e lista", async ({
  page,
}) => {
  const api = await fixtures(page, profiles[2], true);
  const before = JSON.stringify(api.users);
  await page.goto("/painel/coordenacao/instrutores");
  await page
    .getByRole("row")
    .filter({ hasText: "Ficticio instrutor" })
    .getByRole("button", { name: "Editar" })
    .click();
  await page
    .getByPlaceholder("Nome completo")
    .fill("Alteracao Negada Ficticia");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Sem permissão para gerenciar este usuário ou unidade.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Nome completo")).toHaveValue(
    "Alteracao Negada Ficticia",
  );
  expect(JSON.stringify(api.users)).toBe(before);
  expect(api.errors).toEqual([]);
  expect(api.unexpected).toEqual([]);
});
