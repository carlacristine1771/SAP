import { defineConfig } from "vitest/config";
import auth from "./vitest.auth.config.ts";

export default defineConfig({
  ...auth,
  plugins: [],
  test: { ...auth.test, include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"] },
});
