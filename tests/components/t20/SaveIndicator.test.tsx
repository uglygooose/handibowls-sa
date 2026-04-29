import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { SaveIndicator } from "@/components/t20/SaveIndicator";

// Phase 10 / 10-6 — capture-wizard save indicator.

describe("<SaveIndicator />", () => {
  it("saved: renders 'Saved' label + success-tinted dot", () => {
    const { container } = render(<SaveIndicator state="saved" />);
    const root = container.querySelector("[data-slot='save-indicator']");
    expect(root?.getAttribute("data-state")).toBe("saved");
    expect(root?.textContent).toContain("Saved");
    const dot = container.querySelector("[data-slot='save-indicator-dot']");
    expect(dot?.className).toContain("bg-success-500");
  });

  it("saving: renders 'Saving…' + amber pulsing dot", () => {
    const { container } = render(<SaveIndicator state="saving" />);
    const root = container.querySelector("[data-slot='save-indicator']");
    expect(root?.getAttribute("data-state")).toBe("saving");
    expect(root?.textContent).toContain("Saving…");
    const dot = container.querySelector("[data-slot='save-indicator-dot']");
    expect(dot?.className).toContain("bg-warning-500");
    expect(dot?.className).toContain("animate-pulse");
  });

  it("failed: renders 'Save failed — retry' + danger dot, no pulse", () => {
    const { container } = render(<SaveIndicator state="failed" />);
    const root = container.querySelector("[data-slot='save-indicator']");
    expect(root?.getAttribute("data-state")).toBe("failed");
    expect(root?.textContent).toContain("Save failed");
    expect(root?.textContent).toContain("retry");
    const dot = container.querySelector("[data-slot='save-indicator-dot']");
    expect(dot?.className).toContain("bg-danger-500");
    expect(dot?.className).not.toContain("animate-pulse");
  });

  it("uses role='status' + aria-live='polite' so screen readers announce save state", () => {
    const { container } = render(<SaveIndicator state="saved" />);
    const root = container.querySelector("[data-slot='save-indicator']");
    expect(root?.getAttribute("role")).toBe("status");
    expect(root?.getAttribute("aria-live")).toBe("polite");
  });
});
