import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ClubsSearchBar } from "./ClubsSearchBar";

// Phase 12 / 12-7: ClubsSearchBar pinned alongside the search-pagination
// fix. Pattern lifted from UsersSearch.test.tsx.

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  replace.mockReset();
});

describe("ClubsSearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces 300ms before pushing the q= param", () => {
    render(<ClubsSearchBar initialQuery="" basePath="/platform/clubs" />);
    const input = screen.getByTestId("clubs-search-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "demo" } });
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replace).toHaveBeenCalledWith("/platform/clubs?q=demo");
  });

  it("clears the q= param when the input is emptied", () => {
    render(<ClubsSearchBar initialQuery="demo" basePath="/platform/clubs" />);
    const input = screen.getByTestId("clubs-search-input") as HTMLInputElement;
    expect(input.value).toBe("demo");

    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenLastCalledWith("/platform/clubs");
  });

  it("collapses repeated typing into a single push", () => {
    render(<ClubsSearchBar initialQuery="" basePath="/platform/clubs" />);
    const input = screen.getByTestId("clubs-search-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "d" } });
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "de" } });
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: "demo" } });
    act(() => void vi.advanceTimersByTime(300));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/platform/clubs?q=demo");
  });
});
