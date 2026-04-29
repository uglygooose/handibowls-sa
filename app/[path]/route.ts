import { spawnSync } from "node:child_process";

import { createSerwistRoute } from "@serwist/turbopack";

// Phase 8d — Turbopack-compatible Serwist route handler. Replaces the
// Phase-3 deferred `withSerwistInit` wrapper (incompatible with Next
// 16's Turbopack-first build pipeline). The route compiles `app/sw.ts`
// at request time, exposes the result at `/sw.js` (the URL the browser
// registers), and stamps a precache manifest based on the build output.
//
// Why the file lives at `app/[path]/route.ts` (root-level dynamic):
// `createSerwistRoute` returns `generateStaticParams()` that yields
// `[{ path: "sw.js" }]` — Serwist names the bundle entry `sw` so the
// emitted file is `sw.js`. With `dynamicParams: false`, only the
// generated paths resolve; any other top-level URL falls through to
// the matching static folder under `app/` (which Next prioritises over
// dynamic segments at the same level). So `/sw.js` reaches Serwist;
// `/play`, `/tournaments`, etc. continue to resolve to their own
// static folders unchanged.
//
// Revision: HEAD's commit SHA — bumps the precache version on every
// commit so old cached responses get purged when a new build ships.
// Falls back to a UUID when run outside a git repo (e.g. preview
// deployments). Lifted from the Serwist docs example.

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    useNativeEsbuild: true,
  });
