import "server-only";

import * as Sentry from "@sentry/nextjs";

// Phase 13 / 13-5 / Batch B — audit-log-context error helper.
// Wraps Sentry.captureException with structured tags + extra so
// errors thrown from audit_log-touching server actions land in the
// Sentry dashboard with enough context for compliance triage:
// which table, which action, which actor.
//
// Closes DRIFT entry `audit-log-error-telemetry` (re-tagged from
// Phase 12 to 13-5 at 13-prep). Pre-helper, audit_log-context
// errors returned `{ kind: "error", error: <message> }` result
// objects to the caller and were NOT logged anywhere — no console
// output, no telemetry. The helper closes that gap.

export type AuditContext = {
  /** The audit_log.table_name value the failed action was about to write. */
  table_name: string;
  /** Optional row UUID — present when the error occurred AFTER row identification. */
  row_id?: string;
  /** The audit_log.action value (e.g. `"cancel_own_booking"`, `"activate_rubric_version"`). */
  action: string;
  /** The actor's profile UUID (typically auth.uid() at call time). */
  actor_id?: string;
  /** Optional human-readable context — short note about the failed call, NOT PII. */
  reason?: string;
};

export function captureWithAuditContext(
  error: unknown,
  audit: AuditContext,
): void {
  Sentry.captureException(error, {
    tags: {
      audit_table: audit.table_name,
      audit_action: audit.action,
    },
    extra: {
      audit_context: audit,
    },
  });
}
