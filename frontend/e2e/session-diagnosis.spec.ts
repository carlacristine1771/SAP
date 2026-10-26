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
      const authorization = request.headers().authorization;
      const role =
        authorization === "Bearer test-psychologist"
          ? "PSICOLOGO"
          : authorization === "Bearer test-coordination"
            ? "COORDENACAO"
            : "ADMINISTRADOR";
      return route.fulfill({
        status: 200,
        json: {
          id: role === "ADMINISTRADOR" ? 10 : 20,
          nome: "Usuário de teste",
          tipoUsuario: role,
          unidadeId: role === "ADMINISTRADOR" ? null : 1,
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

test("logout da coordenação remove o token compartilhado mas não solicita remoção dos cookies", async ({
  page,
  context,
}) => {
  const logoutRequests = await mockSessions(context);
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("sap_token", "test-coordination"),
  );
  await context.addCookies([
    {
      name: "SAP_AUTH",
      value: "test-cookie",
      url: "http://127.0.0.1:4174",
      httpOnly: true,
    },
    {
      name: "SAP_SESSION",
      value: "test-session-cookie",
      url: "http://127.0.0.1:4174",
    },
  ]);
  await page.goto("/painel/coordenacao/home");
  await expect(page.locator(".app-shell")).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(second).toHaveURL(/\/painel\/coordenacao$/);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".btn-logout:visible, .mobile-logout:visible")
    .first()
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:4174/");
  expect(
    await page.evaluate(() => localStorage.getItem("sap_token")),
  ).toBeNull();
  expect(
    await second.evaluate(() => localStorage.getItem("sap_token")),
  ).toBeNull();
  expect(logoutRequests).toHaveLength(0);
  const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookieNames).toContain("SAP_AUTH");
  expect(cookieNames).toContain("SAP_SESSION");
});
