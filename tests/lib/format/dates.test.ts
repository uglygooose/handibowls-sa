import { describe, expect, it } from "vitest";

import {
  formatDateLongZA,
  formatDateRangeZA,
  formatDateTimeZA,
  formatDateZA,
  formatTimeZA,
} from "@/lib/format/dates";

// All formatters use Intl.DateTimeFormat with timeZone: "Africa/Johannesburg",
// so a UTC instant near midnight crosses into the next SAST day. These tests
// pin the expected output to the SAST-shifted value so a future drift back
// to browser-local-zone breaks the suite immediately.
//
// Note: en-ZA's CLDR formatter zero-pads day-of-month even with `numeric` —
// "09 May 2026", not "9 May 2026". We assert the actual output, not the
// US-style ideal.

describe("formatDateZA", () => {
  it("renders day, short month, year for an ISO string (en-ZA pads day)", () => {
    expect(formatDateZA("2026-05-09T10:00:00.000Z")).toBe("09 May 2026");
  });

  it("shifts UTC into SAST (UTC+2) — 22:30Z → 00:30 next day in JHB", () => {
    expect(formatDateZA("2026-05-09T22:30:00.000Z")).toBe("10 May 2026");
  });

  it("accepts a Date instance", () => {
    expect(formatDateZA(new Date("2026-04-30T08:00:00.000Z"))).toBe(
      "30 Apr 2026",
    );
  });

  it.each([null, undefined, ""])("returns em-dash for %p", (v) => {
    expect(formatDateZA(v as null | undefined | string)).toBe("—");
  });

  it("returns em-dash for an unparseable string", () => {
    expect(formatDateZA("not-a-date")).toBe("—");
  });
});

describe("formatDateLongZA", () => {
  it("includes weekday and pads day", () => {
    expect(formatDateLongZA("2026-05-09T10:00:00.000Z")).toMatch(
      /^Sat,? 09 May 2026$/,
    );
  });

  it("returns em-dash for null", () => {
    expect(formatDateLongZA(null)).toBe("—");
  });
});

describe("formatTimeZA", () => {
  it("renders 24-hour clock in SAST", () => {
    // 10:00 UTC → 12:00 in SAST.
    expect(formatTimeZA("2026-05-09T10:00:00.000Z")).toBe("12:00");
  });

  it("uses leading-zero hours", () => {
    // 06:00Z → 08:00 SAST. 2-digit hour should not collapse to "8:00".
    expect(formatTimeZA("2026-05-09T06:00:00.000Z")).toBe("08:00");
  });

  it("returns em-dash for null", () => {
    expect(formatTimeZA(null)).toBe("—");
  });
});

describe("formatDateTimeZA", () => {
  it("renders date + 24-hour time, SAST-shifted", () => {
    // 22:30 UTC May 9 → 00:30 SAST May 10.
    expect(formatDateTimeZA("2026-05-09T22:30:00.000Z")).toBe(
      "10 May 2026, 00:30",
    );
  });

  it("returns em-dash for empty", () => {
    expect(formatDateTimeZA("")).toBe("—");
  });
});

describe("formatDateRangeZA", () => {
  it("collapses same-month range to '09–10 May 2026'", () => {
    expect(
      formatDateRangeZA(
        "2026-05-09T10:00:00.000Z",
        "2026-05-10T10:00:00.000Z",
      ),
    ).toBe("09–10 May 2026");
  });

  it("collapses same-year cross-month range to '30 Apr – 02 May 2026'", () => {
    expect(
      formatDateRangeZA(
        "2026-04-30T10:00:00.000Z",
        "2026-05-02T10:00:00.000Z",
      ),
    ).toBe("30 Apr – 02 May 2026");
  });

  it("expands cross-year range to '30 Dec 2026 – 02 Jan 2027'", () => {
    expect(
      formatDateRangeZA(
        "2026-12-30T10:00:00.000Z",
        "2027-01-02T10:00:00.000Z",
      ),
    ).toBe("30 Dec 2026 – 02 Jan 2027");
  });

  it("returns just start when end is null", () => {
    expect(formatDateRangeZA("2026-05-09T10:00:00.000Z", null)).toBe(
      "09 May 2026",
    );
  });

  it("returns just start when start === end", () => {
    expect(
      formatDateRangeZA("2026-05-09T10:00:00.000Z", "2026-05-09T10:00:00.000Z"),
    ).toBe("09 May 2026");
  });

  it("falls back to formatted end when start is null", () => {
    expect(formatDateRangeZA(null, "2026-05-09T10:00:00.000Z")).toBe(
      "09 May 2026",
    );
  });

  it("returns em-dash when both null", () => {
    expect(formatDateRangeZA(null, null)).toBe("—");
  });
});
