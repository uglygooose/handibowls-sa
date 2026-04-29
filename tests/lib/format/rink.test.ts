import { describe, expect, it } from "vitest";

import { formatRinkLabel, type RinkEmbed } from "@/lib/format/rink";

// Phase 8d follow-up — three sites consume the same rink-embed shape
// (`rink:rinks(number, green:greens(name))`) and need the same display
// label. The helper centralises the composition so the three `_data.ts`
// mappers stay in lock-step. These cases exercise the format derivation
// directly — once the helper is verified, each site's mapper just
// passes the embed through.

describe("formatRinkLabel", () => {
  it("rink_id populated, green has name → '<green> <number>'", () => {
    const rink: RinkEmbed = { number: 3, green: { name: "Main Green" } };
    expect(formatRinkLabel(rink)).toBe("Main Green 3");
  });

  it("rink_id populated, green name missing → 'Green <number>' fallback", () => {
    const rink: RinkEmbed = { number: 5, green: { name: null } };
    expect(formatRinkLabel(rink)).toBe("Green 5");
    // Same fallback when the green object itself is null (RLS-hidden).
    const rinkOrphaned: RinkEmbed = { number: 5, green: null };
    expect(formatRinkLabel(rinkOrphaned)).toBe("Green 5");
    // And when green is missing entirely from the embed.
    const rinkNoGreen: RinkEmbed = { number: 5 };
    expect(formatRinkLabel(rinkNoGreen)).toBe("Green 5");
  });

  it("rink_id null (no rink assigned) → null", () => {
    expect(formatRinkLabel(null)).toBeNull();
    // PostgREST returns the embed key as null when the FK is null.
    // The shape `{ number: null }` shouldn't happen but defend anyway.
    expect(formatRinkLabel({ number: null })).toBeNull();
    expect(formatRinkLabel({ number: undefined })).toBeNull();
  });

  it("handles green name with internal whitespace correctly", () => {
    expect(
      formatRinkLabel({ number: 1, green: { name: "South Practice Green" } }),
    ).toBe("South Practice Green 1");
  });

  it("preserves number 0 (unusual but legal — schema CHECK is 1..12)", () => {
    // The schema rejects number=0 via CHECK, but the helper shouldn't
    // collapse it to null — that'd hide the constraint violation
    // upstream. Render the literal value so the bug surfaces.
    expect(formatRinkLabel({ number: 0, green: { name: "Test" } })).toBe(
      "Test 0",
    );
  });
});
