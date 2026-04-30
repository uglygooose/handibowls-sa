import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { AuditTab } from "@/app/(club-admin)/manage/tournaments/[id]/_components/tabs/AuditTab";

// Phase 12 / 12-2 — AuditTab empty-state copy fix (closes drift R3a /
// L61 split). The original copy referenced "audit_log table lands in
// Phase 12" — stale lie since migration 031 (Phase 9-prep) shipped
// the table. Replacement copy is neutral (no phase reference) and
// makes the empty-state self-explanatory.
//
// The full retrofit (helper extension + tournament admin RPCs +
// tab wire) is a Phase 13 task tracked separately. This test pins
// the v1 copy.

describe("<AuditTab /> empty-state copy (12-2)", () => {
  it("does NOT reference 'Phase 12' or 'audit_log table lands' anywhere in the rendered text", () => {
    const { container } = render(<AuditTab />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/audit_log table lands/i);
    expect(text).not.toMatch(/Phase 12/);
  });

  it("renders a neutral 'no audit events recorded yet' headline", () => {
    const { container } = render(<AuditTab />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/No audit events recorded for this tournament yet/i);
  });

  it("explains what kinds of events will surface here", () => {
    const { container } = render(<AuditTab />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/status changes/i);
    expect(text).toMatch(/score edits/i);
    expect(text).toMatch(/round advances/i);
    expect(text).toMatch(/withdrawals/i);
  });

  it("preserves the filter chip strip + the disabled 'Read the spec' / 'Why empty?' affordances", () => {
    const { container } = render(<AuditTab />);
    // Filter tablist
    expect(container.querySelector("[role='tablist']")).not.toBeNull();
    // Disabled affordances
    const buttons = container.querySelectorAll("button[disabled]");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
