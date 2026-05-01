import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import ClubAdminLoading from "@/app/(club-admin)/loading";
import SuperAdminLoading from "@/app/(super-admin)/loading";
import PlayerLoading from "@/app/(player)/loading";
import AuthLoading from "@/app/(auth)/loading";

// Phase 12.5 / 12.5-6 (K / `loading-spinner-only`) — pin the
// role-level loading.tsx Skeleton trees match the page shape they
// stand in for. Pre-12.5-6 these were generic 2-3 rectangles —
// post-12.5-6 they mirror the dominant page shape per role group
// so hydration replaces a structurally-similar tree (less layout
// shift, less "everything moves" flash).

afterEach(cleanup);

describe("Role-level loading.tsx Skeleton trees (12.5-6 K)", () => {
  it("club-admin loading renders an AdminPageHero shell + a 3-row list (matches list-page shape)", () => {
    const { container } = render(<ClubAdminLoading />);
    const hero = container.querySelector("[data-slot='loading-admin-page-hero']");
    expect(hero).not.toBeNull();
    // Hero card matches the design-source `.page-hero` chrome —
    // rounded-[18px] + bg-bone + min-h-[156px] inside.
    expect(hero?.className).toContain("rounded-[18px]");
    expect(hero?.className).toContain("bg-bone");
    // 3 list-row skeletons match the list-page shape.
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("super-admin loading renders the same hero + list shape as club-admin (platform surfaces are list-shaped)", () => {
    const { container } = render(<SuperAdminLoading />);
    expect(
      container.querySelector("[data-slot='loading-admin-page-hero']"),
    ).not.toBeNull();
  });

  it("player loading renders a mobile-shape skeleton (no AdminPageHero — player surfaces don't use it)", () => {
    const { container } = render(<PlayerLoading />);
    expect(
      container.querySelector("[data-slot='loading-admin-page-hero']"),
    ).toBeNull();
    // Wrap is the max-w-3xl mobile container, not max-w-7xl.
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("max-w-3xl");
  });

  it("auth loading renders form-row skeletons (auth surfaces are form-shaped)", () => {
    const { container } = render(<AuthLoading />);
    // Auth loading retains the form-fields shape: 4 stacked
    // skeletons (label + 2 inputs + button-sized).
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
    // No AdminPageHero shell — auth surfaces are stand-alone.
    expect(
      container.querySelector("[data-slot='loading-admin-page-hero']"),
    ).toBeNull();
  });
});
