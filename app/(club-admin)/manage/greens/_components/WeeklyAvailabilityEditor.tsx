"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import {
  cellKey,
  type CellKey,
  EDITOR_HOURS,
  EDITOR_HOUR_END,
  EDITOR_HOUR_START,
  gridFromClosures,
  rangesFromGrid,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from "../grid";
import { replaceWeeklyClosures } from "../_actions";
import type { WeekdayClosure } from "../_data";

// Phase 9-1 — weekly availability editor.
//
// 7 columns (SUN…SAT) × 16 rows (06:00..22:00). Each cell is one
// hour on one weekday. Click a cell to toggle closure. Click-drag to
// bulk-toggle a range — the drag's first cell sets the target value
// (open → closed or closed → open) and every subsequent cell entered
// during the drag flips to that target value.
//
// Visual rhythm mirrors `components/tournament/RinkHeatmap`:
//   • bordered table + bg-surface root
//   • surface-muted/50 head bar with mono-caps headers
//   • bone column for the time-of-day labels
//   • color-mix tint for filled cells (primary-500 at low percent)
//
// Save model is snapshot-replace: the editor's grid state is the
// canonical truth. On save, the action deletes existing weekday-
// recurring rows and inserts the new compact ranges. One-off date-
// range closures (`weekday IS NULL`) are preserved by the action's
// targeted DELETE.

type Props = {
  clubId: string;
  initialClosures: WeekdayClosure[];
};

export function WeeklyAvailabilityEditor({ clubId, initialClosures }: Props) {
  const initialGrid = useMemo(
    () => gridFromClosures(initialClosures),
    [initialClosures],
  );

  const [grid, setGrid] = useState<Set<CellKey>>(initialGrid);
  const [pending, startTransition] = useTransition();
  // Drag state — null when idle, otherwise the target value the drag
  // is pinning every entered cell to. Tracking value (not toggle) so
  // a drag across mixed cells settles to one consistent state.
  const [dragTarget, setDragTarget] = useState<boolean | null>(null);

  const dirty = useMemo(() => {
    if (grid.size !== initialGrid.size) return true;
    for (const k of grid) if (!initialGrid.has(k)) return true;
    return false;
  }, [grid, initialGrid]);

  const closedCount = grid.size;

  function setCell(weekday: number, hour: number, value: boolean) {
    setGrid((prev) => {
      const next = new Set(prev);
      const key = cellKey(weekday, hour);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function onPointerDown(weekday: number, hour: number) {
    const key = cellKey(weekday, hour);
    const target = !grid.has(key);
    setDragTarget(target);
    setCell(weekday, hour, target);
  }

  function onPointerEnter(weekday: number, hour: number) {
    if (dragTarget === null) return;
    setCell(weekday, hour, dragTarget);
  }

  function endDrag() {
    setDragTarget(null);
  }

  function reset() {
    setGrid(initialGrid);
    setDragTarget(null);
  }

  function onSave() {
    startTransition(async () => {
      const ranges = rangesFromGrid(grid);
      const result = await replaceWeeklyClosures({ club_id: clubId, ranges });
      if (result.ok) {
        toast.success(
          ranges.length === 0
            ? "Cleared all weekly closures."
            : `Saved ${ranges.length} closure ${ranges.length === 1 ? "window" : "windows"}.`,
        );
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <section
      data-slot="weekly-availability-editor"
      className="flex flex-col gap-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-black uppercase italic tracking-tight">
            Weekly availability
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            Mark closures by tapping cells, or drag to flip a range. Closed
            hours hide from the player slot grid.
            {" "}
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-subtle"
              data-slot="closed-count"
            >
              {closedCount} closed
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending || !dirty}
            data-slot="reset-cta"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bone px-3",
              "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
              "hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            data-slot="save-cta"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-500 px-3",
              "text-[12px] font-extrabold uppercase tracking-[0.04em] text-on-primary",
              "shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            Save
          </button>
        </div>
      </header>

      <div
        data-slot="weekly-grid-wrap"
        className="overflow-x-auto rounded-xl border border-border bg-surface"
        onPointerLeave={endDrag}
        onPointerUp={endDrag}
      >
        <table
          className="w-full min-w-[640px] border-collapse text-left text-[13px]"
          data-slot="weekly-grid"
        >
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface-muted/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
              >
                Time
              </th>
              {WEEKDAYS.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="px-2 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
                >
                  {WEEKDAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EDITOR_HOURS.map((hour) => (
              <tr
                key={hour}
                className="border-b border-border/60 last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-bone px-3 py-2 font-mono text-[11px] font-semibold tabular-nums text-ink-muted"
                >
                  {pad2(hour)}:00
                </th>
                {WEEKDAYS.map((d) => {
                  const closed = grid.has(cellKey(d, hour));
                  return (
                    <td
                      key={d}
                      data-slot="weekly-cell"
                      data-weekday={d}
                      data-hour={hour}
                      data-closed={closed}
                      onPointerDown={() => onPointerDown(d, hour)}
                      onPointerEnter={() => onPointerEnter(d, hour)}
                      style={
                        closed
                          ? {
                              background:
                                "color-mix(in srgb, var(--color-primary-500) 28%, transparent)",
                            }
                          : undefined
                      }
                      className={cn(
                        "h-8 cursor-pointer select-none border-l border-border/60 text-center transition-colors",
                        closed
                          ? "text-primary-600"
                          : "text-ink-subtle hover:bg-surface-muted/40",
                      )}
                      role="button"
                      aria-pressed={closed}
                      aria-label={`${WEEKDAY_LABELS[d]} ${pad2(hour)}:00 ${closed ? "closed" : "open"}`}
                    >
                      {closed ? (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
                          ×
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
        Hours covered: {pad2(EDITOR_HOUR_START)}:00 – {pad2(EDITOR_HOUR_END)}:00
        SAST. One-off date-range closures (specific dates rather than
        recurring weekdays) live on a separate surface.
      </p>
    </section>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
