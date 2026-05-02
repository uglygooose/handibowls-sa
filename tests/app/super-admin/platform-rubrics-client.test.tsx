import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const uploadRubricVersionSpy = vi.fn();
const activateRubricVersionSpy = vi.fn();
const deactivateRubricVersionSpy = vi.fn();
vi.mock(
  "@/app/(super-admin)/platform/rubrics/_actions",
  () => ({
    uploadRubricVersion: (...a: unknown[]) => uploadRubricVersionSpy(...a),
    activateRubricVersion: (...a: unknown[]) =>
      activateRubricVersionSpy(...a),
    deactivateRubricVersion: (...a: unknown[]) =>
      deactivateRubricVersionSpy(...a),
  }),
);

import { RubricsClient } from "@/app/(super-admin)/platform/rubrics/_components/RubricsClient";
import type { RubricVersionRow } from "@/app/(super-admin)/platform/rubrics/_data";
import { RubricSchema, type Rubric } from "@/lib/t20/rubric";

// Phase 10 / 10-8 — rubric library client island contract.

const RUBRIC_V1: Rubric = RubricSchema.parse({
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
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, miss: 0 },
    },
    control: {
      distance_m: 28,
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

const RUBRIC_V2_DRAFT: Rubric = JSON.parse(JSON.stringify(RUBRIC_V1));
RUBRIC_V2_DRAFT.version = "v2-draft-2026";
const goldBand = RUBRIC_V2_DRAFT.grading.find((g) => g.grade === "gold");
if (goldBand) goldBand.minPct = 82;

const ROW_ACTIVE: RubricVersionRow = {
  id: "00000000-0000-0000-0000-00000000aaaa",
  version: "v1-final-2026",
  rubric: RUBRIC_V1,
  status: "active",
  isActive: true,
  activatedAt: "2026-03-22T00:00:00Z",
  createdAt: "2026-03-20T00:00:00Z",
  createdByName: "Stephen N.",
  assessmentCount: 47,
};

const ROW_DRAFT: RubricVersionRow = {
  id: "00000000-0000-0000-0000-00000000bbbb",
  version: "v2-draft-2026",
  rubric: RUBRIC_V2_DRAFT,
  status: "draft",
  isActive: false,
  activatedAt: null,
  createdAt: "2026-04-26T00:00:00Z",
  createdByName: "Mary D.",
  assessmentCount: 0,
};

const ROW_ARCHIVED: RubricVersionRow = {
  id: "00000000-0000-0000-0000-00000000cccc",
  version: "v0-pilot-2025",
  rubric: RUBRIC_V1,
  status: "archived",
  isActive: false,
  activatedAt: null,
  createdAt: "2025-09-12T00:00:00Z",
  createdByName: "Stephen N.",
  assessmentCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<RubricsClient /> — initial render", () => {
  it("renders hero with active version + drafts pending pill", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    const active = container.querySelector("[data-slot='active-pill']");
    expect(active?.textContent).toContain("v1-final-2026");
    expect(active?.textContent?.toLowerCase()).toContain("active");
    const draftsPill = container.querySelector(
      "[data-slot='drafts-pending-pill']",
    );
    expect(draftsPill?.textContent).toContain("1 draft");
  });

  it("hides drafts-pending pill when no drafts exist", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    expect(
      container.querySelector("[data-slot='drafts-pending-pill']"),
    ).toBeNull();
  });

  it("renders all 3 rows in the versions table with status pills", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    const rows = container.querySelectorAll("[data-slot='version-row']");
    expect(rows).toHaveLength(3);
    const statuses = Array.from(rows).map((r) => r.getAttribute("data-status"));
    expect(statuses).toEqual(["draft", "active", "archived"]);
    expect(
      container.querySelectorAll("[data-slot='status-pill']").length,
    ).toBe(3);
  });

  it("active row by default is selected (data-selected='true')", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    const selected = container.querySelector(
      "[data-slot='version-row'][data-selected='true']",
    );
    expect(selected?.getAttribute("data-version-id")).toBe(ROW_ACTIVE.id);
  });

  it("clicking a row switches the selected state", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    fireEvent.click(
      container.querySelector(
        `[data-slot='version-row'][data-version-id='${ROW_ARCHIVED.id}']`,
      ) as HTMLElement,
    );
    const selected = container.querySelector(
      "[data-slot='version-row'][data-selected='true']",
    );
    expect(selected?.getAttribute("data-version-id")).toBe(ROW_ARCHIVED.id);
  });

  it("empty rows array renders the empty-state row", () => {
    const { container } = render(<RubricsClient rows={[]} />);
    expect(
      container.querySelectorAll("[data-slot='version-row']"),
    ).toHaveLength(0);
    expect(container.textContent).toContain("No rubric versions yet");
  });
});

describe("<RubricsClient /> — draft banner", () => {
  it("renders the draft banner with the draft version label", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    const banner = container.querySelector("[data-slot='draft-banner']");
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute("data-draft-id")).toBe(ROW_DRAFT.id);
    expect(banner?.textContent).toContain("v2-draft-2026 draft awaiting");
  });

  it("Compare CTA opens the diff modal", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-compare-cta']",
      ) as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='diff-modal']")).not.toBeNull();
  });

  it("Activate CTA opens the activate modal", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-activate-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='activate-modal']"),
    ).not.toBeNull();
  });
});

describe("<RubricsClient /> — pending changes panel", () => {
  it("renders permanent inline diff when both active + draft exist", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    const panel = container.querySelector(
      "[data-slot='pending-changes-panel']",
    );
    expect(panel).not.toBeNull();
    // The Gold band raised 80→82 should show in the inline diff.
    expect(panel?.textContent).toContain("Gold threshold raised");
  });

  it("hides pending changes panel when no draft exists", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_ACTIVE, ROW_ARCHIVED]} />,
    );
    expect(
      container.querySelector("[data-slot='pending-changes-panel']"),
    ).toBeNull();
  });

  it("summary line shows changes / added / removed / changed counts", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    const summary = container.querySelector(
      "[data-slot='pending-changes-summary']",
    );
    // Only the gold band changed → 1 change · 0 added · 0 removed · 1 changed.
    expect(summary?.textContent).toMatch(
      /1 change\s*·\s*0 added\s*·\s*0 removed\s*·\s*1 changed/,
    );
  });
});

describe("<RubricsClient /> — activate modal", () => {
  it("Activate Now is disabled until the acknowledge checkbox is ticked", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-activate-cta']",
      ) as HTMLButtonElement,
    );
    const cta = document.querySelector("[data-slot='activate-confirm-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.click(
      document.querySelector("[data-slot='activate-acknowledge-input']",
      ) as HTMLInputElement,
    );
    expect(cta.disabled).toBe(false);
  });

  it("Confirm calls activateRubricVersion + closes modal on success", async () => {
    activateRubricVersionSpy.mockResolvedValueOnce({ kind: "ok" });
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-activate-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='activate-acknowledge-input']",
      ) as HTMLInputElement,
    );
    await act(async () => {
      (
        document.querySelector("[data-slot='activate-confirm-cta']",
        ) as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(activateRubricVersionSpy).toHaveBeenCalledWith({
      rubric_id: ROW_DRAFT.id,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(
      document.querySelector("[data-slot='activate-modal']"),
    ).toBeNull();
  });

  it("Failed activation surfaces the error inline + keeps modal open", async () => {
    activateRubricVersionSpy.mockResolvedValueOnce({
      kind: "already_active",
    });
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-activate-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='activate-acknowledge-input']",
      ) as HTMLInputElement,
    );
    await act(async () => {
      (
        document.querySelector("[data-slot='activate-confirm-cta']",
        ) as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(
      document.querySelector("[data-slot='activate-error']"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-slot='activate-modal']"),
    ).not.toBeNull();
  });

  it("Cancel button closes the modal without invoking the action", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-activate-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='activate-cancel-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='activate-modal']"),
    ).toBeNull();
    expect(activateRubricVersionSpy).not.toHaveBeenCalled();
  });
});

describe("<RubricsClient /> — diff modal → activate hand-off", () => {
  it("Activate inside the diff modal closes diff + opens activate modal", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-compare-cta']",
      ) as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='diff-modal']")).not.toBeNull();
    fireEvent.click(
      document.querySelector("[data-slot='diff-modal-activate-cta']",
      ) as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='diff-modal']")).toBeNull();
    expect(
      document.querySelector("[data-slot='activate-modal']"),
    ).not.toBeNull();
  });

  it("Diff close button dismisses the modal", () => {
    // Phase 13 / 13-1 / commit 8b — the manual `diff-modal-close` X button
    // was dropped during the shadcn-Dialog refactor. shadcn DialogContent
    // ships its own close affordance with data-slot="dialog-close" + an
    // sr-only "Close" label, which is the new contract target.
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='draft-compare-cta']",
      ) as HTMLButtonElement,
    );
    // The dialog renders a single close button; query it via the shadcn-
    // dialog data-slot. There may be multiple if other dialogs are mounted,
    // but this test only opens the diff modal so the first match is correct.
    fireEvent.click(
      document.querySelector("[data-slot='dialog-close']") as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='diff-modal']")).toBeNull();
  });
});

describe("<RubricsClient /> — deactivate flow", () => {
  it("active row exposes a Deactivate CTA when other versions exist", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    const row = container.querySelector(
      `[data-slot='version-row'][data-version-id='${ROW_ACTIVE.id}']`,
    );
    expect(
      row?.querySelector("[data-slot='row-deactivate-cta']"),
    ).not.toBeNull();
  });

  it("active row hides Deactivate CTA when it's the only version", () => {
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    const row = container.querySelector(
      `[data-slot='version-row'][data-version-id='${ROW_ACTIVE.id}']`,
    );
    expect(
      row?.querySelector("[data-slot='row-deactivate-cta']"),
    ).toBeNull();
  });

  it("Deactivate CTA opens the deactivate modal + Confirm calls the action", async () => {
    deactivateRubricVersionSpy.mockResolvedValueOnce({ kind: "ok" });
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='row-deactivate-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='deactivate-modal']"),
    ).not.toBeNull();
    await act(async () => {
      (
        document.querySelector("[data-slot='deactivate-confirm-cta']",
        ) as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(deactivateRubricVersionSpy).toHaveBeenCalledWith({
      rubric_id: ROW_ACTIVE.id,
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-slot='deactivate-modal']"),
      ).toBeNull(),
    );
  });

  it("Deactivate Cancel closes without invoking the action", () => {
    const { container } = render(
      <RubricsClient rows={[ROW_DRAFT, ROW_ACTIVE]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='row-deactivate-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='deactivate-cancel-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='deactivate-modal']"),
    ).toBeNull();
    expect(deactivateRubricVersionSpy).not.toHaveBeenCalled();
  });
});

describe("<RubricsClient /> — upload flow", () => {
  function makeJsonFile(json: unknown, name = "rubric.json"): File {
    const blob = new Blob([JSON.stringify(json)], {
      type: "application/json",
    });
    return new File([blob], name, { type: "application/json" });
  }

  it("Upload zone exposes the click CTA + the hidden file input", () => {
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    expect(
      container.querySelector("[data-slot='upload-cta']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='upload-input']"),
    ).not.toBeNull();
  });

  it("invalid JSON file → inline error banner, action NOT called", async () => {
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    const input = container.querySelector(
      "[data-slot='upload-input']",
    ) as HTMLInputElement;
    const file = new File(["not-json"], "broken.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      fireEvent.change(input);
      await new Promise((r) => setTimeout(r, 10));
    });
    await waitFor(() =>
      expect(
        container.querySelector("[data-slot='upload-error']")?.textContent,
      ).toContain("isn't valid JSON"),
    );
    expect(uploadRubricVersionSpy).not.toHaveBeenCalled();
  });

  it("schema-invalid JSON → inline error, action NOT called", async () => {
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    const input = container.querySelector(
      "[data-slot='upload-input']",
    ) as HTMLInputElement;
    const file = makeJsonFile({ totally: "wrong shape" });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      fireEvent.change(input);
      await new Promise((r) => setTimeout(r, 10));
    });
    await waitFor(() =>
      expect(
        container.querySelector("[data-slot='upload-error']")?.textContent,
      ).toContain("Schema validation failed"),
    );
    expect(uploadRubricVersionSpy).not.toHaveBeenCalled();
  });

  it("valid rubric → uploadRubricVersion called + success toast", async () => {
    uploadRubricVersionSpy.mockResolvedValueOnce({
      kind: "ok",
      rubricId: "new-id",
    });
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    const input = container.querySelector(
      "[data-slot='upload-input']",
    ) as HTMLInputElement;
    const newRubric = JSON.parse(JSON.stringify(RUBRIC_V1));
    newRubric.version = "v3-test-2026";
    const file = makeJsonFile(newRubric);
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      fireEvent.change(input);
      await new Promise((r) => setTimeout(r, 10));
    });
    await waitFor(() =>
      expect(uploadRubricVersionSpy).toHaveBeenCalledWith({
        version: "v3-test-2026",
        rubric: expect.objectContaining({ version: "v3-test-2026" }),
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
  });

  it("duplicate-version response surfaces inline error", async () => {
    uploadRubricVersionSpy.mockResolvedValueOnce({
      kind: "duplicate_version",
    });
    const { container } = render(<RubricsClient rows={[ROW_ACTIVE]} />);
    const input = container.querySelector(
      "[data-slot='upload-input']",
    ) as HTMLInputElement;
    const dupe = JSON.parse(JSON.stringify(RUBRIC_V1));
    const file = makeJsonFile(dupe);
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      fireEvent.change(input);
      await new Promise((r) => setTimeout(r, 10));
    });
    await waitFor(() => expect(uploadRubricVersionSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        container.querySelector("[data-slot='upload-error']")?.textContent,
      ).toContain("already exists"),
    );
  });
});
