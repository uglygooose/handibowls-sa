import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Phase 8e-1 — pure helpers in `app/(player)/(gated)/book/_data.ts`.
// Date math, slot shell construction, closure detection, purpose
// labels. No Supabase, no auth — just deterministic math against
// fixed clock values.

const {
  todayIsoSAST,
  parseDateParam,
  buildDateStrip,
  buildSlotShells,
  dateIsClosed,
  purposeLabel,
} = await import("@/app/(player)/(gated)/book/_data");

describe("todayIsoSAST", () => {
  it("returns SAST date even when UTC clock is past midnight on next day", () => {
    // 2026-04-30T00:30:00Z is 2026-04-30T02:30 SAST — same date both
    // sides; trivial sanity.
    expect(todayIsoSAST(new Date("2026-04-30T00:30:00Z"))).toBe(
      "2026-04-30",
    );
    // 2026-04-29T22:30:00Z is 2026-04-30T00:30 SAST — UTC says 29th,
    // SAST says 30th. The whole point of the helper.
    expect(todayIsoSAST(new Date("2026-04-29T22:30:00Z"))).toBe(
      "2026-04-30",
    );
  });

  it("returns SAST yesterday when UTC clock is just past midnight UTC but still late evening SAST", () => {
    // 2026-04-30T00:30:00Z is 2026-04-30T02:30 SAST — but consider
    // 2026-04-29T21:00:00Z = 2026-04-29T23:00 SAST — same date both
    // sides.
    expect(todayIsoSAST(new Date("2026-04-29T21:00:00Z"))).toBe(
      "2026-04-29",
    );
  });
});

describe("parseDateParam", () => {
  const now = new Date("2026-04-29T10:00:00Z");
  const today = todayIsoSAST(now);

  it("returns the param when it's a well-formed ISO date", () => {
    expect(parseDateParam("2026-05-01", now)).toBe("2026-05-01");
  });

  it("falls back to today when undefined / empty / malformed", () => {
    expect(parseDateParam(undefined, now)).toBe(today);
    expect(parseDateParam("", now)).toBe(today);
    expect(parseDateParam("not-a-date", now)).toBe(today);
    expect(parseDateParam("2026-13-99", now)).toBe(today);
    expect(parseDateParam("2026/04/29", now)).toBe(today);
  });

  it("falls back to today on dates the calendar can't represent", () => {
    expect(parseDateParam("2026-02-30", now)).toBe(today);
  });
});

describe("buildDateStrip", () => {
  it("builds a 14-day strip starting at today, marking today + selection", () => {
    const strip = buildDateStrip("2026-04-29", "2026-05-02");
    expect(strip).toHaveLength(14);
    expect(strip[0].iso).toBe("2026-04-29");
    expect(strip[0].is_today).toBe(true);
    expect(strip[0].is_selected).toBe(false);
    expect(strip[3].iso).toBe("2026-05-02");
    expect(strip[3].is_selected).toBe(true);
    expect(strip[3].is_today).toBe(false);
    expect(strip[13].iso).toBe("2026-05-12");
  });

  it("emits day-of-week labels matching the SAST calendar", () => {
    // 2026-04-29 = Wednesday in SAST.
    const strip = buildDateStrip("2026-04-29", "2026-04-29");
    expect(strip[0].dow).toBe("WED");
    expect(strip[1].dow).toBe("THU");
    expect(strip[2].dow).toBe("FRI");
    expect(strip[3].dow).toBe("SAT");
    expect(strip[4].dow).toBe("SUN");
  });

  it("crosses month boundaries cleanly", () => {
    const strip = buildDateStrip("2026-04-29", "2026-04-29");
    expect(strip[2].iso).toBe("2026-05-01");
    expect(strip[2].day).toBe("1");
    expect(strip[3].day).toBe("2");
  });

  it("starts every entry as `closed: false` (caller layers on closures)", () => {
    const strip = buildDateStrip("2026-04-29", "2026-04-29");
    for (const d of strip) expect(d.closed).toBe(false);
  });
});

describe("buildSlotShells", () => {
  it("emits five 2-hour slots from 08:00 to 18:00 SAST", () => {
    const shells = buildSlotShells("2026-04-29");
    expect(shells).toHaveLength(5);
    expect(shells.map((s) => `${s.starts_label}-${s.ends_label}`)).toEqual([
      "08:00-10:00",
      "10:00-12:00",
      "12:00-14:00",
      "14:00-16:00",
      "16:00-18:00",
    ]);
  });

  it("anchors timestamps to SAST (UTC+2) — first slot starts at UTC 06:00", () => {
    const shells = buildSlotShells("2026-04-29");
    expect(shells[0].starts_at).toBe("2026-04-29T06:00:00.000Z");
    expect(shells[0].ends_at).toBe("2026-04-29T08:00:00.000Z");
    expect(shells[4].starts_at).toBe("2026-04-29T14:00:00.000Z");
    expect(shells[4].ends_at).toBe("2026-04-29T16:00:00.000Z");
  });
});

describe("dateIsClosed", () => {
  it("flags weekday-recurring closures (e.g. Sundays)", () => {
    const closures = [
      { weekday: 0, starts_date: null, ends_date: null }, // Sun
    ];
    // 2026-05-03 is a Sunday in SAST.
    expect(dateIsClosed("2026-05-03", closures)).toBe(true);
    // 2026-05-04 is Monday.
    expect(dateIsClosed("2026-05-04", closures)).toBe(false);
  });

  it("flags one-off date-range closures", () => {
    const closures = [
      {
        weekday: null,
        starts_date: "2026-05-01",
        ends_date: "2026-05-03",
      },
    ];
    expect(dateIsClosed("2026-04-30", closures)).toBe(false);
    expect(dateIsClosed("2026-05-01", closures)).toBe(true);
    expect(dateIsClosed("2026-05-02", closures)).toBe(true);
    expect(dateIsClosed("2026-05-03", closures)).toBe(true);
    expect(dateIsClosed("2026-05-04", closures)).toBe(false);
  });

  it("ignores admin-malformed rows (neither weekday nor date range)", () => {
    const closures = [
      { weekday: null, starts_date: null, ends_date: null },
    ];
    expect(dateIsClosed("2026-05-04", closures)).toBe(false);
  });

  it("returns true when ANY closure window matches (OR semantics)", () => {
    const closures = [
      { weekday: 0, starts_date: null, ends_date: null }, // Sundays
      {
        weekday: null,
        starts_date: "2026-05-04",
        ends_date: "2026-05-04",
      }, // 2026-05-04 maintenance
    ];
    expect(dateIsClosed("2026-05-03", closures)).toBe(true); // Sun
    expect(dateIsClosed("2026-05-04", closures)).toBe(true); // Mon range
    expect(dateIsClosed("2026-05-05", closures)).toBe(false);
  });
});

describe("purposeLabel", () => {
  it("maps every booking_purpose enum value to a human label", () => {
    expect(purposeLabel("roll_up")).toBe("Roll-up");
    expect(purposeLabel("practice")).toBe("Practice");
    expect(purposeLabel("coaching")).toBe("Coaching");
    expect(purposeLabel("match")).toBe("Match");
    expect(purposeLabel("social")).toBe("Social");
  });
});
