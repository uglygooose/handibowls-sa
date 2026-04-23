import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Integration tests that hit a live local Supabase stack. Keep these in a
// separate config so they don't get pulled into the default `vitest run`
// (which uses jsdom for component tests).
const env: Record<string, string> = {};
const envPath = path.resolve(__dirname, ".env.test");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/rls/**/*.test.ts", "tests/rpc/**/*.test.ts"],
    environment: "node",
    globals: true,
    env,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
