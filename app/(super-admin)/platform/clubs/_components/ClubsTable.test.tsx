import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ClubsTable } from "./ClubsTable";
import type { ClubRow } from "../_data";

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
  it("renders every row's name as a link to the detail page", () => {
    renderTable();
    const acmeLink = screen.getByRole("link", { name: "Acme Bowls" });
    expect(acmeLink).toHaveAttribute(
      "href",
      "/platform/clubs/22222222-2222-2222-2222-222222222222",
    );
    expect(screen.getByRole("link", { name: "Zephyr Club" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marina Greens" })).toBeInTheDocument();
  });

  it("filters rows by the global filter input", () => {
    renderTable();
    const input = screen.getByLabelText("Filter clubs");
    fireEvent.change(input, { target: { value: "Acme" } });
    expect(screen.queryByRole("link", { name: "Zephyr Club" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Marina Greens" })).toBeNull();
    expect(screen.getByRole("link", { name: "Acme Bowls" })).toBeInTheDocument();
  });

  it("reverses name order when the Name sort header is clicked", () => {
    renderTable();
    const initialLinks = screen
      .getAllByRole("link")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    expect(initialLinks[0]).toBe("Acme Bowls");

    const nameButton = screen.getByRole("button", { name: /name/i });
    fireEvent.click(nameButton);
    const reversedLinks = screen
      .getAllByRole("link")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    expect(reversedLinks[0]).toBe("Zephyr Club");
  });

  it("shows an Archived badge for inactive clubs", () => {
    renderTable();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders the theme preset label next to the chip", () => {
    renderTable();
    expect(screen.getByText("ocean-blue")).toBeInTheDocument();
    expect(screen.getByText("midnight")).toBeInTheDocument();
    expect(screen.getAllByText("atomic-red").length).toBeGreaterThan(0);
  });
});
