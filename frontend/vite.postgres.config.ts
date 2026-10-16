import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: false,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:4188"),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1", port: 4188, strictPort: true, open: false,
    proxy: Object.fromEntries([
      "/auth", "/agenda-eventos", "/atendimentos", "/alunos", "/chat",
      "/cursos", "/dashboard", "/turmas", "/unidades", "/usuarios",
    ].map(path => [path, { target: "http://127.0.0.1:4187" }])),
  },
});
