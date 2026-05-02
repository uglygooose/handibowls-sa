"use client";

import { Check, Flag, MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { StatusDot, type MatchStatusForDot } from "@/components/tournament/StatusDot";
import { cn } from "@/lib/utils";

// Bulk-scoring grid primitive. Admin-only (no Phase-8 player consumer).
//
// Keyboard navigation per design footer:
//   ↑↓←→  navigate cells (between the two score inputs in a row, and
//          between rows)
//   Enter  commit the active row's edits to the staging buffer
//   Shift+Enter  commit + advance to the next row
//   Esc    revert the active cell's edit to the last-committed value
//
// Hotkeys are scoped to the grid via `enableOnFormTags: ["input"]` so
// they fire while typing in the inputs without preventing digit entry
// (the handlers preventDefault on arrow / enter / esc explicitly).

export type BulkScoringMatch = {
  id: string;
  match_no: number;
  round: number;
  rink: string | null;
  home: SlotInfo;
  away: SlotInfo;
  home_shots: number;
  away_shots: number;
  status: MatchStatusForDot;
  finalized_by_admin: boolean;
};

type SlotInfo = {
  name: string;
  subtitle: string | null;
  isBye: boolean;
};

type ScorePatch = {
  match_id: string;
  home_shots: number;
  away_shots: number;
};

type Props = {
  matches: BulkScoringMatch[];
  /** Persisted via lib/tournaments bulk save action — no finalize. */
  onSaveBatch: (patches: ScorePatch[]) => Promise<void> | void;
  /** Persisted via lib/tournaments admin-finalize action. */
  onFinalizeBatch: (patches: ScorePatch[]) => Promise<void> | void;
  /** Per-tournament shots target — surfaces in the keyboard hint footer. */
  shotsTarget?: number | null;
  /** Per-tournament ends target — alternative to shotsTarget. */
  endsTarget?: number | null;
  pending?: boolean;
};

type CellEdit = { home: string; away: string };

export function BulkScoringGrid({
  matches,
  onSaveBatch,
  onFinalizeBatch,
  shotsTarget,
  endsTarget,
  pending,
}: Props) {
  // Active cell tracked as `[rowIndex, side]` — side is "home" | "away".
  const [activeRow, setActiveRow] = useState(0);
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  // Selection set for bulk actions (rows the admin will save / finalize).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Per-match draft scores. Key into matches[i].id; resets back to the
  // committed `home_shots`/`away_shots` when the admin presses Esc.
  const [edits, setEdits] = useState<Record<string, CellEdit>>({});

  // Status filter — chips.
  const [filter, setFilter] = useState<"all" | "open" | "in_play" | "final">("all");

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "all") return true;
      if (filter === "open") return m.status === "OPEN" || m.status === "SCHEDULED";
      if (filter === "in_play") return m.status === "IN_PLAY";
      if (filter === "final") return m.status === "FINAL" || m.status === "COMPLETED";
      return true;
    });
  }, [matches, filter]);

  // Refs for each input so keyboard nav can call .focus() programmatically.
  // Lazy-init per-row in the input ref callbacks below — never written
  // during render to satisfy the React Compiler refs rule.
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const focusCell = useCallback((row: number, side: "home" | "away") => {
    const ref = inputRefs.current[row]?.[side === "home" ? 0 : 1];
    if (ref) {
      ref.focus();
      ref.select();
    }
  }, []);

  // ---------- keyboard nav ----------

  const arrowOpts = {
    enableOnFormTags: ["input" as const],
    preventDefault: true,
  };

  useHotkeys("up", () => {
    const next = Math.max(0, activeRow - 1);
    setActiveRow(next);
    focusCell(next, activeSide);
  }, arrowOpts, [activeRow, activeSide, focusCell]);

  useHotkeys("down", () => {
    const next = Math.min(filtered.length - 1, activeRow + 1);
    setActiveRow(next);
    focusCell(next, activeSide);
  }, arrowOpts, [activeRow, activeSide, focusCell, filtered.length]);

  useHotkeys("left", () => {
    if (activeSide === "away") {
      setActiveSide("home");
      focusCell(activeRow, "home");
    }
  }, arrowOpts, [activeRow, activeSide, focusCell]);

  useHotkeys("right", () => {
    if (activeSide === "home") {
      setActiveSide("away");
      focusCell(activeRow, "away");
    }
  }, arrowOpts, [activeRow, activeSide, focusCell]);

  useHotkeys(
    "enter",
    () => {
      // Plain Enter — commit the row to the staging buffer (no DB write
      // until the admin clicks Save batch / Finalize). Selecting the
      // row marks it for the bulk action.
      const m = filtered[activeRow];
      if (!m) return;
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
    },
    { enableOnFormTags: ["input"], preventDefault: true },
    [activeRow, filtered],
  );

  useHotkeys(
    "shift+enter",
    () => {
      const m = filtered[activeRow];
      if (m) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.add(m.id);
          return next;
        });
      }
      const nextRow = Math.min(filtered.length - 1, activeRow + 1);
      setActiveRow(nextRow);
      setActiveSide("home");
      focusCell(nextRow, "home");
    },
    { enableOnFormTags: ["input"], preventDefault: true },
    [activeRow, filtered, focusCell],
  );

  useHotkeys(
    "esc",
    () => {
      const m = filtered[activeRow];
      if (!m) return;
      setEdits((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      // Re-focus the input so the admin can re-edit immediately.
      focusCell(activeRow, activeSide);
    },
    { enableOnFormTags: ["input"], preventDefault: true },
    [activeRow, activeSide, filtered, focusCell],
  );

  // ---------- patches + actions ----------

  function patchesFromSelection(): ScorePatch[] {
    const patches: ScorePatch[] = [];
    for (const m of matches) {
      if (!selected.has(m.id)) continue;
      const e = edits[m.id];
      const home = e ? safeInt(e.home, m.home_shots) : m.home_shots;
      const away = e ? safeInt(e.away, m.away_shots) : m.away_shots;
      if (home == null || away == null) continue;
      patches.push({ match_id: m.id, home_shots: home, away_shots: away });
    }
    return patches;
  }

  async function handleSave() {
    const patches = patchesFromSelection();
    if (!patches.length) return;
    await onSaveBatch(patches);
    setEdits({});
  }
  async function handleFinalize() {
    const patches = patchesFromSelection();
    if (!patches.length) return;
    await onFinalizeBatch(patches);
    setEdits({});
    setSelected(new Set());
  }

  // ---------- render ----------

  const valueFor = (m: BulkScoringMatch, side: "home" | "away") => {
    const edit = edits[m.id];
    if (edit) return side === "home" ? edit.home : edit.away;
    const committed = side === "home" ? m.home_shots : m.away_shots;
    return committed === 0 && m.status !== "FINAL" && m.status !== "COMPLETED"
      ? ""
      : String(committed);
  };

  return (
    <div data-slot="bulk-scoring-grid" className="flex flex-col gap-4">
      {/* Filter row + bulk action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ["all", "All"],
            ["open", "Open"],
            ["in_play", "In play"],
            ["final", "Final"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id as typeof filter)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors",
                filter === id
                  ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
                  : "border-border bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={selected.size === 0 || pending}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-muted px-3 text-[12px] font-medium text-ink hover:bg-surface-muted/70",
              (selected.size === 0 || pending) && "cursor-not-allowed opacity-60",
            )}
          >
            <Flag className="size-3.5" aria-hidden="true" />
            Finalize ({selected.size})
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.size === 0 || pending}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-500 px-3 text-[12px] font-semibold text-[color:var(--color-on-primary)] hover:bg-primary-600",
              (selected.size === 0 || pending) && "cursor-not-allowed opacity-60",
            )}
          >
            <Check className="size-3.5" aria-hidden="true" />
            Save batch ({selected.size})
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[1080px] border-collapse text-left text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <Th className="w-9" />
              <Th className="w-16">Match</Th>
              <Th className="w-14">Round</Th>
              <Th className="w-16">Rink</Th>
              <Th>Home</Th>
              <Th className="w-16 text-center">Score</Th>
              <Th className="w-6 text-center" />
              <Th className="w-16 text-center">Score</Th>
              <Th>Away</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-20">Final</Th>
              <Th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, rowIndex) => {
              const isActive = rowIndex === activeRow;
              const isSelected = selected.has(m.id);
              const isLive = m.status === "IN_PLAY";
              return (
                <tr
                  key={m.id}
                  data-active={isActive}
                  data-selected={isSelected}
                  data-testid={`scoring-row-${m.id}`}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-b-0",
                    isActive && "bg-primary-500/[0.04]",
                    isSelected && "bg-primary-500/[0.08]",
                  )}
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`Select match M${String(m.match_no).padStart(2, "0")}`}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        });
                      }}
                      className="size-4 cursor-pointer"
                    />
                  </Td>
                  <Td className="font-mono font-semibold">
                    M{String(m.match_no).padStart(2, "0")}
                  </Td>
                  <Td className="text-ink-muted">R{m.round}</Td>
                  <Td>
                    {m.rink ? (
                      <span className="inline-flex h-6 items-center rounded-full bg-primary-500/10 px-2 font-mono text-[11px] font-bold text-accent-ink ring-1 ring-inset ring-primary-500/30">
                        {m.rink}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </Td>
                  <Td>
                    <SlotCell slot={m.home} />
                  </Td>
                  <Td className="text-center">
                    <ScoreInput
                      ref={(el) => {
                        if (!inputRefs.current[rowIndex]) {
                          inputRefs.current[rowIndex] = [null, null];
                        }
                        inputRefs.current[rowIndex][0] = el;
                      }}
                      ariaLabel={`Home score for M${String(m.match_no).padStart(2, "0")}`}
                      value={valueFor(m, "home")}
                      onChange={(value) =>
                        setEdits((prev) => ({
                          ...prev,
                          [m.id]: {
                            home: value,
                            away: prev[m.id]?.away ?? String(m.away_shots),
                          },
                        }))
                      }
                      onFocus={() => {
                        setActiveRow(rowIndex);
                        setActiveSide("home");
                      }}
                      isLive={isLive}
                      disabled={m.status === "BYE" || m.status === "CANCELLED"}
                    />
                  </Td>
                  <Td className="text-center font-mono text-[11px] text-ink-subtle">
                    vs
                  </Td>
                  <Td className="text-center">
                    <ScoreInput
                      ref={(el) => {
                        if (!inputRefs.current[rowIndex]) {
                          inputRefs.current[rowIndex] = [null, null];
                        }
                        inputRefs.current[rowIndex][1] = el;
                      }}
                      ariaLabel={`Away score for M${String(m.match_no).padStart(2, "0")}`}
                      value={valueFor(m, "away")}
                      onChange={(value) =>
                        setEdits((prev) => ({
                          ...prev,
                          [m.id]: {
                            home: prev[m.id]?.home ?? String(m.home_shots),
                            away: value,
                          },
                        }))
                      }
                      onFocus={() => {
                        setActiveRow(rowIndex);
                        setActiveSide("away");
                      }}
                      isLive={isLive}
                      disabled={m.status === "BYE" || m.status === "CANCELLED"}
                    />
                  </Td>
                  <Td>
                    <SlotCell slot={m.away} />
                  </Td>
                  <Td>
                    <StatusDot status={m.status} />
                  </Td>
                  <Td>
                    <FinalSwitch
                      id={`final-${m.id}`}
                      checked={m.finalized_by_admin}
                    />
                  </Td>
                  <Td>
                    <button
                      type="button"
                      aria-label={`Match M${String(m.match_no).padStart(2, "0")} actions`}
                      className="inline-flex size-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </button>
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-ink-muted">
                  No matches match the active filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer hint — verbatim copy from design source */}
      <div className="flex items-center justify-between px-1 text-[11.5px] text-ink-subtle">
        <span>
          Keyboard:{" "}
          <Kbd>↑↓←→</Kbd> navigate · <Kbd>Enter</Kbd> save row ·{" "}
          <Kbd>Shift+Enter</Kbd> save & next · <Kbd>Esc</Kbd> cancel
        </span>
        <span>
          Inline-validated against{" "}
          {shotsTarget != null ? (
            <>
              <strong>{shotsTarget}</strong> shots up
            </>
          ) : endsTarget != null ? (
            <>
              <strong>{endsTarget}</strong> ends
            </>
          ) : (
            "tournament rules"
          )}
        </span>
      </div>
    </div>
  );
}

// -------------------- helpers --------------------

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}

function SlotCell({ slot }: { slot: SlotInfo }) {
  if (slot.isBye) {
    return (
      <div>
        <div className="font-semibold text-ink-muted">BYE</div>
      </div>
    );
  }
  return (
    <div>
      <div className="font-semibold">{slot.name}</div>
      {slot.subtitle && (
        <div className="text-[11px] text-ink-muted">{slot.subtitle}</div>
      )}
    </div>
  );
}

type ScoreInputProps = {
  ref?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  ariaLabel: string;
  isLive?: boolean;
  disabled?: boolean;
};

// React 19 ref-as-prop pattern — no forwardRef needed.
function ScoreInput({
  ref,
  value,
  onChange,
  onFocus,
  ariaLabel,
  isLive,
  disabled,
}: ScoreInputProps) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      onFocus={onFocus}
      placeholder="—"
      disabled={disabled}
      className={cn(
        "h-9 w-14 rounded-md border bg-surface px-1.5 text-center font-mono text-[13px] tabular-nums focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
        isLive ? "border-primary-500 bg-bone" : "border-border",
        disabled && "cursor-not-allowed opacity-50",
      )}
    />
  );
}

function FinalSwitch({ id, checked }: { id: string; checked: boolean }) {
  // Display-only at the grid level — the row-level Finalize action goes
  // through the bulk button. Toggle here is read-state for visibility.
  return (
    <label
      htmlFor={id}
      className="relative inline-flex h-5 w-9 cursor-not-allowed items-center"
    >
      <input
        id={id}
        type="checkbox"
        defaultChecked={checked}
        disabled
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-surface-muted ring-1 ring-inset ring-border peer-checked:bg-primary-500"
      />
      <span
        aria-hidden="true"
        className="relative ml-0.5 size-4 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4"
      />
    </label>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-muted px-1 py-0.5 font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
}

function safeInt(s: string, fallback: number): number | null {
  if (s.trim() === "") return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
