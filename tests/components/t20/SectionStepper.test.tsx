import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { SectionStepper } from "@/components/t20/SectionStepper";

// Phase 10 — section stepper: 7 columns × 2 rounds = 14 cells.

describe("<SectionStepper /> — render shape", () => {
  it("renders 7 columns by default + 14 cells (7×2)", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const cols = container.querySelectorAll("[data-slot='stepper-section']");
    expect(cols).toHaveLength(7);
    const cells = container.querySelectorAll("[data-slot='stepper-cell']");
    expect(cells).toHaveLength(14);
  });

  it("each column carries data-section with the canonical section key", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const cols = container.querySelectorAll("[data-slot='stepper-section']");
    expect(cols[0].getAttribute("data-section")).toBe("jacks");
    expect(cols[1].getAttribute("data-section")).toBe("targets");
    expect(cols[2].getAttribute("data-section")).toBe("drive");
    expect(cols[3].getAttribute("data-section")).toBe("control");
    expect(cols[4].getAttribute("data-section")).toBe("trail");
    expect(cols[5].getAttribute("data-section")).toBe("speedhumps_asc");
    expect(cols[6].getAttribute("data-section")).toBe("speedhumps_desc");
  });

  it("cells carry data-round = 1 | 2", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const r1 = container.querySelector(
      "[data-slot='stepper-cell'][data-section='jacks'][data-round='1']",
    );
    const r2 = container.querySelector(
      "[data-slot='stepper-cell'][data-section='jacks'][data-round='2']",
    );
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });

  it("section labels prefix with 1-based index ('1. Jacks', '7. Speedhumps ↓')", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    expect(container.textContent).toContain("1. Jacks");
    expect(container.textContent).toContain("7. Speedhumps");
  });
});

describe("<SectionStepper /> — current cell highlight", () => {
  it("only the (sectionIdx, round) cell carries data-current='true'", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 2, round: 2 }}
        completed={{}}
      />,
    );
    const allCurrent = container.querySelectorAll(
      "[data-slot='stepper-cell'][data-current='true']",
    );
    expect(allCurrent).toHaveLength(1);
    expect(allCurrent[0].getAttribute("data-section")).toBe("drive");
    expect(allCurrent[0].getAttribute("data-round")).toBe("2");
  });
});

describe("<SectionStepper /> — completion state", () => {
  it("cells flagged in `completed` map carry data-done='true'", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{ jacks_r1: true, jacks_r2: true, targets_r1: true }}
      />,
    );
    const done = container.querySelectorAll(
      "[data-slot='stepper-cell'][data-done='true']",
    );
    expect(done).toHaveLength(3);
  });

  it("done cells render the Check icon", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{ targets_r1: true }}
      />,
    );
    const cell = container.querySelector(
      "[data-slot='stepper-cell'][data-section='targets'][data-round='1']",
    );
    // Check icon is an SVG inside the button.
    expect(cell?.querySelector("svg")).not.toBeNull();
  });

  it("todo cells (neither done nor current) render no SVG", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const todo = container.querySelector(
      "[data-slot='stepper-cell'][data-section='control'][data-round='2']",
    );
    expect(todo?.querySelector("svg")).toBeNull();
  });
});

describe("<SectionStepper /> — onJump", () => {
  it("clicking a cell calls onJump with (sectionIdx, round)", () => {
    const onJump = vi.fn();
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
        onJump={onJump}
      />,
    );
    const cell = container.querySelector(
      "[data-slot='stepper-cell'][data-section='trail'][data-round='2']",
    ) as HTMLButtonElement;
    fireEvent.click(cell);
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(4, 2);
  });

  it("no-op when onJump is omitted (does not crash)", () => {
    const { container } = render(
      <SectionStepper
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const cell = container.querySelector(
      "[data-slot='stepper-cell']",
    ) as HTMLButtonElement;
    expect(() => fireEvent.click(cell)).not.toThrow();
  });
});

describe("<SectionStepper /> — custom sections override", () => {
  it("custom sections list is rendered in supplied order", () => {
    const { container } = render(
      <SectionStepper
        sections={[
          { key: "drive", label: "DR" },
          { key: "control", label: "CT" },
        ]}
        current={{ sectionIdx: 0, round: 1 }}
        completed={{}}
      />,
    );
    const cols = container.querySelectorAll("[data-slot='stepper-section']");
    expect(cols).toHaveLength(2);
    expect(cols[0].getAttribute("data-section")).toBe("drive");
    expect(cols[1].getAttribute("data-section")).toBe("control");
    expect(container.textContent).toContain("1. DR");
    expect(container.textContent).toContain("2. CT");
  });
});
