import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config Vite alignée sur les attentes Tauri (port fixe 1420).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
