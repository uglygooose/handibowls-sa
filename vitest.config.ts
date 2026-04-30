import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/rls/**", "tests/rpc/**", "tests/integration/**", "e2e/**"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
