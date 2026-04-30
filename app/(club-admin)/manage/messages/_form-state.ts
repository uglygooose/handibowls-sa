// Phase 11 / 11-3b — Compose form state contract.
//
// Lives outside `_actions.ts` because that file carries the
// `"use server"` directive: a Client Component (ComposeForm)
// importing a plain-object constant from a server-actions module
// receives `undefined` at runtime — the bundler only exposes the
// async functions as server references. Same class of bug as the
// Phase 10 / 10-5 fix at app/(club-admin)/manage/t20/_form-state.ts
// (commit cd6d068) and the THEME_PRESETS server-module taint
// flagged in CLAUDE.md.
//
// Type and initial value live here; both `_actions.ts` (server)
// and the form Client Component import from this neutral module
// so the shape is single-sourced.

// 12-3 / A4: 'schedule' removed alongside the Send-later UI. Compose
// form only emits 'save_draft' or 'send_now'.
export type ComposeAction = "save_draft" | "send_now";

export type ComposeFormState =
  | { kind: "idle" }
  | {
      kind: "ok";
      messageId: string;
      action: ComposeAction;
      recipientCount?: number;
    }
  | { kind: "no_club" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "wrong_state" }
  | { kind: "audience_invalid"; error: string }
  | { kind: "forbidden"; error: string }
  | { kind: "error"; error: string };

export const COMPOSE_INITIAL: ComposeFormState = { kind: "idle" };
