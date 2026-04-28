import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Mocks for next/navigation. Captures router.replace calls so we can assert
// the URL writeback shape, debounce timing, and allow-list filtering of
// junk URL params.

const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => "/manage/tournaments",
  useSearchParams: () => mockSearchParams,
}));

import { TournamentsList } from "@/app/(club-admin)/manage/tournaments/_components/TournamentsList";
import type { TournamentListRow } from "@/app/(club-admin)/manage/tournaments/_data";

const NOW = new Date("2026-04-28T10:00:00.000Z");

function makeTournament(
  i: number,
  overrides: Partial<TournamentListRow> = {},
): TournamentListRow {
  return {
    id: `t-${i}`,
    host_club_id: "host-1",
    name: `Tournament ${i}`,
    format: "pairs",
    structure: "knockout",
    scope: "club",
    status: "open",
    starts_at: NOW.toISOString(),
    ends_at: null,
    entries_close_at: null,
    max_entries: 32,
    ends_per_match: 18,
    shots_up_target: null,
    entries_count: 4,
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

describe("<TournamentsList /> URL state", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it("writes ?q= to the URL when the user types into search (debounced)", () => {
    vi.useFakeTimers();
    render(
      <TournamentsList
        tournaments={[makeTournament(1), makeTournament(2)]}
        clubName="Demo Bowls Club"
      />,
    );
    const input = screen.getByPlaceholderText(/search tournaments/i);

    fireEvent.change(input, { target: { value: "demo" } });
    // Pre-debounce: nothing pushed (the debounce timeout hasn't fired yet).
    expect(replaceMock).not.toHaveBeenCalled();

    // 200ms debounce.
    vi.advanceTimersByTime(250);
    expect(replaceMock).toHaveBeenCalled();
    const lastCall = replaceMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("/manage/tournaments?q=demo");
    expect(lastCall?.[1]).toEqual({ scroll: false });
    vi.useRealTimers();
  });

  it("writes ?status=… in stable alphabetical order for set-based filters", () => {
    vi.useFakeTimers();
    render(
      <TournamentsList
        tournaments={[makeTournament(1)]}
        clubName="Demo Bowls Club"
      />,
    );

    // Click status chips in non-alphabetical order, expect URL to be sorted.
    fireEvent.click(screen.getByRole("button", { name: /^open$/i }));
    fireEvent.click(screen.getByRole("button", { name: /draft/i }));
    vi.advanceTimersByTime(250);

    const lastUrl = replaceMock.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toContain("status=draft%2Copen");
    vi.useRealTimers();
  });

  it("does not include unchanged defaults in the URL (scope=all, view=grid)", () => {
    vi.useFakeTimers();
    render(
      <TournamentsList
        tournaments={[makeTournament(1)]}
        clubName="Demo Bowls Club"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search tournaments/i), {
      target: { value: "x" },
    });
    vi.advanceTimersByTime(250);

    const lastUrl = replaceMock.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).not.toMatch(/scope=/);
    expect(lastUrl).not.toMatch(/view=/);
    vi.useRealTimers();
  });

  it("ignores junk URL params on parse — falls back to defaults", () => {
    mockSearchParams = new URLSearchParams(
      "status=evil,draft&format=cricket,pairs&scope=galactic&view=hologram",
    );
    render(
      <TournamentsList
        tournaments={[
          makeTournament(1, { status: "draft", format: "pairs" }),
          makeTournament(2, { status: "open", format: "singles" }),
        ]}
        clubName="Demo Bowls Club"
      />,
    );

    // Allow-list keeps `draft` (status) + `pairs` (format), drops `evil` /
    // `cricket` / `galactic` / `hologram`. So row 1 (draft + pairs) shows,
    // row 2 (open + singles) is filtered out.
    expect(screen.getByText("Tournament 1")).toBeInTheDocument();
    expect(screen.queryByText("Tournament 2")).not.toBeInTheDocument();
    // View defaulted to grid (not "hologram"). Grid mode renders cards;
    // confirm no <table> is present.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the list view when ?view=list is in the URL", () => {
    mockSearchParams = new URLSearchParams("view=list");
    render(
      <TournamentsList
        tournaments={[makeTournament(1)]}
        clubName="Demo Bowls Club"
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
