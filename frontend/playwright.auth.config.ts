import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "first-access.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4186",
    channel: "msedge",
    headless: true,
    serviceWorkers: "block",
    launchOptions: {
      args: [
        "--disable-background-networking",
        "--proxy-server=http://127.0.0.1:9",
        "--proxy-bypass-list=127.0.0.1;localhost",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Edge"] } },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
  webServer: {
    command: "npm run dev -- --config vite.auth.config.ts",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
  },
});
