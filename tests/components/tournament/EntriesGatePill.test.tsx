import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  EntriesGatePill,
  deriveEntriesGate,
} from "@/components/tournament/EntriesGatePill";

// The schema has no flat `entries_closed` boolean. EntriesGatePill / its pure
// helper compose status × entries_close_at. Locking these branches here keeps
// the list-page StatusPill, detail-hero, command-palette, and any future
// surfaces in sync.

const NOW = new Date("2026-04-28T10:00:00.000Z");

describe("deriveEntriesGate", () => {
  it("returns 'open' when status='open' and entries_close_at is null", () => {
    expect(
      deriveEntriesGate({ status: "open", entries_close_at: null, now: NOW }),
    ).toBe("open");
  });

  it("returns 'open' when entries_close_at is in the future", () => {
    expect(
      deriveEntriesGate({
        status: "open",
        entries_close_at: "2026-05-01T10:00:00.000Z",
        now: NOW,
      }),
    ).toBe("open");
  });

  it("returns 'closed' when status='open' but entries_close_at has passed", () => {
    expect(
      deriveEntriesGate({
        status: "open",
        entries_close_at: "2026-04-27T10:00:00.000Z",
        now: NOW,
      }),
    ).toBe("closed");
  });

  it("returns 'closed' at the exact close instant (boundary is inclusive)", () => {
    expect(
      deriveEntriesGate({
        status: "open",
        entries_close_at: NOW.toISOString(),
        now: NOW,
      }),
    ).toBe("closed");
  });

  it.each([
    ["draft", "draft"],
    ["in_progress", "in_progress"],
    ["completed", "completed"],
    ["cancelled", "cancelled"],
  ])("passes through status=%s as %s", (status, expected) => {
    expect(
      deriveEntriesGate({
        status,
        entries_close_at: null,
        now: NOW,
      }),
    ).toBe(expected);
  });

  it("falls back to 'closed' for an unknown status string", () => {
    expect(
      deriveEntriesGate({
        status: "archived",
        entries_close_at: null,
        now: NOW,
      }),
    ).toBe("closed");
  });
});

describe("<EntriesGatePill />", () => {
  it("renders the open label and tags the data-state", () => {
    render(
      <EntriesGatePill status="open" entries_close_at={null} now={NOW} />,
    );
    const pill = screen.getByText("Entries open");
    expect(pill).toBeInTheDocument();
    expect(pill.closest("[data-slot='entries-gate-pill']")).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("renders the closed label when the close window has elapsed", () => {
    render(
      <EntriesGatePill
        status="open"
        entries_close_at="2026-04-27T10:00:00.000Z"
        now={NOW}
      />,
    );
    expect(screen.getByText("Entries closed")).toBeInTheDocument();
  });

  it("respects an explicit `label` override (design-spec contexts)", () => {
    render(
      <EntriesGatePill
        status="open"
        entries_close_at={null}
        label="Entries open · 12 days"
        now={NOW}
      />,
    );
    expect(screen.getByText("Entries open · 12 days")).toBeInTheDocument();
  });
});
