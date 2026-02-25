import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({

  plugins: [react()],

  resolve: {
    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: ["antd"],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },

});
