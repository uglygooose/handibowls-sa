import "server-only";

import { Resend } from "resend";

// Phase 11 / 11-1 — Resend client wrapper.
//
// Lazy-init pattern: the Resend constructor is cheap, but holding the
// instance across requests gives the SDK's internal HTTP keep-alive
// pool a chance to reuse sockets. The lazy guard means modules that
// import this file at build time (template snapshot tests, type
// checking) don't trip on a missing RESEND_API_KEY in CI / dev.
//
// `sendEmail` returns a discriminated result rather than throwing.
// In v1, the only outbound path is system-triggered InviteEmail
// (Phase 11 / 11-4 wires this); admin broadcasts are in-app only,
// so this client never participates in a fan-out hot loop. Typed
// kinds on the failure side still earn their keep at the
// invite-creation surface — bounce vs config-fault vs network
// flake all imply different retry / surface decisions.
//
// Out of scope for 11-1
//   • Idempotency key — Resend v6 SDK doesn't surface it on the
//     `emails.send` TypeScript signature in this minor. v1 doesn't
//     need it (one-shot per invite row); add when a use case
//     demands it (e.g. retry-friendly fan-out worker in a later
//     phase).
//   • Batch-send wrapper around resend.batch.send — not needed in
//     v1 (no admin email broadcasts).
//   • Webhook signature verification — dropped from Phase 11
//     entirely per the revised plan.

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _resend = new Resend(key);
  return _resend;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Override RESEND_FROM for a single send (e.g. invite emails that
   *  embed the inviting club admin's name). When omitted the global
   *  RESEND_FROM env var is used. */
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export type SendEmailFailureKind =
  | "config" // missing env / SDK init fault
  | "validation" // Resend rejected the request shape (4xx)
  | "rate_limit" // Resend 429
  | "network" // transport / fetch threw
  | "unknown"; // anything else

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; kind: SendEmailFailureKind; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from ?? process.env.RESEND_FROM;
  if (!from) {
    return {
      ok: false,
      kind: "config",
      error: "RESEND_FROM is not set and no per-send `from` override provided",
    };
  }

  let resend: Resend;
  try {
    resend = getResendClient();
  } catch (e) {
    return {
      ok: false,
      kind: "config",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.headers,
    });
    if (error) {
      return {
        ok: false,
        kind: classifyResendError(error),
        error: error.message ?? String(error),
      };
    }
    if (!data) {
      return {
        ok: false,
        kind: "unknown",
        error: "Resend returned neither data nor error",
      };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    return {
      ok: false,
      kind: "network",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function classifyResendError(err: { name?: string; message?: string }): SendEmailFailureKind {
  const name = (err.name ?? "").toLowerCase();
  const msg = (err.message ?? "").toLowerCase();
  if (name.includes("rate") || msg.includes("rate limit") || msg.includes("too many")) {
    return "rate_limit";
  }
  if (
    name.includes("validation") ||
    msg.includes("validation") ||
    msg.includes("invalid")
  ) {
    return "validation";
  }
  return "unknown";
}

/** Test-only escape hatch: clears the lazy-init cache so subsequent
 *  calls re-read RESEND_API_KEY from the environment. Production
 *  code should never call this; vitest setup may. */
export function __resetResendClientForTests(): void {
  _resend = null;
}
