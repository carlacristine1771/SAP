import { expect, test, type Page } from "@playwright/test";

// Menu lateral dos painéis no celular (até 900px) e preservação do desktop.
// A API é simulada pelo caminho da URL, qualquer que seja a origem configurada.
const unit = { unidadeId: 1, unidade: "SENAC Taguatinga" };
const profiles = {
  geral: {
    path: "/painel/admin",
    first: "dashboard",
    session: { id: 1, nome: "Admin Geral", tipoUsuario: "ADMINISTRADOR", unidadeId: null },
    items: ["Dashboard", "Unidades", "Usuários", "Chat", "Criar Login"],
    target: ["Usuários", "usuarios"],
  },
  unidade: {
    path: "/painel/admin",
    first: "dashboard",
    session: { id: 2, nome: "Admin Unidade", tipoUsuario: "ADMINISTRADOR", ...unit },
    items: ["Dashboard", "Usuários", "Chat", "Criar Login"],
    target: ["Chat", "chat"],
  },
  coordenacao: {
    path: "/painel/coordenacao",
    first: "home",
    session: { id: 3, nome: "Coordenação Teste", tipoUsuario: "COORDENACAO", ...unit },
    items: ["Início", "Alunos", "Encaminhar Aluno", "Cursos e Turmas", "Instrutores", "Atendimentos", "Chat"],
    target: ["Cursos e Turmas", "cursos"],
  },
  instrutor: {
    path: "/painel/instrutor",
    first: "home",
    session: { id: 4, nome: "Instrutor Teste", tipoUsuario: "INSTRUTOR", ...unit },
    items: ["Início", "Alunos", "Encaminhar Aluno", "Atendimentos", "Chat"],
    target: ["Atendimentos", "atendimentos"],
  },
  psicologo: {
    path: "/painel/psicologo",
    first: "dashboard",
    session: { id: 5, nome: "Psicóloga Teste", tipoUsuario: "PSICOLOGO", ...unit },
    items: ["Dashboard", "Indicativos", "Histórico", "Atendimentos", "Alunos", "Calendário", "Chat"],
    target: ["Calendário", "calendario"],
  },
} as const;
type ProfileKey = keyof typeof profiles;
const keys = Object.keys(profiles) as ProfileKey[];

async function mockPanel(page: Page, key: ProfileKey, theme = "light") {
  const appOrigin = new URL(test.info().project.use.baseURL!).origin;
  await page.context().addCookies([{ name: "sap_theme", value: theme, url: appOrigin }]);
  await page.addInitScript(() => localStorage.setItem("sap_token", "test-session"));
  const responses: Record<string, unknown> = {
    "/auth/me": profiles[key].session,
    "/unidades": [{ id: 1, nome: "SENAC Taguatinga", endereco: "Taguatinga" }],
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const api = ["fetch", "xhr"].includes(request.resourceType());
    if (!api) {
      return url.origin === appOrigin ? route.continue() : route.abort();
    }
    const headers = {
      "Access-Control-Allow-Origin": appOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    const body = request.method() === "GET" ? (responses[url.pathname] ?? []) : {};
    return route.fulfill({ status: 200, headers, json: body });
  });
}

async function openPanel(page: Page, key: ProfileKey, theme = "light") {
  await mockPanel(page, key, theme);
  await page.goto(`${profiles[key].path}/${profiles[key].first}`);
  await expect(page.locator(".app-shell")).toBeVisible();
}

const menuLabels = (page: Page) =>
  page.locator("#painel-menu .nav-link .nav-label").allTextContents();

test.describe("celular", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Verificação do celular");
  });

  for (const key of keys) {
    test(`${key}: abre, navega e fecha o menu lateral`, async ({ page }) => {
      await openPanel(page, key);
      const toggle = page.getByRole("button", { name: "Abrir menu" });
      const theme = page.getByRole("button", { name: "Alternar tema claro e escuro" });
      const drawer = page.locator("#painel-menu");

      // Cabeçalho: menu no canto esquerdo e tema no direito, na mesma linha.
      const width = page.viewportSize()!.width;
      const toggleBox = (await toggle.boundingBox())!;
      const themeBox = (await theme.boundingBox())!;
      expect(toggleBox.x).toBeLessThan(40);
      expect(themeBox.x + themeBox.width).toBeGreaterThan(width - 40);
      expect(Math.abs(toggleBox.y - themeBox.y)).toBeLessThan(4);

      // Fechado: menu fora da tela e fora da navegação por teclado.
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(drawer).toBeHidden();
      await expect(page.getByRole("button", { name: "Sair" })).toBeHidden();

      await toggle.click();
      const dialog = page.getByRole("dialog", { name: "Menu do painel" });
      await expect(dialog).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("button", { name: "Fechar menu" })).toBeFocused();
      expect(await menuLabels(page)).toEqual(profiles[key].items);
      await expect(dialog.getByRole("button", { name: "Sair" })).toBeVisible();
      // Espera o fim do deslize para medir a posição final.
      await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0);
      expect((await drawer.boundingBox())!.width).toBeLessThanOrEqual(width);

      // Tab permanece dentro do menu.
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

      // Escape fecha e devolve o foco ao botão de menu.
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(toggle).toBeFocused();

      // Toque fora do menu fecha.
      await toggle.click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(width - 10, 400);
      await expect(drawer).toBeHidden();

      // Navegação pelo menu fecha o menu e troca a tela.
      const [label, route] = profiles[key].target;
      await toggle.click();
      await dialog.getByRole("button", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${profiles[key].path}/${route}$`));
      await expect(drawer).toBeHidden();
      await expect(page.locator(".topbar-page-title")).toHaveText(label);
      await expect(toggle).toBeFocused();
    });
  }

  for (const width of [320, 375, 390, 430, 768]) {
    for (const theme of ["light", "dark"]) {
      test(`sem rolagem horizontal em ${width}px, tema ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        for (const key of keys) {
          await openPanel(page, key, theme);
          await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
          await expect(page.locator("#painel-menu")).toBeHidden();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
          await page.getByRole("button", { name: "Abrir menu" }).click();
          const drawer = page.locator("#painel-menu");
          await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0);
          const box = (await drawer.boundingBox())!;
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
          await page.unrouteAll({ behavior: "ignoreErrors" });
        }
      });
    }
  }
});

test.describe("desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Verificação do desktop");
  });

  // 930px cobre a faixa de 901 a 960px, em que a barra lateral sumia.
  for (const width of [930, 1280, 1440]) {
    for (const key of keys) {
      test(`${key}: desktop em ${width}px mantém a barra lateral`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openPanel(page, key);
        await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
        await expect(page.getByRole("button", { name: "Fechar menu" })).toBeHidden();
        await expect(page.locator(".mobile-menu-overlay")).toBeHidden();
        await expect(page.locator(".btn-logout-label")).toBeHidden();
        const sidebar = page.locator("#painel-menu");
        await expect(sidebar).toBeVisible();
        await expect(sidebar).not.toHaveAttribute("aria-modal", /.*/);
        expect((await sidebar.boundingBox())!.x).toBe(0);
        expect(await menuLabels(page)).toEqual(profiles[key].items);
        await expect(sidebar.getByRole("button", { name: "Sair" })).toBeVisible();
      });
    }
  }
});
