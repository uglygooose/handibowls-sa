// Phase 10 / 10-5 — Twenty 20 New form state contract.
//
// Lives outside `_actions.ts` because that file carries the
// `"use server"` directive: a Client Component (NewAssessmentForm)
// importing a plain-object constant from a server-actions module
// receives `undefined` at runtime — the bundler only exposes the
// async functions as server references. Same class of bug as the
// THEME_PRESETS server-module taint flagged in CLAUDE.md.
//
// Type and initial value live here; both `_actions.ts` (server) and
// the form Client Component import from this neutral module so the
// shape is single-sourced.

export type CreateAssessmentFormState =
  | { kind: "idle" }
  | { kind: "ok"; assessmentId: string }
  | { kind: "no_club" }
  | { kind: "no_active_rubric" }
  | { kind: "validation"; error: string }
  | { kind: "auth"; error: string }
  | { kind: "error"; error: string };

export const CREATE_ASSESSMENT_INITIAL: CreateAssessmentFormState = {
  kind: "idle",
};
