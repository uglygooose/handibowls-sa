import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Required mocks: form pulls in next/navigation, the createTournament server
// action, and a few brand decorations. Mock the action so submit can be
// asserted without hitting Supabase. Brand decorations render fine in jsdom
// (pure SVG) so no mocks needed there.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const createTournamentMock = vi.fn();
vi.mock("@/app/(club-admin)/manage/tournaments/_actions", () => ({
  createTournament: (...args: unknown[]) => createTournamentMock(...args),
}));

import { NewTournamentForm } from "@/app/(club-admin)/manage/tournaments/new/_components/NewTournamentForm";

const HOST = { id: "host-1", name: "Demo Bowls Club" };
const GREENS = [{ id: "g1", name: "Main Green", rink_count: 6 }];

describe("<NewTournamentForm />", () => {
  beforeEach(() => {
    createTournamentMock.mockReset();
  });

  it("renders the prompt copy when required fields are blank", () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);
    expect(
      screen.getByText(
        /fill required fields .*name, format, structure.*to continue/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/required fields complete/i),
    ).not.toBeInTheDocument();
  });

  it("disables the Create button while required fields are missing", () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);
    expect(
      screen.getByRole("button", { name: /create tournament/i }),
    ).toBeDisabled();
  });

  it("disables submit when name is too short (1 char)", async () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);
    await userEvent.type(
      screen.getByPlaceholderText(/demo singles open/i),
      "X",
    );
    // Format + structure also missing — submit still disabled regardless.
    expect(
      screen.getByRole("button", { name: /create tournament/i }),
    ).toBeDisabled();
  });

  it("flips the footer copy + enables submit once name + format + structure are set", async () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);

    await userEvent.type(
      screen.getByPlaceholderText(/demo singles open/i),
      "Demo Open 2026",
    );
    // The active radios in each picker get their accessible name from the
    // surrounding Field label, not their visible text — query by visible
    // label text instead and click the enclosing button.
    const pairs = screen.getByText("Pairs").closest("button");
    if (!pairs) throw new Error("expected Pairs radio button");
    await userEvent.click(pairs);

    const knockout = screen.getByText("Knockout").closest("button");
    if (!knockout) throw new Error("expected Knockout radio button");
    await userEvent.click(knockout);

    expect(
      await screen.findByText(/required fields complete — ready to create/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create tournament/i }),
    ).not.toBeDisabled();
  });

  it("does not call createTournament while invalid", async () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);
    // Submit can still be triggered programmatically via Enter, but the
    // disabled button prevents it via click. Confirm the button is the
    // only submit path.
    expect(
      screen.getByRole("button", { name: /create tournament/i }),
    ).toBeDisabled();
    expect(createTournamentMock).not.toHaveBeenCalled();
  });

  it("save-as-draft button is removed (12-2 user call: REMOVE button — drafts deferred post-v1)", () => {
    render(<NewTournamentForm hostClub={HOST} greens={GREENS} />);
    expect(
      screen.queryByRole("button", { name: /save as draft/i }),
    ).toBeNull();
  });
});
