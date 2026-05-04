import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { AdminGettingStartedChecklist } from "@/app/(club-admin)/manage/overview/_components/AdminGettingStartedChecklist";
import type { OnboardingChecklistState } from "@/app/(club-admin)/manage/overview/_data";

// Phase 13 / 13-6 / Batch C — checklist component is a pure Server
// Component over the OnboardingChecklistState struct. Tests pass the
// state directly; the data layer is exercised separately via the
// per-table queries it wraps.

const ALL_FALSE: OnboardingChecklistState = {
  hasGreensAndRinks: false,
  hasInvitedMember: false,
  hasBookingAvailability: false,
  hasFirstTournament: false,
  hasFirstMessage: false,
};

const ALL_TRUE: OnboardingChecklistState = {
  hasGreensAndRinks: true,
  hasInvitedMember: true,
  hasBookingAvailability: true,
  hasFirstTournament: true,
  hasFirstMessage: true,
};

const ITEM_LABELS: Record<keyof OnboardingChecklistState, string> = {
  hasGreensAndRinks: "Set up your club's greens and rinks",
  hasInvitedMember: "Invite at least one other member",
  hasBookingAvailability: "Set weekly booking availability",
  hasFirstTournament: "Create your first tournament",
  hasFirstMessage: "Send your first message",
};

const ITEM_HREFS: Record<keyof OnboardingChecklistState, string> = {
  hasGreensAndRinks: "/manage/greens",
  hasInvitedMember: "/manage/members",
  hasBookingAvailability: "/manage/greens",
  hasFirstTournament: "/manage/tournaments/new",
  hasFirstMessage: "/manage/messages/new",
};

function getItem(container: HTMLElement, key: keyof OnboardingChecklistState) {
  return container.querySelector<HTMLElement>(
    `[data-slot='checklist-item'][data-item-key='${key}']`,
  );
}

describe("<AdminGettingStartedChecklist /> — fresh club (0/5)", () => {
  it("renders all five items with their labels and CTA hrefs", () => {
    const { container } = render(
      <AdminGettingStartedChecklist state={ALL_FALSE} />,
    );
    const items = container.querySelectorAll(
      "[data-slot='checklist-item']",
    );
    expect(items).toHaveLength(5);

    for (const key of Object.keys(ITEM_LABELS) as Array<
      keyof OnboardingChecklistState
    >) {
      const item = getItem(container, key);
      expect(item).not.toBeNull();
      expect(item?.textContent).toContain(ITEM_LABELS[key]);
      const cta = item?.querySelector<HTMLAnchorElement>(
        "[data-slot='checklist-item-cta']",
      );
      expect(cta?.getAttribute("href")).toBe(ITEM_HREFS[key]);
    }
  });

  it("shows '0 of 5 complete' progress", () => {
    const { container } = render(
      <AdminGettingStartedChecklist state={ALL_FALSE} />,
    );
    const progress = container.querySelector(
      "[data-slot='checklist-progress']",
    );
    expect(progress?.textContent).toBe("0 of 5 complete");
  });
});

describe("<AdminGettingStartedChecklist /> — per-item checked branch", () => {
  // Five it() blocks, one per item. Each renders with only that item
  // true and asserts the item's data-checked is "true" while every
  // other item is "false". Two assertions × 5 items = 10 total.
  it.each([
    "hasGreensAndRinks",
    "hasInvitedMember",
    "hasBookingAvailability",
    "hasFirstTournament",
    "hasFirstMessage",
  ] as const)("derives checked=%s from input state", (target) => {
    const state: OnboardingChecklistState = { ...ALL_FALSE, [target]: true };
    const { container } = render(<AdminGettingStartedChecklist state={state} />);

    const targetItem = getItem(container, target);
    expect(targetItem?.dataset.checked).toBe("true");

    for (const key of Object.keys(state) as Array<
      keyof OnboardingChecklistState
    >) {
      if (key === target) continue;
      const other = getItem(container, key);
      expect(other?.dataset.checked).toBe("false");
    }
  });
});

describe("<AdminGettingStartedChecklist /> — progress + completion states", () => {
  it("reflects partial progress in the count", () => {
    const state: OnboardingChecklistState = {
      ...ALL_FALSE,
      hasGreensAndRinks: true,
      hasInvitedMember: true,
      hasBookingAvailability: true,
    };
    const { container } = render(<AdminGettingStartedChecklist state={state} />);
    const progress = container.querySelector(
      "[data-slot='checklist-progress']",
    );
    expect(progress?.textContent).toBe("3 of 5 complete");
  });

  it("collapses to the 'Setup complete' strip when all five are checked", () => {
    const { container } = render(
      <AdminGettingStartedChecklist state={ALL_TRUE} />,
    );
    const root = container.querySelector(
      "[data-slot='getting-started-checklist']",
    );
    expect(root?.getAttribute("data-state")).toBe("complete");
    expect(container.textContent).toContain("Setup complete");

    // The full card's progress strap and per-item rows are gone.
    expect(
      container.querySelector("[data-slot='checklist-progress']"),
    ).toBeNull();
    expect(
      container.querySelectorAll("[data-slot='checklist-item']"),
    ).toHaveLength(0);
  });
});
