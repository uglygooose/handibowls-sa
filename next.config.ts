import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

// Phase 8d — wrap with `@serwist/turbopack`. The wrapper adds esbuild
// + esbuild-wasm to `serverExternalPackages` so the Serwist build
// (run inside the route handler at `app/[path]/route.ts`) can shell
// out to esbuild at request time without bundling its native binary
// into the server build. No webpack plugin path because Next 16 is
// Turbopack-first.

// Phase 13 / 13-2 / Batch D-CSP — Content-Security-Policy headers.
//
// Mode: Content-Security-Policy-Report-Only. Browser logs violations
// to console (and later to Sentry once 13-5 wires it) but does NOT
// block resources. Switch to enforcing CSP (drop the `-Report-Only`
// suffix) at 13-5 / 13-7 once the report-only stream is clean.
//
// Locked allow-list:
//   default-src 'self'
//   connect-src — Supabase REST + Storage (https) + Realtime (wss)
//                 + Resend (locked decision; SDK is server-side
//                 only so this entry is defence-in-depth for any
//                 future browser-side resend.com call).
//   script-src 'self' — NO 'unsafe-inline' / 'unsafe-eval'.
//   style-src 'self' 'unsafe-inline' — Tailwind 4's inline <style>
//                 injection trade-off. Phase 14 hardening DRIFT
//                 entry (csp-style-nonce-hardening) tracks the
//                 middleware-based nonce migration.
//   img-src — 'self' + data: + blob: covers inline SVGs, client-
//                 generated previews, and Supabase storage URLs.
//   font-src — 'self' + data: — fonts are self-hosted via next/font.
//   object-src 'none' — disables Flash + other plugins.
//   base-uri / form-action / frame-ancestors — defensive defaults.
//
// NOT in the allow-list:
//   - Sentry (deferred to 13-5; that commit extends connect-src).
//   - Vercel Analytics / Speed Insights (deferred until added).
//   - Any third-party CDN (none used today).

function buildContentSecurityPolicy(): string {
  // Resolve the Supabase host from the public env so the policy
  // tracks whichever project the deploy is wired to. Falls back
  // to the wildcard if the env is absent at build time (covers
  // local dev where .env.local hasn't been loaded yet).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseHost = "*.supabase.co";
  if (supabaseUrl) {
    try {
      supabaseHost = new URL(supabaseUrl).host;
    } catch {
      // Bad URL in env — fall through to wildcard.
    }
  }

  const directives = [
    "default-src 'self'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://resend.com`,
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${supabaseHost}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

const baseConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

// Phase 13 / 13-5 / Batch A — wrap composition: withSerwist innermost
// (transforms NextConfig with the PWA service-worker injection) and
// withSentryConfig outermost (instruments build for Sentry). Source-map
// upload is OFF here — `sourcemaps.disable: true` skips the Sentry CLI
// step entirely. Batch B flips `disable: false` and passes `authToken`
// to enable upload + symbolicated stack traces in the Sentry dashboard.
export default withSentryConfig(withSerwist(baseConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: false,
  sourcemaps: { disable: true },
});
