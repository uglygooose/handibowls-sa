import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { GradePill } from "@/components/t20/GradePill";

// Phase 10 — GradePill render contract.

describe("<GradePill /> — labels", () => {
  it("gold renders 'Gold' label", () => {
    const { container } = render(<GradePill grade="gold" />);
    expect(container.textContent).toContain("Gold");
  });

  it("silver renders 'Silver' label", () => {
    const { container } = render(<GradePill grade="silver" />);
    expect(container.textContent).toContain("Silver");
  });

  it("bronze renders 'Bronze' label", () => {
    const { container } = render(<GradePill grade="bronze" />);
    expect(container.textContent).toContain("Bronze");
  });

  it("fail renders 'Reassess' label (NOT 'Fail') — coaching tone", () => {
    const { container } = render(<GradePill grade="fail" />);
    expect(container.textContent).toContain("Reassess");
    expect(container.textContent).not.toContain("Fail");
  });
});

describe("<GradePill /> — size variants", () => {
  it("default size is md", () => {
    const { container } = render(<GradePill grade="silver" />);
    const el = container.querySelector("[data-slot='grade-pill']");
    expect(el?.getAttribute("data-size")).toBe("md");
  });

  it("sm renders compact 22h pill (data-size='sm')", () => {
    const { container } = render(<GradePill grade="silver" size="sm" />);
    expect(
      container.querySelector("[data-slot='grade-pill']")?.getAttribute("data-size"),
    ).toBe("sm");
  });

  it("lg renders the hero variant (data-size='lg', different element shape)", () => {
    const { container } = render(<GradePill grade="gold" size="lg" />);
    const el = container.querySelector("[data-slot='grade-pill']");
    expect(el?.getAttribute("data-size")).toBe("lg");
    // Hero variant is a div (positioned, with shadow); compact is a span.
    expect(el?.tagName.toLowerCase()).toBe("div");
  });

  it("md compact variant is a span (inline element)", () => {
    const { container } = render(<GradePill grade="silver" size="md" />);
    const el = container.querySelector("[data-slot='grade-pill']");
    expect(el?.tagName.toLowerCase()).toBe("span");
  });
});

describe("<GradePill /> — gold star sigil", () => {
  it("gold size=lg renders the ★ sigil", () => {
    const { container } = render(<GradePill grade="gold" size="lg" />);
    expect(container.textContent).toContain("★");
  });

  it("gold sizes sm/md do NOT render the sigil — keep table cells tight", () => {
    const sm = render(<GradePill grade="gold" size="sm" />);
    expect(sm.container.textContent).not.toContain("★");
    const md = render(<GradePill grade="gold" size="md" />);
    expect(md.container.textContent).not.toContain("★");
  });

  it("non-gold size=lg does NOT render the sigil", () => {
    const silver = render(<GradePill grade="silver" size="lg" />);
    expect(silver.container.textContent).not.toContain("★");
    const fail = render(<GradePill grade="fail" size="lg" />);
    expect(fail.container.textContent).not.toContain("★");
  });
});

describe("<GradePill /> — data attributes for downstream selectors", () => {
  it("data-grade attribute matches the prop", () => {
    const { container } = render(<GradePill grade="bronze" size="md" />);
    expect(
      container.querySelector("[data-slot='grade-pill']")?.getAttribute("data-grade"),
    ).toBe("bronze");
  });

  it("custom className is forwarded", () => {
    const { container } = render(
      <GradePill grade="silver" className="my-custom-class" />,
    );
    expect(
      container.querySelector("[data-slot='grade-pill']")?.className,
    ).toContain("my-custom-class");
  });
});
