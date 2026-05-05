// Phase 13 / 13-8 / Batch A / Commit 2 — vitest config for the
// `tests/scripts/**` suite (post-seed coverage matrix verification).
//
// Kept separate from `vitest.config.ts` so the unit suite (npm test)
// doesn't hit cloud Supabase. Run via `npm run seed:demo:verify`.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/scripts/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    testTimeout: 60_000,
  },
});
