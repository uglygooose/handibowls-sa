import * as Sentry from "@sentry/nextjs";

// Phase 13 / 13-5 / Batch A — Sentry browser SDK init. Next.js
// conventional file. Loaded once at first client render; subsequent
// navigations reuse the singleton.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // POPIA: never auto-attach IP / headers / cookies. setUser() is wired
  // separately in the auth listener with id-only (no email, no IP).
  sendDefaultPii: false,

  // 50% trace sampling — gives a meaningful trace stream without burning
  // quota on the launch month's volume. Revisit once Sentry's quota
  // dashboard reveals the actual baseline.
  tracesSampleRate: 0.5,

  // Replay: explicitly OFF for v1. Bandwidth + POPIA surface area aren't
  // worth the diagnostic value at this scale; revisit if a real incident
  // reveals a gap.

  // Filter the noise classes Sentry's community baseline calls out:
  // ResizeObserver loop limit warnings (cosmetic, browser-internal),
  // browser-extension stack frames (third-party origin, not our code),
  // and network errors from blocked third-party requests.
  beforeSend(event, hint) {
    const error = hint.originalException as { message?: string } | undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : typeof event.message === "string"
          ? event.message
          : "";

    if (/ResizeObserver loop/i.test(message)) return null;

    // Stack frames from extensions — extensions inject their own scripts
    // into the page and throw errors that bubble through our SDK. The
    // extension URLs are stable enough to filter on the source path.
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    for (const frame of frames) {
      const filename = frame.filename ?? "";
      if (
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        filename.includes("safari-extension://") ||
        filename.includes("safari-web-extension://")
      ) {
        return null;
      }
    }

    // Network errors from blocked third-party requests — analytics
    // pixels, ad blockers, etc. The browser surfaces these as generic
    // "Failed to fetch" / "Load failed" / "NetworkError"; they're noise.
    if (/^(Failed to fetch|Load failed|NetworkError when attempting)/i.test(message)) {
      return null;
    }

    return event;
  },
});

// Instruments router navigations as separate spans inside the page-load
// transaction — needed for the App Router transition timing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
