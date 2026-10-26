import { expect, test, type Page } from "@playwright/test";

async function mockForms(page: Page, role = "COORDENACAO") {
  await page.addInitScript(() =>
    localStorage.setItem("sap_token", "test-session"),
  );
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const responses: Record<string, unknown> = {
    "/auth/me": {
      id: 10,
      nome: "Usuário de teste",
      tipoUsuario: role,
      unidadeId: role === "ADMINISTRADOR" ? null : 1,
      unidade: "Unidade de teste",
    },
    "/unidades": [{ id: 1, nome: "Unidade de teste" }],
    "/usuarios": [
      {
        id: 11,
        nome: "Instrutor de teste",
        usuario: "instrutor.teste",
        email: "teste@example.com",
        tipoUsuario: "INSTRUTOR",
        unidade: { id: 1 },
      },
    ],
    "/cursos": [{ id: 1, nome: "Curso de teste", unidadeId: 1 }],
    "/turmas": [
      {
        id: 1,
        nome: "Turma de teste",
        cursoId: 1,
        unidadeId: 1,
        turno: "MATUTINO",
      },
    ],
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() !== "fetch") {
      if (url.origin !== "http://127.0.0.1:4174") return route.abort();
      return route.continue();
    }
    if (request.method() !== "GET") {
      writes.push({ path: url.pathname, body: request.postDataJSON() });
      return route.fulfill({
        status: 422,
        json: { message: "Erro simulado de validação do servidor." },
      });
    }
    const emptyPage = {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    };
    return route.fulfill({
      status: 200,
      json:
        responses[url.pathname] ??
        (url.pathname.endsWith("/paginados") ? emptyPage : []),
    });
  });
  return writes;
}

test("nova senha mantém foco e dados após erros na edição de usuário", async ({
  page,
}) => {
  const writes = await mockForms(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/usuarios");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const modal = page.getByRole("dialog");
  const password = modal.locator('input[type="password"]');
  await password.pressSequentially("abc", { delay: 30 });
  await expect(password).toBeFocused();
  await modal.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(modal.getByRole("alert")).toContainText("6 caracteres");
  expect(writes).toHaveLength(0);
  await expect(password).toHaveValue("abc");
  await password.press("End");
  await password.pressSequentially("def", { delay: 30 });
  await expect(password).toBeFocused();
  await modal.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(modal.getByRole("alert")).toContainText("Erro simulado");
  await expect(password).toHaveValue("abcdef");
  await expect(modal.locator('input[autocomplete="name"]')).toHaveValue(
    "Instrutor de teste",
  );
  expect(writes).toHaveLength(1);
});

test("reproduz o retorno repetido ao nome quando a dependência antiga onClose é reintroduzida", async ({
  page,
}) => {
  test.skip(
    process.env.SAP_E2E_PREVIEW === "1",
    "A reprodução da versão antiga intercepta o módulo do servidor de desenvolvimento.",
  );
  await mockForms(page, "ADMINISTRADOR");
  await page.route("**/src/hooks/useModalFocus.ts", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const legacy = body.replace(
      /\},\s*\[open, modalRef\]\);/,
      "}, [onClose, open, modalRef]);",
    );
    expect(legacy).not.toBe(body);
    await route.fulfill({ response, body: legacy });
  });
  await page.goto("/painel/admin/usuarios");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const modal = page.getByRole("dialog");
  const name = modal.locator('input[autocomplete="name"]');
  const password = modal.locator('input[type="password"]');
  await expect(name).toBeFocused();
  for (const character of "a1") {
    await password.click();
    await page.keyboard.type(character);
    await expect(name).toBeFocused();
  }
});

test("editar usuário mantém o mesmo modal e input a cada caractere e restaura foco ao fechar", async ({
  page,
}) => {
  await mockForms(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/usuarios");
  const edit = page.getByRole("button", { name: "Editar", exact: true });
  await edit.click();
  const modal = page.getByRole("dialog");
  const name = modal.locator('input[autocomplete="name"]');
  const password = modal.locator('input[type="password"]');
  await expect(name).toBeFocused();
  const originalModal = await modal.elementHandle();
  const originalInput = await password.elementHandle();
  await password.click();
  let typed = "";
  for (const character of "Senha123456") {
    await page.keyboard.type(character);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    typed += character;
    await expect(password).toHaveValue(typed);
    await expect(password).toBeFocused();
    expect(
      await originalModal!.evaluate(
        (node) => node === document.querySelector('[role="dialog"]'),
      ),
    ).toBe(true);
    expect(
      await originalInput!.evaluate(
        (node) => node === document.activeElement && node.isConnected,
      ),
    ).toBe(true);
  }
  // The latest close callback must see the edited state and request discard confirmation.
  page.once("dialog", (dialog) => dialog.dismiss());
  await password.press("Escape");
  await expect(modal).toBeVisible();
  await expect(password).toBeFocused();
  await expect(password).toHaveValue(typed);
  page.once("dialog", (dialog) => dialog.accept());
  await password.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(name).toBeFocused();
  await expect(password).toHaveValue("");
  await modal.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(name).toBeFocused();
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(edit).toBeFocused();
});

test("foco inicial atrasado não interrompe uma senha que já começou a ser digitada", async ({
  page,
}) => {
  await mockForms(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/usuarios");
  const edit = page.getByRole("button", { name: "Editar", exact: true });
  await expect(edit).toBeVisible();
  await page.evaluate(() => {
    const pending = new Map<number, FrameRequestCallback>();
    let id = 0;
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      pending.set(++id, callback);
      return id;
    };
    window.cancelAnimationFrame = (frame) => {
      pending.delete(frame);
    };
    Object.assign(window, {
      releaseModalFocus: () => {
        window.requestAnimationFrame = originalRequest;
        window.cancelAnimationFrame = originalCancel;
        for (const callback of pending.values()) callback(performance.now());
        pending.clear();
      },
    });
  });
  await edit.click();
  const password = page.getByRole("dialog").locator('input[type="password"]');
  await password.click();
  await page.keyboard.type("a");
  await expect(password).toBeFocused();
  await page.evaluate(() =>
    (
      window as unknown as { releaseModalFocus: () => void }
    ).releaseModalFocus(),
  );
  await expect(password).toBeFocused();
  await page.keyboard.type("1");
  await expect(password).toHaveValue("a1");
});

test("CPF e e-mail inválidos bloqueiam cadastro e preservam dados", async ({
  page,
}) => {
  const writes = await mockForms(page);
  await page.goto("/painel/coordenacao/alunos");
  await page
    .getByRole("button", { name: "Cadastrar Aluno", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.locator("input").nth(0).fill("Aluno de teste");
  const cpf = modal.getByRole("textbox", { name: "CPF", exact: true });
  await cpf.pressSequentially("11111111111", { delay: 20 });
  await expect(cpf).toHaveValue("111.111.111-11");
  await expect(cpf).toBeFocused();
  await modal.locator('input[type="date"]').fill("2007-05-10");
  await modal.locator("input").nth(4).fill("61999991111");
  await modal.locator("select").nth(0).selectOption("1");
  await modal.locator("select").nth(1).selectOption("1");
  const email = modal.getByPlaceholder("Exemplo: teste@gmail.com");
  await email.fill("teste@");
  await modal.getByRole("button", { name: "Cadastrar Aluno" }).click();
  await expect(modal.getByRole("alert")).toContainText("CPF válido");
  expect(writes).toHaveLength(0);
  await cpf.fill("52998224725");
  await modal.getByRole("button", { name: "Cadastrar Aluno" }).click();
  await expect(modal.getByRole("alert")).toContainText("e-mail válido");
  expect(writes).toHaveLength(0);
  await expect(email).toHaveValue("teste@");
  await email.fill("teste@gmail.com");
  await modal.getByRole("button", { name: "Cadastrar Aluno" }).click();
  await expect(modal.getByRole("alert")).toContainText("Erro simulado");
  await expect(cpf).toHaveValue("529.982.247-25");
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({
    cpf: "529.982.247-25",
    email: "teste@gmail.com",
  });
});

test("instrutor exige e-mail válido e senha com seis caracteres", async ({
  page,
}) => {
  const writes = await mockForms(page);
  await page.goto("/painel/coordenacao/instrutores");
  await page.getByRole("button", { name: "Novo Instrutor" }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByPlaceholder("Nome completo", { exact: true })
    .fill("Instrutor de teste");
  await modal.getByPlaceholder("Usuário/login").fill("instrutor.teste");
  const email = modal.getByPlaceholder("Exemplo: teste@gmail.com");
  await email.fill("teste@");
  const password = modal.getByPlaceholder("Senha inicial");
  await password.pressSequentially("abc", { delay: 30 });
  await expect(password).toBeFocused();
  await modal.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("6 caracteres");
  await password.fill("abcdef");
  await modal.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("e-mail válido");
  expect(writes).toHaveLength(0);
  await email.fill("teste@gmail.com");
  await modal.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Erro simulado");
  await expect(password).toHaveValue("abcdef");
  expect(writes).toHaveLength(1);
});

test("unidade envia por Enter e mantém os campos quando o servidor rejeita", async ({
  page,
}) => {
  const writes = await mockForms(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/unidades");
  await page.getByRole("button", { name: "Nova Unidade" }).click();
  const modal = page.getByRole("dialog");
  const name = modal.getByPlaceholder("Ex: Nome da unidade");
  const region = modal.getByPlaceholder("Ex: Região Oeste");
  await name.fill("Unidade de teste");
  await name.press("Enter");
  await expect(modal.getByRole("alert")).toContainText("Região é obrigatório");
  expect(writes).toHaveLength(0);
  await region.pressSequentially("Região de teste", { delay: 20 });
  await expect(region).toBeFocused();
  await region.press("Enter");
  await expect(modal.getByRole("alert")).toContainText("Erro simulado");
  await expect(name).toHaveValue("Unidade de teste");
  await expect(region).toHaveValue("Região de teste");
  expect(writes).toHaveLength(1);
});

test("criação de login apresenta erro de e-mail e preserva o cadastro", async ({
  page,
}) => {
  const writes = await mockForms(page, "ADMINISTRADOR");
  await page.goto("/painel/admin/criar");
  const form = page.locator("form");
  await form.getByRole("button", { name: /Administrador Geral/ }).click();
  await form.locator('input[name="nome"]').fill("Usuário de teste");
  await form.locator('input[name="usuario"]').fill("usuario.teste");
  await form.locator('input[name="senha"]').fill("senha de teste");
  const email = form.getByPlaceholder("Exemplo: teste@gmail.com");
  await email.fill("teste@");
  await form.getByRole("button", { name: "Criar Login", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("e-mail válido");
  expect(writes).toHaveLength(0);
  await expect(form.locator('input[name="nome"]')).toHaveValue(
    "Usuário de teste",
  );
  await email.fill("teste@gmail.com");
  await form.getByRole("button", { name: "Criar Login", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("Erro simulado");
  await expect(email).toHaveValue("teste@gmail.com");
  await expect(form.locator('input[name="senha"]')).toHaveValue(
    "senha de teste",
  );
  expect(writes).toHaveLength(1);
});
