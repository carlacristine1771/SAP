import { defineConfig } from "@playwright/test";
import isolated from "./playwright.auth.config";

export default defineConfig({
  ...isolated,
  testMatch: "first-access.postgres.spec.ts",
  outputDir: "test-results-postgres",
  use: {
    ...isolated.use, baseURL: "http://127.0.0.1:4188",
    launchOptions: {
      ...isolated.use?.launchOptions,
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config vite.postgres.config.ts",
    url: "http://127.0.0.1:4188", reuseExistingServer: false,
  },
});
