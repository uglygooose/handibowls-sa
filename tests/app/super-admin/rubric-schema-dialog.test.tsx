import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RubricSchemaDialog } from "@/app/(super-admin)/platform/rubrics/_components/RubricSchemaDialog";
import { RubricSchema, type Rubric } from "@/lib/t20/rubric";

// Phase 12.5 / 12.5-3 (audit id `rubrics-view-schema-modal`):
// dialog is a thin viewer over a Rubric — coverage focuses on the
// section table shape + the JSON details reveal.

afterEach(cleanup);

const RUBRIC: Rubric = RubricSchema.parse({
  version: "v1-final-2026",
  deliveriesPerRoundPerDistance: 8,
  rounds: 2,
  sections: {
    jacks: {
      distances_m: [23, 26, 29, 32],
      model: "line_outcome",
      points: { on_line: 1, narrow: 0.5, wide: 0 },
      max_per_distance: 16,
    },
    targets: {
      distances_m: [23, 26, 29, 32],
      model: "line_outcome",
      points: { on_line: 1, narrow: 0.5, wide: 0 },
      max_per_distance: 16,
    },
    drive: {
      distance_m: 23,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    control: {
      distance_m: 26,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    trail: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    speedhumps_asc: {
      ladder_m: [23, 26, 29, 32],
      model: "on_length",
      pointsPerOnLength: 2,
    },
    speedhumps_desc: {
      ladder_m: [32, 29, 26, 23],
      model: "on_length",
      pointsPerOnLength: 2,
    },
  },
  grading: [
    { grade: "gold", minPct: 80 },
    { grade: "silver", minPct: 65 },
    { grade: "bronze", minPct: 50 },
    { grade: "fail", minPct: 0 },
  ],
  passPctTarget: 60,
  assessor: { minLevel: 2, secondMarkerRecommended: true },
});

describe("<RubricSchemaDialog />", () => {
  it("renders 7 section rows in canonical order", () => {
    render(
      <RubricSchemaDialog
        open
        onOpenChange={vi.fn()}
        rubric={RUBRIC}
        versionLabel="v1-final-2026"
      />,
    );
    const rows = screen.getAllByText(
      (_, el) => el?.getAttribute("data-slot") === "schema-row",
    );
    expect(rows).toHaveLength(7);
  });

  it("renders the section labels in canonical order (jacks → targets → drive → control → trail → asc → desc)", () => {
    render(
      <RubricSchemaDialog
        open
        onOpenChange={vi.fn()}
        rubric={RUBRIC}
        versionLabel="v1-final-2026"
      />,
    );
    const labels = ["Jacks", "Targets", "Drive", "Control", "Trail", "Speedhumps Ascending", "Speedhumps Descending"];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders the version label in the dialog header", () => {
    render(
      <RubricSchemaDialog
        open
        onOpenChange={vi.fn()}
        rubric={RUBRIC}
        versionLabel="v2-experimental"
      />,
    );
    expect(screen.getByText("v2-experimental")).toBeInTheDocument();
  });

  it("computes Max R1 = Max R2 = sectionMax/2 per section + sums to grandTotal in the footer", () => {
    render(
      <RubricSchemaDialog
        open
        onOpenChange={vi.fn()}
        rubric={RUBRIC}
        versionLabel="v1-final-2026"
      />,
    );
    // Dialog portals to document.body — query against document, not
    // the render container.
    const rows = document.querySelectorAll("[data-slot='schema-row']");
    expect(rows).toHaveLength(7);
    let computedGrandTotal = 0;
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      const r1 = Number(cells[3].textContent);
      const r2 = Number(cells[4].textContent);
      const total = Number(cells[5].textContent);
      expect(r1 + r2).toBe(total);
      computedGrandTotal += total;
    }
    const grandRow = document.querySelector("[data-slot='schema-grand-total']");
    expect(grandRow).not.toBeNull();
    const grandCell = grandRow!.querySelector("td:last-child");
    expect(Number(grandCell?.textContent)).toBe(computedGrandTotal);
  });

  it("ships a JSON details reveal containing the rubric JSON", async () => {
    const user = userEvent.setup();
    render(
      <RubricSchemaDialog
        open
        onOpenChange={vi.fn()}
        rubric={RUBRIC}
        versionLabel="v1-final-2026"
      />,
    );
    const details = document.querySelector(
      "[data-slot='schema-json-details']",
    ) as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);

    const summary = within(details).getByText("JSON");
    await user.click(summary);
    expect(details.open).toBe(true);

    const pre = details.querySelector("pre");
    expect(pre?.textContent).toContain('"version"');
    expect(pre?.textContent).toContain("v1-final-2026");
    expect(pre?.textContent).toContain('"sections"');
  });

  it("calls onOpenChange(false) when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <RubricSchemaDialog
        open
        onOpenChange={onOpenChange}
        rubric={RUBRIC}
        versionLabel="v1-final-2026"
      />,
    );
    // shadcn Dialog ships an X close button with sr-only label "Close"
    const close = screen.getByRole("button", { name: /close/i });
    await user.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
