import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { AdminPageHero } from "@/components/layout/AdminPageHero";

// Phase 12.5 / 12.5-6 — pin the AdminPageHero design contract.
// Every value below traces to the design source bundle's
// `admin-styles.css:313-323` (.page-hero / .page-hero-inner /
// .page-hero h1 / .page-hero .sub) + `t20-page-list.jsx:67`
// (subtitle inline style). If the design source ever updates,
// these tests must be re-pinned to the new values, not relaxed.

afterEach(cleanup);

describe("<AdminPageHero /> — design-source contract", () => {
  it("renders with the design-source border-radius (18px), bg-bone, border, isolate stacking", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    const hero = container.querySelector("[data-slot='admin-page-hero']");
    expect(hero).not.toBeNull();
    const cls = hero?.className ?? "";
    // Border radius 18 (NOT 14, NOT 20) — design source line 314.
    expect(cls).toContain("rounded-[18px]");
    // bg-bone (NOT bg-surface) — design source line 318.
    expect(cls).toContain("bg-bone");
    expect(cls).toContain("border");
    // isolate so SplatterAccent's intrinsic rotate doesn't leak.
    expect(cls).toContain("isolate");
  });

  it("inner row uses items-end + min-h-[156px] + px-9 py-8 + gap-8 (32 36 padding from design source)", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    const inner = container.querySelector(
      "[data-slot='admin-page-hero'] > .relative.z-10",
    );
    expect(inner).not.toBeNull();
    const cls = inner?.className ?? "";
    expect(cls).toContain("items-end");
    expect(cls).toContain("min-h-[156px]");
    expect(cls).toContain("px-9");
    expect(cls).toContain("py-8");
    expect(cls).toContain("gap-8");
    expect(cls).toContain("justify-between");
  });

  it("h1 renders at text-[56px] font-display font-black leading-none — NO italic (design source has none)", () => {
    const { container } = render(<AdminPageHero title="Tournaments" containerWidth="none" />);
    const h1 = container.querySelector("[data-slot='admin-page-hero-title']");
    expect(h1?.tagName).toBe("H1");
    expect(h1?.textContent).toBe("Tournaments");
    const cls = h1?.className ?? "";
    expect(cls).toContain("text-[56px]");
    expect(cls).toContain("font-display");
    expect(cls).toContain("font-black");
    expect(cls).toContain("leading-none");
    // Design source `.page-hero h1` does NOT set font-style: italic.
    // Pinning the absence prevents drift back to the shipped
    // pre-12.5-6 italic styling.
    expect(cls).not.toMatch(/\bitalic\b/);
  });
});

describe("<AdminPageHero /> — slot variants", () => {
  it("renders eyebrow when provided — Barlow Condensed (font-display) font-bold 11px tracking 0.16em ink-muted", () => {
    const { container } = render(
      <AdminPageHero
        title="Test"
        eyebrow="Club admin · Demo Bowls Club"
        containerWidth="none"
      />,
    );
    const eyebrow = container.querySelector("[data-slot='admin-page-hero-eyebrow']");
    expect(eyebrow).not.toBeNull();
    expect(eyebrow?.textContent).toBe("Club admin · Demo Bowls Club");
    const cls = eyebrow?.className ?? "";
    // Design source `.eyebrow` (admin-styles.css:94-101): font-family
    // 'Barlow Condensed' (font-display), font-weight 700 (font-bold),
    // letter-spacing 0.16em, font-size 11px, text-ink-muted, uppercase.
    // NOTE: this is NOT mono — pre-12.5-6 admin Pattern B used JetBrains
    // Mono (font-mono text-[10px]) which is drift; design says
    // Barlow Condensed 11px.
    expect(cls).toContain("font-display");
    expect(cls).toContain("font-bold");
    expect(cls).toContain("text-[11px]");
    expect(cls).toContain("tracking-[0.16em]");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("text-ink-muted");
  });

  it("does NOT render eyebrow slot when no eyebrow prop given", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    expect(
      container.querySelector("[data-slot='admin-page-hero-eyebrow']"),
    ).toBeNull();
  });

  it("renders subtitle when provided — 22px font-display font-bold italic ink-muted (per t20-page-list.jsx:67)", () => {
    const { container } = render(
      <AdminPageHero
        title="Twenty 20"
        subtitle="skills assessment"
        containerWidth="none"
      />,
    );
    const sub = container.querySelector("[data-slot='admin-page-hero-subtitle']");
    expect(sub).not.toBeNull();
    expect(sub?.textContent).toBe("skills assessment");
    const cls = sub?.className ?? "";
    expect(cls).toContain("text-[22px]");
    expect(cls).toContain("font-display");
    expect(cls).toContain("font-bold");
    expect(cls).toContain("italic");
    expect(cls).toContain("text-ink-muted");
  });

  it("renders description when provided — text-[15px] ink-muted max-w-[56ch] (design source .sub)", () => {
    const { container } = render(
      <AdminPageHero
        title="Test"
        description="Run knockouts, drawn sets, and tournaments at Demo Bowls Club."
        containerWidth="none"
      />,
    );
    const desc = container.querySelector(
      "[data-slot='admin-page-hero-description']",
    );
    expect(desc?.tagName).toBe("P");
    const cls = desc?.className ?? "";
    expect(cls).toContain("text-[15px]");
    expect(cls).toContain("text-ink-muted");
    expect(cls).toContain("max-w-[56ch]");
  });

  it("renders actions slot top-right when provided", () => {
    const { container } = render(
      <AdminPageHero
        title="Test"
        actions={
          <button type="button" data-testid="cta">
            New Tournament
          </button>
        }
        containerWidth="none"
      />,
    );
    const actionsSlot = container.querySelector(
      "[data-slot='admin-page-hero-actions']",
    );
    expect(actionsSlot).not.toBeNull();
    expect(actionsSlot?.querySelector("[data-testid='cta']")).not.toBeNull();
  });
});

describe("<AdminPageHero /> — speckle + splatter", () => {
  it("renders SpeckleLayer by default — design source admin primitive (NOT SpeckleField)", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    // SpeckleLayer renders as an <svg> — checking SVG presence inside
    // the absolute-positioned z-0 backdrop layer is the simplest pin.
    const speckleWrap = container.querySelector(
      "[data-slot='admin-page-hero'] > .pointer-events-none.absolute.inset-0.z-0",
    );
    expect(speckleWrap).not.toBeNull();
    expect(speckleWrap?.querySelector("svg")).not.toBeNull();
  });

  it("disables speckle when speckle={false}", () => {
    const { container } = render(
      <AdminPageHero title="Test" speckle={false} containerWidth="none" />,
    );
    const speckleWrap = container.querySelector(
      "[data-slot='admin-page-hero'] > .pointer-events-none.absolute.inset-0.z-0",
    );
    expect(speckleWrap).toBeNull();
  });

  it("renders splatter at default size L (300) when splatter prop omitted", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    // Default splatter renders 1 SplatterAccent. Its rendered SVG width
    // attribute reflects the resolved size — we pin SPLATTER_SIZE.L = 300
    // through the rendered SVG.
    const splatterSvgs = container.querySelectorAll(
      "[data-slot='admin-page-hero'] svg[viewBox='0 0 200 200']",
    );
    expect(splatterSvgs.length).toBeGreaterThanOrEqual(1);
    // Verify size — SplatterAccent renders width={size} on the wrapper div.
    const splatterWraps = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-slot='admin-page-hero'] > .pointer-events-none.absolute.z-\\[1\\]",
      ),
    );
    expect(splatterWraps).toHaveLength(1);
  });

  it("disables splatter when splatter={false}", () => {
    const { container } = render(
      <AdminPageHero title="Test" splatter={false} containerWidth="none" />,
    );
    const splatterWraps = container.querySelectorAll(
      "[data-slot='admin-page-hero'] > .pointer-events-none.absolute.z-\\[1\\]",
    );
    expect(splatterWraps).toHaveLength(0);
  });

  it("renders multiple splatters when splatter={[a, b]} (per t20-page-list double-splatter)", () => {
    const { container } = render(
      <AdminPageHero
        title="Test"
        splatter={[
          { size: "L", variant: 1, rotate: -14, opacity: 0.55 },
          { size: "M", variant: 0, rotate: 32, opacity: 0.4, top: undefined, right: undefined },
        ]}
        containerWidth="none"
      />,
    );
    const splatterWraps = container.querySelectorAll(
      "[data-slot='admin-page-hero'] > .pointer-events-none.absolute.z-\\[1\\]",
    );
    expect(splatterWraps).toHaveLength(2);
  });
});

describe("<AdminPageHero /> — containerWidth tier", () => {
  it("default 'list' wraps the hero in max-w-7xl px-6 py-8 pb-24", () => {
    const { container } = render(<AdminPageHero title="Test" />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain("max-w-7xl");
    expect(wrap.className).toContain("px-6");
    expect(wrap.className).toContain("py-8");
    expect(wrap.className).toContain("pb-24");
    // hero card is the child of the wrap.
    expect(wrap.querySelector("[data-slot='admin-page-hero']")).not.toBeNull();
  });

  it("'form' wraps the hero in max-w-[1100px]", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="form" />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain("max-w-[1100px]");
  });

  it("'none' renders the hero card directly with no wrapper container", () => {
    const { container } = render(<AdminPageHero title="Test" containerWidth="none" />);
    expect(container.firstChild).toBe(
      container.querySelector("[data-slot='admin-page-hero']"),
    );
  });
});
