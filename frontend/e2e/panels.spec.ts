import { expect, test, type Page } from "@playwright/test";

const students = [
  {
    id: 1,
    nome: "Ana Souza",
    cpf: "123.456.789-00",
    dataNascimento: "2007-05-10",
    telefone: "(61) 99999-1111",
    ativo: true,
    unidadeId: 1,
    cursoId: 1,
    turmaId: 1,
    curso: "Técnico em Administração",
    turma: "ADM 2026",
    turno: "MATUTINO",
  },
];
const appointments = [
  {
    id: 11,
    alunoId: 1,
    aluno: "Ana Souza",
    descricao: "Acompanhamento acadêmico",
    dataAtendimento: "2027-09-14T09:30:00",
    tipoAtendimento: "dentro",
    solicitante: "Coordenação",
    psicologo: "Marina",
    status: "PENDENTE",
  },
];
const pageResponse = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  first: true,
  last: true,
});

async function mockApi(page: Page, role: "PSICOLOGO" | "COORDENACAO") {
  const responses: Record<string, unknown> = {
    "/auth/me": {
      id: 10,
      nome: "Usuário de Teste",
      tipoUsuario: role,
      unidadeId: 1,
      unidade: "SENAC Taguatinga",
    },
    "/alunos": students,
    "/alunos/paginados": pageResponse(students),
    "/atendimentos": appointments,
    "/atendimentos/paginados": pageResponse(appointments),
    "/cursos": [{ id: 1, nome: "Técnico", unidadeId: 1 }],
    "/turmas": [
      { id: 1, nome: "ADM 2026", cursoId: 1, unidadeId: 1, turno: "MATUTINO" },
    ],
    "/usuarios": [],
    "/chat/mensagens": [],
    "/agenda-eventos": [],
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const response = responses[url.pathname];
    if (response === undefined) return route.continue();
    if (request.method() !== "GET") {
      return route.fulfill({ status: 200, json: {} });
    }
    return route.fulfill({ status: 200, json: response });
  });
}

test("mantém a aba na URL e permite links diretos", async ({ page }) => {
  await mockApi(page, "PSICOLOGO");
  await page.goto("/painel/psicologo/calendario");
  await expect(page.locator(".topbar-page-title")).toHaveText("Calendário");
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/psicologo\/alunos$/);
  await expect(page.locator(".topbar-page-title")).toHaveText("Alunos");
  await page.goBack();
  await expect(page).toHaveURL(/\/painel\/psicologo\/calendario$/);
  await expect(page.locator(".topbar-page-title")).toHaveText("Calendário");
});

test("protege cadastro alterado ao trocar de aba", async ({ page }) => {
  await mockApi(page, "COORDENACAO");
  await page.goto("/painel/coordenacao/alunos");
  await page.getByRole("button", { name: "Cadastrar Aluno" }).click();
  await page.locator(".modal-box input").first().fill("Aluno não salvo");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".modal-box")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(page.locator(".modal-overlay.open")).toHaveCount(0);
  await page.getByRole("button", { name: "Atendimentos", exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/coordenacao\/atendimentos$/);
});

test("calendário mensal cabe no celular", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Verificação exclusiva do celular",
  );
  await mockApi(page, "PSICOLOGO");
  await page.goto("/painel/psicologo/calendario");
  await expect(page.locator(".cal-weekday")).toHaveCount(7);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBe(390);
  const weekdayRows = await page
    .locator(".cal-weekday")
    .evaluateAll(
      (items) =>
        new Set(
          items.map((item) => Math.round(item.getBoundingClientRect().top)),
        ).size,
    );
  expect(weekdayRows).toBe(1);
});
