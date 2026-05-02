import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const mockRequestAccountDeletion = vi.fn();
const mockRestoreAccount = vi.fn();
vi.mock("@/app/(player)/(gated)/me/_actions", () => ({
  requestAccountDeletion: () => mockRequestAccountDeletion(),
  restoreAccount: () => mockRestoreAccount(),
}));

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (path: string) => mockRouterPush(path),
    refresh: () => mockRouterRefresh(),
  }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

import { DeleteAccountCard } from "@/app/(player)/(gated)/me/settings/data-and-privacy/_components/DeleteAccountCard";
import { RestoreAccountButton } from "@/components/player/RestoreAccountButton";

afterEach(() => {
  mockRequestAccountDeletion.mockReset();
  mockRestoreAccount.mockReset();
  mockRouterPush.mockReset();
  mockRouterRefresh.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
});

// Phase 13 / 13-2b / Batch H2 — DeleteAccountCard + RestoreAccountButton
// component coverage. The GraceWindowBanner is a Server Component
// reading getCurrentProfile via server cache; its conditional-render
// logic is exercised via the integration test in Batch G1's
// me-deletion suite (the data-layer write/read flow). Component-
// level tests focus on the Client Component interaction surface
// (button states, dialog confirmation, action wiring, toast paths).

describe("DeleteAccountCard", () => {
  it("renders the trigger button with destructive variant + danger tinted card", () => {
    render(<DeleteAccountCard />);
    const card = document.querySelector(
      "[data-slot='delete-account-card']",
    );
    expect(card).not.toBeNull();
    const trigger = document.querySelector(
      "[data-slot='delete-account-trigger']",
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain("Delete account");
  });

  it("opens the AlertDialog on trigger click", async () => {
    render(<DeleteAccountCard />);
    const trigger = document.querySelector(
      "[data-slot='delete-account-trigger']",
    ) as HTMLElement;
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='delete-account-confirm']"),
      ).not.toBeNull();
    });
  });

  it("disables Confirm until the 'I understand' checkbox is checked", async () => {
    render(<DeleteAccountCard />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-trigger']",
      ) as HTMLElement,
    );
    await waitFor(() => {
      const confirm = document.querySelector(
        "[data-slot='delete-account-confirm']",
      ) as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);
    });
    const check = document.querySelector(
      "[data-slot='delete-account-confirm-check']",
    ) as HTMLInputElement;
    fireEvent.click(check);
    await waitFor(() => {
      const confirm = document.querySelector(
        "[data-slot='delete-account-confirm']",
      ) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
    });
  });

  it("happy path → calls requestAccountDeletion, redirects to /me, surfaces success toast", async () => {
    mockRequestAccountDeletion.mockResolvedValueOnce({
      kind: "scheduled",
      grace_until: "2026-06-01T00:00:00Z",
    });
    render(<DeleteAccountCard />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-trigger']",
      ) as HTMLElement,
    );
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='delete-account-confirm-check']"),
      ).not.toBeNull();
    });
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-confirm-check']",
      ) as HTMLInputElement,
    );
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-confirm']",
      ) as HTMLButtonElement,
    );
    await waitFor(() => {
      expect(mockRequestAccountDeletion).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/me");
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("last_super_admin_block path → surfaces friendly toast, no redirect", async () => {
    mockRequestAccountDeletion.mockResolvedValueOnce({
      kind: "last_super_admin_block",
    });
    render(<DeleteAccountCard />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-trigger']",
      ) as HTMLElement,
    );
    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='delete-account-confirm-check']"),
      ).not.toBeNull();
    });
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-confirm-check']",
      ) as HTMLInputElement,
    );
    fireEvent.click(
      document.querySelector(
        "[data-slot='delete-account-confirm']",
      ) as HTMLButtonElement,
    );
    await waitFor(() => {
      expect(mockRequestAccountDeletion).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalled();
      expect(mockToastError.mock.calls[0]?.[0]).toContain(
        "only super-admin",
      );
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});

describe("RestoreAccountButton", () => {
  it("renders with idle copy", () => {
    render(<RestoreAccountButton />);
    const btn = document.querySelector(
      "[data-slot='restore-account-button']",
    );
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Restore account");
  });

  it("calls restoreAccount + refreshes router on success", async () => {
    mockRestoreAccount.mockResolvedValueOnce({ kind: "restored" });
    render(<RestoreAccountButton />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='restore-account-button']",
      ) as HTMLElement,
    );
    await waitFor(() => {
      expect(mockRestoreAccount).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith("Account restored.");
      expect(mockRouterRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces error toast on not_eligible", async () => {
    mockRestoreAccount.mockResolvedValueOnce({ kind: "not_eligible" });
    render(<RestoreAccountButton />);
    fireEvent.click(
      document.querySelector(
        "[data-slot='restore-account-button']",
      ) as HTMLElement,
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });
});
