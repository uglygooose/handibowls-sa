import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { AuditLogPanel } from "@/app/(club-admin)/manage/overview/_components/AuditLogPanel";
import type { AuditLogRow } from "@/app/(club-admin)/manage/overview/_data";

// Phase 9-3 — read-only audit log panel. Server-rendered (no client
// state, no actions), so tests are purely structural.

function makeRow(over: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "a1",
    table_name: "bookings",
    row_id: "44444444-4444-4444-8444-444444444444",
    action: "force_cancel_booking",
    reason: "Member contacted secretary",
    performed_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    performer_name: "Bridget Boss",
    performer_email: "bridget@example.com",
    ...over,
  };
}

describe("<AuditLogPanel /> — render", () => {
  it("renders the panel root + header copy", () => {
    const { container } = render(<AuditLogPanel rows={[]} />);
    const root = container.querySelector("[data-slot='audit-log-panel']");
    expect(root).not.toBeNull();
    expect(container.textContent).toContain("Recent admin actions");
  });

  it("shows '0 entries' on the count pill when rows is empty", () => {
    const { container } = render(<AuditLogPanel rows={[]} />);
    const count = container.querySelector("[data-slot='audit-row-count']");
    expect(count?.textContent).toContain("0 entries");
  });

  it("shows '1 entry' (singular) when one row", () => {
    const { container } = render(<AuditLogPanel rows={[makeRow()]} />);
    const count = container.querySelector("[data-slot='audit-row-count']");
    expect(count?.textContent).toContain("1 entry");
  });

  it("shows pluralised '3 entries' for multiple rows", () => {
    const { container } = render(
      <AuditLogPanel
        rows={[
          makeRow({ id: "a1" }),
          makeRow({ id: "a2" }),
          makeRow({ id: "a3" }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='audit-row-count']")?.textContent,
    ).toContain("3 entries");
  });
});

describe("<AuditLogPanel /> — empty state", () => {
  it("rows=[] + errored=false → renders the empty placeholder", () => {
    const { container } = render(<AuditLogPanel rows={[]} />);
    expect(
      container.querySelector("[data-slot='audit-log-empty']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='audit-log-error']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='audit-log-list']"),
    ).toBeNull();
  });

  it("errored=true → renders the error placeholder, NOT the empty one", () => {
    const { container } = render(<AuditLogPanel rows={[]} errored />);
    expect(
      container.querySelector("[data-slot='audit-log-error']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='audit-log-empty']"),
    ).toBeNull();
  });
});

describe("<AuditLogPanel /> — populated rows", () => {
  it("renders one row per audit entry", () => {
    const rows = [
      makeRow({ id: "a1" }),
      makeRow({ id: "a2", performer_name: "Ada Bowls" }),
    ];
    const { container } = render(<AuditLogPanel rows={rows} />);
    const items = container.querySelectorAll("[data-slot='audit-log-row']");
    expect(items).toHaveLength(2);
    expect(container.textContent).toContain("Bridget Boss");
    expect(container.textContent).toContain("Ada Bowls");
  });

  it("force_cancel_booking action gets the danger-tinted pill class", () => {
    const { container } = render(
      <AuditLogPanel rows={[makeRow()]} />,
    );
    const pill = container.querySelector("[data-slot='audit-action-pill']");
    // Phase 13 / 13-1 / commit 12: tinted-pill foreground swept to
    // theme-invariant text-ink to clear axe-serious contrast. The
    // danger semantic now travels on the bg class only — pin the bg
    // (the visual cue), not the text colour.
    expect(pill?.className).toContain("bg-danger-500/12");
    expect(pill?.textContent?.toLowerCase()).toContain("force-cancel");
  });

  it("renders the row reason inline when present", () => {
    const { container } = render(
      <AuditLogPanel
        rows={[makeRow({ reason: "Resurfacing — admin override" })]}
      />,
    );
    expect(container.textContent).toContain("Resurfacing — admin override");
  });

  it("falls back to 'Unknown admin' when performer_name is null", () => {
    const { container } = render(
      <AuditLogPanel
        rows={[makeRow({ performer_name: null, performer_email: null })]}
      />,
    );
    const performer = container.querySelector("[data-slot='performer-name']");
    expect(performer?.textContent).toContain("Unknown admin");
  });

  it("renders truncated row_id for the audited booking (first 8 chars)", () => {
    const { container } = render(
      <AuditLogPanel
        rows={[
          makeRow({ row_id: "abcdef12-3456-7890-abcd-ef1234567890" }),
        ]}
      />,
    );
    const row = container.querySelector("[data-slot='audit-log-row']");
    expect(row?.textContent).toContain("abcdef12");
    // Full UUID should NOT render — keep the row compact.
    expect(row?.textContent).not.toContain("ef1234567890");
  });

  it("emits a <time> element with dateTime attr matching the ISO timestamp", () => {
    const isoTime = "2026-04-29T10:00:00.000Z";
    const { container } = render(
      <AuditLogPanel rows={[makeRow({ performed_at: isoTime })]} />,
    );
    const time = container.querySelector(
      "[data-slot='audit-time']",
    ) as HTMLTimeElement;
    expect(time.getAttribute("datetime")).toBe(isoTime);
  });

  it("unknown action falls back to the raw action string + neutral pill", () => {
    const { container } = render(
      <AuditLogPanel
        rows={[makeRow({ action: "future_action_kind" })]}
      />,
    );
    const pill = container.querySelector("[data-slot='audit-action-pill']");
    expect(pill?.textContent).toContain("future_action_kind");
    // Neutral pill = NOT the danger-tinted bg.
    expect(pill?.className).not.toContain("bg-danger-500/12");
  });
});

describe("<AuditLogPanel /> — data attributes for row identity", () => {
  it("each row carries data-row-id + data-action for downstream selectors", () => {
    const { container } = render(
      <AuditLogPanel rows={[makeRow({ id: "abc" })]} />,
    );
    const row = container.querySelector("[data-slot='audit-log-row']");
    expect(row?.getAttribute("data-row-id")).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
    expect(row?.getAttribute("data-action")).toBe("force_cancel_booking");
  });
});
