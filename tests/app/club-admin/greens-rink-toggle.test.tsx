import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const updateRinkActiveSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/greens/_actions", () => ({
  updateRinkActive: (...a: unknown[]) => updateRinkActiveSpy(...a),
}));

import { RinkDisableToggle } from "@/app/(club-admin)/manage/greens/_components/RinkDisableToggle";

const RINK = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<RinkDisableToggle /> — render states", () => {
  it("active rink renders Disable button + ACTIVE label", () => {
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    const root = container.querySelector("[data-slot='rink-disable-toggle']");
    expect(root?.getAttribute("data-active")).toBe("true");
    expect(
      container.querySelector("[data-slot='rink-status-label']")?.textContent,
    ).toContain("ACTIVE");
    const cta = container.querySelector(
      "[data-slot='toggle-cta']",
    ) as HTMLButtonElement;
    expect(cta.textContent?.toLowerCase()).toContain("disable");
  });

  it("inactive rink renders Enable button + MAINTENANCE label", () => {
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={false} />,
    );
    expect(
      container.querySelector("[data-slot='rink-status-label']")?.textContent,
    ).toContain("MAINTENANCE");
    const cta = container.querySelector(
      "[data-slot='toggle-cta']",
    ) as HTMLButtonElement;
    expect(cta.textContent?.toLowerCase()).toContain("enable");
  });

  it("does NOT render the reason form on first render (active)", () => {
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    expect(container.querySelector("[data-slot='reason-form']")).toBeNull();
  });
});

describe("<RinkDisableToggle /> — disable flow", () => {
  it("clicking Disable opens the reason form (does NOT call action yet)", () => {
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='toggle-cta']") as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='reason-form']"),
    ).not.toBeNull();
    expect(updateRinkActiveSpy).not.toHaveBeenCalled();
  });

  it("submit with empty reason shows inline error + does NOT call action", () => {
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='toggle-cta']") as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='reason-submit']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='reason-error']"),
    ).not.toBeNull();
    expect(updateRinkActiveSpy).not.toHaveBeenCalled();
  });

  it("submit with valid reason calls action with active=false + reason", async () => {
    updateRinkActiveSpy.mockResolvedValueOnce({
      ok: true,
      data: { rink_id: RINK, active: false },
    });
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='toggle-cta']") as HTMLButtonElement,
    );
    const textarea = container.querySelector(
      "[data-slot='reason-textarea']",
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "Resurfacing — back online Saturday" },
    });
    await act(async () => {
      (
        container.querySelector("[data-slot='reason-submit']") as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(updateRinkActiveSpy).toHaveBeenCalledWith({
      rink_id: RINK,
      active: false,
      reason: "Resurfacing — back online Saturday",
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
  });
});

describe("<RinkDisableToggle /> — re-enable flow", () => {
  it("clicking Enable on inactive rink calls action directly with active=true (no reason form)", async () => {
    updateRinkActiveSpy.mockResolvedValueOnce({
      ok: true,
      data: { rink_id: RINK, active: true },
    });
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={false} />,
    );
    await act(async () => {
      (
        container.querySelector("[data-slot='toggle-cta']") as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(updateRinkActiveSpy).toHaveBeenCalledWith({
      rink_id: RINK,
      active: true,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(container.querySelector("[data-slot='reason-form']")).toBeNull();
  });
});

describe("<RinkDisableToggle /> — error handling", () => {
  it("action error → toast.error, sheet stays open", async () => {
    updateRinkActiveSpy.mockResolvedValueOnce({
      ok: false,
      kind: "error",
      error: "RLS denied",
    });
    const { container } = render(
      <RinkDisableToggle rinkId={RINK} rinkLabel="Main 1" active={true} />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='toggle-cta']") as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='reason-textarea']",
      ) as HTMLTextAreaElement,
      { target: { value: "maintenance" } },
    );
    await act(async () => {
      (
        container.querySelector("[data-slot='reason-submit']") as HTMLButtonElement
      ).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(
      container.querySelector("[data-slot='reason-form']"),
    ).not.toBeNull();
  });
});
