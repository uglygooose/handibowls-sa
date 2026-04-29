import { describe, expect, it } from "vitest";

// Phase 9-1 — pure grid-derivation helpers. No Supabase, no auth —
// just deterministic transforms between the editor's flat closure
// set and the canonical compact range list the action persists.

import {
  cellKey,
  EDITOR_HOUR_END,
  EDITOR_HOUR_START,
  EDITOR_HOURS,
  gridFromClosures,
  hourFromTime,
  rangesFromGrid,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from "@/app/(club-admin)/manage/greens/grid";

describe("editor constants", () => {
  it("covers 06:00-22:00 inclusive-exclusive (16 hour rows)", () => {
    expect(EDITOR_HOUR_START).toBe(6);
    expect(EDITOR_HOUR_END).toBe(22);
    expect(EDITOR_HOURS).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });

  it("WEEKDAYS uses Postgres `extract(dow)` order — Sunday=0", () => {
    expect(WEEKDAYS).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(WEEKDAY_LABELS).toEqual([
      "SUN",
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
    ]);
  });
});

describe("hourFromTime", () => {
  it("parses HH:MM and HH:MM:SS Postgres time strings", () => {
    expect(hourFromTime("09:00")).toBe(9);
    expect(hourFromTime("09:00:00")).toBe(9);
    expect(hourFromTime("13:30:00")).toBe(13);
    expect(hourFromTime("00:00:00")).toBe(0);
    expect(hourFromTime("23:59:59")).toBe(23);
  });

  it("rejects malformed input", () => {
    expect(hourFromTime("9:00")).toBeNull();
    expect(hourFromTime("9-00")).toBeNull();
    expect(hourFromTime("not a time")).toBeNull();
    expect(hourFromTime("")).toBeNull();
  });
});

describe("gridFromClosures", () => {
  it("expands a single closure into per-hour cells (half-open [start, end))", () => {
    const grid = gridFromClosures([
      { weekday: 1, starts_time: "09:00:00", ends_time: "11:00:00" },
    ]);
    // 09:00–11:00 covers hours 9 and 10 only — NOT 11.
    expect(grid.has(cellKey(1, 9))).toBe(true);
    expect(grid.has(cellKey(1, 10))).toBe(true);
    expect(grid.has(cellKey(1, 11))).toBe(false);
    expect(grid.size).toBe(2);
  });

  it("unions overlapping closures on the same weekday", () => {
    const grid = gridFromClosures([
      { weekday: 3, starts_time: "08:00", ends_time: "12:00" },
      { weekday: 3, starts_time: "10:00", ends_time: "14:00" },
    ]);
    // Combined coverage: 08, 09, 10, 11, 12, 13 — six cells.
    expect(grid.size).toBe(6);
    for (let h = 8; h < 14; h++) expect(grid.has(cellKey(3, h))).toBe(true);
    expect(grid.has(cellKey(3, 14))).toBe(false);
  });

  it("clamps to editor hour bounds (06-22)", () => {
    const grid = gridFromClosures([
      { weekday: 5, starts_time: "04:00", ends_time: "08:00" },
      { weekday: 5, starts_time: "20:00", ends_time: "23:30" },
    ]);
    // Lower clamp: 04-08 → only 06 and 07 land.
    expect(grid.has(cellKey(5, 4))).toBe(false);
    expect(grid.has(cellKey(5, 5))).toBe(false);
    expect(grid.has(cellKey(5, 6))).toBe(true);
    expect(grid.has(cellKey(5, 7))).toBe(true);
    expect(grid.has(cellKey(5, 8))).toBe(false);
    // Upper clamp: 20-23:30 → 20 and 21 land.
    expect(grid.has(cellKey(5, 20))).toBe(true);
    expect(grid.has(cellKey(5, 21))).toBe(true);
    expect(grid.has(cellKey(5, 22))).toBe(false);
    expect(grid.has(cellKey(5, 23))).toBe(false);
  });

  it("ignores zero-length / inverted ranges", () => {
    const grid = gridFromClosures([
      { weekday: 0, starts_time: "10:00", ends_time: "10:00" },
      { weekday: 0, starts_time: "12:00", ends_time: "10:00" },
    ]);
    expect(grid.size).toBe(0);
  });

  it("handles malformed time strings without throwing", () => {
    const grid = gridFromClosures([
      { weekday: 0, starts_time: "9-00", ends_time: "11:00" },
      { weekday: 0, starts_time: "13:00", ends_time: "" },
    ]);
    expect(grid.size).toBe(0);
  });
});

describe("rangesFromGrid", () => {
  it("collapses consecutive closed hours into one range per weekday", () => {
    const grid = new Set([
      cellKey(1, 9),
      cellKey(1, 10),
      cellKey(1, 11),
    ]);
    const ranges = rangesFromGrid(grid);
    expect(ranges).toEqual([
      { weekday: 1, starts_time: "09:00:00", ends_time: "12:00:00" },
    ]);
  });

  it("produces multiple ranges when closed hours have gaps", () => {
    const grid = new Set([
      cellKey(2, 9),
      cellKey(2, 10),
      // gap at 11
      cellKey(2, 12),
      cellKey(2, 13),
    ]);
    const ranges = rangesFromGrid(grid);
    expect(ranges).toEqual([
      { weekday: 2, starts_time: "09:00:00", ends_time: "11:00:00" },
      { weekday: 2, starts_time: "12:00:00", ends_time: "14:00:00" },
    ]);
  });

  it("handles single-hour closures", () => {
    const grid = new Set([cellKey(4, 14)]);
    const ranges = rangesFromGrid(grid);
    expect(ranges).toEqual([
      { weekday: 4, starts_time: "14:00:00", ends_time: "15:00:00" },
    ]);
  });

  it("emits ranges per weekday in 0..6 order", () => {
    const grid = new Set([
      cellKey(6, 8),
      cellKey(0, 8),
      cellKey(3, 8),
    ]);
    const ranges = rangesFromGrid(grid);
    const weekdays = ranges.map((r) => r.weekday);
    expect(weekdays).toEqual([0, 3, 6]);
  });

  it("returns empty array when grid is empty", () => {
    expect(rangesFromGrid(new Set())).toEqual([]);
  });

  it("round-trip: grid → ranges → grid is identity", () => {
    const original = new Set<ReturnType<typeof cellKey>>([
      cellKey(1, 9),
      cellKey(1, 10),
      cellKey(3, 12),
      cellKey(3, 13),
      cellKey(3, 14),
      cellKey(6, 7),
    ]);
    const ranges = rangesFromGrid(original);
    const rebuilt = gridFromClosures(ranges);
    expect(new Set(rebuilt)).toEqual(original);
  });
});
