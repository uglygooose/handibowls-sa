import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRow } from "../_data";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { UsersSearchBar } from "./UsersSearchBar";
import { UsersTable } from "./UsersTable";

const FIXTURE: UserRow[] = [
  {
    id: "u-super",
    display: "Super Admin",
    email: "super@handibowls.local",
    role: "super_admin",
    profile_completed: true,
    bsa_number: null,
    created_at: "2026-04-01T00:00:00Z",
    clubs: [],
  },
  {
    id: "u-admin",
    display: "Demo Admin",
    email: "admin@demo.local",
    role: "club_admin",
    profile_completed: true,
    bsa_number: "NOR-0001",
    created_at: "2026-04-02T00:00:00Z",
    clubs: [{ id: "c-demo", name: "Demo Bowls Club", short_name: "DEMO" }],
  },
  {
    id: "u-player",
    display: "Demo Player",
    email: "player@demo.local",
    role: "player",
    profile_completed: false,
    bsa_number: "WP-2019",
    created_at: "2026-04-03T00:00:00Z",
    clubs: [
      { id: "c-demo", name: "Demo Bowls Club", short_name: "DEMO" },
      { id: "c-other", name: "Other Bowls Club", short_name: "OTH" },
    ],
  },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  replace.mockReset();
});

describe("UsersSearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces 300ms before pushing the q= param", () => {
    render(<UsersSearchBar initialQuery="" basePath="/platform/users" />);
    const input = screen.getByTestId("users-search-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "demo" } });
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replace).toHaveBeenCalledWith("/platform/users?q=demo");
  });

  it("clears the q= param when the input is emptied", () => {
    render(<UsersSearchBar initialQuery="demo" basePath="/platform/users" />);
    const input = screen.getByTestId("users-search-input") as HTMLInputElement;
    expect(input.value).toBe("demo");

    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenLastCalledWith("/platform/users");
  });

  it("collapses repeated typing into a single push", () => {
    render(<UsersSearchBar initialQuery="" basePath="/platform/users" />);
    const input = screen.getByTestId("users-search-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "d" } });
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "de" } });
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "demo" } });
    act(() => void vi.advanceTimersByTime(300));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/platform/users?q=demo");
  });
});

describe("UsersTable", () => {
  function renderTable(rows: UserRow[] = FIXTURE, q = "") {
    return render(
      <UsersTable
        rows={rows}
        page={1}
        pageSize={50}
        total={rows.length}
        q={q}
        basePath="/platform/users"
      />,
    );
  }

  it("renders one row per user with name link, email, role, club chips, BSA #, and joined date", () => {
    renderTable();
    const rows = screen.getAllByTestId(/^user-row-/);
    expect(rows).toHaveLength(3);

    // Name links — the redesigned cell wraps avatar + display name in a
    // single Link to the detail page.
    expect(screen.getByTestId("user-link-u-super")).toHaveAttribute(
      "href",
      "/platform/users/u-super",
    );
    expect(screen.getByTestId("user-link-u-admin")).toHaveTextContent("Demo Admin");
    expect(screen.getByTestId("user-link-u-player")).toHaveTextContent("Demo Player");

    // Email
    expect(screen.getByText("super@handibowls.local")).toBeInTheDocument();
    expect(screen.getByText("admin@demo.local")).toBeInTheDocument();

    // RoleBadge labels
    expect(screen.getByText("Super admin")).toBeInTheDocument();
    expect(screen.getByText("Club admin")).toBeInTheDocument();
    expect(screen.getByText("Player")).toBeInTheDocument();

    // BSA # column
    expect(screen.getByText("NOR-0001")).toBeInTheDocument();
    expect(screen.getByText("WP-2019")).toBeInTheDocument();

    // Joined date — formatted as "DD Mon YYYY" (en-ZA).
    expect(screen.getByText("01 Apr 2026")).toBeInTheDocument();
    expect(screen.getByText("03 Apr 2026")).toBeInTheDocument();
  });

  it("renders ClubChips for each membership; em-dash when no clubs", () => {
    renderTable();
    // Super admin has no clubs and no BSA #, so two em-dashes appear in
    // the row — assert via the row scope and getAllByText.
    const superRow = screen.getByTestId("user-row-u-super");
    expect(within(superRow).getAllByText("—").length).toBeGreaterThanOrEqual(1);

    // Single-club admin → one chip with the club's short_name.
    const adminClubsCell = screen.getByTestId("user-clubs-u-admin");
    expect(within(adminClubsCell).getByText("DEMO")).toBeInTheDocument();

    // Two-club player → two chips.
    const playerClubsCell = screen.getByTestId("user-clubs-u-player");
    expect(within(playerClubsCell).getByText("DEMO")).toBeInTheDocument();
    expect(within(playerClubsCell).getByText("OTH")).toBeInTheDocument();
  });

  it("renders only the rows it is given — i.e. acts as the read-only render of the server-side filter", () => {
    const filtered = FIXTURE.filter((u) =>
      u.clubs.some((c) => c.name.toLowerCase().includes("demo")) ||
      u.display.toLowerCase().includes("demo") ||
      (u.email ?? "").toLowerCase().includes("demo"),
    );
    renderTable(filtered, "demo");

    expect(screen.queryByTestId("user-link-u-super")).toBeNull();
    expect(screen.getByTestId("user-link-u-admin")).toBeInTheDocument();
    expect(screen.getByTestId("user-link-u-player")).toBeInTheDocument();
  });

  it("filters by name field — display name match only", () => {
    const matched = FIXTURE.filter((u) => u.display === "Demo Admin");
    renderTable(matched, "Demo Admin");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByTestId("user-link-u-admin")).toBeInTheDocument();
  });

  it("filters by email field — email-only match", () => {
    const matched = FIXTURE.filter((u) =>
      (u.email ?? "").includes("super@handibowls"),
    );
    renderTable(matched, "super@handibowls");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByTestId("user-link-u-super")).toBeInTheDocument();
  });

  it("filters by club field — only users with a matching club", () => {
    const matched = FIXTURE.filter((u) =>
      u.clubs.some((c) => c.name.toLowerCase().includes("other")),
    );
    renderTable(matched, "Other");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByTestId("user-link-u-player")).toBeInTheDocument();
  });

  it("renders an EmptyState when no rows match the active query", () => {
    renderTable([], "zzz");
    expect(screen.getByText("Nothing matches.")).toBeInTheDocument();
    // EmptyState description quotes the search hint, no longer the literal q.
    expect(
      screen.getByText(/Try a different name, email, or BSA number/),
    ).toBeInTheDocument();
  });

  it("does NOT render an impersonation control (Q11 v2-deferred lockout)", () => {
    renderTable();
    expect(screen.queryByText(/impersonate/i)).toBeNull();
    expect(screen.queryByText(/view as/i)).toBeNull();
    expect(screen.queryByText(/act as/i)).toBeNull();
  });
});
