import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  StatusPill,
  deriveDisplayState,
} from "@/app/(club-admin)/manage/tournaments/_components/StatusPill";

// 5 DB enum values × entries_close_at composition → 6 display states
// (open splits into "open" / "entries_closed").

const NOW = new Date("2026-04-28T10:00:00.000Z");

describe("deriveDisplayState", () => {
  it.each([
    ["draft", null, "draft"],
    ["in_progress", null, "in_progress"],
    ["completed", null, "completed"],
    ["cancelled", null, "cancelled"],
  ] as const)(
    "passes through status=%s as %s",
    (status, entriesCloseAt, expected) => {
      expect(
        deriveDisplayState(
          { status, entries_close_at: entriesCloseAt },
          NOW,
        ),
      ).toBe(expected);
    },
  );

  it("renders 'open' when status=open and the close window is open", () => {
    expect(
      deriveDisplayState(
        { status: "open", entries_close_at: null },
        NOW,
      ),
    ).toBe("open");
  });

  it("renders 'entries_closed' when status=open but the close window has passed", () => {
    expect(
      deriveDisplayState(
        { status: "open", entries_close_at: "2026-04-27T10:00:00.000Z" },
        NOW,
      ),
    ).toBe("entries_closed");
  });

  it("renders 'open' when entries_close_at is in the future", () => {
    expect(
      deriveDisplayState(
        { status: "open", entries_close_at: "2026-05-01T10:00:00.000Z" },
        NOW,
      ),
    ).toBe("open");
  });
});

describe("<StatusPill />", () => {
  it("displays the human label and tags the data-state", () => {
    render(
      <StatusPill
        tournament={{ status: "open", entries_close_at: null }}
        now={NOW}
      />,
    );
    const pill = screen.getByText("Open");
    expect(pill).toHaveAttribute("data-state", "open");
  });

  it("renders 'Entries Closed' for status=open past the window", () => {
    render(
      <StatusPill
        tournament={{
          status: "open",
          entries_close_at: "2026-04-27T10:00:00.000Z",
        }}
        now={NOW}
      />,
    );
    expect(screen.getByText("Entries Closed")).toBeInTheDocument();
  });

  it("renders 'In Progress' for status=in_progress", () => {
    render(
      <StatusPill
        tournament={{ status: "in_progress", entries_close_at: null }}
        now={NOW}
      />,
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
