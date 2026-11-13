import { expect, test, type BrowserContext } from "@playwright/test";

// These tests describe the current authentication behavior without changing it.
async function mockSessions(context: BrowserContext) {
  const logoutRequests: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() !== "fetch") {
      if (url.origin !== "http://127.0.0.1:4174") return route.abort();
      return route.continue();
    }
    if (url.pathname === "/auth/logout") {
      logoutRequests.push(url.pathname);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/auth/me") {
      const token = request.headers().authorization?.replace("Bearer ", "");
      const role =
        {
          "test-psychologist": "PSICOLOGO",
          "test-coordination": "COORDENACAO",
          "test-instructor": "INSTRUTOR",
        }[token ?? ""] ?? "ADMINISTRADOR";
      const globalAdmin = role === "ADMINISTRADOR" && token !== "test-unit-admin";
      return route.fulfill({
        status: 200,
        json: {
          id: role === "ADMINISTRADOR" ? 10 : 20,
          nome: "Usuário de teste",
          tipoUsuario: role,
          unidadeId: globalAdmin ? null : 1,
          unidade: "Unidade de teste",
        },
      });
    }
    return route.fulfill({ status: 200, json: [] });
  });
  return logoutRequests;
}

test("abas compartilham o token e a página inicial restaura o perfil existente", async ({
  page,
  context,
}) => {
  await mockSessions(context);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sap_token", "test-admin"));
  await page.goto("/painel/admin/usuarios");
  await expect(page.locator(".topbar-page-title")).toHaveText("Usuários");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second).toHaveURL(/\/painel\/admin$/);
  await expect(second.locator(".app-shell")).toBeVisible();
  expect(
    await second.evaluate(
      () => localStorage.getItem("sap_token") === "test-admin",
    ),
  ).toBe(true);
  // Simulate storing the token returned by a different successful login.
  await second.evaluate(() =>
    localStorage.setItem("sap_token", "test-psychologist"),
  );
  expect(
    await page.evaluate(
      () => localStorage.getItem("sap_token") === "test-psychologist",
    ),
  ).toBe(true);
  await second.goto("/");
  await expect(second).toHaveURL(/\/painel\/psicologo$/);
  await expect(second.locator(".app-shell")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/painel\/psicologo$/);
});

test("contextos de navegador separados permitem perfis simultâneos", async ({
  page,
  context,
  browser,
}) => {
  await mockSessions(context);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("sap_token", "test-admin"));
  const isolated = await browser.newContext();
  try {
    await mockSessions(isolated);
    const psychologist = await isolated.newPage();
    await psychologist.goto("http://127.0.0.1:4174/");
    expect(
      await psychologist.evaluate(() => localStorage.getItem("sap_token")),
    ).toBeNull();
    await psychologist.evaluate(() =>
      localStorage.setItem("sap_token", "test-psychologist"),
    );
    await psychologist.goto("http://127.0.0.1:4174/");
    await expect(psychologist).toHaveURL(/\/painel\/psicologo$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/painel\/admin$/);
  } finally {
    await isolated.close();
  }
});

// Every panel asks the server to expire the session cookies on logout.
const logoutProfiles = [
  { name: "administrador geral", token: "test-admin", path: "/painel/admin" },
  { name: "administrador de unidade", token: "test-unit-admin", path: "/painel/admin" },
  { name: "coordenação", token: "test-coordination", path: "/painel/coordenacao" },
  { name: "instrutor", token: "test-instructor", path: "/painel/instrutor" },
  { name: "psicóloga", token: "test-psychologist", path: "/painel/psicologo" },
];

for (const profile of logoutProfiles) {
  test(`logout de ${profile.name} chama /auth/logout e remove o token compartilhado`, async ({
    page,
    context,
  }) => {
    const logoutRequests = await mockSessions(context);
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto("/");
    await page.evaluate(
      (token) => localStorage.setItem("sap_token", token),
      profile.token,
    );
    await page.goto(profile.path);
    await expect(page.locator(".app-shell")).toBeVisible();
    const second = await context.newPage();
    await second.goto("/");
    await expect(second).toHaveURL(new RegExp(`${profile.path}$`));
    // No celular (até 900px), Sair fica dentro do menu lateral.
    if ((page.viewportSize()?.width ?? 1280) <= 900) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL("http://127.0.0.1:4174/");
    expect(
      await page.evaluate(() => localStorage.getItem("sap_token")),
    ).toBeNull();
    expect(
      await second.evaluate(() => localStorage.getItem("sap_token")),
    ).toBeNull();
    expect(logoutRequests).toHaveLength(1);
    expect(dialogs).toEqual([]);
  });
}
