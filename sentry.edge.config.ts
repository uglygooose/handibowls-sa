import * as Sentry from "@sentry/nextjs";

// Phase 13 / 13-5 / Batch A — Sentry edge SDK init. Loaded by
// instrumentation.ts when NEXT_RUNTIME === "edge". v1 doesn't use
// edge runtime explicitly, but ship for completeness so future edge
// route handlers (if any) land instrumented from the first request.
//
// Per Vercel knowledge update (2026-02-27): Edge Functions are
// deprecated in favour of Fluid Compute. This file's relevance may
// diminish further; revisit at Phase 14 if the codebase actively
// uses an edge route handler.

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0.5,
  beforeSend(event, hint) {
    const error = hint.originalException as
      | { code?: string; digest?: string }
      | undefined;

    // Same RLS-denial filter as the server config — Postgres errors
    // bubble through whether the route runs in nodejs or edge.
    if (error?.code === "42501") return null;
    if (error?.digest && /^NEXT_REDIRECT/.test(error.digest)) return null;

    return event;
  },
});
