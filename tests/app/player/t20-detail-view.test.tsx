import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

// Mock the lazy-loaded heatmap so its dynamic import doesn't show
// up as a Suspense fallback in the test render.
vi.mock("@/components/t20/CompassHeatmap", () => ({
  CompassHeatmap: ({ counts, size }: { counts: unknown; size?: number }) => (
    <div
      data-slot="compass-heatmap-mock"
      data-counts={JSON.stringify(counts)}
      data-size={size}
    />
  ),
}));

// Mock next/dynamic so it short-circuits to the underlying module
// rather than wrapping in a React.lazy proxy that needs a Suspense
// boundary. The CompassHeatmap module is already mocked above; this
// mock just returns its `default` export when the loader resolves.
type AnyComponent = React.ComponentType<Record<string, unknown>>;
vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ default: AnyComponent }>,
  ) => {
    let Loaded: AnyComponent | null = null;
    void loader().then((m) => {
      Loaded = m.default;
    });
    function DynamicProxy(props: Record<string, unknown>) {
      if (!Loaded) return <div data-slot="dynamic-loading" />;
      const Resolved = Loaded;
      return <Resolved {...props} />;
    }
    return DynamicProxy;
  },
}));

vi.mock("@/app/(player)/(gated)/t20/_actions", () => ({
  requestT20Assessment: vi.fn(),
}));

import { PlayerResultsView } from "@/app/(player)/(gated)/t20/[assessmentId]/_components/PlayerResultsView";
import {
  type AssessmentDetail,
  type AssessmentDetailAssessment,
  type DeliveryRow,
} from "@/lib/t20/assessment-detail";
import { RubricSchema, type Rubric } from "@/lib/t20/rubric";

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

function makeAssessment(
  over: Partial<AssessmentDetailAssessment> = {},
): AssessmentDetailAssessment {
  return {
    id: "00000000-0000-0000-0000-00000000aaaa",
    club_id: "11111111-1111-1111-1111-111111111111",
    player_id: "22222222-2222-2222-2222-222222222222",
    player_name: "James Thomas",
    player_email: null,
    assessor_id: "33333333-3333-3333-3333-333333333333",
    assessor_name: "Coach Williams",
    assessor_accreditation_id: "BSA-CL2-1184",
    assessed_on: "2026-04-22",
    green_type: "outdoor",
    green_speed: 13.2,
    status: "submitted",
    ui_state: "completed",
    total_score: 220,
    percentage: 68.75,
    grade: "silver",
    rubric_version_id: "44444444-4444-4444-4444-444444444444",
    rubric_version_label: "v1-final-2026",
    second_marker_name: null,
    notes: null,
    pdf_url: null,
    submitted_at: "2026-04-22T18:00:00Z",
    ...over,
  };
}

function makeDelivery(over: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: `d-${Math.random().toString(16).slice(2)}`,
    assessment_id: "00000000-0000-0000-0000-00000000aaaa",
    section: "drive",
    round: 1,
    delivery_index: 1,
    distance_m: 23,
    hand: "fore",
    outcome: { zone: 1 },
    points: 8,
    distance_bucket: null,
    ...over,
  } as DeliveryRow;
}

const SAMPLE_DETAIL: AssessmentDetail = {
  assessment: makeAssessment(),
  deliveries: [
    makeDelivery({ section: "drive", round: 1, delivery_index: 1, outcome: { zone: 1 } }),
    makeDelivery({ section: "drive", round: 1, delivery_index: 2, outcome: { zone: 2 } }),
    makeDelivery({ section: "control", round: 1, delivery_index: 1, outcome: { zone: 1 } }),
    makeDelivery({ section: "trail", round: 2, delivery_index: 1, outcome: { zone: 5 } }),
  ],
  rubric: RUBRIC,
};

describe("<PlayerResultsView /> — read-only contract", () => {
  it("renders the hero with grade pill + percentage + assessor + date", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const hero = container.querySelector("[data-slot='player-results-hero']");
    expect(hero).not.toBeNull();
    // Grade is derived from the live deliveries via
    // aggregateAssessment (the same recomputation the admin view
    // does). Sparse fixture → "fail" band; a fuller fixture would
    // band into silver/gold. The contract under test is "hero
    // renders with a grade attr"; specific band logic is pinned
    // by score.test.ts.
    expect(hero?.getAttribute("data-grade")).toMatch(/^(gold|silver|bronze|fail)$/);
    expect(hero?.textContent).toContain("Coach Williams");
    expect(hero?.textContent).toContain("v1-final-2026");
  });

  it("renders the back-to-hub link pointing at /t20", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const back = container.querySelector("[data-slot='back-to-hub']");
    expect(back?.getAttribute("href")).toBe("/t20");
  });

  it("renders the section breakdown table with 7 rows (one per section)", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const rows = container.querySelectorAll("[data-slot='breakdown-row']");
    expect(rows).toHaveLength(7);
    const sections = Array.from(rows).map((r) => r.getAttribute("data-section"));
    expect(sections).toEqual([
      "jacks",
      "targets",
      "drive",
      "control",
      "trail",
      "speedhumps_asc",
      "speedhumps_desc",
    ]);
  });

  it("renders a parallel mobile-collapsed breakdown (Section + Total · %)", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const mobileRows = container.querySelectorAll(
      "[data-slot='breakdown-row-mobile']",
    );
    expect(mobileRows).toHaveLength(7);
  });

  it("does NOT render any edit affordances on the breakdown", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const buttons = container.querySelectorAll("button");
    for (const btn of buttons) {
      const label = (btn.textContent ?? "").toLowerCase();
      expect(label).not.toMatch(/edit/);
    }
  });

  it("renders three coach-notes tiles (Strengths / Watch / Coach focus) with empty states when notes are null", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const strengths = container.querySelector("[data-slot='note-tile-strengths']");
    const watch = container.querySelector("[data-slot='note-tile-watch']");
    const focus = container.querySelector("[data-slot='note-tile-focus']");
    expect(strengths).not.toBeNull();
    expect(watch).not.toBeNull();
    expect(focus).not.toBeNull();
    expect(strengths?.getAttribute("data-empty")).toBe("true");
    expect(watch?.getAttribute("data-empty")).toBe("true");
    expect(focus?.getAttribute("data-empty")).toBe("true");
    expect(strengths?.textContent).toContain("No strengths notes yet.");
  });

  it("renders populated notes tiles when notes are present + drops the empty-state copy", () => {
    const detail: AssessmentDetail = {
      ...SAMPLE_DETAIL,
      assessment: makeAssessment({
        notes: {
          strengths: "Great line discipline at 23m.",
          watch: "Backhand drift creeping in.",
        },
      }),
    };
    const { container } = render(
      <PlayerResultsView detail={detail} hasClubMembership={true} />,
    );
    const strengths = container.querySelector("[data-slot='note-tile-strengths']");
    const watch = container.querySelector("[data-slot='note-tile-watch']");
    const focus = container.querySelector("[data-slot='note-tile-focus']");
    expect(strengths?.getAttribute("data-empty")).toBe("false");
    expect(strengths?.textContent).toContain("Great line discipline at 23m.");
    expect(watch?.getAttribute("data-empty")).toBe("false");
    expect(focus?.getAttribute("data-empty")).toBe("true");
  });

  it("renders the legacy notes block when present, hides it when absent", () => {
    const withLegacy: AssessmentDetail = {
      ...SAMPLE_DETAIL,
      assessment: makeAssessment({
        notes: { legacy: "Pre-12-4 import — original capture notes." },
      }),
    };
    const { container } = render(
      <PlayerResultsView detail={withLegacy} hasClubMembership={true} />,
    );
    expect(container.querySelector("[data-slot='note-tile-legacy']")).not.toBeNull();

    cleanup();

    const { container: c2 } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    expect(c2.querySelector("[data-slot='note-tile-legacy']")).toBeNull();
  });

  it("renders the heatmap with computed zone counts", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const heatmap = container.querySelector("[data-slot='compass-heatmap-mock']");
    expect(heatmap).not.toBeNull();
    const counts = JSON.parse(heatmap?.getAttribute("data-counts") ?? "{}");
    // 4 deliveries: zone 1 ×2, zone 2 ×1, zone 5 ×1
    expect(counts).toEqual({ "1": 2, "2": 1, "5": 1 });
  });

  it("does NOT render a hand-balance chart (12.5-4 amendment: hand-balance stays admin-only)", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    expect(container.querySelector("[data-slot='hand-balance-chart']")).toBeNull();
    expect(container.textContent).not.toMatch(/hand balance/i);
  });

  it("renders the length-distribution chart alongside the heatmap (12.5-4 amendment)", () => {
    const detail: AssessmentDetail = {
      ...SAMPLE_DETAIL,
      deliveries: [
        ...SAMPLE_DETAIL.deliveries,
        // Speedhumps deliveries → length-distribution buckets.
        {
          id: "sl1",
          assessment_id: "00000000-0000-0000-0000-00000000aaaa",
          section: "speedhumps_asc",
          round: 1,
          delivery_index: 1,
          distance_m: 23,
          hand: null,
          outcome: { on_length: true },
          points: 2,
          distance_bucket: null,
        },
        {
          id: "sl2",
          assessment_id: "00000000-0000-0000-0000-00000000aaaa",
          section: "speedhumps_asc",
          round: 1,
          delivery_index: 2,
          distance_m: 23,
          hand: null,
          outcome: { on_length: false },
          points: 0,
          distance_bucket: null,
        },
        {
          id: "sl3",
          assessment_id: "00000000-0000-0000-0000-00000000aaaa",
          section: "speedhumps_desc",
          round: 1,
          delivery_index: 1,
          distance_m: 26,
          hand: null,
          outcome: { on_length: true },
          points: 2,
          distance_bucket: null,
        },
      ],
    };
    const { container } = render(
      <PlayerResultsView detail={detail} hasClubMembership={true} />,
    );
    const chart = container.querySelector(
      "[data-slot='length-distribution-chart']",
    );
    expect(chart).not.toBeNull();
    expect(chart?.getAttribute("data-empty")).toBe("false");
    // Two distance buckets present (23m + 26m).
    const cols = container.querySelectorAll(
      "[data-slot='length-distribution-col']",
    );
    expect(cols).toHaveLength(2);
  });

  it("places heatmap + length-distribution side-by-side under the same charts grid", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const grid = container.querySelector("[data-slot='player-results-charts']");
    expect(grid).not.toBeNull();
    // Both children render under the grid container.
    expect(grid?.querySelector("[data-slot='player-results-heatmap']")).not.toBeNull();
    expect(grid?.querySelector("[data-slot='player-results-length']")).not.toBeNull();
    // 2-column at ≥900px, 1-column at <900px (Tailwind responsive
    // breakpoint pinned in the className).
    expect(grid?.className).toMatch(/min-\[900px\]:grid-cols-2/);
  });

  it("renders the Request re-assessment CTA with the correct copy + enabled state when the player has a club", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={true} />,
    );
    const cta = container.querySelector(
      "[data-slot='request-reassessment-cta']",
    ) as HTMLButtonElement;
    expect(cta).not.toBeNull();
    expect(cta.disabled).toBe(false);
    expect(cta.textContent?.toLowerCase()).toContain("request re-assessment");
  });

  it("disables the Request re-assessment CTA when the player has no club", () => {
    const { container } = render(
      <PlayerResultsView detail={SAMPLE_DETAIL} hasClubMembership={false} />,
    );
    const cta = container.querySelector(
      "[data-slot='request-reassessment-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});
