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
// Mode: Content-Security-Policy (enforcing) as of Phase 13 / 13-7.
// Browser BLOCKS violating resources. Sentry CSP collector still
// receives violation reports via report-uri + report-to so any
// post-flip regression surfaces immediately in the Sentry dashboard.
//
// Pre-flip safety baseline: zero inline <script>, eval, new Function,
// or dangerouslySetInnerHTML across app/ + components/ (grep at 13-7
// kickoff); zero violations on /login + / from the 13-2 production-
// build capture run. Authenticated-surface coverage gap noted in
// 13-5 close summary — auth shells were not in the pre-flip capture
// scope; operator confirms the smoke-test list in
// docs/LAUNCH_DEPLOY_DRY_RUN.md exercises auth surfaces post-deploy.
//
// Locked allow-list:
//   default-src 'self'
//   connect-src — Supabase REST + Storage (https) + Realtime (wss)
//                 + Resend (defence-in-depth) + Sentry ingest host
//                 (browser SDK error transport).
//   script-src 'self' — NO 'unsafe-inline' / 'unsafe-eval'.
//   style-src 'self' 'unsafe-inline' — Tailwind 4 inline <style>
//                 injection trade-off (csp-style-nonce-hardening
//                 DRIFT entry tracks the Phase 14 nonce migration).
//   img-src — 'self' + data: + blob: + Supabase storage URLs.
//   font-src — 'self' + data: — fonts self-hosted via next/font.
//   object-src 'none' — disables Flash + other plugins.
//   base-uri / form-action / frame-ancestors — defensive defaults.
//   report-uri / report-to — Sentry CSP collector for the
//                 authenticated-surface coverage gap (closes DRIFT
//                 csp-authenticated-surface-violation-capture).

// Sentry CSP collector + browser SDK ingest host. Parsed from the
// public DSN at build time with a hardcoded fallback that matches
// the production project — so dev / preview without the env var
// still emit a working policy. DSN format:
// https://<public_key>@<host>/<project_id> →
// CSP report URL: https://<host>/api/<project_id>/security/?sentry_key=<public_key>
type SentryEndpoint = {
  host: string;
  projectId: string;
  publicKey: string;
  reportUrl: string;
};

function resolveSentryEndpoint(): SentryEndpoint {
  // Hardcoded production values — fallback when the DSN env var isn't
  // resolvable at build time. Stable per project; rotate if the
  // Sentry project is recreated.
  const fallback: SentryEndpoint = {
    host: "o4511319521558528.ingest.de.sentry.io",
    projectId: "4511319531389008",
    publicKey: "0962a2cf918960eedaf6d2cc8ded69c4",
    reportUrl: "",
  };
  fallback.reportUrl = `https://${fallback.host}/api/${fallback.projectId}/security/?sentry_key=${fallback.publicKey}`;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return fallback;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    const publicKey = u.username;
    if (!projectId || !publicKey) return fallback;
    return {
      host: u.host,
      projectId,
      publicKey,
      reportUrl: `https://${u.host}/api/${projectId}/security/?sentry_key=${publicKey}`,
    };
  } catch {
    return fallback;
  }
}

function buildContentSecurityPolicy(sentry: SentryEndpoint): string {
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
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://resend.com https://${sentry.host}`,
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${supabaseHost}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${sentry.reportUrl}`,
    "report-to csp-endpoint",
  ];
  return directives.join("; ");
}

const baseConfig: NextConfig = {
  turbopack: {},
  async headers() {
    const sentry = resolveSentryEndpoint();
    // Reporting-Endpoints is a separate HTTP header that defines the
    // named groups referenced by CSP's `report-to` directive. Modern
    // browsers (Chrome / Edge) prefer this; older browsers fall back
    // to the legacy `report-uri`. Both reference the same Sentry
    // collector URL — Sentry accepts both report shapes.
    const reportingEndpoints = `csp-endpoint="${sentry.reportUrl}"`;
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: buildContentSecurityPolicy(sentry),
          },
          {
            key: "Reporting-Endpoints",
            value: reportingEndpoints,
          },
        ],
      },
    ];
  },
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
