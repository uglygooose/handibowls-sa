import { describe, expect, it } from "vitest";

import { formatRelativeZA } from "@/lib/format/relative";

const NOW = new Date("2026-04-29T12:00:00.000Z");

describe("formatRelativeZA", () => {
  it("returns empty string for null / undefined / invalid input", () => {
    expect(formatRelativeZA(null, NOW)).toBe("");
    expect(formatRelativeZA(undefined, NOW)).toBe("");
    expect(formatRelativeZA("not a date", NOW)).toBe("");
  });

  it.each([
    [10_000, "now"], // 10s ago
    [59_999, "now"], // just under a minute
  ])("renders 'now' for delta < 60s (%dms)", (delta, expected) => {
    const d = new Date(NOW.getTime() - delta);
    expect(formatRelativeZA(d, NOW)).toBe(expected);
  });

  it("renders Nm for sub-hour deltas", () => {
    const d = new Date(NOW.getTime() - 5 * 60_000);
    expect(formatRelativeZA(d, NOW)).toBe("5m");
  });

  it("renders Nh for sub-day deltas", () => {
    const d = new Date(NOW.getTime() - 3 * 60 * 60_000);
    expect(formatRelativeZA(d, NOW)).toBe("3h");
  });

  it("renders Nd for sub-week deltas", () => {
    const d = new Date(NOW.getTime() - 4 * 24 * 60 * 60_000);
    expect(formatRelativeZA(d, NOW)).toBe("4d");
  });

  it("renders Nw for sub-month deltas", () => {
    const d = new Date(NOW.getTime() - 2 * 7 * 24 * 60 * 60_000);
    expect(formatRelativeZA(d, NOW)).toBe("2w");
  });

  it("falls through to formatDateZA past 4 weeks", () => {
    const d = new Date(NOW.getTime() - 8 * 7 * 24 * 60 * 60_000);
    const out = formatRelativeZA(d, NOW);
    // formatDateZA returns en-ZA with day-month-year — no "w" suffix.
    expect(out).not.toMatch(/^\d+w$/);
    expect(out).toMatch(/\d/);
  });

  it("accepts an ISO string and a Date interchangeably", () => {
    const iso = new Date(NOW.getTime() - 90_000).toISOString();
    expect(formatRelativeZA(iso, NOW)).toBe("1m");
  });
});
