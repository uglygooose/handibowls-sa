import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

// Phase 8d — wrap with `@serwist/turbopack`. The wrapper adds esbuild
// + esbuild-wasm to `serverExternalPackages` so the Serwist build
// (run inside the route handler at `app/[path]/route.ts`) can shell
// out to esbuild at request time without bundling its native binary
// into the server build. No webpack plugin path because Next 16 is
// Turbopack-first.

// Phase 13 / 13-2 / Batch D-CSP → 13-5 / Batch B → 13-7 — Content-
// Security-Policy headers.
//
// Mode: Content-Security-Policy (enforcing) as of Phase 13 / 13-7
// Batch A reattack. Browser BLOCKS violating resources. Sentry CSP
// collector still receives violation reports via report-uri +
// report-to so any post-flip regression surfaces immediately in the
// Sentry dashboard.
//
// CSP emission moved out of next.config.ts and into proxy.ts —
// per-request nonce generation needs middleware/proxy execution
// context (next.config.ts:headers() is static). See lib/security/
// csp.ts for the builder + Sentry-endpoint resolver, and proxy.ts
// for the request-time stamp. Allow-list rationale + the broader
// CSP design (style-src 'unsafe-inline' Tailwind 4 trade-off,
// Sentry CSP collector wiring) is documented in DRIFT_LOG.md
// `csp-style-nonce-hardening` and the Phase 13 / 13-5 Batch B close.

const baseConfig: NextConfig = {
  turbopack: {},
};

// Phase 13 / 13-5 / Batch A → Batch B — wrap composition: withSerwist
// innermost (PWA SW injection), withSentryConfig outermost (Sentry
// build instrumentation). Batch B enables source-map upload —
// authToken from Vercel env unlocks the Sentry CLI upload step;
// deleteSourcemapsAfterUpload prevents .map files from shipping in
// the production bundle (kept privately on Sentry for symbolication).
export default withSentryConfig(withSerwist(baseConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: false,
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
});
