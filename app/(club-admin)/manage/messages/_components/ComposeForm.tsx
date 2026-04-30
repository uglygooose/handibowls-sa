"use client";

import { Inbox, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { composeMessageFromForm } from "../_actions";
import type { MemberOption, TournamentOption } from "../_data";
import { COMPOSE_INITIAL, type ComposeFormState } from "../_form-state";
import {
  AudiencePicker,
  type AudiencePickerValue,
} from "./AudiencePicker";

// Phase 11 / 11-3 — admin Messages compose form (Client island).
//
// 5 numbered sections matching /manage/t20/new's rhythm:
//   1. Subject       single text input, required, max 120 chars
//   2. Body          markdown textarea, required, max 5000 chars,
//                    live char count
//   3. Audience      Full picker via <AudiencePicker> — all_members
//                    / tournament_entrants (with dropdown) / custom
//                    (with searchable multi-select). 11-3c upgrade.
//   4. Schedule      radio group: Send now / Send later. Later
//                    reveals a datetime-local input.
//   5. Channel       read-only "In-app only" pill — locked
//                    decision #1, no toggle.
//
// Footer:
//   • Cancel              Link to /manage/messages
//   • Save as draft       writes status='draft', redirect to list
//   • Send now            writes status='draft', queues, calls
//                         send_message RPC, redirect to list
//   • Schedule            writes status='queued' + scheduled_at,
//                         redirect to list
//
// Per the Phase 10 manual-QA learning, helper text under the
// disabled submit button explicitly lists what's missing — admin
// shouldn't have to guess why a button won't activate.

const MAX_SUBJECT = 120;
const MAX_BODY = 5000;

type ScheduleMode = "now" | "later";

type ComposeFormProps = {
  /** Tournament dropdown source for the audience_kind=tournament_entrants
   *  branch. Server-fetched + RLS-scoped at the new-page render. */
  tournaments: TournamentOption[];
  /** Active member roster for the audience_kind=custom multi-select.
   *  Server-fetched + RLS-scoped at the new-page render. */
  members: MemberOption[];
};

export function ComposeForm({ tournaments, members }: ComposeFormProps) {
  const [state, formAction, pending] = useActionState<
    ComposeFormState,
    FormData
  >(composeMessageFromForm, COMPOSE_INITIAL);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AudiencePickerValue>({
    audience_kind: "all_members",
    audience_tournament_id: null,
    audience_profile_ids: [],
  });
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  // Snapshot "now" once at mount via lazy useState — keeps the
  // render pure (React Compiler doesn't trip on Date.now() inside a
  // useState initialiser). The value drifts slightly across the
  // form's lifetime; the server-side Zod .refine() enforces the
  // strict future check at submit. The render-time gate is
  // UX-friendly disable, not the authoritative validator.
  const [mountedNowMs] = useState(() => Date.now());

  // ---------- validation ----------
  const subjectTrimmed = subject.trim();
  const bodyTrimmed = body.trim();
  const subjectValid =
    subjectTrimmed.length > 0 && subjectTrimmed.length <= MAX_SUBJECT;
  const bodyValid = bodyTrimmed.length > 0 && bodyTrimmed.length <= MAX_BODY;
  // Audience validity rules:
  //   all_members         always valid
  //   tournament_entrants requires a tournament_id
  //   custom              requires at least one selected member
  const audienceValid =
    (audience.audience_kind === "all_members") ||
    (audience.audience_kind === "tournament_entrants" &&
      Boolean(audience.audience_tournament_id)) ||
    (audience.audience_kind === "custom" &&
      audience.audience_profile_ids.length > 0);
  const scheduleValid =
    scheduleMode === "now" ||
    (scheduledAt.length > 0 &&
      new Date(scheduledAt).getTime() > mountedNowMs);

  const baseValid = subjectValid && bodyValid && audienceValid;
  const sendNowValid = baseValid && scheduleMode === "now";
  const scheduleSubmitValid = baseValid && scheduleMode === "later" && scheduleValid;
  const draftValid = subjectValid && bodyValid; // can save partial audience as draft

  const missingHints = useMemo(() => {
    const out: string[] = [];
    if (!subjectValid) out.push("subject");
    if (!bodyValid) out.push("body");
    if (
      audience.audience_kind === "tournament_entrants" &&
      !audience.audience_tournament_id
    ) {
      out.push("tournament");
    }
    if (
      audience.audience_kind === "custom" &&
      audience.audience_profile_ids.length === 0
    ) {
      out.push("at least one member");
    }
    if (scheduleMode === "later" && !scheduleValid) out.push("future schedule time");
    return out;
  }, [
    subjectValid,
    bodyValid,
    audience.audience_kind,
    audience.audience_tournament_id,
    audience.audience_profile_ids.length,
    scheduleMode,
    scheduleValid,
  ]);

  const errorBanner =
    state.kind !== "idle" && state.kind !== "ok" ? renderError(state) : null;

  return (
    <form
      action={formAction}
      data-slot="compose-form"
      className="overflow-hidden rounded-2xl border border-border bg-bone"
    >
      {/* Hidden mirrors. compose_action is NOT mirrored from state —
          each submit button carries its own name/value (`compose_action=...`)
          so the chosen action survives React's state batching at click time. */}
      <input type="hidden" name="audience_kind" value={audience.audience_kind} />
      <input
        type="hidden"
        name="audience_tournament_id"
        value={audience.audience_tournament_id ?? ""}
      />
      <input
        type="hidden"
        name="audience_profile_ids"
        value={audience.audience_profile_ids.join(",")}
      />
      {scheduleMode === "later" && (
        <input type="hidden" name="scheduled_at" value={scheduledAt} />
      )}

      {errorBanner}

      {/* Section 1 — Subject */}
      <FormSection
        index={1}
        title="Subject"
        desc="The line members see in their inbox preview."
        required
      >
        <FieldLabel htmlFor="subject">Subject</FieldLabel>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          autoComplete="off"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Practice tomorrow at 17:00"
          maxLength={MAX_SUBJECT}
          data-slot="subject-input"
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-bone px-3.5 text-[14px]",
            "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
          )}
        />
        <p className="mt-1 flex justify-between font-mono text-[11px] text-ink-muted">
          <span>Keep it short — most clients truncate at ~60 chars.</span>
          <span data-slot="subject-count">
            {subjectTrimmed.length} / {MAX_SUBJECT}
          </span>
        </p>
      </FormSection>

      {/* Section 2 — Body */}
      <FormSection
        index={2}
        title="Body"
        desc="Markdown is supported. Members see the full body when they tap the message."
        required
      >
        <FieldLabel htmlFor="body_md">Message body</FieldLabel>
        <textarea
          id="body_md"
          name="body_md"
          required
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          placeholder={"Hi everyone,\n\nReminder that practice starts at 17:00 tomorrow. Bring two extra ends.\n\n— Andrew"}
          data-slot="body-input"
          className={cn(
            "w-full rounded-lg border border-border bg-bone px-3.5 py-3 font-mono text-[13px]",
            "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
          )}
        />
        <p className="mt-1 flex justify-between font-mono text-[11px] text-ink-muted">
          <span>Markdown: **bold**, *italic*, [links](url). Body preview truncates at 140 chars.</span>
          <span data-slot="body-count">
            {bodyTrimmed.length} / {MAX_BODY}
          </span>
        </p>
      </FormSection>

      {/* Section 3 — Audience */}
      <FormSection
        index={3}
        title="Audience"
        desc="Who receives this broadcast."
        required
      >
        <AudiencePicker
          value={audience}
          onChange={setAudience}
          tournaments={tournaments}
          members={members}
        />
      </FormSection>

      {/* Section 4 — Schedule */}
      <FormSection
        index={4}
        title="Schedule"
        desc="Send right now, or schedule for later."
      >
        <div data-slot="schedule-radios" className="flex flex-col gap-2">
          <ScheduleRadio
            value="now"
            current={scheduleMode}
            onChange={setScheduleMode}
            label="Send now"
            sub="Fan out the broadcast as soon as you tap Send."
          />
          <ScheduleRadio
            value="later"
            current={scheduleMode}
            onChange={setScheduleMode}
            label="Send later"
            sub="Pick a future date / time. Dispatch worker is a future phase."
          />
        </div>
        {scheduleMode === "later" && (
          <div className="mt-3" data-slot="schedule-input-row">
            <FieldLabel htmlFor="scheduled-at">Schedule for</FieldLabel>
            <input
              id="scheduled-at"
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              data-slot="schedule-input"
              className={cn(
                "h-11 w-full max-w-sm rounded-lg border border-border bg-bone px-3.5 text-[14px]",
                "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
              )}
            />
            <p className="mt-1 font-mono text-[11px] text-ink-muted">
              Local time. Must be in the future.
            </p>
          </div>
        )}
      </FormSection>

      {/* Section 5 — Channel (read-only) */}
      <FormSection
        index={5}
        title="Channel"
        desc="Locked to in-app for v1."
      >
        <div
          data-slot="channel-locked-card"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500"
          >
            <Inbox className="size-3.5" />
          </span>
          <div className="text-[13px]">
            <div className="font-bold text-ink">In-app only.</div>
            <p className="text-ink-muted">
              Members see this in their HandiBowls inbox + bell. Email
              broadcasts are out of scope for v1; the only outbound email
              path is system-triggered InviteEmail at invite-creation time.
            </p>
          </div>
        </div>
      </FormSection>

      {/* Footer */}
      <div
        data-slot="compose-footer"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted px-7 py-5"
      >
        <Link
          href="/manage/messages"
          data-slot="cancel-cta"
          className="inline-flex h-11 items-center rounded-lg px-3 text-[13px] font-medium text-ink hover:bg-surface"
        >
          Cancel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {missingHints.length > 0 && (
            <p
              data-slot="missing-hints"
              role="status"
              className="font-mono text-[11px] text-ink-muted"
            >
              Add {missingHints.join(", ")} to enable Send / Schedule.
            </p>
          )}
          <button
            type="submit"
            name="compose_action"
            value="save_draft"
            disabled={!draftValid || pending}
            data-slot="save-draft-cta"
            className={cn(
              "inline-flex h-11 cursor-pointer items-center rounded-lg border border-border bg-bone px-4 text-[13px] font-medium text-ink",
              "hover:bg-surface",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Save as draft
          </button>
          {scheduleMode === "later" ? (
            <button
              type="submit"
              name="compose_action"
              value="schedule"
              disabled={!scheduleSubmitValid || pending}
              data-slot="schedule-cta"
              className={cn(
                "inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-6 text-[14px] font-semibold text-on-primary shadow-sm",
                "hover:bg-primary-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {pending ? "Scheduling…" : "Schedule"}
            </button>
          ) : (
            <button
              type="submit"
              name="compose_action"
              value="send_now"
              disabled={!sendNowValid || pending}
              data-slot="send-now-cta"
              className={cn(
                "inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-6 text-[14px] font-semibold text-on-primary shadow-sm",
                "hover:bg-primary-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Send className="size-4" aria-hidden="true" />
              {pending ? "Sending…" : "Send now"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Section primitives — local copies of the t20 form pattern. Kept inline
// rather than extracted to a shared module because the visual rhythm is
// owned by the form file, and a shared abstraction would have to handle
// every form's drift; better to keep one clear pattern per surface.
// ---------------------------------------------------------------------

function FormSection({
  index,
  title,
  desc,
  required = false,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      data-slot="form-section"
      data-section-index={index}
      className="border-b border-border px-7 py-6 last:border-b-0"
    >
      <header className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[20px] font-black italic leading-tight tracking-tight">
            {index}. {title}
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">{desc}</p>
        </div>
        {required && (
          <span
            data-slot="required-pill"
            className="inline-flex h-6 items-center rounded-full bg-primary-500 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-on-primary"
          >
            Required
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
    >
      {children}
    </label>
  );
}

function ScheduleRadio({
  value,
  current,
  onChange,
  label,
  sub,
}: {
  value: ScheduleMode;
  current: ScheduleMode;
  onChange: (v: ScheduleMode) => void;
  label: string;
  sub: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      data-slot="schedule-radio"
      data-value={value}
      data-active={active}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        active
          ? "border-ink bg-ink/4 ring-2 ring-ink/10"
          : "border-border bg-bone hover:border-ink/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-ink bg-ink" : "border-border bg-bone",
        )}
      >
        {active && <span className="size-2 rounded-full bg-bone" />}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-bold tracking-tight">
          {label}
        </span>
        <span className="block text-[12.5px] text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------

function renderError(state: ComposeFormState): React.ReactNode {
  if (state.kind === "idle" || state.kind === "ok") return null;
  const map: Record<string, string> = {
    no_club: "No club is in scope for this account.",
    auth: "You must be signed in to send messages.",
    validation: "Form validation failed. Please review the fields.",
    wrong_state:
      "This message is no longer in draft state — refresh the page.",
    audience_invalid:
      "Audience resolution failed. The message was queued but not delivered. Edit and try again.",
    forbidden: "You don't have permission to send messages for this club.",
    error: "Something went wrong. Please try again.",
  };
  const detail =
    "error" in state && state.error
      ? state.error
      : (map[state.kind] ?? "Unknown error.");
  return (
    <div
      data-slot="compose-error-banner"
      data-kind={state.kind}
      role="alert"
      className="border-b border-danger-500/20 bg-danger-500/8 px-7 py-3.5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-danger-500 text-[12px] font-bold text-bone"
        >
          <X className="size-3" />
        </span>
        <div>
          <div className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-danger-500">
            {state.kind.replace(/_/g, " ")}
          </div>
          <div className="text-[13px]">{detail}</div>
        </div>
      </div>
    </div>
  );
}
