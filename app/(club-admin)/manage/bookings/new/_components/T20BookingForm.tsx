"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminScheduleT20Assessment,
  type ScheduleT20AssessmentResult,
} from "../_actions";
import type {
  BookingFormMember,
  BookingFormRink,
} from "../_data";

// Phase 12 / 12-1 followup — admin form for scheduling a Twenty 20
// assessment booking. Wraps adminScheduleT20Assessment.
//
// Pre-fill via query params (player_id, request_message_id) is
// resolved at the parent Server Component layer; this island just
// receives the resolved initialPlayerId / requestMessageId.

type Props = {
  members: BookingFormMember[];
  rinks: BookingFormRink[];
  clubName: string;
  /** Pre-selected player from a "Schedule from this request" deep link.
   *  Null when the admin opened the form directly. */
  initialPlayerId: string | null;
  /** Echo of the request message id so the form can include a link
   *  back to the originating message after submission. Display-only. */
  requestMessageId: string | null;
};

const DEFAULT_DURATION_MIN = 90;

export function T20BookingForm({
  members,
  rinks,
  clubName,
  initialPlayerId,
  requestMessageId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [playerId, setPlayerId] = useState<string>(initialPlayerId ?? "");
  const [rinkId, setRinkId] = useState<string>("");
  // Lazy initialiser — React Compiler flags Date-touching calls as
  // impure when invoked directly in render; wrapping in a thunk runs
  // it once on mount only. Same pattern for `mountedNowMs` below
  // (one Date.now snapshot per form instance — drift across the form's
  // lifetime is fine because the server-side Zod refine + the RPC's
  // bad_input check are the authoritative validators).
  const [startsAt, setStartsAt] = useState<string>(() => defaultStartsAtLocal());
  const [mountedNowMs] = useState(() => Date.now());
  const [durationMin, setDurationMin] = useState<number>(DEFAULT_DURATION_MIN);
  const [notes, setNotes] = useState<string>("");

  const playerValid = playerId.length > 0;
  const rinkValid = rinkId.length > 0;
  const startsAtValid =
    startsAt.length > 0 && new Date(startsAt).getTime() > mountedNowMs - 5 * 60_000;
  const durationValid = durationMin >= 15 && durationMin <= 240;
  const formValid = playerValid && rinkValid && startsAtValid && durationValid;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formValid || pending) return;
    startTransition(async () => {
      const result: ScheduleT20AssessmentResult =
        await adminScheduleT20Assessment({
          player_id: playerId,
          rink_id: rinkId,
          // Convert datetime-local "YYYY-MM-DDTHH:MM" to a full ISO
          // timestamp by trusting the browser's local-tz interpretation.
          // The server-side Zod refine + the RPC's bad_input check are
          // the authoritative validators.
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: durationMin,
          notes: notes.trim().length > 0 ? notes.trim() : null,
        });

      switch (result.kind) {
        case "ok": {
          const memberName =
            members.find((m) => m.profile_id === playerId)?.name ?? "the player";
          toast.success("Assessment scheduled", {
            description: `Notification sent to ${memberName}.`,
          });
          router.push("/manage/overview");
          return;
        }
        case "slot_taken":
          toast.error("Slot taken", {
            description:
              "Another booking covers this rink at the same time. Pick a different rink or time.",
          });
          return;
        case "wrong_player":
          toast.error("Player not at this club", {
            description:
              `Selected player isn't an active member of ${clubName}. Refresh to update the roster.`,
          });
          return;
        case "wrong_club":
          toast.error("Wrong club", {
            description:
              "That rink belongs to a club you don't admin. Switch clubs and retry.",
          });
          return;
        case "wrong_role":
          toast.error("Permission denied", {
            description:
              "Your account doesn't have club_admin permissions for this club.",
          });
          return;
        case "bad_input":
          toast.error("Invalid time", {
            description:
              "Start time must be in the future and end time must be after start.",
          });
          return;
        case "not_authenticated":
          toast.error("Sign in again");
          return;
        case "validation":
          toast.error("Validation error", { description: result.message });
          return;
        case "error":
          toast.error("Couldn't schedule", { description: result.message });
          return;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {requestMessageId && (
        <div className="rounded-md border border-primary-500/30 bg-primary-500/5 px-4 py-3 text-[13px] text-ink-muted">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary-600">
            From request
          </span>
          <p className="m-0 mt-1">
            This booking was opened from a Twenty 20 assessment request in{" "}
            <Link
              href="/manage/messages"
              className="font-bold text-primary-600 hover:underline"
            >
              /manage/messages
            </Link>
            . The originating message stays in the inbox.
          </p>
        </div>
      )}

      <Field label="Player" required>
        <select
          name="player_id"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          required
          className="h-10 w-full rounded-md border border-border bg-bone px-3 text-[14px]"
        >
          <option value="">— select a player —</option>
          {members.map((m) => (
            <option key={m.profile_id} value={m.profile_id}>
              {m.name}
              {m.bsa_number ? ` · BSA ${m.bsa_number}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Rink" required>
        <select
          name="rink_id"
          value={rinkId}
          onChange={(e) => setRinkId(e.target.value)}
          required
          className="h-10 w-full rounded-md border border-border bg-bone px-3 text-[14px]"
        >
          <option value="">— select a rink —</option>
          {rinks.map((r) => (
            <option
              key={r.rink_id}
              value={r.rink_id}
              disabled={!r.rink_active || !r.green_active}
            >
              {r.green_name} · Rink {r.rink_number}
              {!r.rink_active || !r.green_active ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" required>
          <input
            name="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="h-10 w-full rounded-md border border-border bg-bone px-3 text-[14px]"
          />
        </Field>
        <Field label="Duration (min)" required>
          <input
            name="duration_minutes"
            type="number"
            min={15}
            max={240}
            step={15}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
            required
            className="h-10 w-full rounded-md border border-border bg-bone px-3 text-[14px]"
          />
        </Field>
      </div>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-border bg-bone px-3 py-2 text-[14px]"
          placeholder="Optional context — e.g. assessor name, special equipment, gold-tier rubric…"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!formValid || pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-500 px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--color-on-primary)] hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {pending ? "Scheduling…" : "Schedule assessment"}
        </button>
        <Link
          href="/manage/overview"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted hover:bg-surface-muted"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

// Default the start input to "today, 09:00 next day if before 09:00"
// in the user's local timezone. datetime-local inputs are local-tz so
// we render the value as YYYY-MM-DDTHH:MM with no Z suffix.
function defaultStartsAtLocal(): string {
  const now = new Date();
  const target = new Date(now);
  target.setSeconds(0);
  target.setMilliseconds(0);
  if (now.getHours() < 9) {
    target.setHours(9);
    target.setMinutes(0);
  } else {
    target.setDate(target.getDate() + 1);
    target.setHours(9);
    target.setMinutes(0);
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(
    target.getDate(),
  )}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}
