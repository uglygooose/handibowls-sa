import { describe, it, expect } from "vitest";

// Phase 7 follow-up: regression coverage for parseTabFromUrl. The Server
// Component /manage/tournaments/[id]/page.tsx calls this during SSR, so
// the helper MUST live in a universal module — never a "use client" one,
// or Next 16 emits "Attempted to call parseTabFromUrl() from the server"
// at render time. This test pins the contract; the import path itself
// keeps the helper anchored in the right module.

import {
  ALL_TAB_IDS,
  parseTabFromUrl,
  type TabId,
} from "@/app/(club-admin)/manage/tournaments/[id]/_components/tabs";

describe("parseTabFromUrl", () => {
  it("returns 'entries' for null / undefined / empty input (default-tab contract)", () => {
    expect(parseTabFromUrl(null)).toBe("entries");
    expect(parseTabFromUrl(undefined)).toBe("entries");
    expect(parseTabFromUrl("")).toBe("entries");
  });

  it("accepts every canonical tab id", () => {
    for (const tab of ALL_TAB_IDS) {
      expect(parseTabFromUrl(tab)).toBe(tab);
    }
  });

  it("rejects unknown values and falls back to 'entries'", () => {
    expect(parseTabFromUrl("not-a-tab")).toBe("entries");
    expect(parseTabFromUrl("ENTRIES")).toBe("entries"); // case-sensitive
    expect(parseTabFromUrl("draw ")).toBe("draw"); // trim handles whitespace
    expect(parseTabFromUrl("  scoring  ")).toBe("scoring");
  });

  it("returns a TabId-typed value", () => {
    // Compile-time sanity — TS will fail this file if the type widens.
    const t: TabId = parseTabFromUrl("draw");
    expect(t).toBe("draw");
  });

  it("ALL_TAB_IDS exposes the canonical six in order", () => {
    expect(ALL_TAB_IDS).toEqual([
      "entries",
      "draw",
      "scoring",
      "rinks",
      "comms",
      "audit",
    ]);
  });
});
