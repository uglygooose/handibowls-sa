import { describe, expect, it, vi, beforeEach } from "vitest";

// Phase 8d follow-up — Finding 13 helper unit test.
//
// `revalidateMatchSurfaces` collapses the 5–6 `revalidatePath` calls
// every match-mutating action used to need into a single utility.
// Future drift to player surface paths is one diff. These cases pin
// the path set so a missing/extra revalidation surfaces locally.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const cache = await import("next/cache");
const revalidatePathSpy = vi.mocked(cache.revalidatePath);

const mod = await import("@/lib/tournaments/revalidate");

beforeEach(() => {
  revalidatePathSpy.mockClear();
});

describe("revalidateMatchSurfaces", () => {
  it("hits admin + player tournament-level surfaces when called without a matchId", () => {
    mod.revalidateMatchSurfaces("t-1");
    const calls = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      "/manage/tournaments/t-1",
      "/play",
      "/tournaments",
      "/tournaments/t-1",
      "/me",
    ]);
    // Every call must specify "page" target (not "layout") — the
    // surfaces are leaf pages, not group layouts.
    for (const call of revalidatePathSpy.mock.calls) {
      expect(call[1]).toBe("page");
    }
  });

  it("additionally revalidates the per-match scorecard when matchId is provided", () => {
    mod.revalidateMatchSurfaces("t-1", "m-9");
    const calls = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      "/manage/tournaments/t-1",
      "/play",
      "/tournaments",
      "/tournaments/t-1",
      "/tournaments/t-1/matches/m-9",
      "/me",
    ]);
  });

  it("treats null matchId the same as omitted (no per-match path)", () => {
    mod.revalidateMatchSurfaces("t-2", null);
    const calls = revalidatePathSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("/tournaments/t-2/matches/null");
    expect(calls).toEqual([
      "/manage/tournaments/t-2",
      "/play",
      "/tournaments",
      "/tournaments/t-2",
      "/me",
    ]);
  });
});
