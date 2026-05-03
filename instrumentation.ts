import * as Sentry from "@sentry/nextjs";

// Phase 13 / 13-5 / Batch A — Sentry instrumentation hook. Next.js
// conventional file: register() runs once per server boot; the runtime-
// gated import lets us ship a single SDK install that loads the right
// config based on which runtime serves the request.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown from Server Components, Route Handlers,
// Server Actions, and middleware — the whole server-render path.
export const onRequestError = Sentry.captureRequestError;
