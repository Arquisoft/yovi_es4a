import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Targets para el proxy de desarrollo / CI.
// En producción (Docker) nginx enruta el tráfico, así que este proxy
// solo se activa con `vite dev` y en los tests E2E de CI.
//
// Rutas:
//   /api/users/* → users service (:8001) — nginx hace strip del prefijo,
//                  así que reescribimos /api/users/X → /X
//   /api/v1/*    → gamey (:4000) — ruta directa, sin rewrite
//   /play        → gamey (:4000) — ruta directa, sin rewrite
//   /status      → gamey (:4000) — health check
const usersTarget = process.env.VITE_API_PROXY_TARGET  ?? "http://localhost:8001";
const gameyTarget = process.env.VITE_GAME_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({

  plugins: [react()],

  resolve: {
    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: ["antd"],
  },

  server: {
    proxy: {
      // Users service: quitar el prefijo /api/users antes de reenviar
      "/api/users": {
        target: usersTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/users/, ""),
      },
      // Gamey: rutas de la API interna (sin rewrite, gamey las espera tal cual)
      "/api/v1": {
        target: gameyTarget,
        changeOrigin: true,
      },
      // Gamey: API externa de bots
      "/play": {
        target: gameyTarget,
        changeOrigin: true,
      },
      // Gamey: health check
      "/status": {
        target: gameyTarget,
        changeOrigin: true,
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },

});