"use client";

import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { CompassPicker } from "@/components/t20/CompassPicker";
import { SaveIndicator, type SaveState } from "@/components/t20/SaveIndicator";
import { SectionStepper } from "@/components/t20/SectionStepper";
import { WakeLockIndicator } from "@/components/player/WakeLockIndicator";
import { useWakeLock } from "@/lib/scorecard/use-wake-lock";
import { cn } from "@/lib/utils";
import { formatDateZA } from "@/lib/format/dates";
import {
  type LineOutcome,
  type Rubric,
  SECTION_KEYS,
  type SectionKey,
  ZONE_META,
  type ZoneOutcome,
} from "@/lib/t20/rubric";
import { sectionMaxes } from "@/lib/t20/score";

import {
  finalizeAssessment,
  recordDelivery,
} from "../_actions";
import type { AssessmentDetail, DeliveryRow } from "../_data";

// Phase 10 / 10-6 — Twenty 20 capture wizard.
//
// The high-stakes surface. Coach drives this on a tablet at the
// green for ~25 minutes, scoring 14 section-rounds in real time.
//
// Architecture
// ------------
// One Client Component, three section bodies branched on rubric
// model:
//
//   line_outcome (sections 1–2)  Distance tabs + 8 delivery cards
//                                with on_line/narrow/wide buttons.
//   zones_8     (sections 3–5)   CompassPicker + hand toggle. Tap
//                                a wedge to record the active bowl.
//                                Right-side thumbnails show all 8
//                                deliveries for the round.
//   on_length   (sections 6–7)   4 ladder cards, each with F + B
//                                rows of "On length" / "Off" buttons.
//
// State is local + optimistic. Each tap:
//   1. Updates `deliveries` immediately (visual feedback).
//   2. Calls recordDelivery server action.
//   3. Reflects save state via SaveIndicator (saved / saving / failed).
//
// Wake-lock acquired on first user gesture (iOS Safari constraint).
// Released automatically on unmount + visibility-change to hidden.
//
// Resume
// ------
// Server pre-fetches existing deliveries; we hydrate into the local
// map on mount and seek the cursor to the next incomplete (section,
// round). Coaches can navigate back to any earlier (section, round)
// via the SectionStepper or the Prev button — re-capture overwrites
// via recordDelivery's UPSERT path.
//
// Per plan §13: online-only for v1 ("assessments generally happen at
// the club with Wi-Fi"). No offline outbox; failed saves surface as
// SaveIndicator state='failed' and the coach can retry by tapping
// the same cell again.

type Props = {
  assessment: AssessmentDetail["assessment"];
  deliveries: DeliveryRow[];
  rubric: Rubric;
};

// Local state shape — nested for fast lookup at render time.
//   key 1: section key
//   key 2: round (1 | 2)
//   key 3: distance index (0..3 for line_outcome / on_length, always 0 for zones_8)
//   value: array of 8 outcomes (LineOutcome | ZoneOutcome | boolean | null)
//   for on_length the array has 2 entries (F + B), rest are 8.
type DeliveriesMap = Record<
  string,
  Record<number, Record<number, Array<LineOutcome | ZoneOutcome | boolean | null>>>
>;

export function CaptureWizard({ assessment, deliveries, rubric }: Props) {
  const router = useRouter();
  const wakeLock = useWakeLock();
  const [savePending, startSaveTransition] = useTransition();
  const [finalizePending, startFinalizeTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [hand, setHand] = useState<"forehand" | "backhand">("forehand");

  // Resume cursor — computed once from the seeded deliveries.
  const initial = useMemo(() => hydrateAndSeek(rubric, deliveries), [rubric, deliveries]);

  const [sIdx, setSIdx] = useState<number>(initial.sectionIdx);
  const [round, setRound] = useState<1 | 2>(initial.round);
  const [distIdx, setDistIdx] = useState<number>(0);
  const [deliveriesMap, setDeliveriesMap] = useState<DeliveriesMap>(
    initial.deliveriesMap,
  );

  // Keep the SectionStepper completion map in sync with the
  // deliveries state.
  const completed = useMemo(
    () => completedMapFor(rubric, deliveriesMap),
    [rubric, deliveriesMap],
  );

  // Capture wizard pages need the screen kept on for tablet use at
  // the green (no auto-sleep mid-end). Acquire on mount AND on first
  // user tap — iOS Safari rejects API requests without a fresh
  // gesture. We re-attempt on every tap until the lock holds.
  function ensureWakeLock() {
    if (!wakeLock.active && !wakeLock.unsupported) {
      void wakeLock.acquire();
    }
  }

  const sectionKey = SECTION_KEYS[sIdx];
  const sectionDef = rubric.sections[sectionKey];
  const distances = distancesOf(sectionDef);
  const allComplete = SECTION_KEYS.every(
    (k) => completed[`${k}_r1`] && completed[`${k}_r2`],
  );

  function recordOptimistic(
    deliveryIndex: number,
    distanceIdx: number,
    value: LineOutcome | ZoneOutcome | boolean,
  ) {
    setDeliveriesMap((prev) => {
      const next: DeliveriesMap = { ...prev };
      const sec = (next[sectionKey] = { ...(next[sectionKey] ?? {}) });
      const rd = (sec[round] = { ...(sec[round] ?? {}) });
      const arr = (rd[distanceIdx] = [...(rd[distanceIdx] ?? [])]);
      arr[deliveryIndex] = value;
      return next;
    });
  }

  function recordTap(
    deliveryIndex: number,
    distanceIdx: number,
    value: LineOutcome | ZoneOutcome | boolean,
  ) {
    ensureWakeLock();
    recordOptimistic(deliveryIndex, distanceIdx, value);
    setSaveState("saving");
    startSaveTransition(async () => {
      const distanceMetres =
        sectionDef.model === "zones_8"
          ? sectionDef.distance_m
          : distances[distanceIdx] ?? null;
      const handArg: "fore" | "back" | null =
        sectionDef.model === "zones_8" || sectionDef.model === "on_length"
          ? hand === "forehand"
            ? "fore"
            : "back"
          : null;
      const outcome =
        sectionDef.model === "line_outcome"
          ? { kind: "line_outcome" as const, line: value as LineOutcome }
          : sectionDef.model === "zones_8"
            ? {
                kind: "zones_8" as const,
                zone: value as Exclude<ZoneOutcome, "miss"> | "miss",
              }
            : {
                kind: "on_length" as const,
                on_length: value as boolean,
              };
      const result = await recordDelivery({
        assessment_id: assessment.id,
        section: sectionKey,
        round,
        delivery_index: deliveryIndex + 1,
        distance_m: distanceMetres,
        hand: handArg,
        outcome,
      });
      setSaveState(result.kind === "ok" ? "saved" : "failed");
    });
  }

  function jumpToSection(idx: number, r: 1 | 2) {
    setSIdx(idx);
    setRound(r);
    setDistIdx(0);
  }

  function nextStep() {
    if (round === 1) {
      setRound(2);
      setDistIdx(0);
      return;
    }
    if (sIdx < SECTION_KEYS.length - 1) {
      setSIdx(sIdx + 1);
      setRound(1);
      setDistIdx(0);
    }
  }

  function prevStep() {
    if (round === 2) {
      setRound(1);
      setDistIdx(0);
      return;
    }
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
      setRound(2);
      setDistIdx(0);
    }
  }

  function onFinalize() {
    startFinalizeTransition(async () => {
      const result = await finalizeAssessment({ assessment_id: assessment.id });
      if (result.kind === "ok") {
        router.push(`/manage/t20/${assessment.id}`);
      } else {
        setSaveState("failed");
      }
    });
  }

  // Re-fire wake-lock acquisition when the page becomes visible
  // again (iOS auto-releases). The hook owns the visibility logic;
  // this useEffect is just here so the React tree stays subscribed.
  useEffect(() => {
    void wakeLock; // touch the ref so React knows we observe it
  }, [wakeLock]);

  const isLastStep = sIdx === SECTION_KEYS.length - 1 && round === 2;
  const isFirstStep = sIdx === 0 && round === 1;
  const subtotalPoints = subtotalForSectionRound(
    rubric,
    sectionKey,
    round,
    deliveriesMap,
  );
  const sectionRoundMax = sectionMaxes(rubric)[sectionKey] / 2;
  const liveLabel = humanLiveLabel(savePending, saveState);

  return (
    <div
      data-slot="capture-wizard"
      data-assessment-id={assessment.id}
      data-section={sectionKey}
      data-round={round}
      className="flex min-h-screen flex-col bg-surface"
      onPointerDown={ensureWakeLock}
    >
      {/* TOP STRIP */}
      <header
        data-slot="capture-header"
        className="sticky top-0 z-30 border-b border-border bg-bone px-6 py-3"
      >
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/manage/t20")}
              aria-label="Save and exit to assessments list"
              data-slot="capture-exit-cta"
              className="inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                Twenty 20 capture · {formatDateZA(assessment.assessed_on)}
              </div>
              <div className="font-display text-[16px] font-bold leading-tight">
                {assessment.player_name ?? "Unknown player"}
                {assessment.player_email && (
                  <span className="ml-1.5 font-mono text-[12px] font-normal text-ink-muted">
                    · {assessment.player_email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveIndicator state={saveState} />
            <WakeLockIndicator active={wakeLock.active} />
            <button
              type="button"
              onClick={() => router.push("/manage/t20")}
              data-slot="save-pause-cta"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bone px-3 text-[12px] font-medium text-ink hover:bg-surface-muted"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              Save & pause
            </button>
          </div>
        </div>
        <SectionStepper
          current={{ sectionIdx: sIdx, round }}
          completed={completed}
          onJump={(idx, r) => jumpToSection(idx, r)}
        />
      </header>

      {/* BODY */}
      <main
        data-slot="capture-body"
        className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-6"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Section {sIdx + 1} of 7 · Round {round} of 2
            </div>
            <h2 className="mt-1 font-display text-[42px] font-black italic uppercase leading-none tracking-tight">
              {SECTION_TITLE[sectionKey]}
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              {SECTION_DESC[sectionKey]}
            </p>
            {liveLabel && (
              <p
                data-slot="live-status"
                className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle"
              >
                {liveLabel}
              </p>
            )}
          </div>
          <div
            data-slot="subtotal-chip"
            className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-muted px-4 py-2.5"
          >
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                R{round} subtotal
              </div>
              <div className="font-mono text-[18px] font-bold tabular-nums">
                {subtotalPoints.toFixed(1)} / {sectionRoundMax}
              </div>
            </div>
            <div className="h-7 w-px bg-border" aria-hidden="true" />
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                Live %
              </div>
              <div className="font-mono text-[18px] font-bold tabular-nums text-primary-600">
                {sectionRoundMax > 0
                  ? `${Math.round((subtotalPoints / sectionRoundMax) * 100)}%`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {sectionDef.model === "line_outcome" && (
          <LineOutcomeBody
            distances={distances}
            distIdx={distIdx}
            setDistIdx={setDistIdx}
            data={deliveriesMap[sectionKey]?.[round] ?? {}}
            onPick={(d, value) => recordTap(d, distIdx, value)}
          />
        )}
        {sectionDef.model === "zones_8" && (
          <ZonesBody
            hand={hand}
            setHand={setHand}
            data={deliveriesMap[sectionKey]?.[round]?.[0] ?? []}
            onPick={(d, value) => recordTap(d, 0, value)}
          />
        )}
        {sectionDef.model === "on_length" && (
          <OnLengthBody
            ladder={distances}
            hand={hand}
            setHand={setHand}
            data={deliveriesMap[sectionKey]?.[round] ?? {}}
            onPick={(d, distanceIdx, value) =>
              recordTap(d, distanceIdx, value)
            }
          />
        )}
      </main>

      {/* BOTTOM STICKY CONTROLS */}
      <footer
        data-slot="capture-footer"
        className="sticky bottom-0 z-20 border-t border-border bg-bone px-6 py-3.5"
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={isFirstStep}
            data-slot="prev-cta"
            className="inline-flex h-12 items-center gap-1.5 rounded-lg border border-border bg-bone px-4 text-[13px] font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </button>
          <span
            data-slot="footer-locator"
            className="font-mono text-[11px] text-ink-muted"
          >
            Section {sIdx + 1} · R{round} · {SECTION_TITLE[sectionKey]}
          </span>
          {isLastStep ? (
            <button
              type="button"
              onClick={onFinalize}
              disabled={!allComplete || finalizePending}
              data-slot="finalize-cta"
              className={cn(
                "inline-flex h-12 items-center gap-1.5 rounded-lg bg-primary-500 px-6 text-[14px] font-semibold text-on-primary shadow-sm",
                "hover:bg-primary-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {finalizePending ? "Finalizing…" : "Finalize assessment"}
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              data-slot="next-cta"
              className="inline-flex h-12 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-[13px] font-semibold text-on-primary shadow-sm hover:bg-primary-600"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------
// Body — line_outcome (sections 1, 2: Jacks, Targets)
// ---------------------------------------------------------------------

const LINE_LABEL: Record<LineOutcome, string> = {
  on_line: "On line",
  narrow: "Narrow",
  wide: "Wide",
};
const LINE_POINTS: Record<LineOutcome, string> = {
  on_line: "1pt",
  narrow: "0.5pt",
  wide: "0pt",
};

function LineOutcomeBody({
  distances,
  distIdx,
  setDistIdx,
  data,
  onPick,
}: {
  distances: number[];
  distIdx: number;
  setDistIdx: (i: number) => void;
  data: Record<number, Array<LineOutcome | ZoneOutcome | boolean | null>>;
  onPick: (deliveryIdx: number, value: LineOutcome) => void;
}) {
  const distData = (data[distIdx] ?? []) as Array<LineOutcome | null>;
  const nextEmpty = [...Array(8)].findIndex((_, i) => distData[i] == null);
  return (
    <div data-slot="line-outcome-body">
      {/* Distance tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {distances.map((d, i) => {
          const filled = ((data[i] ?? []) as Array<LineOutcome | null>).filter(
            (v) => v != null,
          ).length;
          const isActive = i === distIdx;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDistIdx(i)}
              data-slot="distance-tab"
              data-distance={d}
              data-active={isActive}
              className={cn(
                "inline-flex h-12 items-center rounded-full border px-4 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] transition",
                isActive
                  ? "border-ink bg-ink text-ink-inverse"
                  : "border-border bg-bone text-ink hover:border-ink/40",
              )}
            >
              {d}m
              <span
                className={cn(
                  "ml-2 font-mono text-[12px]",
                  isActive ? "text-ink-inverse/75" : "text-ink-muted",
                )}
              >
                {filled}/8
              </span>
            </button>
          );
        })}
      </div>
      {/* Delivery cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => {
          const v = distData[i] ?? null;
          const isNext = i === nextEmpty;
          return (
            <div
              key={i}
              data-slot="delivery-card"
              data-delivery={i + 1}
              data-recorded={v != null}
              data-next={isNext}
              className={cn(
                "overflow-hidden rounded-xl border-[1.5px] transition",
                isNext && !v ? "border-primary-500" : "border-border",
                isNext && !v &&
                  "shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary-500)_20%,transparent)]",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
                  v
                    ? "bg-ink/12 text-ink"
                    : "border-b border-border bg-surface-muted text-ink-muted",
                )}
              >
                <span>Bowl {i + 1}</span>
                {v && (
                  <span>
                    {LINE_LABEL[v]} · {LINE_POINTS[v]}
                  </span>
                )}
                {!v && isNext && (
                  <span className="text-primary-600">Next</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-bone p-2">
                {(["on_line", "narrow", "wide"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onPick(i, opt)}
                    data-slot="line-outcome-option"
                    data-delivery={i + 1}
                    data-option={opt}
                    data-selected={v === opt}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border-[1.5px] font-display text-[12px] font-extrabold uppercase tracking-[0.06em] transition",
                      v === opt
                        ? "border-primary-500 bg-primary-500 text-on-primary shadow-sm"
                        : v
                          ? "border-border bg-bone text-ink/40"
                          : "border-border bg-bone text-ink hover:border-ink/40",
                    )}
                  >
                    <span>{LINE_LABEL[opt]}</span>
                    <span
                      className={cn(
                        "font-mono text-[10px] font-bold",
                        v === opt ? "opacity-90" : "opacity-60",
                      )}
                    >
                      {LINE_POINTS[opt]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Body — zones_8 (sections 3, 4, 5: Drive, Control, Trail)
// ---------------------------------------------------------------------

function ZonesBody({
  hand,
  setHand,
  data,
  onPick,
}: {
  hand: "forehand" | "backhand";
  setHand: (h: "forehand" | "backhand") => void;
  data: Array<LineOutcome | ZoneOutcome | boolean | null>;
  onPick: (deliveryIdx: number, value: ZoneOutcome) => void;
}) {
  const typed = data as Array<ZoneOutcome | null>;
  const nextEmpty = [...Array(8)].findIndex((_, i) => typed[i] == null);
  const activeIdx = nextEmpty === -1 ? 7 : nextEmpty;
  const activeValue = typed[activeIdx];
  const compassValue =
    typeof activeValue === "number" ? (activeValue as Exclude<ZoneOutcome, "miss">) : null;

  return (
    <div
      data-slot="zones-body"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]"
    >
      <div className="rounded-xl border border-border bg-bone p-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              Active bowl
            </div>
            <div className="font-display text-[32px] font-black leading-none">
              Bowl {activeIdx + 1}
              <span className="ml-1 text-[18px] font-bold text-ink-muted">
                / 8
              </span>
            </div>
          </div>
          <div
            data-slot="hand-toggle"
            className="inline-flex gap-1.5 rounded-full bg-surface-muted p-1"
          >
            {(["forehand", "backhand"] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHand(h)}
                data-slot="hand-option"
                data-hand={h}
                data-active={hand === h}
                className={cn(
                  "h-10 rounded-full border-0 px-4 font-display text-[12px] font-extrabold uppercase tracking-[0.12em] transition",
                  hand === h
                    ? "bg-primary-500 text-on-primary"
                    : "bg-transparent text-ink-muted hover:text-ink",
                )}
              >
                {h === "forehand" ? "Forehand" : "Backhand"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-center py-2">
          <CompassPicker
            size={380}
            value={compassValue}
            hand={hand}
            onPick={(zone) => onPick(activeIdx, zone)}
          />
        </div>
        <div className="mt-3.5 flex justify-center">
          <button
            type="button"
            onClick={() => onPick(activeIdx, "miss")}
            data-slot="miss-cta"
            data-selected={activeValue === "miss"}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-lg border-[1.5px] px-6 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] transition",
              activeValue === "miss"
                ? "border-danger-500 bg-danger-500 text-bone"
                : "border-border bg-bone text-ink hover:border-ink/40",
            )}
          >
            <X className="size-4" aria-hidden="true" />
            Miss · 0pt
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          8 bowls
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {[...Array(8)].map((_, i) => {
            const v = typed[i];
            const isActive = i === activeIdx;
            return (
              <li key={i}>
                <div
                  data-slot="bowl-thumb"
                  data-delivery={i + 1}
                  data-active={isActive}
                  data-value={v == null ? "" : String(v)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border-[1.5px] px-3 py-2.5 transition",
                    isActive
                      ? "border-primary-500 bg-primary-500/8 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary-500)_16%,transparent)]"
                      : "border-border bg-bone",
                  )}
                >
                  <div>
                    <div className="font-mono text-[11px] text-ink-subtle">
                      Bowl
                    </div>
                    <div className="font-display text-[22px] font-black leading-none">
                      {i + 1}
                    </div>
                  </div>
                  {v === "miss" ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-danger-500/12 px-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-danger-500">
                      Miss · 0
                    </span>
                  ) : typeof v === "number" ? (
                    <div className="text-right">
                      <div className="font-display text-[18px] font-black leading-none text-primary-600">
                        Z{v} · {ZONE_META[v as Exclude<ZoneOutcome, "miss">].short}
                      </div>
                      <div className="font-mono text-[11px] text-ink-muted">
                        {ZONE_POINTS[v as Exclude<ZoneOutcome, "miss">]}pt
                      </div>
                    </div>
                  ) : (
                    <span className="text-[12px] italic text-ink-muted">
                      {isActive ? "Tap a wedge →" : "—"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Body — on_length (sections 6, 7: Speedhumps Asc / Desc)
// ---------------------------------------------------------------------

function OnLengthBody({
  ladder,
  hand,
  setHand,
  data,
  onPick,
}: {
  ladder: number[];
  hand: "forehand" | "backhand";
  setHand: (h: "forehand" | "backhand") => void;
  data: Record<number, Array<LineOutcome | ZoneOutcome | boolean | null>>;
  onPick: (deliveryIdx: number, distanceIdx: number, value: boolean) => void;
}) {
  return (
    <div data-slot="on-length-body">
      <div className="mb-4 flex items-center gap-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          Order: {ladder.join(" → ")}m
        </div>
        <div
          data-slot="hand-toggle"
          className="ml-auto inline-flex gap-1.5 rounded-full bg-surface-muted p-1"
        >
          {(["forehand", "backhand"] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHand(h)}
              data-slot="hand-option"
              data-hand={h}
              data-active={hand === h}
              className={cn(
                "h-9 rounded-full border-0 px-4 font-display text-[12px] font-extrabold uppercase tracking-[0.12em] transition",
                hand === h
                  ? "bg-primary-500 text-on-primary"
                  : "bg-transparent text-ink-muted hover:text-ink",
              )}
            >
              {h === "forehand" ? "Forehand" : "Backhand"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {ladder.map((len, idx) => {
          const lengthData =
            (data[idx] ?? []) as Array<boolean | null>;
          return (
            <div
              key={`${len}-${idx}`}
              data-slot="ladder-card"
              data-distance={len}
              data-rung={idx + 1}
              className="overflow-hidden rounded-xl border-[1.5px] border-border bg-bone"
            >
              <div className="bg-ink px-3.5 py-3 text-ink-inverse">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">
                  Rung {idx + 1}
                </div>
                <div className="font-display text-[30px] font-black italic leading-none">
                  {len}m
                </div>
              </div>
              <div className="grid gap-2.5 p-3.5">
                {([
                  ["F", "Forehand"],
                  ["B", "Backhand"],
                ] as const).map(([code, lbl], di) => {
                  const v = lengthData[di] ?? null;
                  return (
                    <div key={code} data-slot="ladder-row" data-di={di}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                          {lbl}
                        </span>
                        {v != null && (
                          <span
                            className={cn(
                              "font-mono text-[11px] font-bold",
                              v ? "text-success-500" : "text-danger-500",
                            )}
                          >
                            {v ? "+2pt" : "0pt"}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPick(di, idx, true)}
                          data-slot="on-length-option"
                          data-distance={len}
                          data-di={di}
                          data-option="on"
                          data-selected={v === true}
                          className={cn(
                            "flex h-14 flex-col items-center justify-center rounded-md border-[1.5px] font-display text-[12px] font-extrabold uppercase tracking-[0.06em] transition",
                            v === true
                              ? "border-success-500 bg-success-500 text-bone"
                              : v === false
                                ? "border-border bg-bone text-ink/45"
                                : "border-border bg-bone text-ink hover:border-ink/40",
                          )}
                        >
                          <span>On length</span>
                          <span className="font-mono text-[10px] font-bold opacity-80">
                            2pt
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPick(di, idx, false)}
                          data-slot="on-length-option"
                          data-distance={len}
                          data-di={di}
                          data-option="off"
                          data-selected={v === false}
                          className={cn(
                            "flex h-14 flex-col items-center justify-center rounded-md border-[1.5px] font-display text-[12px] font-extrabold uppercase tracking-[0.06em] transition",
                            v === false
                              ? "border-danger-500 bg-danger-500 text-bone"
                              : v === true
                                ? "border-border bg-bone text-ink/45"
                                : "border-border bg-bone text-ink hover:border-ink/40",
                          )}
                        >
                          <span>Off</span>
                          <span className="font-mono text-[10px] font-bold opacity-80">
                            0pt
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

const SECTION_TITLE: Record<SectionKey, string> = {
  jacks: "JACKS",
  targets: "TARGETS",
  drive: "DRIVE",
  control: "CONTROL",
  trail: "TRAIL",
  speedhumps_asc: "SPEEDHUMPS ASCENDING",
  speedhumps_desc: "SPEEDHUMPS DESCENDING",
};

const SECTION_DESC: Record<SectionKey, string> = {
  jacks: "Score each delivery: on line / narrow / wide. 8 bowls × 4 distances.",
  targets: "Score each delivery: on line / narrow / wide. 8 bowls × 4 distances.",
  drive: "Tap the wedge where each bowl finished. 8 bowls per hand.",
  control: "Tap the wedge where each bowl finished. 8 bowls per hand.",
  trail: "Tap the wedge where each bowl finished. 8 bowls per hand.",
  speedhumps_asc:
    "Mark each delivery on length or off. 2 bowls (F + B) per length rung.",
  speedhumps_desc:
    "Mark each delivery on length or off. 2 bowls (F + B) per length rung.",
};

const ZONE_POINTS: Record<Exclude<ZoneOutcome, "miss">, number> = {
  1: 8,
  2: 5,
  3: 2,
  4: 4,
  5: 6,
  6: 4,
  7: 2,
  8: 5,
};

function distancesOf(
  sec: Rubric["sections"][SectionKey],
): number[] {
  if (sec.model === "line_outcome") return [...sec.distances_m];
  if (sec.model === "zones_8") return [sec.distance_m];
  return [...sec.ladder_m];
}

function expectedDeliveriesPerRound(
  sec: Rubric["sections"][SectionKey],
): number {
  if (sec.model === "line_outcome") return sec.distances_m.length * 8;
  if (sec.model === "zones_8") return 8;
  return sec.ladder_m.length * 2;
}

function hydrateAndSeek(
  rubric: Rubric,
  rows: DeliveryRow[],
): { sectionIdx: number; round: 1 | 2; deliveriesMap: DeliveriesMap } {
  const map: DeliveriesMap = {};
  for (const r of rows) {
    const sec = rubric.sections[r.section];
    let distIdx = 0;
    if (sec.model === "line_outcome") {
      distIdx = sec.distances_m.indexOf(r.distance_m ?? -1);
      if (distIdx < 0) distIdx = 0;
    } else if (sec.model === "on_length") {
      distIdx = sec.ladder_m.indexOf(r.distance_m ?? -1);
      if (distIdx < 0) distIdx = 0;
    }
    const value = decodeOutcome(r);
    if (value === undefined) continue;
    const sectionMap = (map[r.section] = map[r.section] ?? {});
    const roundMap = (sectionMap[r.round] = sectionMap[r.round] ?? {});
    const arr = (roundMap[distIdx] = roundMap[distIdx] ?? []);
    arr[r.delivery_index - 1] = value;
  }
  // Seek: walk in canonical order, jump to first incomplete (sec, round).
  for (let i = 0; i < SECTION_KEYS.length; i++) {
    const k = SECTION_KEYS[i];
    for (const r of [1, 2] as const) {
      const filled = countFilled(map[k]?.[r] ?? {});
      const expected = expectedDeliveriesPerRound(rubric.sections[k]);
      if (filled < expected) {
        return { sectionIdx: i, round: r, deliveriesMap: map };
      }
    }
  }
  // Fully captured — land on the last cell so the user can finalize.
  return {
    sectionIdx: SECTION_KEYS.length - 1,
    round: 2,
    deliveriesMap: map,
  };
}

function countFilled(
  buckets: Record<number, Array<LineOutcome | ZoneOutcome | boolean | null>>,
): number {
  let n = 0;
  for (const arr of Object.values(buckets)) {
    for (const v of arr) {
      if (v != null) n++;
    }
  }
  return n;
}

function decodeOutcome(
  r: DeliveryRow,
): LineOutcome | ZoneOutcome | boolean | undefined {
  const o = r.outcome ?? {};
  if (typeof o.line === "string") return o.line as LineOutcome;
  if (typeof o.zone === "number") return o.zone as ZoneOutcome;
  if (o.zone === "miss") return "miss";
  if (typeof o.on_length === "boolean") return o.on_length;
  return undefined;
}

function completedMapFor(
  rubric: Rubric,
  deliveriesMap: DeliveriesMap,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of SECTION_KEYS) {
    const expected = expectedDeliveriesPerRound(rubric.sections[k]);
    for (const r of [1, 2] as const) {
      const filled = countFilled(deliveriesMap[k]?.[r] ?? {});
      out[`${k}_r${r}`] = filled >= expected;
    }
  }
  return out;
}

function subtotalForSectionRound(
  rubric: Rubric,
  section: SectionKey,
  round: 1 | 2,
  deliveriesMap: DeliveriesMap,
): number {
  const sec = rubric.sections[section];
  const buckets = deliveriesMap[section]?.[round] ?? {};
  let total = 0;
  for (const arr of Object.values(buckets)) {
    for (const v of arr) {
      if (v == null) continue;
      if (sec.model === "line_outcome") {
        const points = sec.points;
        if (typeof v === "string" && v in points) {
          total += points[v as LineOutcome];
        }
      } else if (sec.model === "zones_8") {
        const key = String(v) as keyof typeof sec.zonePoints;
        total += sec.zonePoints[key] ?? 0;
      } else {
        if (v === true) total += sec.pointsPerOnLength;
      }
    }
  }
  return total;
}

function humanLiveLabel(pending: boolean, state: SaveState): string | null {
  if (state === "failed") return "Last delivery didn't save — tap to retry.";
  if (pending || state === "saving") return "Auto-saving as you tap.";
  return null;
}
