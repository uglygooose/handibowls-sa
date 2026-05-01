import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const orderMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: orderMock,
            }),
          }),
        }),
      }),
    }),
}));

vi.mock("@/lib/auth/role", () => ({
  getAuthContext: () => Promise.resolve({ userId: "p1", role: "player" }),
}));

vi.mock("@/lib/auth/memberships", () => ({
  getCurrentMemberships: () => Promise.resolve([]),
}));

import { getCurrentPlayerT20Profile } from "@/app/(player)/(gated)/t20/_data";

// Phase 12.5 / 12.5-4 hotfix — pin the contract change that history
// includes the latest assessment (previously rows.slice(1)). The
// latest still surfaces in `latest`; the list is the tap target into
// the detail view at /t20/[assessmentId] for players with exactly one
// submitted assessment.

describe("getCurrentPlayerT20Profile — 12.5-4 hotfix contract", () => {
  it("history includes the latest assessment, not rows.slice(1)", async () => {
    orderMock.mockResolvedValueOnce({
      data: [
        {
          id: "a1",
          club_id: "c1",
          assessed_on: "2026-04-30",
          percentage: 85,
          total_score: 17,
          grade: "gold",
          club: { name: "Demo Club", theme_preset: "atomic-red" },
          assessor: null,
          rubric: { version: "1.0" },
        },
        {
          id: "a2",
          club_id: "c1",
          assessed_on: "2026-03-15",
          percentage: 65,
          total_score: 13,
          grade: "silver",
          club: { name: "Demo Club", theme_preset: "atomic-red" },
          assessor: null,
          rubric: { version: "1.0" },
        },
      ],
      error: null,
    });

    const profile = await getCurrentPlayerT20Profile();

    // Hero still resolves to the newest row.
    expect(profile.latest?.id).toBe("a1");
    // History now includes the latest as the top row — same id as
    // `latest`, so 1-assessment players have a tap target into the
    // /t20/[assessmentId] detail view.
    expect(profile.history.map((a) => a.id)).toEqual(["a1", "a2"]);
  });
});
