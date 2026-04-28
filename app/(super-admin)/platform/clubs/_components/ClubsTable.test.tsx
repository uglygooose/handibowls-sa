import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClubRow } from "../_data";
import { ClubsTable } from "./ClubsTable";

// next/navigation's useRouter is now invoked from the redesigned table to
// drive row-click navigation. Mock it so jsdom-backed tests don't reach
// out to the real Next runtime.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

function makeRow(overrides: Partial<ClubRow>): ClubRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Acme Bowls",
    short_name: "ACME",
    slug: "acme",
    city: "Adelaide",
    active: true,
    theme_preset: "atomic-red",
    district_id: "00000000-0000-0000-0000-000000000000",
    district_name: "District 1",
    admin_display: "Alice Admin",
    admin_email: "alice@acme.test",
    members_count: 42,
    greens_count: 2,
    ...overrides,
  };
}

const rows: ClubRow[] = [
  makeRow({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Zephyr Club",
    city: "Sydney",
    members_count: 10,
    greens_count: 1,
    theme_preset: "ocean-blue",
  }),
  makeRow({
    id: "22222222-2222-2222-2222-222222222222",
    name: "Acme Bowls",
    city: "Adelaide",
    members_count: 42,
    greens_count: 2,
  }),
  makeRow({
    id: "33333333-3333-3333-3333-333333333333",
    name: "Marina Greens",
    city: "Perth",
    members_count: 25,
    greens_count: 3,
    active: false,
    theme_preset: "midnight",
  }),
];

function renderTable() {
  pushMock.mockClear();
  return render(
    <ClubsTable
      rows={rows}
      page={1}
      pageSize={50}
      total={rows.length}
      basePath="/platform/clubs"
    />,
  );
}

describe("ClubsTable", () => {
  it("renders every row with a click-through to the detail page", () => {
    renderTable();
    // Names are rendered inline (no anchor wrapper) per the redesigned
    // tabular layout — the whole row is clickable via router.push.
    const acmeName = screen.getByTestId("club-row-22222222-2222-2222-2222-222222222222");
    expect(acmeName).toHaveTextContent("Acme Bowls");
    expect(
      screen.getByTestId("club-row-11111111-1111-1111-1111-111111111111"),
    ).toHaveTextContent("Zephyr Club");
    expect(
      screen.getByTestId("club-row-33333333-3333-3333-3333-333333333333"),
    ).toHaveTextContent("Marina Greens");

    const acmeRow = screen.getByTestId("row-22222222-2222-2222-2222-222222222222");
    fireEvent.click(acmeRow);
    expect(pushMock).toHaveBeenCalledWith(
      "/platform/clubs/22222222-2222-2222-2222-222222222222",
    );
  });

  it("filters rows by the search input", () => {
    renderTable();
    const input = screen.getByLabelText("Search clubs");
    fireEvent.change(input, { target: { value: "Acme" } });
    expect(
      screen.queryByTestId("club-row-11111111-1111-1111-1111-111111111111"),
    ).toBeNull();
    expect(
      screen.queryByTestId("club-row-33333333-3333-3333-3333-333333333333"),
    ).toBeNull();
    expect(
      screen.getByTestId("club-row-22222222-2222-2222-2222-222222222222"),
    ).toBeInTheDocument();
  });

  it("reverses name order when the Club sort header is clicked", () => {
    renderTable();
    const initialNames = screen
      .getAllByTestId(/^club-row-/)
      .map((el) => el.textContent?.trim());
    expect(initialNames[0]).toBe("Acme Bowls");

    // Header is now a plain th (sort-on-click) rather than a nested
    // button. Click the th element directly.
    const nameHeader = screen.getByRole("columnheader", { name: /club/i });
    fireEvent.click(nameHeader);
    const reversedNames = screen
      .getAllByTestId(/^club-row-/)
      .map((el) => el.textContent?.trim());
    expect(reversedNames[0]).toBe("Zephyr Club");
  });

  it("shows an Inactive status pill for inactive clubs", () => {
    renderTable();
    // Status column now uses the StatusPill primitive — "Inactive" replaces
    // the prior "Archived" Badge label.
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    // Two of three rows are active.
    expect(screen.getAllByText("Active")).toHaveLength(2);
  });

  it("renders BowlChips for each row's theme preset (no text label per design)", () => {
    renderTable();
    // The Theme column shows a BowlChip only — the text label was dropped
    // in the redesign because the chip is the recognition cue. Verify all
    // three rows render their chips by aria-label (BowlChip uses the
    // preset's pretty label).
    expect(screen.getByLabelText("Atomic Red")).toBeInTheDocument();
    expect(screen.getByLabelText("Ocean Blue")).toBeInTheDocument();
    expect(screen.getByLabelText("Midnight")).toBeInTheDocument();
  });
});
