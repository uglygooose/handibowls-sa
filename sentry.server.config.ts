import * as Sentry from "@sentry/nextjs";

// Phase 13 / 13-5 / Batch A — Sentry server SDK init. Loaded by
// instrumentation.ts when NEXT_RUNTIME === "nodejs". Runs in every
// Server Component render, Route Handler invocation, and Server Action.

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // POPIA: never auto-capture request headers / IP / body. The
  // belt-and-braces beforeSend below also nulls event.request.data
  // unconditionally so a future flip of sendDefaultPii→true doesn't
  // silently leak request payloads into Sentry events.
  sendDefaultPii: false,

  // 50% trace sampling — same calibration as the browser SDK; the
  // server volume profile is dominated by Server Action calls + Route
  // Handlers, both of which we want visibility on.
  tracesSampleRate: 0.5,

  beforeSend(event, hint) {
    // Belt-and-braces PII: drop request body unconditionally on every
    // server-side event. sendDefaultPii: false should already prevent
    // this from being populated, but the filter is explicit defence
    // against future configuration drift on routes touching profiles /
    // consents / email / bsa_number (e.g. /api/me/export, /me/setup
    // actions, POPIA admin actions, message broadcast actions).
    if (event.request) {
      event.request.data = undefined;
    }

    const error = hint.originalException as
      | { message?: string; code?: string; digest?: string }
      | undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof event.message === "string"
          ? event.message
          : "";

    // Auth gate failures — every protected surface throws "Not
    // authenticated" when a session is missing. Working as intended;
    // the redirect to /login is the correct UX, not an error to
    // triage.
    if (message === "Not authenticated") return null;

    // Postgres RLS denial. Working as intended whenever a user
    // attempts a cross-club / cross-role read/write — RLS is the
    // security boundary doing its job. Capturing these as Sentry
    // errors generates noise from honest-actor edge cases (a user
    // whose membership changed mid-session) and from genuine
    // cross-club probes (which we don't want to wake on).
    if (error?.code === "42501") return null;

    // Next.js redirect() throws an internal error to short-circuit
    // render; the digest "NEXT_REDIRECT" identifies it. Control
    // flow, not a bug.
    if (error?.digest && /^NEXT_REDIRECT/.test(error.digest)) return null;

    return event;
  },
});
