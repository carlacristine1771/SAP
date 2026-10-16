import { defineConfig } from "@playwright/test";
import auth from "./playwright.auth.config.ts";

export default defineConfig({
  ...auth,
  testMatch: [
    "permissions.p0.spec.ts",
    "first-access.spec.ts",
    "panels.spec.ts",
  ],
  outputDir: "test-results/p0",
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/p0-results.json" }],
  ],
});
