import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dedicated browser-test server: never load .env files or proxy an API.
export default defineConfig({
  envDir: false,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:4186"),
  },
  plugins: [
    react(),
    {
      name: "reject-unmocked-auth-api",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path = (request.url || "").split("?")[0];
          if (/^\/(auth|unidades)(\/|$)/.test(path)) {
            response.statusCode = 503;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ message: "API request was not mocked" }));
            return;
          }
          next();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4186, strictPort: true, open: false },
});
