import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const apiPaths = [
  '/auth', '/agenda-eventos', '/atendimentos', '/alunos', '/chat',
  '/cursos', '/dashboard', '/turmas', '/unidades', '/usuarios',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:8080';
  const proxy = Object.fromEntries(
    apiPaths.map((path) => [path, { target, changeOrigin: true }]),
  );

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: { outDir: 'dist', sourcemap: true },
  };
});
