"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { cn } from "@/lib/utils";

import { MatchCard, type MatchCardData } from "./MatchCard";

// Bracket-canvas primitive. Renders rounds left-to-right with the
// design's expanding-spacing convention (each round doubles the
// vertical centering of its match cards).
//
// Phase 8 player surfaces consume this same component (read-only —
// pass `onMatchClick={undefined}` and you get a pure-display bracket).

export type BracketRound = {
  round: number;
  /** "Quarter-finals" / "Semi-finals" / "Final" / "Round N" — caller
   *  decides the labels so this primitive doesn't bake bracket-size
   *  assumptions. */
  label: string;
  matches: MatchCardData[];
  /** When true, the current-round-active accent renders. */
  isCurrent?: boolean;
};

type Props = {
  rounds: BracketRound[];
  /** Theme preset that drives the splatter accent (matches the page-level
   *  ThemeApplier output). Omit for the platform default ("ocean-green"). */
  decorPreset?: ThemePreset;
  onMatchClick?: (match: MatchCardData) => void;
  /** Initial zoom (0.7–1.5). Defaults to 1.0. */
  initialZoom?: number;
  className?: string;
};

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

export function BracketCanvas({
  rounds,
  decorPreset,
  onMatchClick,
  initialZoom = 1,
  className,
}: Props) {
  const [zoom, setZoom] = useState(initialZoom);

  return (
    <div
      data-slot="bracket-canvas"
      className={cn(
        "flex flex-col gap-4",
        className,
      )}
    >
      {/* Toolbar — zoom controls; downstream toolbars (advance / print)
          stack above this primitive in the consuming page. */}
      <div className="flex items-center gap-2 self-end">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ZoomOut className="size-4" aria-hidden="true" />
        </button>
        <span className="w-12 text-center font-mono text-[12px] tabular-nums text-ink-muted">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ZoomIn className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Canvas */}
      {/* `isolate` keeps the splatter SVG's transform-induced stacking
          context bounded inside the canvas — without it the empty-state
          and round columns can render beneath the splatter accent.
          See SplatterAccent.tsx stacking-expectation block. */}
      <div className="relative isolate overflow-auto rounded-2xl border border-border bg-bone p-6">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer seed="bracket-canvas" density="high" opacity={0.5} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 z-0 opacity-60"
        >
          <SplatterAccent
            preset={decorPreset ?? "ocean-green"}
            variant={1}
            size={260}
            rotate={15}
          />
        </div>

        <div
          className="relative z-10 flex items-start gap-8"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {rounds.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border bg-surface px-6 py-10 text-center text-[13px] text-ink-muted">
              No rounds to render yet — generate the bracket from the
              entries tab.
            </div>
          ) : (
            rounds.map((r) => (
              <RoundColumn
                key={r.round}
                round={r}
                isFinal={r.round === Math.max(...rounds.map((x) => x.round))}
                onMatchClick={onMatchClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RoundColumn({
  round,
  isFinal,
  onMatchClick,
}: {
  round: BracketRound;
  isFinal: boolean;
  onMatchClick?: (match: MatchCardData) => void;
}) {
  // Spacing factor: each successive round doubles the gap so the
  // bracket rendering stays visually centered. Pre-padding the column
  // pushes round-N matches to align with the midpoint between their
  // round-(N-1) feeders.
  const factor = Math.pow(2, round.round - 1);
  const verifiedCount = round.matches.filter(
    (m) => m.status === "FINAL" || m.status === "COMPLETED",
  ).length;

  return (
    <div
      className="flex flex-col"
      style={{
        paddingTop: round.round > 1 ? `${((factor - 1) / 2) * 90}px` : 0,
        gap: `${factor * 18}px`,
        minWidth: isFinal ? 280 : 240,
      }}
    >
      <div
        className={cn(
          "flex items-baseline justify-between border-b-2 pb-1.5",
          round.isCurrent ? "border-primary-500" : "border-ink",
        )}
      >
        <span className="font-display text-base font-bold tracking-tight">
          {round.label}
        </span>
        <span className="font-mono text-[11px] text-ink-muted">
          {verifiedCount}/{round.matches.length}
          {round.isCurrent && (
            <span className="ml-2 text-accent-ink">● CURRENT</span>
          )}
        </span>
      </div>
      {round.matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          isCurrent={round.isCurrent && m.status !== "FINAL" && m.status !== "COMPLETED"}
          isFinal={isFinal}
          onClick={onMatchClick}
        />
      ))}
    </div>
  );
}
