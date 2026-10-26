import { expect, test } from "@playwright/test";
import {
  closeAndReopen,
  expectKeyboardCycle,
  mockFocusApi,
  typeWithoutLosingFocus,
} from "./helpers/focus.ts";

test.describe.configure({ mode: "parallel" });

test("administrador: nome, login e nova senha mantêm foco e valores", async ({
  page,
}) => {
  await mockFocusApi(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/usuarios");
  const opener = page.getByRole("button", { name: "Editar", exact: true });
  await opener.click();
  const modal = page.getByRole("dialog");
  const original = await modal.elementHandle();
  const name = modal.locator('input[autocomplete="name"]');
  const login = modal.locator('input[autocomplete="username"]');
  const password = modal.locator('input[autocomplete="new-password"]');
  await typeWithoutLosingFocus(page, name, "Nome atualizado");
  await name.press("Tab");
  await expect(login).toBeFocused();
  await typeWithoutLosingFocus(page, login, "login.teste");
  await login.press("Tab");
  await expect(password).toBeFocused();
  await typeWithoutLosingFocus(page, password, "Senha123456");
  await expect(name).toHaveValue("Nome atualizado");
  await expect(login).toHaveValue("login.teste");
  expect(
    await original!.evaluate(
      (node) =>
        node.isConnected && node === document.querySelector('[role="dialog"]'),
    ),
  ).toBe(true);
  await expectKeyboardCycle(modal);
  await modal.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(modal.getByRole("alert")).toContainText("dados preservados");
  await expect(password).toHaveValue("Senha123456");
  await closeAndReopen(page, opener);
});

test("administrador: nome e região da unidade não roubam foco", async ({
  page,
}) => {
  await mockFocusApi(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/unidades");
  const opener = page.getByRole("button", { name: "Nova Unidade" });
  await opener.click();
  const modal = page.getByRole("dialog");
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Ex: Nome da unidade"),
    "Unidade teste",
  );
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Ex: Região Oeste"),
    "Região teste",
  );
  await expect(modal.getByPlaceholder("Ex: Nome da unidade")).toHaveValue(
    "Unidade teste",
  );
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, opener);
});

test("administrador: criação de login mantém nome, e-mail, usuário e senha", async ({
  page,
}) => {
  await mockFocusApi(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/criar");
  const form = page.locator("form");
  await form.getByRole("button", { name: /Administrador Geral/ }).click();
  for (const [field, value] of [
    ["nome", "Nome teste"],
    ["email", "teste@example.com"],
    ["usuario", "usuario.teste"],
    ["senha", "Senha123456"],
  ])
    await typeWithoutLosingFocus(
      page,
      form.locator(`input[name="${field}"]`),
      value,
    );
  await expect(form.locator('input[name="nome"]')).toHaveValue("Nome teste");
  await expect(form.locator('input[name="email"]')).toHaveValue(
    "teste@example.com",
  );
  await form.getByRole("button", { name: "Criar Login", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("dados preservados");
  await expect(form.locator('input[name="senha"]')).toHaveValue("Senha123456");
});

for (const profile of ["coordenacao", "instrutor"]) {
  test(`${profile}: cadastro de aluno preserva todos os inputs consecutivos`, async ({
    page,
  }) => {
    await mockFocusApi(
      page,
      profile === "coordenacao" ? "COORDENACAO" : "INSTRUTOR",
    );
    await page.goto(`/painel/${profile}/alunos`);
    const opener = page.getByRole("button", {
      name: "Cadastrar Aluno",
      exact: true,
    });
    await opener.click();
    const modal = page.getByRole("dialog");
    const inputs = modal.locator("input");
    await typeWithoutLosingFocus(page, inputs.nth(0), "Aluno teste");
    await typeWithoutLosingFocus(page, inputs.nth(1), "MATR123456");
    await typeWithoutLosingFocus(
      page,
      modal.getByRole("textbox", { name: "CPF", exact: true }),
      "52998224725",
      [
        "5",
        "52",
        "529",
        "529.9",
        "529.98",
        "529.982",
        "529.982.2",
        "529.982.24",
        "529.982.247",
        "529.982.247-2",
        "529.982.247-25",
      ],
    );
    await inputs.nth(3).focus();
    await inputs.nth(3).fill("2007-05-10");
    await expect(inputs.nth(3)).toBeFocused();
    await typeWithoutLosingFocus(page, inputs.nth(4), "61999991111");
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Exemplo: teste@gmail.com"),
      "teste@example.com",
    );
    await modal.locator("select").nth(0).focus();
    await modal.locator("select").nth(0).selectOption("1");
    await expect(modal.locator("select").nth(0)).toBeFocused();
    await modal.locator("select").nth(1).focus();
    await modal.locator("select").nth(1).selectOption("1");
    await expect(modal.locator("select").nth(1)).toBeFocused();
    await expect(inputs.nth(0)).toHaveValue("Aluno teste");
    await expect(inputs.nth(1)).toHaveValue("MATR123456");
    await expectKeyboardCycle(modal);
    await modal
      .getByRole("button", { name: "Cadastrar Aluno", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText("dados preservados");
    await expect(inputs.nth(4)).toHaveValue("61999991111");
    await closeAndReopen(page, opener);
  });

  test(`${profile}: motivo e observações do encaminhamento mantêm foco`, async ({
    page,
  }) => {
    await mockFocusApi(
      page,
      profile === "coordenacao" ? "COORDENACAO" : "INSTRUTOR",
    );
    await page.goto(`/painel/${profile}/encaminhar`);
    const form = page.locator("form");
    await typeWithoutLosingFocus(
      page,
      form.locator("textarea").nth(0),
      "Motivo de teste",
    );
    await typeWithoutLosingFocus(
      page,
      form.locator("textarea").nth(1),
      "Observação teste",
    );
    await expect(form.locator("textarea").nth(0)).toHaveValue(
      "Motivo de teste",
    );
    await form.getByRole("button", { name: "Enviar Solicitação" }).click();
    await expect(form.getByRole("alert")).toContainText("Selecione o aluno");
    await expect(form.locator("textarea").nth(1)).toHaveValue(
      "Observação teste",
    );
  });
}

for (const edit of [false, true]) {
  test(`coordenação: ${edit ? "editar" : "criar"} instrutor preserva nome, login, e-mail e senha`, async ({
    page,
  }) => {
    await mockFocusApi(page, "COORDENACAO");
    await page.goto("/painel/coordenacao/instrutores");
    const opener = page.getByRole("button", {
      name: edit ? "Editar" : "Novo Instrutor",
      exact: true,
    });
    await opener.click();
    const modal = page.getByRole("dialog");
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Nome completo", { exact: true }),
      "Instrutor teste",
    );
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Usuário/login"),
      "instrutor.teste",
    );
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Exemplo: teste@gmail.com"),
      "teste@example.com",
    );
    await typeWithoutLosingFocus(
      page,
      modal.locator('input[type="password"]'),
      "Senha123456",
    );
    await expect(
      modal.getByPlaceholder("Nome completo", { exact: true }),
    ).toHaveValue("Instrutor teste");
    await expectKeyboardCycle(modal);
    await closeAndReopen(page, opener);
  });
}

test("coordenação: curso e turma mantêm o foco ao atualizar campos", async ({
  page,
}) => {
  await mockFocusApi(page, "COORDENACAO");
  await page.goto("/painel/coordenacao/cursos");
  const course = page.getByRole("button", { name: "Criar curso", exact: true });
  await course.click();
  const modal = page.getByRole("dialog");
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Nome do curso"),
    "Curso teste",
  );
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Tipo de aprendizagem"),
    "Tipo teste",
  );
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Descrição", { exact: true }),
    "Descrição teste",
  );
  await expect(modal.getByPlaceholder("Nome do curso")).toHaveValue(
    "Curso teste",
  );
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, course);
  const classroom = page.getByRole("button", {
    name: "Criar turma",
    exact: true,
  });
  await classroom.click();
  await typeWithoutLosingFocus(
    page,
    modal.getByPlaceholder("Nome da turma"),
    "Turma teste",
  );
  await modal.locator("select").nth(0).focus();
  await modal.locator("select").nth(0).selectOption("1");
  await expect(modal.locator("select").nth(0)).toBeFocused();
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, classroom);
});

test("psicologia: motivo, observações e relatório de atendimento mantêm foco", async ({
  page,
}) => {
  await mockFocusApi(page, "PSICOLOGO");
  await page.goto("/painel/psicologo/atendimentos");
  const opener = page.getByRole("button", {
    name: "Novo Atendimento",
    exact: true,
  });
  await opener.click();
  const modal = page.getByRole("dialog");
  for (const [index, value] of [
    "Motivo de teste",
    "Observação teste",
    "Relatório teste",
  ].entries())
    await typeWithoutLosingFocus(
      page,
      modal.locator("textarea").nth(index),
      value,
    );
  await expect(modal.locator("textarea").nth(0)).toHaveValue("Motivo de teste");
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, opener);
});

test("psicologia: título e descrição de evento mantêm foco", async ({
  page,
}) => {
  await mockFocusApi(page, "PSICOLOGO");
  await page.goto("/painel/psicologo/calendario");
  const opener = page.getByRole("button", { name: "Novo Evento", exact: true });
  await opener.click();
  const modal = page.getByRole("dialog");
  await typeWithoutLosingFocus(
    page,
    modal.locator("input:not([type])"),
    "Evento teste",
  );
  await typeWithoutLosingFocus(
    page,
    modal.locator("textarea"),
    "Descrição teste",
  );
  await expect(modal.locator("input:not([type])")).toHaveValue("Evento teste");
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, opener);
});

test("psicologia: modal de histórico sem inputs permite Tab, Escape e reabertura", async ({
  page,
}) => {
  await mockFocusApi(page, "PSICOLOGO");
  await page.goto("/painel/psicologo/alunos");
  const opener = page
    .getByRole("table")
    .getByRole("button", { name: "Histórico", exact: true });
  await opener.click();
  const modal = page.getByRole("dialog");
  await expect(modal.locator("input, textarea")).toHaveCount(0);
  await expect(
    modal.getByRole("button", { name: "Fechar", exact: true }),
  ).toBeFocused();
  await expectKeyboardCycle(modal);
  await closeAndReopen(page, opener);
});

for (const [profile, role] of [
  ["admin", "ADMINISTRADOR"],
  ["coordenacao", "COORDENACAO"],
  ["instrutor", "INSTRUTOR"],
  ["psicologo", "PSICOLOGO"],
]) {
  test(`${profile}: busca de nova conversa mantém foco e navegação por teclado`, async ({
    page,
  }) => {
    await mockFocusApi(page, role);
    await page.goto(`/painel/${profile}/chat`);
    const opener = page.getByRole("button", { name: "+ Nova", exact: true });
    await opener.click();
    const modal = page.getByRole("dialog");
    await typeWithoutLosingFocus(
      page,
      modal.getByRole("textbox", { name: "Buscar usuário" }),
      "Instrutor",
    );
    await expectKeyboardCycle(modal);
    await closeAndReopen(page, opener);
  });
}

for (const card of [
  "Administrador",
  "Psicólogo(a)",
  "Coordenação",
  "Instrutor",
]) {
  test(`login ${card}: usuário e senha mantêm foco e fechamento restaura o botão`, async ({
    page,
  }) => {
    await mockFocusApi(page, "ADMINISTRADOR", false);
    await page.goto("/");
    const opener = page
      .locator(".role-card")
      .filter({ has: page.locator(".card-name", { hasText: card }) })
      .getByRole("button", { name: "Acessar painel" });
    await opener.click();
    const modal = page.getByRole("dialog");
    await expect(
      card === "Administrador"
        ? modal.getByPlaceholder("Seu usuário")
        : modal.locator("select"),
    ).toBeFocused();
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Seu usuário"),
      "usuario.teste",
    );
    await typeWithoutLosingFocus(
      page,
      modal.getByPlaceholder("Sua senha"),
      "Senha123456",
    );
    await expect(modal.getByPlaceholder("Seu usuário")).toHaveValue(
      "usuario.teste",
    );
    await expectKeyboardCycle(modal);
    await closeAndReopen(page, opener);
  });
}
