// Phase 13 / 13-7 Batch A reattack — Content-Security-Policy builder.
//
// Per-request nonce CSP per the Next.js 16 documented pattern
// (https://nextjs.org/docs/app/guides/content-security-policy). The
// header is emitted from `proxy.ts` because the nonce changes per
// request — `next.config.ts:headers()` is static.
//
// Architecture:
//   proxy.ts → generateNonce() → buildContentSecurityPolicy(nonce, env)
//          → response.headers.set("Content-Security-Policy", ...)
//          → request.headers.set("x-nonce", nonce)  (read by Next's
//                                                    framework script
//                                                    injection + by
//                                                    Server Components
//                                                    via headers())
//
// Allow-list rationale + the broader CSP design (style-src
// 'unsafe-inline' Tailwind 4 trade-off, Sentry CSP collector wiring)
// is documented in DRIFT_LOG.md `csp-style-nonce-hardening` and the
// Phase 13 / 13-5 Batch B close.

// Sentry CSP collector + browser SDK ingest host. Parsed from the
// public DSN at request time with a hardcoded fallback that matches
// the production project — so dev / preview without the env var
// still emit a working policy. DSN format:
//   https://<public_key>@<host>/<project_id>
// CSP report URL:
//   https://<host>/api/<project_id>/security/?sentry_key=<public_key>
export type SentryEndpoint = {
  host: string;
  projectId: string;
  publicKey: string;
  reportUrl: string;
};

export function resolveSentryEndpoint(): SentryEndpoint {
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

// Cryptographically random nonce. Edge-runtime compatible — uses Web
// Crypto's randomUUID + global btoa (no Node Buffer dependency so the
// proxy stays portable across runtimes).
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

export type CspEnv = {
  nonce: string;
  // Vercel deployment environment. `production` is the production deploy
  // (apex domain); `preview` covers preview URLs; `development` covers
  // `vercel dev`; `undefined` covers local `next dev`.
  vercelEnv: string | undefined;
  // process.env.NODE_ENV at request time. `development` for `next dev`,
  // `production` everywhere else.
  nodeEnv: string | undefined;
  sentry: SentryEndpoint;
};

export function buildContentSecurityPolicy(env: CspEnv): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseHost = "*.supabase.co";
  if (supabaseUrl) {
    try {
      supabaseHost = new URL(supabaseUrl).host;
    } catch {
      // Bad URL in env — fall through to wildcard.
    }
  }

  // Vercel feedback widget loads vercel.live/_next-live/feedback/
  // feedback.js on every Vercel deployment that is NOT the production
  // alias (i.e. on every preview URL + `vercel dev`). Without
  // allowlisting, ~60 inline-script + connect violations land on the
  // preview deploy. The widget never loads on production custom
  // domains so vercel.live stays out of the production allow-list.
  const isVercelNonProd =
    env.vercelEnv !== undefined && env.vercelEnv !== "production";
  const vercelLiveOrigin = isVercelNonProd ? " https://vercel.live" : "";

  // `next dev` uses `eval` for HMR + React DevTools wiring, which CSP
  // blocks without 'unsafe-eval'. Production + Vercel preview build is
  // a static bundle with no eval, so the relaxation is dev-only.
  const isLocalDev = env.nodeEnv === "development";
  const unsafeEvalIfDev = isLocalDev ? " 'unsafe-eval'" : "";

  const directives = [
    "default-src 'self'",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://resend.com https://${env.sentry.host}${vercelLiveOrigin}`,
    `script-src 'self' 'nonce-${env.nonce}'${vercelLiveOrigin}${unsafeEvalIfDev}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${supabaseHost}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${env.sentry.reportUrl}`,
    "report-to csp-endpoint",
  ];
  return directives.join("; ");
}

// `Reporting-Endpoints` is a separate HTTP header that defines the
// named groups referenced by CSP's `report-to` directive. Modern
// browsers (Chrome / Edge) prefer this; older browsers fall back to
// the legacy `report-uri`. Both reference the same Sentry collector
// URL — Sentry accepts both report shapes.
export function buildReportingEndpoints(sentry: SentryEndpoint): string {
  return `csp-endpoint="${sentry.reportUrl}"`;
}

// Convenience reader for proxy.ts — a single call site that gathers
// the per-request env shape. Pulled out for testability.
export function readCspEnv(): Omit<CspEnv, "nonce" | "sentry"> {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  };
}
