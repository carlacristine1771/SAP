import { expect, test, type Page } from "@playwright/test";

async function fictionalApi(page: Page, changeStatus = 200) {
  let password = "temporary-test";
  let temporary = true;
  let authenticated = false;
  let changes = 0;
  let logouts = 0;
  const session = {
    id: 1,
    nome: "Fictional User",
    email: "test@example.invalid",
    tipoUsuario: "ADMINISTRADOR",
    token: "new-fictional-token",
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // No external requests, including the production API, may leave this test.
    if (url.origin !== "http://127.0.0.1:4186") return route.abort();
    if (url.pathname === "/auth/login") {
      expect(request.headers().authorization).toBeUndefined();
      if (request.postDataJSON().senha !== password)
        return route.fulfill({
          status: 401,
          json: { message: "Invalid credentials" },
        });
      authenticated = true;
      return route.fulfill({
        json: { ...session, senhaTemporaria: temporary },
      });
    }
    if (url.pathname === "/auth/change-password") {
      changes++;
      expect(request.headers().authorization).toBe(`Bearer ${session.token}`);
      expect(request.postDataJSON().senhaAtual).toBe(password);
      if (changeStatus !== 200)
        return route.fulfill({
          status: changeStatus,
          json: { message: "Change failed" },
        });
      password = request.postDataJSON().novaSenha;
      temporary = false;
      return route.fulfill({ json: "Password changed" });
    }
    if (url.pathname === "/auth/logout") {
      authenticated = false;
      logouts++;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/auth/me")
      return route.fulfill({
        status: authenticated ? 200 : 401,
        json: authenticated ? { ...session, senhaTemporaria: temporary } : {},
      });
    if (url.pathname === "/unidades") return route.fulfill({ json: [] });
    if (["fetch", "xhr"].includes(request.resourceType()))
      return route.fulfill({ json: [] });
    return route.continue();
  });
  return { changes: () => changes, logouts: () => logouts };
}

async function submit(page: Page, password = "temporary-test") {
  await page.goto("/");
  await page
    .locator(".role-card")
    .filter({ hasText: "Administrador" })
    .getByRole("button", { name: "Acessar painel" })
    .click();
  await page.locator("#f-user").fill("test@example.invalid");
  await page.locator("#f-pw").fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
}

test("first access, password change, logout and new login", async ({
  page,
}) => {
  const api = await fictionalApi(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("auth-test-initialized")) {
      localStorage.setItem("sap_token", "previous-fictional-token");
      sessionStorage.setItem("auth-test-initialized", "true");
    }
  });
  page.once("dialog", (dialog) => dialog.accept("new-password-test"));
  await submit(page);
  await expect(page).toHaveURL(/\/painel\/admin$/);
  expect(await page.evaluate(() => localStorage.getItem("sap_token"))).toBe(
    "new-fictional-token",
  );
  expect(api.changes()).toBe(1);
  // Real SAP logout control, with all API responses simulated above.
  await page.locator('button[aria-label="Sair"]:visible').click();
  await expect(page).toHaveURL(/\/$/);
  expect(api.logouts()).toBe(1);
  page.on("dialog", () => {
    throw new Error("Established account must not request another password");
  });
  await submit(page, "new-password-test");
  await expect(page).toHaveURL(/\/painel\/admin$/);
  expect(api.changes()).toBe(1);
});

test("cancelled password leaves login open and clears the session", async ({
  page,
}) => {
  const api = await fictionalApi(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await submit(page);
  await expect(page.getByRole("alert")).toContainText("6 caracteres");
  expect(
    await page.evaluate(() => localStorage.getItem("sap_token")),
  ).toBeNull();
  expect(api.changes()).toBe(0);
  expect(api.logouts()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Entrar no sistema" }),
  ).toBeEnabled();
});

test("failed change does not persist token or navigate to the panel", async ({
  page,
}) => {
  const api = await fictionalApi(page, 401);
  page.once("dialog", (dialog) => dialog.accept("new-password-test"));
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText("Change failed");
  expect(
    await page.evaluate(() => localStorage.getItem("sap_token")),
  ).toBeNull();
  expect(api.logouts()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Entrar no sistema" }),
  ).toBeEnabled();
});
