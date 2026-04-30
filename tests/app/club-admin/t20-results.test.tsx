import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastMessage = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    message: (...a: unknown[]) => toastMessage(...a),
  },
}));

const addSecondMarkerSpy = vi.fn();
const requestPdfExportSpy = vi.fn();
const editAssessmentNotesSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/t20/_actions", () => ({
  addSecondMarker: (...a: unknown[]) => addSecondMarkerSpy(...a),
  requestPdfExport: (...a: unknown[]) => requestPdfExportSpy(...a),
  editAssessmentNotes: (...a: unknown[]) => editAssessmentNotesSpy(...a),
}));

import { AssessmentResults } from "@/app/(club-admin)/manage/t20/_components/AssessmentResults";
import type { AssessmentDetail } from "@/app/(club-admin)/manage/t20/_data";
import type { HandBalance } from "@/app/(club-admin)/manage/t20/[id]/page";
import { RubricSchema, type Rubric } from "@/lib/t20/rubric";
import { type AssessmentScore } from "@/lib/t20/score";

// Phase 10 / 10-7 — results-view contract.

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

const ASSESSMENT_ID = "00000000-0000-0000-0000-00000000bbbb";

function makeAssessment(
  over: Partial<AssessmentDetail["assessment"]> = {},
): AssessmentDetail["assessment"] {
  return {
    id: ASSESSMENT_ID,
    club_id: "club-1",
    player_id: "p-1",
    player_name: "James Thomas",
    player_email: "james@example.com",
    assessor_id: "c-1",
    assessor_name: "Coach Williams",
    assessor_accreditation_id: "BSA-CL2-1184",
    assessed_on: "2026-04-22",
    green_type: "outdoor",
    green_speed: 13.4,
    status: "submitted",
    ui_state: "completed",
    total_score: 247,
    percentage: 77.2,
    grade: "silver",
    rubric_version_id: "r-1",
    rubric_version_label: "v1-final-2026",
    second_marker_name: null,
    notes: null,
    pdf_url: null,
    submitted_at: "2026-04-22T10:00:00Z",
    ...over,
  };
}

function makeScore(
  over: Partial<AssessmentScore> = {},
): AssessmentScore {
  return {
    sectionTotals: [
      { section: "jacks", model: "line_outcome", earned: 27, max: 64, r1: 14, r2: 13 },
      { section: "targets", model: "line_outcome", earned: 27, max: 64, r1: 12, r2: 15 },
      { section: "drive", model: "zones_8", earned: 48, max: 256, r1: 22, r2: 26 },
      { section: "control", model: "zones_8", earned: 47, max: 256, r1: 24, r2: 23 },
      { section: "trail", model: "zones_8", earned: 48, max: 256, r1: 25, r2: 23 },
      { section: "speedhumps_asc", model: "on_length", earned: 27, max: 32, r1: 13, r2: 14 },
      { section: "speedhumps_desc", model: "on_length", earned: 23, max: 32, r1: 11, r2: 12 },
    ],
    earned: 247,
    max: 320,
    percentage: 77.1875,
    grade: "silver",
    ...over,
  };
}

const HAND_BALANCE_DEFAULT: HandBalance = {
  forehand: 58,
  backhand: 42,
  totalDeliveries: 144,
};

const LENGTH_DIST_DEFAULT = [
  { distance: 23, pct: 78 },
  { distance: 26, pct: 84 },
  { distance: 29, pct: 71 },
  { distance: 32, pct: 58 },
];

const ZONE_COUNTS_DEFAULT = {
  1: 42,
  2: 18,
  3: 12,
  4: 9,
  5: 14,
  6: 8,
  7: 11,
  8: 24,
};

function renderResults(
  over: Partial<Parameters<typeof AssessmentResults>[0]> = {},
) {
  return render(
    <AssessmentResults
      assessment={over.assessment ?? makeAssessment()}
      rubric={over.rubric ?? RUBRIC}
      score={over.score ?? makeScore()}
      zoneCounts={over.zoneCounts ?? ZONE_COUNTS_DEFAULT}
      handBalance={over.handBalance ?? HAND_BALANCE_DEFAULT}
      lengthDistribution={over.lengthDistribution ?? LENGTH_DIST_DEFAULT}
      clubName={over.clubName ?? "Demo Bowls Club"}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requestPdfExportSpy.mockResolvedValue({
    kind: "pending",
    reason: "template_not_ready",
  });
});

describe("<AssessmentResults /> — hero", () => {
  it("renders the hero with grade=silver data attribute", () => {
    const { container } = renderResults();
    const hero = container.querySelector("[data-slot='results-hero']");
    expect(hero?.getAttribute("data-grade")).toBe("silver");
  });

  it("renders the player name + percentage + total/max", () => {
    const { container } = renderResults();
    expect(
      container.querySelector("[data-slot='results-hero-name']")?.textContent,
    ).toContain("James Thomas");
    const pct = container.querySelector("[data-slot='results-pct']");
    expect(pct?.textContent).toContain("77.2");
    expect(container.textContent).toContain("247 / 320 points");
  });

  it("renders GradePill in size lg with the score's grade", () => {
    const { container } = renderResults();
    const pill = container.querySelector(
      "[data-slot='grade-pill-wrap'] [data-slot='grade-pill']",
    );
    expect(pill?.getAttribute("data-grade")).toBe("silver");
    expect(pill?.getAttribute("data-size")).toBe("lg");
  });

  it("renders conditions as 'Outdoor · 13.4s'", () => {
    const { container } = renderResults();
    expect(container.textContent).toContain("Outdoor · 13.4s");
  });

  it("renders rubric label from the assessment row", () => {
    const { container } = renderResults();
    expect(container.textContent).toContain("v1-final-2026");
  });

  it("renders 'Final · {long-formatted date}' eyebrow", () => {
    const { container } = renderResults();
    expect(container.textContent).toContain("Final");
    expect(container.textContent).toMatch(/\d{2}\s\w{3}\s\d{4}/);
  });

  it("Export PDF button calls requestPdfExport + surfaces 'PDF generation pending' toast", async () => {
    const { container } = renderResults();
    const cta = container.querySelector(
      "[data-slot='export-pdf-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      cta.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(requestPdfExportSpy).toHaveBeenCalledWith({
      assessment_id: ASSESSMENT_ID,
    });
    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith(
        "PDF generation pending",
        expect.objectContaining({
          description: expect.stringContaining("template ships"),
        }),
      ),
    );
  });
});

describe("<AssessmentResults /> — section breakdown", () => {
  it("renders 7 breakdown rows with section keys", () => {
    const { container } = renderResults();
    const rows = container.querySelectorAll("[data-slot='breakdown-row']");
    expect(rows).toHaveLength(7);
    expect(rows[0].getAttribute("data-section")).toBe("jacks");
    expect(rows[6].getAttribute("data-section")).toBe("speedhumps_desc");
  });

  it("each row renders the section name", () => {
    const { container } = renderResults();
    expect(container.textContent).toContain("Jacks");
    expect(container.textContent).toContain("Targets");
    expect(container.textContent).toContain("Drive");
    expect(container.textContent).toContain("Control");
    expect(container.textContent).toContain("Trail");
    expect(container.textContent).toContain("Speedhumps Ascending");
    expect(container.textContent).toContain("Speedhumps Descending");
  });

  it("grand total row uses score.earned / score.max", () => {
    const { container } = renderResults();
    const total = container.querySelector(
      "[data-slot='breakdown-grand-total']",
    );
    expect(total?.textContent).toContain("247 / 320");
    const pct = container.querySelector(
      "[data-slot='breakdown-grand-pct']",
    );
    expect(pct?.textContent).toContain("77.2%");
  });

  it("breakdown bars start at 0% width then animate to pct after reveal timeout", async () => {
    const { container } = renderResults();
    const fills = container.querySelectorAll(
      "[data-slot='breakdown-bar-fill']",
    );
    expect(fills.length).toBeGreaterThan(0);
    // Pre-reveal: width should be 0%
    expect((fills[0] as HTMLElement).style.width).toBe("0%");
    await waitFor(
      () => {
        // After mount-timeout, revealed=true → width is the pct%.
        expect((fills[0] as HTMLElement).style.width).not.toBe("0%");
      },
      { timeout: 1500 },
    );
  });
});

describe("<AssessmentResults /> — charts row", () => {
  it("renders three chart cards: zone-heatmap-card / hand-balance-card / length-card", () => {
    const { container } = renderResults();
    expect(
      container.querySelector("[data-slot='zone-heatmap-card']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='hand-balance-card']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='length-card']"),
    ).not.toBeNull();
  });

  it("zone heatmap renders with the zone-count totals in the eyebrow", () => {
    const { container } = renderResults();
    const card = container.querySelector(
      "[data-slot='zone-heatmap-card']",
    );
    // 42 + 18 + 12 + 9 + 14 + 8 + 11 + 24 = 138
    expect(card?.textContent).toContain("138");
  });

  it("zero-zones counts render the empty placeholder note", () => {
    const { container } = renderResults({
      zoneCounts: {},
    });
    const note = container.querySelector(
      "[data-slot='zone-heatmap-note']",
    );
    expect(note?.textContent).toContain("No zones_8 deliveries");
  });

  it("hand balance chart receives the supplied percentages", () => {
    const { container } = renderResults();
    const card = container.querySelector(
      "[data-slot='hand-balance-card']",
    );
    expect(card?.textContent).toContain("58%");
    expect(card?.textContent).toContain("42%");
  });

  it("length distribution chart renders one column per data point", () => {
    const { container } = renderResults();
    const cols = container.querySelectorAll(
      "[data-slot='length-distribution-col']",
    );
    expect(cols).toHaveLength(4);
  });

  it("empty length-distribution data renders the chart's empty placeholder", () => {
    const { container } = renderResults({ lengthDistribution: [] });
    const card = container.querySelector("[data-slot='length-card']");
    expect(card?.textContent).toContain("No on-length");
  });
});

describe("<AssessmentResults /> — notes section (12-4 / N8 categorised)", () => {
  it("renders three category tiles (Strengths / Watch / Focus)", () => {
    const { container } = renderResults({
      assessment: makeAssessment({ notes: null }),
    });
    const tiles = container.querySelectorAll("[data-slot='notes-tile']");
    expect(tiles).toHaveLength(3);
    const cats = Array.from(tiles).map((t) => t.getAttribute("data-category"));
    expect(cats).toEqual(["strengths", "watch", "focus"]);
  });

  it("populated category renders body; empty category renders empty-state", () => {
    const { container } = renderResults({
      assessment: makeAssessment({
        notes: {
          strengths: "Strong forehand control on Section 1.",
        },
      }),
    });
    const strengthsTile = container.querySelector(
      "[data-slot='notes-tile'][data-category='strengths']",
    );
    expect(strengthsTile?.getAttribute("data-has-value")).toBe("true");
    expect(
      strengthsTile?.querySelector("[data-slot='notes-tile-body']")?.textContent,
    ).toMatch(/strong forehand control/i);

    const watchTile = container.querySelector(
      "[data-slot='notes-tile'][data-category='watch']",
    );
    expect(watchTile?.getAttribute("data-has-value")).toBe("false");
    expect(
      watchTile?.querySelector("[data-slot='notes-tile-empty']"),
    ).not.toBeNull();
  });

  it("'+ Add' CTA renders on empty tiles; 'Edit' on populated tiles", () => {
    const { container } = renderResults({
      assessment: makeAssessment({
        notes: { strengths: "Existing copy." },
      }),
    });
    const strengthsCta = container
      .querySelector("[data-slot='notes-tile'][data-category='strengths']")
      ?.querySelector("[data-slot='notes-tile-edit-cta']");
    expect(strengthsCta?.textContent).toMatch(/edit/i);

    const watchCta = container
      .querySelector("[data-slot='notes-tile'][data-category='watch']")
      ?.querySelector("[data-slot='notes-tile-edit-cta']");
    expect(watchCta?.textContent).toMatch(/\+ ?add/i);
  });

  it("clicking Edit reveals the tile's textarea + Save / Cancel", async () => {
    const { container } = renderResults({
      assessment: makeAssessment({ notes: null }),
    });
    const strengthsTile = container.querySelector(
      "[data-slot='notes-tile'][data-category='strengths']",
    );
    const cta = strengthsTile?.querySelector(
      "[data-slot='notes-tile-edit-cta']",
    ) as HTMLButtonElement;
    cta.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(
      strengthsTile?.querySelector("[data-slot='notes-tile-textarea']"),
    ).not.toBeNull();
    expect(
      strengthsTile?.querySelector("[data-slot='notes-tile-save-cta']"),
    ).not.toBeNull();
    expect(
      strengthsTile?.querySelector("[data-slot='notes-tile-cancel-cta']"),
    ).not.toBeNull();
  });

  it("legacy notes render in a read-only banner when present", () => {
    const { container } = renderResults({
      assessment: makeAssessment({
        notes: { legacy: "Pre-12-4 uncategorised note." },
      }),
    });
    const legacy = container.querySelector("[data-slot='notes-legacy']");
    expect(legacy).not.toBeNull();
    expect(legacy?.textContent).toMatch(/pre-12-4 uncategorised note/i);
  });
});

describe("<AssessmentResults /> — second marker section", () => {
  it("with no marker shows 'Add second marker' CTA + section data-has-marker='false'", () => {
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    const sec = container.querySelector(
      "[data-slot='second-marker-section']",
    );
    expect(sec?.getAttribute("data-has-marker")).toBe("false");
    expect(
      container.querySelector("[data-slot='second-marker-add-cta']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='second-marker-row']"),
    ).toBeNull();
  });

  it("with existing marker shows the row + section data-has-marker='true'", () => {
    const { container } = renderResults({
      assessment: makeAssessment({
        second_marker_name: "Marijke Roux · BSA-CL2-2208",
      }),
    });
    const sec = container.querySelector(
      "[data-slot='second-marker-section']",
    );
    expect(sec?.getAttribute("data-has-marker")).toBe("true");
    expect(
      container.querySelector("[data-slot='second-marker-row']")?.textContent,
    ).toContain("Marijke Roux");
    expect(
      container.querySelector("[data-slot='second-marker-add-cta']"),
    ).toBeNull();
  });

  it("clicking 'Add second marker' opens the form", () => {
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    expect(
      container.querySelector("[data-slot='second-marker-form']"),
    ).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-add-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='second-marker-form']"),
    ).not.toBeNull();
  });

  it("submit button is disabled until name + accred (regex-valid) are filled", () => {
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-add-cta']",
      ) as HTMLButtonElement,
    );
    const submit = container.querySelector(
      "[data-slot='second-marker-submit']",
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-name-input']",
      ) as HTMLInputElement,
      { target: { value: "Bongani" } },
    );
    expect(submit.disabled).toBe(true);
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-accred-input']",
      ) as HTMLInputElement,
      { target: { value: "abc" } },
    );
    // 3 chars too short.
    expect(submit.disabled).toBe(true);
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-accred-input']",
      ) as HTMLInputElement,
      { target: { value: "BSA-CL1-3098" } },
    );
    expect(submit.disabled).toBe(false);
  });

  it("submit calls addSecondMarker with the right shape on valid input", async () => {
    addSecondMarkerSpy.mockResolvedValueOnce({ kind: "ok" });
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-add-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-name-input']",
      ) as HTMLInputElement,
      { target: { value: "Marijke Roux" } },
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-accred-input']",
      ) as HTMLInputElement,
      { target: { value: "BSA-CL2-2208" } },
    );
    const form = container.querySelector(
      "[data-slot='second-marker-form']",
    ) as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(addSecondMarkerSpy).toHaveBeenCalledWith({
      assessment_id: ASSESSMENT_ID,
      marker_name: "Marijke Roux",
      marker_accreditation_id: "BSA-CL2-2208",
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("validation error from action surfaces inline + does not toast.error", async () => {
    addSecondMarkerSpy.mockResolvedValueOnce({
      kind: "validation",
      error: "Accreditation ID must be 4-32 alphanumeric characters.",
    });
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-add-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-name-input']",
      ) as HTMLInputElement,
      { target: { value: "M" } },
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='second-marker-accred-input']",
      ) as HTMLInputElement,
      { target: { value: "ABCD" } },
    );
    const form = container.querySelector(
      "[data-slot='second-marker-form']",
    ) as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() =>
      expect(
        container.querySelector("[data-slot='second-marker-error']"),
      ).not.toBeNull(),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("Cancel button closes the form without calling the action", () => {
    const { container } = renderResults({
      assessment: makeAssessment({ second_marker_name: null }),
    });
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-add-cta']",
      ) as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='second-marker-cancel']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='second-marker-form']"),
    ).toBeNull();
    expect(addSecondMarkerSpy).not.toHaveBeenCalled();
  });
});

describe("<AssessmentResults /> — back link", () => {
  it("renders a link back to /manage/t20", () => {
    const { container } = renderResults();
    const link = container.querySelector("[data-slot='back-cta']");
    expect(link?.getAttribute("href")).toBe("/manage/t20");
  });
});
