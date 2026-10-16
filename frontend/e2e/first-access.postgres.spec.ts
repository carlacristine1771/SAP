import { test, expect } from "@playwright/test";

test("real PostgreSQL: register, first access, change, logout and login", async ({ page, request }, info) => {
  const email = `pg-${info.project.name}@example.invalid`;
  const admin = process.env.AUTH_FICTIONAL_ADMIN_TOKEN;
  expect(admin).toBeTruthy();
  const created = await request.post("/auth/register", {
    headers: { Authorization: `Bearer ${admin}` },
    data: { nome: "Fictional PostgreSQL User", email, usuario: `pg-${info.project.name}`,
      senha: "temporary-test", tipoUsuario: "ADMINISTRADOR" },
  });
  expect(created.status()).toBe(200);
  const initial = await request.post("/auth/login", { data: { email, senha: "temporary-test" } });
  expect(initial.status()).toBe(200);
  expect((await initial.json()).senhaTemporaria).toBe(true);

  const external: string[] = [];
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:4188") return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  async function login(password: string) {
    await page.goto("/");
    await page.locator(".role-card").filter({ hasText: "Administrador" })
      .getByRole("button", { name: "Acessar painel" }).click();
    await page.locator("#f-user").fill(email);
    await page.locator("#f-pw").fill(password);
    await page.getByRole("button", { name: "Entrar no sistema" }).click();
  }
  page.once("dialog", dialog => dialog.accept("new-password-postgres"));
  const changed = page.waitForResponse(r => r.url().endsWith("/auth/change-password"));
  await login("temporary-test");
  expect((await changed).status()).toBe(200);
  await expect(page).toHaveURL(/\/painel\/admin$/);
  expect(await page.evaluate(() => localStorage.getItem("sap_token"))).toBeTruthy();
  await page.locator('button[aria-label="Sair"]:visible').click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("sap_token"))).toBeNull();
  expect((await page.context().cookies()).filter(c => ["SAP_AUTH", "SAP_SESSION"].includes(c.name))).toHaveLength(0);
  const loggedOut = await page.evaluate(async () => (await fetch("/auth/me")).status);
  expect(loggedOut).toBe(401);
  const old = await request.post("/auth/login", { data: { email, senha: "temporary-test" } });
  expect(old.status()).toBe(401);
  page.on("dialog", () => { throw new Error("Password change must not repeat"); });
  await login("new-password-postgres");
  await expect(page).toHaveURL(/\/painel\/admin$/);
  const me = await page.evaluate(async () => (await fetch("/auth/me")).json());
  expect(me.email).toBe(email);
  expect(me.senhaTemporaria).toBe(false);
  await page.locator('button[aria-label="Sair"]:visible').click();
  await expect(page).toHaveURL(/\/$/);
  // External font requests, if attempted, were aborted before network access.
  expect(external.every(url => new URL(url).hostname === "fonts.googleapis.com" ||
    new URL(url).hostname === "fonts.gstatic.com")).toBe(true);
});
