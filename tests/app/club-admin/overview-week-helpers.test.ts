import { describe, expect, it } from "vitest";

import {
  CALENDAR_DAYS,
  CALENDAR_DAY_LABELS,
  CALENDAR_HOURS,
  dayBoundsUtc,
  mondayOf,
  parseWeekParam,
  sastHourOf,
  sastIsoDateOf,
  shiftIso,
  shortDayLabel,
  todayIsoSAST,
  weekBoundsUtc,
  weekDateRange,
} from "@/app/(club-admin)/manage/overview/week";

// Phase 9-2 — pure week-derivation helpers. SAST anchored via fixed
// +02:00 offset (no DST in Africa/Johannesburg). Each case pins an
// invariant the calendar grid relies on; together they're the
// safety net for any future day-boundary refactor.

describe("CALENDAR constants", () => {
  it("CALENDAR_DAYS is Monday-first ISO week order (Postgres dow ints)", () => {
    expect(CALENDAR_DAYS).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("CALENDAR_DAY_LABELS aligns to CALENDAR_DAYS positionally", () => {
    expect(CALENDAR_DAY_LABELS).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
  });

  it("CALENDAR_HOURS spans 06..21 inclusive (16 hours)", () => {
    expect(CALENDAR_HOURS).toHaveLength(16);
    expect(CALENDAR_HOURS[0]).toBe(6);
    expect(CALENDAR_HOURS[CALENDAR_HOURS.length - 1]).toBe(21);
  });
});

describe("mondayOf", () => {
  it("Monday → itself", () => {
    expect(mondayOf("2026-04-27")).toBe("2026-04-27");
  });

  it("Tuesday → previous Monday", () => {
    expect(mondayOf("2026-04-28")).toBe("2026-04-27");
  });

  it("Sunday → previous Monday (six days back, NOT next-Monday)", () => {
    expect(mondayOf("2026-05-03")).toBe("2026-04-27");
  });

  it("month boundary is handled correctly", () => {
    // 2026-05-01 is a Friday — Monday-of is 2026-04-27.
    expect(mondayOf("2026-05-01")).toBe("2026-04-27");
  });

  it("year boundary is handled correctly", () => {
    // 2027-01-02 is a Saturday → Monday-of is 2026-12-28.
    expect(mondayOf("2027-01-02")).toBe("2026-12-28");
  });
});

describe("shiftIso", () => {
  it("0 days → same date", () => {
    expect(shiftIso("2026-04-29", 0)).toBe("2026-04-29");
  });

  it("+1 day → next day", () => {
    expect(shiftIso("2026-04-29", 1)).toBe("2026-04-30");
  });

  it("+7 days → same weekday next week", () => {
    expect(shiftIso("2026-04-27", 7)).toBe("2026-05-04");
  });

  it("-7 days → previous week", () => {
    expect(shiftIso("2026-04-27", -7)).toBe("2026-04-20");
  });

  it("crosses month + year boundary correctly", () => {
    expect(shiftIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIso("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("parseWeekParam", () => {
  // Lock 'now' to 2026-04-29 (Wed) for deterministic results.
  const NOW = new Date("2026-04-29T12:00:00+02:00");

  it("undefined → mondayOf(today)", () => {
    expect(parseWeekParam(undefined, NOW)).toBe("2026-04-27");
  });

  it("malformed string → fallback to mondayOf(today)", () => {
    expect(parseWeekParam("not-a-date", NOW)).toBe("2026-04-27");
  });

  it("calendar-impossible date (2026-02-30) → fallback", () => {
    expect(parseWeekParam("2026-02-30", NOW)).toBe("2026-04-27");
  });

  it("valid Monday → echoed back unchanged", () => {
    expect(parseWeekParam("2026-04-20", NOW)).toBe("2026-04-20");
  });

  it("valid mid-week date → snapped to its Monday", () => {
    // 2026-04-23 is a Thursday → Monday is 2026-04-20.
    expect(parseWeekParam("2026-04-23", NOW)).toBe("2026-04-20");
  });

  it("valid Sunday → snapped to its Monday (the prior six days back)", () => {
    expect(parseWeekParam("2026-04-26", NOW)).toBe("2026-04-20");
  });
});

describe("weekDateRange", () => {
  it("returns 7 ISO dates Mon..Sun", () => {
    expect(weekDateRange("2026-04-27")).toEqual([
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
  });
});

describe("dayBoundsUtc / weekBoundsUtc", () => {
  it("dayBoundsUtc anchors to SAST midnight → 22:00 UTC start", () => {
    const { startUtc, endUtc } = dayBoundsUtc("2026-04-29");
    // 2026-04-29 00:00 SAST = 2026-04-28 22:00 UTC
    expect(startUtc).toBe("2026-04-28T22:00:00.000Z");
    expect(endUtc).toBe("2026-04-29T22:00:00.000Z");
  });

  it("weekBoundsUtc spans 7 SAST days as a half-open UTC interval", () => {
    const { startUtc, endUtc } = weekBoundsUtc("2026-04-27");
    expect(startUtc).toBe("2026-04-26T22:00:00.000Z");
    // endUtc = (Monday + 7) 00:00 SAST = same prior-day 22:00 UTC.
    expect(endUtc).toBe("2026-05-03T22:00:00.000Z");
  });
});

describe("sastHourOf / sastIsoDateOf", () => {
  it("UTC 06:00 → SAST 08:00 (hour=8)", () => {
    expect(sastHourOf("2026-04-29T06:00:00.000Z")).toBe(8);
  });

  it("UTC 22:00 prior day → SAST 00:00 next day (date rolls forward)", () => {
    expect(sastIsoDateOf("2026-04-28T22:00:00.000Z")).toBe("2026-04-29");
    expect(sastHourOf("2026-04-28T22:00:00.000Z")).toBe(0);
  });

  it("midday UTC stays on same SAST date", () => {
    expect(sastIsoDateOf("2026-04-29T12:00:00.000Z")).toBe("2026-04-29");
    expect(sastHourOf("2026-04-29T12:00:00.000Z")).toBe(14);
  });
});

describe("shortDayLabel", () => {
  it('"Mon 27 Apr" format', () => {
    expect(shortDayLabel("2026-04-27")).toBe("Mon 27 Apr");
  });

  it("zero-pads the day", () => {
    expect(shortDayLabel("2026-05-03")).toBe("Sun 03 May");
  });
});

describe("todayIsoSAST", () => {
  it("returns YYYY-MM-DD format for the SAST date of the input clock", () => {
    // 2026-04-29 23:00 UTC is 2026-04-30 01:00 SAST.
    const out = todayIsoSAST(new Date("2026-04-29T23:00:00.000Z"));
    expect(out).toBe("2026-04-30");
  });
});
