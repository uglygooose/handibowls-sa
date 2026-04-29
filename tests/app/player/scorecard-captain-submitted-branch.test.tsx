import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// `Scorecard.tsx` imports a type from `_data.ts`, which is `"server-only"`.
// Vitest's transpile resolves the import even though only types are
// referenced. Mock the module so the test environment loads cleanly.
vi.mock("server-only", () => ({}));

import type { ScorecardMatch } from "@/app/(player)/(gated)/tournaments/[id]/matches/[matchId]/_data";
import { CaptainSubmittedBranch } from "@/app/(player)/(gated)/tournaments/[id]/matches/[matchId]/_components/Scorecard";

// Phase 8d follow-up — Migration 029 closes Diagnostic 14 (captain
// self-confirm). These tests pin the branching contract so a
// regression to the pre-029 "render OpponentConfirmationCard for
// both teams" shape gets caught locally.

const baseMatch: ScorecardMatch = {
  match_id: "m-1",
  match_no: 1,
  round: 1,
  status: "in_progress",
  finalized_by_admin: false,
  submission_status: "captain_submitted",
  captain_submitted_at: new Date().toISOString(),
  opponent_confirmed_at: null,
  submitted_by_team_id: null,
  home_team_id: "team-home",
  away_team_id: "team-away",
  home_team_name: "James Thomas",
  away_team_name: "Sam Visser",
  home_shots: 21,
  away_shots: 14,
  rink: "Main Green 3",
  player_is_home: true,
  tournament: {
    id: "t-1",
    name: "Test Cup",
    format: "singles",
    structure: "knockout",
    handicap_rule: "scratch",
    shots_up_target: 21,
    ends_per_match: null,
    host_club_theme: "atomic-red",
  },
  home_handicap_shots: 0,
  away_handicap_shots: 0,
};

const baseProps = {
  match: baseMatch,
  localHomeTotal: 21,
  localAwayTotal: 14,
  onConfirm: () => {},
  onDispute: () => {},
  pending: false,
};

describe("<CaptainSubmittedBranch /> — passive vs active branching", () => {
  it("caller is the submitter (player_is_home + submitted_by_team_id == home) → passive banner, no confirm button", () => {
    const match: ScorecardMatch = {
      ...baseMatch,
      player_is_home: true,
      submitted_by_team_id: "team-home",
    };
    const { container } = render(
      <CaptainSubmittedBranch {...baseProps} match={match} />,
    );
    expect(
      container.querySelector("[data-slot='awaiting-opponent-confirm']"),
    ).not.toBeNull();
    expect(screen.getByText(/score submitted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/awaiting opponent confirmation/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm result/i }),
    ).toBeNull();
  });

  it("caller is the opponent (player_is_home + submitted_by_team_id == away) → active OpponentConfirmationCard with Confirm + Dispute", () => {
    const match: ScorecardMatch = {
      ...baseMatch,
      player_is_home: true,
      submitted_by_team_id: "team-away",
    };
    render(<CaptainSubmittedBranch {...baseProps} match={match} />);
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dispute/i }),
    ).toBeInTheDocument();
  });

  it("submitted_by_team_id null (legacy / admin-override) → active card on both sides as fallback", () => {
    const match: ScorecardMatch = {
      ...baseMatch,
      submitted_by_team_id: null,
    };
    const { container, rerender } = render(
      <CaptainSubmittedBranch {...baseProps} match={{ ...match, player_is_home: true }} />,
    );
    expect(
      container.querySelector("[data-slot='awaiting-opponent-confirm']"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();

    rerender(
      <CaptainSubmittedBranch {...baseProps} match={{ ...match, player_is_home: false }} />,
    );
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });

  it("away-side caller submitted (player_is_home false + submitted_by_team_id == away) → passive banner", () => {
    const match: ScorecardMatch = {
      ...baseMatch,
      player_is_home: false,
      submitted_by_team_id: "team-away",
    };
    const { container } = render(
      <CaptainSubmittedBranch {...baseProps} match={match} />,
    );
    expect(
      container.querySelector("[data-slot='awaiting-opponent-confirm']"),
    ).not.toBeNull();
  });

  it("away-side caller is opponent (player_is_home false + submitted_by_team_id == home) → active card", () => {
    const match: ScorecardMatch = {
      ...baseMatch,
      player_is_home: false,
      submitted_by_team_id: "team-home",
    };
    render(<CaptainSubmittedBranch {...baseProps} match={match} />);
    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
  });
});
