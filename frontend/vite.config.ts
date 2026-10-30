import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:8000",
        xfwd: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
    // Generous, because simulated typing is slow on a busy computer or CI runner.
    testTimeout: 30_000,
  },
});
