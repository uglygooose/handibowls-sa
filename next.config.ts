import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Phase 8d — wrap with `@serwist/turbopack`. The wrapper adds esbuild
// + esbuild-wasm to `serverExternalPackages` so the Serwist build
// (run inside the route handler at `app/[path]/route.ts`) can shell
// out to esbuild at request time without bundling its native binary
// into the server build. No webpack plugin path because Next 16 is
// Turbopack-first.

const baseConfig: NextConfig = {
  turbopack: {},
};

export default withSerwist(baseConfig);
