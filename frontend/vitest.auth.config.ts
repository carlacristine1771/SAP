import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:4186"),
  },
  test: {
    include: ["src/auth/login.test.ts"],
    environment: "jsdom",
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
