import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// En producción (Docker/nginx) el proxy apunta a localhost:80 porque nginx
// hace de reverse proxy. En CI y en dev local los servicios corren directos:
//   users  → localhost:8001
//   gamey  → localhost:4000
// Se sobreescribe con variables de entorno para no tocar este fichero en CI.
const usersTarget  = process.env.VITE_API_PROXY_TARGET  ?? "http://localhost:80";
const gameyTarget  = process.env.VITE_GAME_PROXY_TARGET ?? "http://localhost:80";

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
      "/api/users": {
        target: usersTarget,
        changeOrigin: true,
      },
      "/api/game": {
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