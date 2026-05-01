import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { PlayerHero } from "@/components/layout/PlayerHero";

// Phase 12.5 / 12.5-6.5 — pin the PlayerHero design contract.
// Bundle source rules: `.profile-hero` (player-styles.css:711),
// `.t20-hero` (player-styles-additions.css:199), `.detail-hero`
// (player-styles.css:418). All three prescribe identical chrome —
// `border-radius: 20px`, `padding: 18px`, `background:
// var(--primary-500)`, `position: relative; overflow: hidden`,
// `color: var(--on-primary)`.

afterEach(cleanup);

describe("<PlayerHero /> — bundle CSS contract", () => {
  it("renders rounded-[20px] + bg-primary-500 + p-[18px] + isolate + overflow-hidden + on-primary ink", () => {
    const { container } = render(<PlayerHero title="Test" />);
    const hero = container.querySelector("[data-slot='player-hero']");
    expect(hero).not.toBeNull();
    const cls = hero?.className ?? "";
    // border-radius: 20px (NOT 18 — that's the admin AdminPageHero
    // tier; player heroes are 20 per bundle's all three rules)
    expect(cls).toContain("rounded-[20px]");
    // Themed primary background — drives off the active club's
    // theme preset via --primary-500.
    expect(cls).toContain("bg-primary-500");
    // padding: 18px on all four sides per bundle.
    expect(cls).toContain("p-[18px]");
    // Stacking + clipping for SplatterAccent.
    expect(cls).toContain("isolate");
    expect(cls).toContain("overflow-hidden");
    // On-primary ink so eyebrow/title read on the themed bg.
    expect(cls).toContain("text-[color:var(--color-on-primary)]");
  });

  it("renders <section> for landmark semantics (NOT a div)", () => {
    const { container } = render(<PlayerHero title="Test" />);
    const hero = container.querySelector("[data-slot='player-hero']");
    expect(hero?.tagName).toBe("SECTION");
  });
});

describe("<PlayerHero /> — title-size tier (grade / identity / detail)", () => {
  it("default 'identity' tier sets fontSize 28px (per `.profile-hero .name` / `.detail-hero h1`)", () => {
    const { container } = render(<PlayerHero title="Andrew Els" />);
    const h1 = container.querySelector<HTMLHeadingElement>(
      "[data-slot='player-hero-title']",
    );
    expect(h1?.tagName).toBe("H1");
    expect(h1?.style.fontSize).toBe("28px");
  });

  it("'grade' tier sets fontSize 56px (per `.t20-grade`)", () => {
    const { container } = render(
      <PlayerHero title="SILVER" titleSize="grade" />,
    );
    const h1 = container.querySelector<HTMLHeadingElement>(
      "[data-slot='player-hero-title']",
    );
    expect(h1?.style.fontSize).toBe("56px");
  });

  it("'detail' tier sets fontSize 28px (matches identity — both are 28 per bundle)", () => {
    const { container } = render(
      <PlayerHero title="Demo Cup" titleSize="detail" />,
    );
    const h1 = container.querySelector<HTMLHeadingElement>(
      "[data-slot='player-hero-title']",
    );
    expect(h1?.style.fontSize).toBe("28px");
  });

  it("h1 has font-display + font-black + italic + uppercase + leading-[0.95] (per .profile-hero .name + .detail-hero h1)", () => {
    const { container } = render(<PlayerHero title="Test" />);
    const h1 = container.querySelector<HTMLHeadingElement>(
      "[data-slot='player-hero-title']",
    );
    const cls = h1?.className ?? "";
    expect(cls).toContain("font-display");
    expect(cls).toContain("font-black");
    expect(cls).toContain("italic");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("leading-[0.95]");
  });
});

describe("<PlayerHero /> — slot variants", () => {
  it("renders eyebrow when provided, white-tinted (rgba(255,255,255,0.85))", () => {
    const { container } = render(
      <PlayerHero title="SILVER" eyebrow="YOUR T20 GRADE" />,
    );
    const eyebrow = container.querySelector("[data-slot='player-hero-eyebrow']");
    expect(eyebrow).not.toBeNull();
    expect(eyebrow?.textContent).toBe("YOUR T20 GRADE");
    const cls = eyebrow?.className ?? "";
    // Mono-style eyebrow per bundle: 11px font-mono uppercase.
    expect(cls).toContain("font-mono");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("text-[11px]");
  });

  it("does NOT render eyebrow slot when no eyebrow prop", () => {
    const { container } = render(<PlayerHero title="Test" />);
    expect(
      container.querySelector("[data-slot='player-hero-eyebrow']"),
    ).toBeNull();
  });

  it("renders meta slot below title when provided", () => {
    const { container } = render(
      <PlayerHero
        title="Demo Cup"
        meta={
          <div className="flex gap-1.5">
            <span data-testid="meta-pill">Singles</span>
          </div>
        }
      />,
    );
    const meta = container.querySelector("[data-slot='player-hero-meta']");
    expect(meta).not.toBeNull();
    expect(meta?.querySelector("[data-testid='meta-pill']")).not.toBeNull();
  });

  it("renders actions slot below meta when provided", () => {
    const { container } = render(
      <PlayerHero
        title="SILVER"
        actions={<button data-testid="cta">Book gold</button>}
      />,
    );
    const actions = container.querySelector("[data-slot='player-hero-actions']");
    expect(actions?.querySelector("[data-testid='cta']")).not.toBeNull();
  });

  it("renders children slot for arbitrary content (e.g. /me avatar block)", () => {
    const { container } = render(
      <PlayerHero title="Andrew Els">
        <div data-testid="avatar-block">avatar + stats</div>
      </PlayerHero>,
    );
    expect(container.querySelector("[data-testid='avatar-block']")).not.toBeNull();
  });
});

describe("<PlayerHero /> — speckle + splatter", () => {
  it("renders SpeckleField by default at intensity='bold' + borderRadius 20 (per /t20 + /tournaments/[id] bundle JSX)", () => {
    const { container } = render(<PlayerHero title="Test" />);
    const speckleWrap = container.querySelector(
      "[data-slot='player-hero'] > .pointer-events-none.absolute.inset-0.z-0",
    );
    expect(speckleWrap).not.toBeNull();
    expect(speckleWrap?.querySelector("svg")).not.toBeNull();
  });

  it("disables speckle when speckle={false}", () => {
    const { container } = render(<PlayerHero title="Test" speckle={false} />);
    const speckleWrap = container.querySelector(
      "[data-slot='player-hero'] > .pointer-events-none.absolute.inset-0.z-0",
    );
    expect(speckleWrap).toBeNull();
  });

  it("renders splatter at the consumer's specified inset position (no default; opt-in per surface)", () => {
    const { container } = render(
      <PlayerHero
        title="Test"
        splatter={{
          preset: "atomic-red",
          variant: 1,
          size: "S",
          rotate: 0,
          opacity: 0.45,
          right: -22,
          bottom: -22,
        }}
      />,
    );
    const splatterWrap = container.querySelector(
      "[data-slot='player-hero'] > .pointer-events-none.absolute.z-\\[1\\]",
    );
    expect(splatterWrap).not.toBeNull();
  });

  it("does NOT render splatter when no splatter prop given (no default — opt-in per surface, varies between /me's bottom-right vs /t20's bottom-right at different insets)", () => {
    const { container } = render(<PlayerHero title="Test" />);
    const splatterWraps = container.querySelectorAll(
      "[data-slot='player-hero'] > .pointer-events-none.absolute.z-\\[1\\]",
    );
    expect(splatterWraps).toHaveLength(0);
  });
});
