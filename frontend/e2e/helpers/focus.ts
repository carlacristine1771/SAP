import { expect, type Locator, type Page } from "@playwright/test";

export async function mockFocusApi(
  page: Page,
  role: string,
  authenticated = true,
) {
  if (authenticated) {
    await page.addInitScript(() =>
      localStorage.setItem("sap_token", "test-focus-session"),
    );
  }
  const student = {
    id: 1,
    nome: "Aluno de teste",
    cpf: "529.982.247-25",
    unidadeId: 1,
    cursoId: 1,
    turmaId: 1,
    curso: "Curso de teste",
    turma: "Turma de teste",
    ativo: true,
  };
  const responses: Record<string, unknown> = {
    "/auth/me": {
      id: 10,
      nome: "Usuário de teste",
      tipoUsuario: role,
      unidadeId: role === "ADMINISTRADOR" ? null : 1,
      unidade: "Unidade de teste",
    },
    "/unidades": [
      { id: 1, nome: "Unidade de teste", endereco: "Região de teste" },
    ],
    "/usuarios": [
      {
        id: 11,
        nome: "Instrutor de teste",
        usuario: "instrutor.teste",
        email: "teste@example.com",
        tipoUsuario: "INSTRUTOR",
        ativo: true,
        unidade: { id: 1 },
      },
    ],
    "/alunos": [student],
    "/cursos": [{ id: 1, nome: "Curso de teste", unidadeId: 1 }],
    "/turmas": [
      {
        id: 1,
        nome: "Turma de teste",
        cursoId: 1,
        unidadeId: 1,
        instrutorId: 10,
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
    if (request.method() !== "GET")
      return route.fulfill({
        status: 422,
        json: { message: "Erro de teste: dados preservados." },
      });
    const content = url.pathname === "/alunos/paginados" ? [student] : [];
    return route.fulfill({
      status: 200,
      json:
        responses[url.pathname] ??
        (url.pathname.endsWith("/paginados")
          ? {
              content,
              page: 0,
              size: 20,
              totalElements: content.length,
              totalPages: content.length ? 1 : 0,
              first: true,
              last: true,
            }
          : []),
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
}

export async function typeWithoutLosingFocus(
  page: Page,
  field: Locator,
  text: string,
  values?: string[],
) {
  await field.click();
  await field.press("ControlOrMeta+A");
  await field.press("Backspace");
  const original = await field.elementHandle();
  let typed = "";
  for (const [index, character] of [...text].entries()) {
    await page.keyboard.type(character);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    typed += character;
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(values?.[index] ?? typed);
    expect(
      await original!.evaluate(
        (node) => node.isConnected && document.activeElement === node,
      ),
    ).toBe(true);
    expect(
      await field.evaluate((active) =>
        [
          ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            "[data-focus-expected]",
          ),
        ]
          .filter((element) => element !== active)
          .every(
            (element) =>
              element.value === element.getAttribute("data-focus-expected"),
          ),
      ),
      "os valores dos campos anteriores devem continuar preservados",
    ).toBe(true);
  }
  await field.evaluate(
    (element, expected) =>
      element.setAttribute("data-focus-expected", expected),
    values?.at(-1) ?? text,
  );
}

export async function expectKeyboardCycle(modal: Locator) {
  const controls = modal.locator(
    "button:visible:not(:disabled), input:visible:not(:disabled), select:visible:not(:disabled), textarea:visible:not(:disabled), a[href]:visible",
  );
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  await controls.last().focus();
  await modal.page().keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
  await modal.page().keyboard.press("Shift+Tab");
  await expect(controls.last()).toBeFocused();
  await controls.first().focus();
  for (const direction of ["Tab", "Shift+Tab"]) {
    const visited = new Set([0]);
    let wrapped = false;
    // Native date inputs have several keyboard segments within one DOM input.
    for (let step = 0; step < count * 12; step++) {
      await modal.page().keyboard.press(direction);
      const index = await controls.evaluateAll((elements) =>
        elements.findIndex((element) => element === document.activeElement),
      );
      expect(
        index,
        "o foco deve permanecer dentro do modal",
      ).toBeGreaterThanOrEqual(0);
      visited.add(index);
      if (index === 0) {
        wrapped = true;
        break;
      }
    }
    expect(wrapped).toBe(true);
    expect(
      visited.size,
      "todos os controles devem ser acessíveis por teclado",
    ).toBe(count);
  }
}

export async function closeAndReopen(page: Page, opener: Locator) {
  const modal = page.getByRole("dialog");
  await modal.locator('button[aria-label="Fechar"]').click();
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(modal).toBeVisible();
  const initialControl = modal
    .locator(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    )
    .first();
  if (await initialControl.count()) await expect(initialControl).toBeFocused();
  else await expect(modal.locator('button[aria-label="Fechar"]')).toBeFocused();
  await expectKeyboardCycle(modal);
  await modal.locator('button[aria-label="Fechar"]').press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
}
