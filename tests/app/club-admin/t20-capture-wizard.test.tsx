import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const routerPushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushSpy, refresh: vi.fn() }),
}));

const recordDeliverySpy = vi.fn();
const finalizeAssessmentSpy = vi.fn();
const discardAssessmentSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/t20/_actions", () => ({
  recordDelivery: (...a: unknown[]) => recordDeliverySpy(...a),
  finalizeAssessment: (...a: unknown[]) => finalizeAssessmentSpy(...a),
  discardAssessment: (...a: unknown[]) => discardAssessmentSpy(...a),
}));

const wakeLockAcquireSpy = vi.fn().mockResolvedValue(true);
const wakeLockReleaseSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scorecard/use-wake-lock", () => ({
  useWakeLock: () => ({
    active: false,
    unsupported: false,
    acquire: wakeLockAcquireSpy,
    release: wakeLockReleaseSpy,
  }),
}));

import { CaptureWizard } from "@/app/(club-admin)/manage/t20/_components/CaptureWizard";
import type {
  AssessmentDetail,
  DeliveryRow,
} from "@/app/(club-admin)/manage/t20/_data";
import { RubricSchema, type Rubric } from "@/lib/t20/rubric";

// Phase 10 / 10-6 — capture-wizard contract.

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
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
    },
    control: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
    },
    trail: {
      distance_m: 28,
      model: "zones_8",
      hands: ["fore", "back"],
      zonePoints: {
        "1": 8,
        "2": 5,
        "3": 2,
        "4": 4,
        "5": 6,
        "6": 4,
        "7": 2,
        "8": 5,
        miss: 0,
      },
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

const ASSESSMENT_ID = "00000000-0000-0000-0000-00000000aaaa";

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
    assessed_on: "2026-04-29",
    green_type: "outdoor",
    green_speed: 13.2,
    status: "draft",
    ui_state: "draft",
    total_score: 0,
    percentage: 0,
    grade: null,
    rubric_version_id: "r-1",
    rubric_version_label: "v1-final-2026",
    second_marker_name: null,
    notes: null,
    pdf_url: null,
    submitted_at: null,
    ...over,
  };
}

function makeDelivery(over: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: `d-${Math.random().toString(36).slice(2, 8)}`,
    assessment_id: ASSESSMENT_ID,
    section: "jacks",
    round: 1,
    delivery_index: 1,
    distance_m: 23,
    hand: null,
    outcome: { line: "on_line" },
    points: 1,
    distance_bucket: null,
    ...over,
  };
}

beforeEach(() => {
  routerPushSpy.mockReset();
  recordDeliverySpy.mockReset();
  finalizeAssessmentSpy.mockReset();
  wakeLockAcquireSpy.mockClear();
  recordDeliverySpy.mockResolvedValue({
    kind: "ok",
    deliveryId: "d-new",
    points: 1,
  });
});

describe("<CaptureWizard /> — initial render + resume", () => {
  it("with no deliveries lands on Section 1 / Round 1", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("jacks");
    expect(root?.getAttribute("data-round")).toBe("1");
    expect(container.textContent).toContain("Section 1 of 7");
    expect(container.textContent).toContain("JACKS");
  });

  it("renders the full SectionStepper (7×2 = 14 cells)", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='stepper-cell']"),
    ).toHaveLength(14);
  });

  it("seeks to next incomplete (section, round) when partial deliveries exist", () => {
    // Fully complete jacks R1 (4 distances × 8 = 32 deliveries).
    const partials: DeliveryRow[] = [];
    for (const d of [23, 26, 29, 32]) {
      for (let i = 1; i <= 8; i++) {
        partials.push(
          makeDelivery({
            section: "jacks",
            round: 1,
            delivery_index: i,
            distance_m: d,
            outcome: { line: "on_line" },
            points: 1,
          }),
        );
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={partials}
        rubric={RUBRIC_V1}
      />,
    );
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("jacks");
    expect(root?.getAttribute("data-round")).toBe("2");
  });

  it("hydrates pre-filled deliveries into the body (data-recorded='true')", () => {
    const partials: DeliveryRow[] = [
      makeDelivery({
        section: "jacks",
        round: 1,
        delivery_index: 1,
        distance_m: 23,
        outcome: { line: "on_line" },
      }),
      makeDelivery({
        section: "jacks",
        round: 1,
        delivery_index: 2,
        distance_m: 23,
        outcome: { line: "narrow" },
      }),
    ];
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={partials}
        rubric={RUBRIC_V1}
      />,
    );
    const card1 = container.querySelector(
      "[data-slot='delivery-card'][data-delivery='1']",
    );
    expect(card1?.getAttribute("data-recorded")).toBe("true");
    const card2 = container.querySelector(
      "[data-slot='delivery-card'][data-delivery='2']",
    );
    expect(card2?.getAttribute("data-recorded")).toBe("true");
    const card3 = container.querySelector(
      "[data-slot='delivery-card'][data-delivery='3']",
    );
    expect(card3?.getAttribute("data-recorded")).toBe("false");
  });
});

describe("<CaptureWizard /> — line_outcome (sections 1-2)", () => {
  it("clicking an option calls recordDelivery with line_outcome shape", async () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const btn = container.querySelector(
      "[data-slot='line-outcome-option'][data-delivery='1'][data-option='on_line']",
    ) as HTMLButtonElement;
    await act(async () => {
      btn.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(recordDeliverySpy).toHaveBeenCalledTimes(1);
    expect(recordDeliverySpy).toHaveBeenCalledWith({
      assessment_id: ASSESSMENT_ID,
      section: "jacks",
      round: 1,
      delivery_index: 1,
      distance_m: 23,
      hand: null,
      outcome: { kind: "line_outcome", line: "on_line" },
    });
  });

  it("changing distance tab swaps the visible cards (filled count per distance)", () => {
    const partials: DeliveryRow[] = [
      makeDelivery({
        section: "jacks",
        round: 1,
        delivery_index: 1,
        distance_m: 26,
        outcome: { line: "wide" },
      }),
    ];
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={partials}
        rubric={RUBRIC_V1}
      />,
    );
    // Start on 23m (default distIdx=0). Switch to 26m.
    const tab26 = container.querySelector(
      "[data-slot='distance-tab'][data-distance='26']",
    ) as HTMLButtonElement;
    fireEvent.click(tab26);
    expect(tab26.getAttribute("data-active")).toBe("true");
    const card1 = container.querySelector(
      "[data-slot='delivery-card'][data-delivery='1']",
    );
    expect(card1?.getAttribute("data-recorded")).toBe("true");
  });

  it("'Next' button is the second card when 1 is filled", () => {
    const partials: DeliveryRow[] = [
      makeDelivery({
        section: "jacks",
        round: 1,
        delivery_index: 1,
        distance_m: 23,
        outcome: { line: "on_line" },
      }),
    ];
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={partials}
        rubric={RUBRIC_V1}
      />,
    );
    const card2 = container.querySelector(
      "[data-slot='delivery-card'][data-delivery='2']",
    );
    expect(card2?.getAttribute("data-next")).toBe("true");
  });
});

describe("<CaptureWizard /> — zones_8 (sections 3-5)", () => {
  it("Drive section renders the CompassPicker + 8-bowl thumbnail grid", () => {
    const allJacksAndTargets: DeliveryRow[] = [];
    // Fill jacks + targets so resume jumps to drive R1.
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            allJacksAndTargets.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={allJacksAndTargets}
        rubric={RUBRIC_V1}
      />,
    );
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("drive");
    expect(
      container.querySelector("[data-slot='compass-picker']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll("[data-slot='bowl-thumb']"),
    ).toHaveLength(8);
  });

  it("clicking a compass wedge calls recordDelivery with zones_8 shape", async () => {
    // Start on Drive section by completing jacks + targets.
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    const target = container.querySelector(
      "[data-slot='compass-target'][data-zone='1']",
    ) as SVGPathElement;
    await act(async () => {
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(recordDeliverySpy).toHaveBeenCalledTimes(1);
    expect(recordDeliverySpy.mock.calls[0][0]).toMatchObject({
      section: "drive",
      round: 1,
      delivery_index: 1,
      distance_m: 28,
      hand: "fore",
      outcome: { kind: "zones_8", zone: 1 },
    });
  });

  it("hand toggle flips between forehand / backhand and the next save uses the new hand", async () => {
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    const backhandBtn = container.querySelector(
      "[data-slot='hand-option'][data-hand='backhand']",
    ) as HTMLButtonElement;
    fireEvent.click(backhandBtn);
    expect(backhandBtn.getAttribute("data-active")).toBe("true");
    const target = container.querySelector(
      "[data-slot='compass-target'][data-zone='5']",
    ) as SVGPathElement;
    await act(async () => {
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(recordDeliverySpy.mock.calls[0][0]).toMatchObject({
      section: "drive",
      hand: "back",
      outcome: { kind: "zones_8", zone: 5 },
    });
  });

  it("'Miss' button records zone='miss'", async () => {
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    const missBtn = container.querySelector(
      "[data-slot='miss-cta']",
    ) as HTMLButtonElement;
    await act(async () => {
      missBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(recordDeliverySpy.mock.calls[0][0]).toMatchObject({
      section: "drive",
      outcome: { kind: "zones_8", zone: "miss" },
    });
  });
});

describe("<CaptureWizard /> — on_length (sections 6-7)", () => {
  it("speedhumps_asc renders 4 ladder cards with F + B rows", () => {
    // Seed everything up to speedhumps_asc.
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    for (const sec of ["drive", "control", "trail"] as const) {
      for (const r of [1, 2] as const) {
        for (let i = 1; i <= 8; i++) {
          seed.push(
            makeDelivery({
              section: sec,
              round: r,
              delivery_index: i,
              distance_m: 28,
              outcome: { zone: 1 },
              points: 8,
            }),
          );
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("speedhumps_asc");
    expect(
      container.querySelectorAll("[data-slot='ladder-card']"),
    ).toHaveLength(4);
  });

  it("clicking 'On length' records on_length=true with hand", async () => {
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    for (const sec of ["drive", "control", "trail"] as const) {
      for (const r of [1, 2] as const) {
        for (let i = 1; i <= 8; i++) {
          seed.push(
            makeDelivery({
              section: sec,
              round: r,
              delivery_index: i,
              distance_m: 28,
              outcome: { zone: 1 },
              points: 8,
            }),
          );
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    // First ladder rung (idx=0, distance=23m), Forehand (di=0), On length.
    const onBtn = container.querySelector(
      "[data-slot='on-length-option'][data-distance='23'][data-di='0'][data-option='on']",
    ) as HTMLButtonElement;
    await act(async () => {
      onBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(recordDeliverySpy).toHaveBeenCalledTimes(1);
    expect(recordDeliverySpy.mock.calls[0][0]).toMatchObject({
      section: "speedhumps_asc",
      round: 1,
      delivery_index: 1,
      distance_m: 23,
      hand: "fore",
      outcome: { kind: "on_length", on_length: true },
    });
  });
});

describe("<CaptureWizard /> — navigation", () => {
  it("Next button advances Round 1 → Round 2 within the same section", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='next-cta']") as HTMLButtonElement,
    );
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("jacks");
    expect(root?.getAttribute("data-round")).toBe("2");
  });

  it("Previous button on Section 1 / R1 is disabled", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const prev = container.querySelector(
      "[data-slot='prev-cta']",
    ) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it("Stepper cells call jump → updates section + round + resets distance", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const cell = container.querySelector(
      "[data-slot='stepper-cell'][data-section='trail'][data-round='2']",
    ) as HTMLButtonElement;
    fireEvent.click(cell);
    const root = container.querySelector("[data-slot='capture-wizard']");
    expect(root?.getAttribute("data-section")).toBe("trail");
    expect(root?.getAttribute("data-round")).toBe("2");
  });

  it("Last step (S7 R2) shows Finalize button instead of Next", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='stepper-cell'][data-section='speedhumps_desc'][data-round='2']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='next-cta']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='finalize-cta']"),
    ).not.toBeNull();
  });
});

describe("<CaptureWizard /> — finalize", () => {
  it("Finalize is disabled when not every cell is complete", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='stepper-cell'][data-section='speedhumps_desc'][data-round='2']",
      ) as HTMLButtonElement,
    );
    const cta = container.querySelector(
      "[data-slot='finalize-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it("Finalize calls finalizeAssessment and on success pushes to results", async () => {
    finalizeAssessmentSpy.mockResolvedValueOnce({
      kind: "ok",
      total_score: 247,
      percentage: 77.2,
      grade: "silver",
    });
    // Build a fully completed assessment seed.
    const seed: DeliveryRow[] = [];
    for (const sec of ["jacks", "targets"] as const) {
      for (const r of [1, 2] as const) {
        for (const d of [23, 26, 29, 32]) {
          for (let i = 1; i <= 8; i++) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { line: "on_line" },
              }),
            );
          }
        }
      }
    }
    for (const sec of ["drive", "control", "trail"] as const) {
      for (const r of [1, 2] as const) {
        for (let i = 1; i <= 8; i++) {
          seed.push(
            makeDelivery({
              section: sec,
              round: r,
              delivery_index: i,
              distance_m: 28,
              outcome: { zone: 1 },
              points: 8,
            }),
          );
        }
      }
    }
    for (const sec of ["speedhumps_asc", "speedhumps_desc"] as const) {
      const ladder =
        sec === "speedhumps_asc" ? [23, 26, 29, 32] : [32, 29, 26, 23];
      for (const r of [1, 2] as const) {
        for (let i = 1; i <= 2; i++) {
          for (const d of ladder) {
            seed.push(
              makeDelivery({
                section: sec,
                round: r,
                delivery_index: i,
                distance_m: d,
                outcome: { on_length: true },
                points: 2,
              }),
            );
          }
        }
      }
    }
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={seed}
        rubric={RUBRIC_V1}
      />,
    );
    const cta = container.querySelector(
      "[data-slot='finalize-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    await act(async () => {
      cta.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(finalizeAssessmentSpy).toHaveBeenCalledTimes(1);
    expect(finalizeAssessmentSpy).toHaveBeenCalledWith({
      assessment_id: ASSESSMENT_ID,
    });
    await waitFor(() =>
      expect(routerPushSpy).toHaveBeenCalledWith(`/manage/t20/${ASSESSMENT_ID}`),
    );
  });
});

describe("<CaptureWizard /> — exit + save indicator", () => {
  it("Save indicator starts in 'saved' state", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    expect(
      container
        .querySelector("[data-slot='save-indicator']")
        ?.getAttribute("data-state"),
    ).toBe("saved");
  });

  it("Save indicator flips to 'failed' when recordDelivery returns error", async () => {
    recordDeliverySpy.mockResolvedValueOnce({
      kind: "error",
      error: "DB down",
    });
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const btn = container.querySelector(
      "[data-slot='line-outcome-option'][data-delivery='1'][data-option='wide']",
    ) as HTMLButtonElement;
    await act(async () => {
      btn.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() =>
      expect(
        container
          .querySelector("[data-slot='save-indicator']")
          ?.getAttribute("data-state"),
      ).toBe("failed"),
    );
  });

  it("Discard button (zero shots) + Save & pause both push back to /manage/t20", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    // 12.5-3: discard CTA goes silent-route when zero shots are
    // recorded (no AlertDialog opens). Save & pause is unchanged.
    fireEvent.click(
      container.querySelector(
        "[data-slot='capture-discard-cta']",
      ) as HTMLButtonElement,
    );
    expect(routerPushSpy).toHaveBeenLastCalledWith("/manage/t20");
    fireEvent.click(
      container.querySelector(
        "[data-slot='save-pause-cta']",
      ) as HTMLButtonElement,
    );
    expect(routerPushSpy).toHaveBeenLastCalledWith("/manage/t20");
  });
});

describe("<CaptureWizard /> — wake lock", () => {
  it("first user gesture triggers wakeLock.acquire()", () => {
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    const root = container.querySelector(
      "[data-slot='capture-wizard']",
    ) as HTMLElement;
    fireEvent.pointerDown(root);
    expect(wakeLockAcquireSpy).toHaveBeenCalled();
  });
});

describe("<CaptureWizard /> — subtotal chip", () => {
  it("displays R{round} subtotal + live %", () => {
    const partials: DeliveryRow[] = [
      makeDelivery({
        section: "jacks",
        round: 1,
        delivery_index: 1,
        distance_m: 23,
        outcome: { line: "on_line" },
        points: 1,
      }),
    ];
    const { container } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={partials}
        rubric={RUBRIC_V1}
      />,
    );
    const chip = container.querySelector("[data-slot='subtotal-chip']");
    expect(chip?.textContent).toContain("R1 subtotal");
    expect(chip?.textContent).toContain("Live %");
  });
});

describe("<CaptureWizard /> — discard-with-confirm (12.5-3)", () => {
  beforeEach(() => {
    routerPushSpy.mockReset();
    discardAssessmentSpy.mockReset();
  });

  function makeShot(over: Partial<DeliveryRow> = {}): DeliveryRow {
    return {
      id: `d-${Math.random().toString(16).slice(2)}`,
      assessment_id: ASSESSMENT_ID,
      section: "jacks",
      round: 1,
      delivery_index: 1,
      distance_m: 23,
      outcome: { line: "on_line" },
      points: 1,
      ...over,
    } as DeliveryRow;
  }

  it("does NOT open the AlertDialog when zero shots are recorded — silent route", () => {
    const { container, queryByText } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='capture-discard-cta']",
      ) as HTMLButtonElement,
    );
    expect(queryByText("Discard this assessment?")).toBeNull();
    expect(routerPushSpy).toHaveBeenLastCalledWith("/manage/t20");
    expect(discardAssessmentSpy).not.toHaveBeenCalled();
  });

  it("opens the AlertDialog when at least one shot is recorded", async () => {
    const { container, findByText, findByRole } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[
          makeShot({ delivery_index: 1, outcome: { line: "on_line" } }),
          makeShot({ delivery_index: 2, outcome: { line: "narrow" } }),
        ]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='capture-discard-cta']",
      ) as HTMLButtonElement,
    );
    expect(await findByText("Discard this assessment?")).toBeInTheDocument();
    // 2 shots, 1 section
    expect(
      await findByText(/2 shots across 1 section/i),
    ).toBeInTheDocument();
    // projection pill renders the grade label + percent
    expect(await findByRole("button", { name: /Discard assessment/i })).toBeInTheDocument();
    expect(routerPushSpy).not.toHaveBeenCalled();
    expect(discardAssessmentSpy).not.toHaveBeenCalled();
  });

  it("'Keep editing' closes the dialog without discarding or routing", async () => {
    const { container, findByRole, queryByText } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[makeShot()]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='capture-discard-cta']",
      ) as HTMLButtonElement,
    );
    const cancelBtn = await findByRole("button", { name: /Keep editing/i });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(queryByText("Discard this assessment?")).toBeNull();
    });
    expect(discardAssessmentSpy).not.toHaveBeenCalled();
    expect(routerPushSpy).not.toHaveBeenCalled();
  });

  it("'Discard assessment' calls discardAssessment then routes to /manage/t20", async () => {
    discardAssessmentSpy.mockResolvedValueOnce({ kind: "ok" });
    const { container, findByRole } = render(
      <CaptureWizard
        assessment={makeAssessment()}
        deliveries={[makeShot()]}
        rubric={RUBRIC_V1}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='capture-discard-cta']",
      ) as HTMLButtonElement,
    );
    const discardBtn = await findByRole("button", { name: /Discard assessment/i });
    await act(async () => {
      fireEvent.click(discardBtn);
    });
    await waitFor(() => {
      expect(discardAssessmentSpy).toHaveBeenCalledWith({ assessment_id: ASSESSMENT_ID });
    });
    await waitFor(() => {
      expect(routerPushSpy).toHaveBeenCalledWith("/manage/t20");
    });
  });
});
