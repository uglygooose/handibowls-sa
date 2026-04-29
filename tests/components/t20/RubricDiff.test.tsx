import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import {
  RubricDiff,
  type RubricChange,
} from "@/components/t20/RubricDiff";

// Phase 10 — rubric diff render contract for /platform/rubrics.

const SAMPLE_CHANGES: RubricChange[] = [
  {
    kind: "changed",
    path: "bands.gold",
    label: "Gold band raised 80% → 82%",
    from: 80,
    to: 82,
  },
  {
    kind: "added",
    path: "sections[8]",
    label: "New section: Approach (zones_8 model)",
    from: null,
    to: "Approach",
  },
  {
    kind: "removed",
    path: "on_length_points.partial",
    label: "Partial-length credit removed",
    from: 1,
    to: null,
  },
];

describe("<RubricDiff /> — header band", () => {
  it("renders default left/right labels", () => {
    const { container } = render(<RubricDiff changes={SAMPLE_CHANGES} />);
    expect(
      container.querySelector("[data-slot='diff-header-active']")?.textContent,
    ).toContain("v1-final-2026");
    expect(
      container.querySelector("[data-slot='diff-header-incoming']")?.textContent,
    ).toContain("v2-draft-2026");
  });

  it("supports custom leftLabel/rightLabel overrides", () => {
    const { container } = render(
      <RubricDiff
        changes={SAMPLE_CHANGES}
        leftLabel="vA · ACTIVE"
        rightLabel="vB · INCOMING"
      />,
    );
    expect(container.textContent).toContain("vA · ACTIVE");
    expect(container.textContent).toContain("vB · INCOMING");
  });
});

describe("<RubricDiff /> — change rows", () => {
  it("renders one row per change", () => {
    const { container } = render(<RubricDiff changes={SAMPLE_CHANGES} />);
    const rows = container.querySelectorAll("[data-slot='diff-row']");
    expect(rows).toHaveLength(3);
  });

  it("each row carries data-kind", () => {
    const { container } = render(<RubricDiff changes={SAMPLE_CHANGES} />);
    const rows = container.querySelectorAll("[data-slot='diff-row']");
    expect(rows[0].getAttribute("data-kind")).toBe("changed");
    expect(rows[1].getAttribute("data-kind")).toBe("added");
    expect(rows[2].getAttribute("data-kind")).toBe("removed");
  });

  it("changed row renders the sigil '~'", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[0]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-sigil']")?.textContent,
    ).toBe("~");
  });

  it("added row renders the sigil '+'", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[1]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-sigil']")?.textContent,
    ).toBe("+");
  });

  it("removed row renders the sigil '−' (en-dash)", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[2]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-sigil']")?.textContent,
    ).toBe("−");
  });

  it("renders the path + label per row", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[0]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-path']")?.textContent,
    ).toBe("bands.gold");
    expect(
      container.querySelector("[data-slot='diff-label']")?.textContent,
    ).toContain("Gold band raised 80% → 82%");
  });
});

describe("<RubricDiff /> — value display", () => {
  it("changed row renders both from + to with sigils", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[0]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-from']")?.textContent,
    ).toContain("80");
    expect(
      container.querySelector("[data-slot='diff-to']")?.textContent,
    ).toContain("82");
  });

  it("added row renders to ONLY (no from)", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[1]]} />,
    );
    expect(container.querySelector("[data-slot='diff-from']")).toBeNull();
    expect(
      container.querySelector("[data-slot='diff-to']")?.textContent,
    ).toContain("Approach");
  });

  it("removed row renders from ONLY (no to)", () => {
    const { container } = render(
      <RubricDiff changes={[SAMPLE_CHANGES[2]]} />,
    );
    expect(
      container.querySelector("[data-slot='diff-from']")?.textContent,
    ).toContain("1");
    expect(container.querySelector("[data-slot='diff-to']")).toBeNull();
  });
});

describe("<RubricDiff /> — empty state", () => {
  it("empty changes array renders the empty placeholder", () => {
    const { container } = render(<RubricDiff changes={[]} />);
    expect(container.querySelector("[data-slot='diff-empty']")).not.toBeNull();
    expect(container.querySelector("[data-slot='diff-list']")).toBeNull();
    expect(container.textContent).toContain("No changes");
  });
});
