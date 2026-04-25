import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DistrictsTable } from "./DistrictsTable";
import type { DistrictWithCount } from "../_data";

// 20 BSA districts as seeded in migration 003. Same names + provinces; the
// fixture is a snapshot of seed data and exists so the table-render tests run
// without a database. Order is intentionally shuffled to verify alpha sort.
const FIXTURE: DistrictWithCount[] = [
  { id: "d-01", name: "Western Province", province: "Western Cape", clubs_count: 1 },
  { id: "d-02", name: "Boland", province: "Western Cape", clubs_count: 0 },
  { id: "d-03", name: "Border", province: "Eastern Cape", clubs_count: 0 },
  { id: "d-04", name: "Bowls Gauteng North", province: "Gauteng", clubs_count: 0 },
  { id: "d-05", name: "Eden", province: "Western Cape", clubs_count: 0 },
  { id: "d-06", name: "Ekurhuleni", province: "Gauteng", clubs_count: 0 },
  { id: "d-07", name: "Eastern Province", province: "Eastern Cape", clubs_count: 0 },
  { id: "d-08", name: "Johannesburg", province: "Gauteng", clubs_count: 0 },
  { id: "d-09", name: "Kingfisher", province: "KwaZulu-Natal", clubs_count: 0 },
  { id: "d-10", name: "KwaZulu-Natal Country", province: "KwaZulu-Natal", clubs_count: 0 },
  { id: "d-11", name: "Limpopo", province: "Limpopo", clubs_count: 0 },
  { id: "d-12", name: "Mpumalanga", province: "Mpumalanga", clubs_count: 0 },
  { id: "d-13", name: "Natal Inland", province: "KwaZulu-Natal", clubs_count: 0 },
  { id: "d-14", name: "North West", province: "North West", clubs_count: 0 },
  { id: "d-15", name: "Northern Cape", province: "Northern Cape", clubs_count: 0 },
  { id: "d-16", name: "Northern Free State", province: "Free State", clubs_count: 0 },
  { id: "d-17", name: "Port Natal", province: "KwaZulu-Natal", clubs_count: 0 },
  { id: "d-18", name: "Sables", province: "Mpumalanga", clubs_count: 0 },
  { id: "d-19", name: "Sedibeng", province: "Gauteng", clubs_count: 0 },
  { id: "d-20", name: "Southern Free State", province: "Free State", clubs_count: 0 },
];

describe("DistrictsTable", () => {
  function rowName(row: HTMLElement): string | null {
    return within(row).getAllByRole("cell")[0].textContent;
  }

  it("renders all 20 BSA districts", () => {
    render(<DistrictsTable rows={FIXTURE} />);
    const rows = screen.getAllByTestId(/^district-row-/);
    expect(rows).toHaveLength(20);
    // "Northern Cape" appears twice (district + province) — use getAllByText.
    expect(screen.getAllByText("Western Province").length).toBeGreaterThan(0);
    expect(screen.getByText("Bowls Gauteng North")).toBeInTheDocument();
    expect(screen.getAllByText("Northern Cape").length).toBe(2);
  });

  it("sorts by district name ascending by default", () => {
    render(<DistrictsTable rows={FIXTURE} />);
    const rows = screen.getAllByTestId(/^district-row-/);
    expect(rowName(rows[0])).toBe("Boland");
    expect(rowName(rows[rows.length - 1])).toBe("Western Province");
  });

  it("reverses district order when the District sort header is clicked", () => {
    render(<DistrictsTable rows={FIXTURE} />);
    const districtButton = screen.getByRole("button", { name: /district/i });
    fireEvent.click(districtButton);
    const rows = screen.getAllByTestId(/^district-row-/);
    expect(rowName(rows[0])).toBe("Western Province");
  });

  it("renders the club count for each district", () => {
    render(<DistrictsTable rows={FIXTURE} />);
    // Western Province seeds the demo club, so its count is 1; the rest are 0.
    const wpRow = screen.getByTestId("district-row-d-01");
    const wpCells = within(wpRow).getAllByRole("cell");
    expect(wpCells[2].textContent).toBe("1");
    const bolandRow = screen.getByTestId("district-row-d-02");
    const bolandCells = within(bolandRow).getAllByRole("cell");
    expect(bolandCells[2].textContent).toBe("0");
  });

  it("shows the row count summary", () => {
    render(<DistrictsTable rows={FIXTURE} />);
    expect(screen.getByText("20 districts")).toBeInTheDocument();
  });
});
