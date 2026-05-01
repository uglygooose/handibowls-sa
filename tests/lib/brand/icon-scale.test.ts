import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  ICON_SIZE,
  ICON_STROKE,
  LEGAL_ICON_SIZE_TOKENS,
} from "@/lib/brand/icon-scale";

// Phase 12.5 / 12.5-6 (L / `icon-stroke-scale`) — the icon scale
// guard test. Documents + enforces the locked size + stroke tier
// from `lib/brand/icon-scale.ts`. Marketing surfaces are exempt
// (bespoke `IconArrow` / `IconTournament` / `IconScore` /
// `IconCompass` in landing — separate brand-differentiator tier).

describe("icon scale — locked tier from lib/brand/icon-scale.ts", () => {
  it("ICON_SIZE includes the 5 documented tiers (pill/inline/heading/nav/hero)", () => {
    expect(ICON_SIZE.pill).toBe(12);
    expect(ICON_SIZE.inline).toBe(14);
    expect(ICON_SIZE.heading).toBe(16);
    expect(ICON_SIZE.nav).toBe(20);
    expect(ICON_SIZE.hero).toBe(24);
  });

  it("ICON_STROKE includes default 2 + active 2.5 (aria-current)", () => {
    expect(ICON_STROKE.default).toBe(2);
    expect(ICON_STROKE.active).toBe(2.5);
  });

  it("LEGAL_ICON_SIZE_TOKENS covers the Tailwind size-N values for the 5 tiers", () => {
    expect(LEGAL_ICON_SIZE_TOKENS).toContain("size-3");
    expect(LEGAL_ICON_SIZE_TOKENS).toContain("size-3.5");
    expect(LEGAL_ICON_SIZE_TOKENS).toContain("size-4");
    expect(LEGAL_ICON_SIZE_TOKENS).toContain("size-5");
    expect(LEGAL_ICON_SIZE_TOKENS).toContain("size-6");
  });
});

describe("icon scale — grep guard against arbitrary sizes on lucide-imported components", () => {
  // Arbitrary `size-[Npx]` literals on lucide-imported icons drift
  // outside the documented tier (e.g. AdminSidebar shipped with
  // `size-[18px]` on nav icons before 12.5-6). Pragmatic detection:
  // grep for `size-\[` patterns inside files that import from
  // `lucide-react`, scoped to admin / super-admin / player /
  // components/nav surfaces. Marketing is exempted as a separate
  // tier (custom IconArrow / IconTournament / IconScore /
  // IconCompass keep their bespoke strokes).

  function grepArbitrarySizes(): string[] {
    try {
      // Narrow regex: only match `<PascalCase ... className="...size-[...]"`
      // — i.e. an arbitrary `size-[Npx]` literal on a Capital-letter JSX
      // tag (which lucide icons always are; div/span/input are
      // lowercase). Scope: admin + super-admin + player + components.
      // Marketing is exempted (custom IconArrow / IconTournament /
      // IconScore / IconCompass keep their bespoke strokes).
      // The literal opening-tag-on-same-line pattern misses
      // multi-line attributes — those have to be picked up at
      // code review time. Pragmatic > clever per the user's spec.
      const output = execSync(
        `find app components -type f \\( -name "*.tsx" -o -name "*.ts" \\) ! -path "*/(marketing)/*" ! -path "*/_sections/*" ! -path "*/(dev)/*" -exec grep -l "from \\"lucide-react\\"" {} + | xargs grep -nE '<[A-Z][A-Za-z]+ [^>]*className="[^"]*size-\\[[0-9]' || true`,
        { encoding: "utf-8", shell: "/bin/bash" },
      );
      return output
        .split("\n")
        .filter((line) => line.trim().length > 0);
    } catch {
      return [];
    }
  }

  it("no arbitrary `size-[Npx]` lucide-icon literals outside the marketing exemption (12.5-6 baseline)", () => {
    const offenders = grepArbitrarySizes();
    if (offenders.length > 0) {
      // Surface the offenders directly so the failure is actionable.
      const detail = offenders.slice(0, 10).join("\n");
      throw new Error(
        `${offenders.length} arbitrary size-[Npx] icon usage(s) outside the locked tier. First 10:\n${detail}\n\n` +
          `Fix: snap to one of the LEGAL_ICON_SIZE_TOKENS (size-3/3.5/4/5/6) or document the exception in lib/brand/icon-scale.ts.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
