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
    created_at: "2026-04-01T00:00:00Z",
    clubs: [],
  },
  {
    id: "u-admin",
    display: "Demo Admin",
    email: "admin@demo.local",
    role: "club_admin",
    profile_completed: true,
    created_at: "2026-04-02T00:00:00Z",
    clubs: [{ id: "c-demo", name: "Demo Bowls Club" }],
  },
  {
    id: "u-player",
    display: "Demo Player",
    email: "player@demo.local",
    role: "player",
    profile_completed: false,
    created_at: "2026-04-03T00:00:00Z",
    clubs: [
      { id: "c-demo", name: "Demo Bowls Club" },
      { id: "c-other", name: "Other Bowls Club" },
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

  it("renders one row per user with name, email, role, club count, and created", () => {
    renderTable();
    const rows = screen.getAllByTestId(/^user-row-/);
    expect(rows).toHaveLength(3);

    // Name links
    expect(screen.getByRole("link", { name: "Super Admin" })).toHaveAttribute(
      "href",
      "/platform/users/u-super",
    );
    expect(screen.getByRole("link", { name: "Demo Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demo Player" })).toBeInTheDocument();

    // Email
    expect(screen.getByText("super@handibowls.local")).toBeInTheDocument();
    expect(screen.getByText("admin@demo.local")).toBeInTheDocument();

    // Role labels
    expect(screen.getByText("Super admin")).toBeInTheDocument();
    expect(screen.getByText("Club admin")).toBeInTheDocument();
    expect(screen.getByText("Player")).toBeInTheDocument();

    // Created (ISO date trimmed)
    expect(screen.getByText("2026-04-01")).toBeInTheDocument();
    expect(screen.getByText("2026-04-03")).toBeInTheDocument();
  });

  it("renders the club count as a tooltip trigger; em-dash when no clubs", () => {
    renderTable();
    // Super admin has no clubs → em-dash in the Clubs column.
    const superRow = screen.getByTestId("user-row-u-super");
    const superCells = within(superRow).getAllByRole("cell");
    expect(superCells[3].textContent).toBe("—");

    // Demo admin → 1, Demo player → 2.
    expect(screen.getByTestId("user-clubs-u-admin").textContent).toBe("1");
    expect(screen.getByTestId("user-clubs-u-player").textContent).toBe("2");
  });

  it("renders only the rows it is given — i.e. acts as the read-only render of the server-side filter", () => {
    // Simulate the server having filtered down to only club-name matches.
    const filtered = FIXTURE.filter((u) =>
      u.clubs.some((c) => c.name.toLowerCase().includes("demo")) ||
      u.display.toLowerCase().includes("demo") ||
      (u.email ?? "").toLowerCase().includes("demo"),
    );
    renderTable(filtered, "demo");

    expect(screen.queryByRole("link", { name: "Super Admin" })).toBeNull();
    expect(screen.getByRole("link", { name: "Demo Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demo Player" })).toBeInTheDocument();
  });

  it("filters by name field — display name match only", () => {
    // Simulate server-side first_name match: only Demo Admin returned.
    const matched = FIXTURE.filter((u) => u.display === "Demo Admin");
    renderTable(matched, "Demo Admin");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Demo Admin" })).toBeInTheDocument();
  });

  it("filters by email field — email-only match", () => {
    const matched = FIXTURE.filter((u) =>
      (u.email ?? "").includes("super@handibowls"),
    );
    renderTable(matched, "super@handibowls");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Super Admin" })).toBeInTheDocument();
  });

  it("filters by club field — only users with a matching club", () => {
    const matched = FIXTURE.filter((u) =>
      u.clubs.some((c) => c.name.toLowerCase().includes("other")),
    );
    renderTable(matched, "Other");
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Demo Player" })).toBeInTheDocument();
  });

  it("renders an empty-state message when no rows match the active query", () => {
    renderTable([], "zzz");
    expect(screen.getByText(/No users match/)).toBeInTheDocument();
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
  });
});
