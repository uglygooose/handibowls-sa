import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const updateClubTheme = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const refresh = vi.fn();

vi.mock("../../_actions", () => ({
  updateClubTheme: (...args: unknown[]) => updateClubTheme(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { ThemeTab } from "./ThemeTab";

describe("ThemeTab", () => {
  beforeEach(() => {
    updateClubTheme.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    refresh.mockReset();
  });

  it("updates the live preview when a preset is selected", () => {
    render(<ThemeTab clubId="club-1" clubName="Demo Bowls" current="atomic-red" />);
    const swatch = screen.getByTestId("theme-preview-swatch");
    expect(swatch).toHaveAttribute("data-preset", "atomic-red");

    fireEvent.click(screen.getByTestId("theme-preset-ocean-blue"));
    expect(swatch).toHaveAttribute("data-preset", "ocean-blue");
  });

  it("opens the confirm dialog when a non-current preset is chosen", () => {
    render(<ThemeTab clubId="club-1" clubName="Demo Bowls" current="atomic-red" />);
    expect(screen.queryByTestId("theme-confirm-dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("theme-preset-ocean-blue"));
    expect(screen.getByTestId("theme-confirm-dialog")).toBeInTheDocument();
  });

  it("does NOT open the dialog when the current preset is re-selected", () => {
    render(<ThemeTab clubId="club-1" clubName="Demo Bowls" current="atomic-red" />);
    fireEvent.click(screen.getByTestId("theme-preset-atomic-red"));
    expect(screen.queryByTestId("theme-confirm-dialog")).toBeNull();
  });

  it("calls updateClubTheme + toast + router.refresh on confirm", async () => {
    updateClubTheme.mockResolvedValue({ ok: true, data: true });
    render(<ThemeTab clubId="club-1" clubName="Demo Bowls" current="atomic-red" />);

    fireEvent.click(screen.getByTestId("theme-preset-ocean-blue"));
    fireEvent.click(screen.getByTestId("theme-confirm"));

    await waitFor(() => {
      expect(updateClubTheme).toHaveBeenCalledWith({
        club_id: "club-1",
        theme_preset: "ocean-blue",
      });
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows an error toast and does not refresh when the action fails", async () => {
    updateClubTheme.mockResolvedValue({ ok: false, error: "nope" });
    render(<ThemeTab clubId="club-1" clubName="Demo Bowls" current="atomic-red" />);

    fireEvent.click(screen.getByTestId("theme-preset-ocean-blue"));
    fireEvent.click(screen.getByTestId("theme-confirm"));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("nope");
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
