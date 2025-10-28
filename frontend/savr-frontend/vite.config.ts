// vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 8080,
    host: '127.0.0.1',
    open: false,
    proxy: {
      // proxy all /api requests to your backend
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false, // allow self-signed / http backend
      },
    },
  },
});
