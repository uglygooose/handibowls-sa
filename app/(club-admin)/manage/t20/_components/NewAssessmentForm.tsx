"use client";

import { ClipboardList, Sparkles, User, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { GradePill } from "@/components/t20/GradePill";
import { cn } from "@/lib/utils";
import { formatDateZA } from "@/lib/format/dates";
import { SECTION_KEYS, type Grade } from "@/lib/t20/rubric";
import { sectionMaxes } from "@/lib/t20/score";

import { createAssessmentFromForm } from "../_actions";
import type { T20PersonRow } from "../_data";
import {
  CREATE_ASSESSMENT_INITIAL,
  type CreateAssessmentFormState,
} from "../_form-state";

// Phase 10 / 10-5 — Twenty 20 New assessment setup form.
//
// Five-section layout from the design source (t20-page-new.jsx):
//   1. Player        Single-select picker + history sidebar
//   2. Assessor      Card-grid picker + accreditation ID input
//   3. Conditions    Date + green-type chips + green-speed (optional)
//   4. Rubric        Read-only band-legend reference card with
//                    modal "View details" showing per-section maxes
//   5. Second marker Optional toggle + name + accreditation ID
//
// Submit flow uses useActionState wired to createAssessmentFromForm
// (see _actions.ts). Success path: server-side redirect() to
// /manage/t20/<id>/capture — useActionState handles the redirect
// transparently. Failure path: typed FormState surfaces a banner
// at the top of the form.
//
// Section 4's band labels render "Fail" (NOT "Reassess") per the
// design source — this is the documentary BSA-vocabulary band
// definition, distinct from the result-label "Reassess" used by
// GradePill in the player history sidebar. Both spellings live in
// the same file because they serve different roles.

const GREEN_TYPE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["outdoor", "Outdoor"],
  ["indoor", "Indoor"],
  ["tarred", "Tarred"],
] as const;

const RUBRIC_BANDS: ReadonlyArray<{ label: string; range: string; accent: string }> = [
  { label: "Gold", range: "≥80%", accent: "#d4a000" },
  { label: "Silver", range: "65–79%", accent: "var(--color-primary-500)" },
  { label: "Bronze", range: "50–64%", accent: "#8a6230" },
  { label: "Fail", range: "<50%", accent: "var(--color-ink)" },
];

type Props = {
  candidates: T20PersonRow[];
  defaultDate: string;
  activeRubricLabel: string;
};

export function NewAssessmentForm({
  candidates,
  defaultDate,
  activeRubricLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<
    CreateAssessmentFormState,
    FormData
  >(createAssessmentFromForm, CREATE_ASSESSMENT_INITIAL);

  // Local state — controlled fields the form needs to derive props
  // (selected player history, assessor accred prefill).
  const [playerId, setPlayerId] = useState<string>(
    candidates[0]?.profile_id ?? "",
  );
  const [assessorId, setAssessorId] = useState<string>(
    candidates[0]?.profile_id ?? "",
  );
  const [accredId, setAccredId] = useState<string>("");
  const [date, setDate] = useState<string>(defaultDate);
  const [greenType, setGreenType] = useState<string>("outdoor");
  const [greenSpeed, setGreenSpeed] = useState<string>("");
  const [secondMarkerOpen, setSecondMarkerOpen] = useState<boolean>(false);
  const [secondName, setSecondName] = useState<string>("");
  const [secondAccred, setSecondAccred] = useState<string>("");
  const [showRubricModal, setShowRubricModal] = useState<boolean>(false);
  const [showPlayerPicker, setShowPlayerPicker] = useState<boolean>(false);
  const [playerSearch, setPlayerSearch] = useState<string>("");

  const player = useMemo(
    () => candidates.find((c) => c.profile_id === playerId) ?? null,
    [candidates, playerId],
  );
  // Note: the design source auto-fills the accreditation ID from the
  // selected assessor's profile. Our schema doesn't carry per-profile
  // accreditation today (it's free-text per-assessment per migration
  // 007), so the field is fully manual until a v2 schema split lands.
  const valid =
    Boolean(playerId) &&
    Boolean(assessorId) &&
    Boolean(date) &&
    accredId.trim().length >= 4;

  const errorBanner =
    state.kind !== "idle" && state.kind !== "ok" ? renderError(state) : null;

  // Cap the visible assessor grid to 6 — the design uses 3 in mocks
  // but a real club may have many. Show the rest behind a "more"
  // disclosure when needed.
  const assessorCandidates = candidates.slice(0, 6);
  const assessorOverflow = candidates.length - assessorCandidates.length;

  return (
    <form
      action={formAction}
      data-slot="new-assessment-form"
      className="overflow-hidden rounded-2xl border border-border bg-bone"
    >
      {/* Hidden state mirrors for action submit */}
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="assessor_id" value={assessorId} />
      <input type="hidden" name="green_type" value={greenType} />

      {errorBanner}

      {/* Section 1 — Player */}
      <FormSection
        index={1}
        title="Player"
        desc="Select the player being assessed."
        required
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div data-slot="player-row">
            <FieldLabel htmlFor="player-card">Player</FieldLabel>
            {showPlayerPicker ? (
              <PlayerPicker
                id="player-card"
                candidates={candidates}
                playerId={playerId}
                search={playerSearch}
                onSearch={setPlayerSearch}
                onPick={(id) => {
                  setPlayerId(id);
                  setShowPlayerPicker(false);
                  setPlayerSearch("");
                }}
                onCancel={() => setShowPlayerPicker(false)}
              />
            ) : (
              <PlayerSummaryCard
                player={player}
                onChange={() => setShowPlayerPicker(true)}
              />
            )}
            <p className="mt-1 text-[12px] text-ink-muted">
              Searches club members. BSA # auto-fills.
            </p>
          </div>
          <div data-slot="player-history-row">
            <FieldLabel>Player history</FieldLabel>
            <PlayerHistoryCard player={player} />
          </div>
        </div>
      </FormSection>

      {/* Section 2 — Assessor */}
      <FormSection
        index={2}
        title="Assessor"
        desc="Twenty 20 assessments must be conducted by a BSA-accredited coach (Level 2 preferred)."
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.2fr_1fr]">
          <div data-slot="assessor-grid-wrap">
            <FieldLabel>Assessor</FieldLabel>
            <div
              data-slot="assessor-grid"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {assessorCandidates.map((c) => (
                <button
                  key={c.profile_id}
                  type="button"
                  onClick={() => setAssessorId(c.profile_id)}
                  data-slot="assessor-option"
                  data-profile-id={c.profile_id}
                  data-selected={c.profile_id === assessorId}
                  className={cn(
                    "rounded-lg border bg-bone px-3 py-2.5 text-left transition",
                    c.profile_id === assessorId
                      ? "border-ink bg-ink/4 ring-2 ring-ink/10"
                      : "border-border hover:border-ink/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-ink font-display text-[11px] font-black text-ink-inverse"
                    >
                      {initialsFor(c.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold leading-tight">
                        {c.name ?? "Unnamed"}
                      </div>
                      <div className="font-mono text-[11px] text-ink-muted">
                        {c.bsa_number ?? "—"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {assessorOverflow > 0 && (
              <p className="mt-2 font-mono text-[11px] text-ink-muted">
                {assessorOverflow} more candidate{assessorOverflow === 1 ? "" : "s"} —
                use the picker once a roster cap surfaces.
              </p>
            )}
          </div>
          <div data-slot="accreditation-row">
            <FieldLabel htmlFor="assessor-accred">Accreditation ID</FieldLabel>
            <input
              id="assessor-accred"
              name="assessor_accreditation_id"
              type="text"
              autoComplete="off"
              required
              value={accredId}
              onChange={(e) => setAccredId(e.target.value)}
              placeholder="BSA-CL2-1184"
              data-slot="accreditation-input"
              className={cn(
                "h-11 w-full rounded-lg border border-border bg-bone px-3.5 font-mono text-[13px]",
                "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
              )}
            />
            <p className="mt-1 text-[12px] text-ink-muted">
              Enter the assessor&apos;s BSA accreditation ID.
            </p>
          </div>
        </div>
      </FormSection>

      {/* Section 3 — Conditions */}
      <FormSection
        index={3}
        title="Conditions"
        desc="Date, green type, and optional speed (seconds per draw)."
      >
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.2fr_1fr]">
          <div>
            <FieldLabel htmlFor="assessed-on">Date</FieldLabel>
            <input
              id="assessed-on"
              name="assessed_on"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-slot="date-input"
              className={cn(
                "h-11 w-full rounded-lg border border-border bg-bone px-3.5 text-[13px]",
                "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
              )}
            />
          </div>
          <div>
            <FieldLabel>Green type</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {GREEN_TYPE_OPTIONS.map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGreenType(id)}
                  data-slot="green-type-chip"
                  data-value={id}
                  data-active={greenType === id}
                  className={cn(
                    "inline-flex h-12 items-center rounded-full border px-4 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] transition",
                    greenType === id
                      ? "border-ink bg-ink text-ink-inverse"
                      : "border-border bg-bone text-ink hover:border-ink/40",
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="green-speed">Green speed (s)</FieldLabel>
            <input
              id="green-speed"
              name="green_speed"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={greenSpeed}
              onChange={(e) => setGreenSpeed(e.target.value)}
              placeholder="13.2"
              data-slot="green-speed-input"
              className={cn(
                "h-11 w-full rounded-lg border border-border bg-bone px-3.5 font-mono text-[13px]",
                "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
              )}
            />
            <p className="mt-1 text-[12px] text-ink-muted">
              Optional. Leave blank if not measured.
            </p>
          </div>
        </div>
      </FormSection>

      {/* Section 4 — Rubric reference card */}
      <FormSection
        index={4}
        title="Rubric"
        desc="This rubric grades the assessment. Cannot be changed mid-capture."
      >
        <div
          data-slot="rubric-card"
          className="rounded-[14px] border bg-primary-500/4 px-5 py-4"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary-500) 25%, var(--color-border))",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-[42px] items-center justify-center rounded-[10px] bg-primary-500 text-on-primary"
              >
                <ClipboardList className="size-5" />
              </span>
              <div>
                <div className="font-mono text-[15px] font-bold">
                  {activeRubricLabel}
                </div>
                <div className="text-[12px] text-ink-muted">
                  Active across all clubs · pinned to this assessment at create
                  time.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                data-slot="rubric-bands"
                className="grid grid-flow-col gap-3 font-mono"
              >
                {RUBRIC_BANDS.map((b) => (
                  <div
                    key={b.label}
                    data-slot="rubric-band"
                    data-band={b.label.toLowerCase()}
                    className="text-center"
                  >
                    <div
                      className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: b.accent }}
                    >
                      {b.label}
                    </div>
                    <div className="text-[12px] font-bold">{b.range}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowRubricModal(true)}
                data-slot="rubric-details-cta"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-[12px] font-medium text-ink hover:bg-surface-muted"
              >
                View details
              </button>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Section 5 — Second marker */}
      <FormSection
        index={5}
        title="Second marker"
        desc="Best practice for fairness, consistency, and dispute resolution."
        right={
          <button
            type="button"
            role="switch"
            aria-checked={secondMarkerOpen}
            onClick={() => setSecondMarkerOpen((v) => !v)}
            data-slot="second-marker-toggle"
            data-state={secondMarkerOpen ? "on" : "off"}
            className={cn(
              "relative h-6 w-11 rounded-full border transition",
              secondMarkerOpen
                ? "border-ink bg-ink"
                : "border-border bg-surface-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-bone shadow transition-all",
                secondMarkerOpen ? "left-[1.375rem]" : "left-0.5",
              )}
            />
          </button>
        }
      >
        {secondMarkerOpen ? (
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <div>
              <FieldLabel htmlFor="second-marker-name">Marker name</FieldLabel>
              <input
                id="second-marker-name"
                type="text"
                value={secondName}
                onChange={(e) => setSecondName(e.target.value)}
                data-slot="second-marker-name"
                className={cn(
                  "h-11 w-full rounded-lg border border-border bg-bone px-3.5 text-[13px]",
                  "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
                )}
              />
            </div>
            <div>
              <FieldLabel htmlFor="second-marker-accred">
                Accreditation ID
              </FieldLabel>
              <input
                id="second-marker-accred"
                type="text"
                value={secondAccred}
                onChange={(e) => setSecondAccred(e.target.value)}
                placeholder="BSA-CL2-2208"
                data-slot="second-marker-accred"
                className={cn(
                  "h-11 w-full rounded-lg border border-border bg-bone px-3.5 font-mono text-[13px]",
                  "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
                )}
              />
              <p className="mt-1 text-[12px] text-ink-muted">
                Captured here; persists once capture begins via the
                results-view second-marker action.
              </p>
            </div>
          </div>
        ) : (
          <p
            data-slot="second-marker-disabled-note"
            className="text-[13px] text-ink-muted"
          >
            No second marker for this assessment.
          </p>
        )}
      </FormSection>

      {/* Footer — actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted px-7 py-5">
        <Link
          href="/manage/t20"
          data-slot="cancel-cta"
          className="inline-flex h-11 items-center rounded-lg px-3 text-[13px] font-medium text-ink hover:bg-surface"
        >
          Cancel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!valid || pending}
            data-slot="start-cta"
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-lg bg-primary-500 px-6 text-[14px] font-semibold text-on-primary shadow-sm",
              "hover:bg-primary-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {pending ? "Starting…" : "Start capture"}
          </button>
        </div>
      </div>

      {showRubricModal && (
        <RubricDetailsModal
          rubricLabel={activeRubricLabel}
          onClose={() => setShowRubricModal(false)}
        />
      )}
    </form>
  );
}

// ---------------------------------------------------------------------
// Section primitives
// ---------------------------------------------------------------------

function FormSection({
  index,
  title,
  desc,
  required = false,
  right,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  required?: boolean;
  right?: React.ReactNode;
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
            className="inline-flex h-6 items-center gap-1 rounded-full bg-primary-500 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-on-primary"
          >
            <User aria-hidden="true" className="size-3" />
            Required
          </span>
        )}
        {right}
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

// ---------------------------------------------------------------------
// Player picker — "Change" flow
// ---------------------------------------------------------------------

function PlayerSummaryCard({
  player,
  onChange,
}: {
  player: T20PersonRow | null;
  onChange: () => void;
}) {
  if (!player) {
    return (
      <div
        data-slot="player-card-empty"
        className="flex h-[64px] items-center justify-between rounded-lg border border-dashed border-border bg-surface-muted px-3.5 text-[13px] text-ink-muted"
      >
        No club members available.
      </div>
    );
  }
  return (
    <div
      data-slot="player-card"
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-lg border border-border bg-bone px-3.5 py-2.5"
    >
      <div
        aria-hidden="true"
        className="flex size-[42px] items-center justify-center rounded-full bg-ink font-display text-[14px] font-black text-ink-inverse"
      >
        {initialsFor(player.name)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold leading-tight">
          {player.name ?? "Unnamed player"}
        </div>
        <div className="font-mono text-[12px] text-ink-muted">
          {player.bsa_number ?? "—"}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        data-slot="player-change-cta"
        className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-medium text-ink hover:bg-surface-muted"
      >
        Change
      </button>
    </div>
  );
}

function PlayerPicker({
  id,
  candidates,
  playerId,
  search,
  onSearch,
  onPick,
  onCancel,
}: {
  id: string;
  candidates: T20PersonRow[];
  playerId: string;
  search: string;
  onSearch: (v: string) => void;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((c) => (c.name ?? "").toLowerCase().includes(q))
    : candidates;
  return (
    <div
      data-slot="player-picker"
      className="overflow-hidden rounded-lg border border-border bg-bone"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
        <input
          id={id}
          type="search"
          autoFocus
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name…"
          data-slot="player-picker-search"
          className={cn(
            "h-9 flex-1 rounded-md border border-border bg-bone px-2.5 text-[13px]",
            "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
          )}
        />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel player picker"
          data-slot="player-picker-cancel"
          className="inline-flex size-9 items-center justify-center rounded-md text-ink hover:bg-bone"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul
        data-slot="player-picker-results"
        className="max-h-64 divide-y divide-border overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-[13px] text-ink-muted">
            No matches.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c.profile_id}>
              <button
                type="button"
                onClick={() => onPick(c.profile_id)}
                data-slot="player-picker-row"
                data-profile-id={c.profile_id}
                data-current={c.profile_id === playerId}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                  c.profile_id === playerId
                    ? "bg-primary-500/8"
                    : "hover:bg-surface-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-ink font-display text-[11px] font-black text-ink-inverse"
                >
                  {initialsFor(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">
                    {c.name ?? "Unnamed"}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-muted">
                    {c.bsa_number ?? "—"}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function PlayerHistoryCard({ player }: { player: T20PersonRow | null }) {
  return (
    <div
      data-slot="player-history-card"
      className="rounded-lg border border-dashed border-border-strong bg-surface-muted px-4 py-3.5"
    >
      {player?.last_assessment ? (
        <>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Last Twenty 20
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[18px] font-bold tabular-nums">
                {player.last_assessment.percentage.toFixed(1)}%
              </div>
              <div className="text-[12px] text-ink-muted">
                {formatDateZA(player.last_assessment.assessed_on)}
              </div>
            </div>
            {player.last_assessment.grade && (
              <GradePill
                grade={player.last_assessment.grade as Grade}
                size="md"
              />
            )}
          </div>
        </>
      ) : (
        <p data-slot="player-first-time" className="text-[13px] text-ink-muted">
          {player
            ? "First-time Twenty 20 for this player."
            : "Pick a player to see their history."}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Rubric details modal
// ---------------------------------------------------------------------

function RubricDetailsModal({
  rubricLabel,
  onClose,
}: {
  rubricLabel: string;
  onClose: () => void;
}) {
  // Section maxes are theoretical (per-rubric). Plan-locked grand max
  // is 320; per-section maxes from sectionMaxes() vary by model.
  // We render the seeded v1 maxes as a fixed reference (matches the
  // design source's table footer "Grand max 320").
  const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
    jacks: "Jacks",
    targets: "Targets",
    drive: "Drive",
    control: "Control",
    trail: "Trail",
    speedhumps_asc: "Speedhumps Ascending",
    speedhumps_desc: "Speedhumps Descending",
  };
  const MODEL_LABELS = {
    line_outcome: "line_outcome",
    zones_8: "zones_8",
    on_length: "on_length",
  };
  const DISTANCES_TEXT: Record<(typeof SECTION_KEYS)[number], string> = {
    jacks: "23 / 26 / 29 / 32m",
    targets: "23 / 26 / 29 / 32m",
    drive: "28m",
    control: "28m",
    trail: "28m",
    speedhumps_asc: "23 / 26 / 29 / 32m",
    speedhumps_desc: "32 / 29 / 26 / 23m",
  };
  const HAND_TEXT: Record<(typeof SECTION_KEYS)[number], string> = {
    jacks: "—",
    targets: "—",
    drive: "F + B",
    control: "F + B",
    trail: "F + B",
    speedhumps_asc: "F + B",
    speedhumps_desc: "F + B",
  };
  const MODELS: Record<(typeof SECTION_KEYS)[number], keyof typeof MODEL_LABELS> = {
    jacks: "line_outcome",
    targets: "line_outcome",
    drive: "zones_8",
    control: "zones_8",
    trail: "zones_8",
    speedhumps_asc: "on_length",
    speedhumps_desc: "on_length",
  };

  // sectionMaxes returns theoretical maxes — caller's reference. We
  // display them per-section but the band thresholds are calibrated
  // against the practical 320 grand max.
  const maxes = sectionMaxes({
    version: rubricLabel,
    deliveriesPerRoundPerDistance: 8,
    rounds: 2,
    sections: {
      jacks: { distances_m: [23, 26, 29, 32], model: "line_outcome", points: { on_line: 1, narrow: 0.5, wide: 0 }, max_per_distance: 16 },
      targets: { distances_m: [23, 26, 29, 32], model: "line_outcome", points: { on_line: 1, narrow: 0.5, wide: 0 }, max_per_distance: 16 },
      drive: { distance_m: 28, model: "zones_8", hands: ["fore", "back"], zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 } },
      control: { distance_m: 28, model: "zones_8", hands: ["fore", "back"], zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 } },
      trail: { distance_m: 28, model: "zones_8", hands: ["fore", "back"], zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 } },
      speedhumps_asc: { ladder_m: [23, 26, 29, 32], model: "on_length", pointsPerOnLength: 2 },
      speedhumps_desc: { ladder_m: [32, 29, 26, 23], model: "on_length", pointsPerOnLength: 2 },
    },
    grading: [
      { grade: "gold", minPct: 80 },
      { grade: "silver", minPct: 65 },
      { grade: "bronze", minPct: 50 },
      { grade: "fail", minPct: 0 },
    ],
    passPctTarget: 60,
    assessor: { minLevel: 2, secondMarkerRecommended: true },
  });

  return (
    <div
      data-slot="rubric-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rubric details"
    >
      <div
        data-slot="rubric-modal"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-bone shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Active rubric
            </div>
            <h3 className="mt-1 font-display text-[24px] font-black italic leading-tight tracking-tight">
              {rubricLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-slot="rubric-modal-close"
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto px-6 py-5">
          <table
            className="w-full border-collapse text-[12.5px]"
            data-slot="rubric-table"
          >
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  #
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Section
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Model
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Distance
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Hand
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Max
                </th>
              </tr>
            </thead>
            <tbody>
              {SECTION_KEYS.map((key, i) => (
                <tr
                  key={key}
                  data-slot="rubric-row"
                  data-section={key}
                  className="border-b border-border/60"
                >
                  <td className="px-3 py-2 font-mono">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{SECTION_LABELS[key]}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 font-mono text-[10.5px]">
                      {MODEL_LABELS[MODELS[key]]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{DISTANCES_TEXT[key]}</td>
                  <td className="px-3 py-2">{HAND_TEXT[key]}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {maxes[key]}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-3 py-3 font-bold">
                  Grand max
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
                  320
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-[12px] text-ink-muted">
            Per-section maxes are theoretical (all-bowls-perfect). The
            grading bands (Gold ≥80%, Silver 65–79%, Bronze 50–64%, Fail
            &lt;50%) are calibrated against the practical 320 grand max.
          </p>
        </div>
      </div>
    </div>
  );
}

function renderError(state: CreateAssessmentFormState) {
  if (state.kind === "idle" || state.kind === "ok") return null;
  const map: Record<string, string> = {
    no_club: "No club is in scope for this account.",
    no_active_rubric:
      "No active rubric is configured. A platform admin must activate one before captures can begin.",
    auth: "You must be signed in to start an assessment.",
    validation: "Form validation failed. Please review the fields.",
    error: "Something went wrong. Please try again.",
  };
  const detail =
    "error" in state && state.error
      ? state.error
      : (map[state.kind] ?? "Unknown error.");
  return (
    <div
      data-slot="form-error-banner"
      data-kind={state.kind}
      role="alert"
      className="border-b border-danger-500/20 bg-danger-500/8 px-7 py-3.5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-danger-500 text-[12px] font-bold text-bone"
        >
          !
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

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}
