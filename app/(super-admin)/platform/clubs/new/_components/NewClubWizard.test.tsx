import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DistrictRow } from "../../_data";
import { WIZARD_DRAFT_KEY } from "../_draft";
import { WIZARD_DEFAULTS, type WizardFormValues } from "../_schema";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../_actions", () => ({
  createClub: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ data: {}, error: null }) }),
    },
  }),
}));

import { NewClubWizard } from "./NewClubWizard";

const DISTRICTS: DistrictRow[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Gauteng North" },
];

const DRAFT: WizardFormValues = {
  ...WIZARD_DEFAULTS,
  details: {
    ...WIZARD_DEFAULTS.details,
    name: "Saved Draft Club",
    slug: "saved-draft-club",
  },
};

describe("NewClubWizard", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("mounts on step 1 with no draft prompt when storage is empty", async () => {
    render(<NewClubWizard districts={DISTRICTS} />);
    await waitFor(() => {
      expect(screen.getByTestId("new-club-wizard")).toHaveAttribute(
        "data-current-step",
        "1",
      );
    });
    expect(screen.queryByTestId("wizard-draft-dialog")).toBeNull();
  });

  it("shows the Resume/Discard dialog when a draft exists", async () => {
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(DRAFT));
    render(<NewClubWizard districts={DISTRICTS} />);
    await waitFor(() => {
      expect(screen.getByTestId("wizard-draft-dialog")).toBeInTheDocument();
    });
  });

  it("Discard removes the draft from storage and exits the dialog", async () => {
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(DRAFT));
    render(<NewClubWizard districts={DISTRICTS} />);

    await waitFor(() =>
      expect(screen.getByTestId("wizard-draft-dialog")).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("wizard-draft-discard"));
    });
    expect(window.sessionStorage.getItem(WIZARD_DRAFT_KEY)).toBeNull();
    await waitFor(() =>
      expect(screen.queryByTestId("wizard-draft-dialog")).toBeNull(),
    );
  });

  it("Resume hydrates the form with the stored draft values", async () => {
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(DRAFT));
    render(<NewClubWizard districts={DISTRICTS} />);
    await waitFor(() =>
      expect(screen.getByTestId("wizard-draft-dialog")).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("wizard-draft-resume"));
    });
    await waitFor(() => {
      const input = screen.getByTestId("field-name") as HTMLInputElement;
      expect(input.value).toBe("Saved Draft Club");
    });
  });

  it("silently discards an expired draft on mount", async () => {
    const expired = {
      values: DRAFT,
      expiresAt: Date.now() - 1,
    };
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(expired));
    render(<NewClubWizard districts={DISTRICTS} />);
    await waitFor(() => {
      expect(screen.getByTestId("new-club-wizard")).toHaveAttribute(
        "data-current-step",
        "1",
      );
    });
    expect(screen.queryByTestId("wizard-draft-dialog")).toBeNull();
    expect(window.sessionStorage.getItem(WIZARD_DRAFT_KEY)).toBeNull();
  });
});
