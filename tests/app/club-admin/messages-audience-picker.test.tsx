import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import {
  AudiencePicker,
  type AudiencePickerValue,
} from "@/app/(club-admin)/manage/messages/_components/AudiencePicker";
import type {
  MemberOption,
  TournamentOption,
} from "@/app/(club-admin)/manage/messages/_data";

// Phase 11 / 11-3c — admin compose audience picker contract.
//
// AudiencePicker is presentational + state-managed via props. Each
// test below renders a Harness that holds the value in local React
// state and forwards onChange — mirrors the real ComposeForm wiring
// without bringing the rest of the form along.
//
// Coverage:
//   • Mode radios switch between the three audience kinds and
//     conditionally surface the tournament dropdown / custom multi-
//     select.
//   • Empty-state copy when the club has no tournaments / no
//     active members.
//   • Tournament select fires onChange with the chosen UUID.
//   • Custom multi-select toggles selection per row + clears all.
//   • Search narrows the custom list across name/email/BSA #.

const TOURNAMENTS: TournamentOption[] = [
  {
    id: "00000000-0000-4000-8000-000000000a01",
    name: "Spring Singles",
    format: "singles",
    status: "open",
    starts_at: "2026-05-12T08:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000a02",
    name: "Autumn Pairs",
    format: "pairs",
    status: "draft",
    starts_at: null,
  },
];

const MEMBERS: MemberOption[] = [
  {
    profile_id: "00000000-0000-4000-8000-000000000b01",
    name: "James Thomas",
    email: "james@example.com",
    bsa_number: "WP-2419",
  },
  {
    profile_id: "00000000-0000-4000-8000-000000000b02",
    name: "Wessel Coetzee",
    email: "wessel@example.com",
    bsa_number: "WP-1004",
  },
  {
    profile_id: "00000000-0000-4000-8000-000000000b03",
    name: "Jolene Williams",
    email: "jolene@example.com",
    bsa_number: "WP-3088",
  },
];

function Harness({
  initial,
  tournaments,
  members,
}: {
  initial: AudiencePickerValue;
  tournaments?: TournamentOption[];
  members?: MemberOption[];
}) {
  // Local state harness: AudiencePicker is purely controlled, so
  // the harness owns the value + onChange to drive re-renders.
  const [value, setValue] = useState<AudiencePickerValue>(initial);
  return (
    <AudiencePicker
      value={value}
      onChange={setValue}
      tournaments={tournaments ?? TOURNAMENTS}
      members={members ?? MEMBERS}
    />
  );
}

describe("<AudiencePicker /> — mode radios", () => {
  it("renders all three radios with all_members active by default", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "all_members",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    expect(
      container.querySelectorAll("[data-slot='audience-radio']"),
    ).toHaveLength(3);
    expect(
      container
        .querySelector("[data-slot='audience-radio'][data-active='true']")
        ?.getAttribute("data-value"),
    ).toBe("all_members");
  });

  it("clicking tournament_entrants reveals the tournament select", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "all_members",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    expect(container.querySelector("[data-slot='tournament-select']")).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='audience-radio'][data-value='tournament_entrants']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='tournament-select']"),
    ).not.toBeNull();
  });

  it("clicking custom reveals the multi-select picker", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "all_members",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    expect(container.querySelector("[data-slot='custom-picker']")).toBeNull();
    fireEvent.click(
      container.querySelector(
        "[data-slot='audience-radio'][data-value='custom']",
      ) as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='custom-picker']")).not.toBeNull();
  });

  it("none of the radios carry a disabled attribute", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "all_members",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    const radios = container.querySelectorAll("[data-slot='audience-radio']");
    radios.forEach((r) => {
      expect(r.getAttribute("data-disabled")).toBe("false");
      expect(r.hasAttribute("disabled")).toBe(false);
    });
  });
});

describe("<AudiencePicker /> — tournament dropdown", () => {
  it("renders all tournaments as options when populated", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "tournament_entrants",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    const select = container.querySelector(
      "[data-slot='tournament-select']",
    ) as HTMLSelectElement;
    expect(select.options.length).toBe(TOURNAMENTS.length + 1); // +1 for placeholder
    expect(select.options[1].textContent).toContain("Spring Singles");
    expect(select.options[2].textContent).toContain("Autumn Pairs");
  });

  it("renders the empty-state when no tournaments at this club", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "tournament_entrants",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
        tournaments={[]}
      />,
    );
    expect(
      container.querySelector("[data-slot='tournament-select-empty']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='tournament-select']"),
    ).toBeNull();
  });

  it("shows the warning hint when no tournament has been picked yet", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "tournament_entrants",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    expect(
      container.querySelector("[data-slot='tournament-select-hint']"),
    ).not.toBeNull();
  });

  it("changing the select updates the audience tournament id", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "tournament_entrants",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    const select = container.querySelector(
      "[data-slot='tournament-select']",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: TOURNAMENTS[0].id } });
    expect(
      (
        container.querySelector("[data-slot='tournament-select']") as
          HTMLSelectElement
      ).value,
    ).toBe(TOURNAMENTS[0].id);
    // Hint clears once a tournament is picked.
    expect(
      container.querySelector("[data-slot='tournament-select-hint']"),
    ).toBeNull();
  });
});

describe("<AudiencePicker /> — custom multi-select", () => {
  it("renders all members as toggle rows", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    const rows = container.querySelectorAll("[data-slot='custom-picker-row']");
    expect(rows).toHaveLength(MEMBERS.length);
  });

  it("renders the empty-state when no active members at this club", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
        members={[]}
      />,
    );
    expect(
      container.querySelector("[data-slot='custom-picker-empty']"),
    ).not.toBeNull();
  });

  it("clicking a row toggles its data-checked state", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    const target = container.querySelector(
      `[data-slot='custom-picker-row'][data-profile-id='${MEMBERS[0].profile_id}']`,
    ) as HTMLButtonElement;
    expect(target.getAttribute("data-checked")).toBe("false");
    fireEvent.click(target);
    const checked = container.querySelector(
      `[data-slot='custom-picker-row'][data-profile-id='${MEMBERS[0].profile_id}']`,
    );
    expect(checked?.getAttribute("data-checked")).toBe("true");
  });

  it("Clear all resets the selected count", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [
            MEMBERS[0].profile_id,
            MEMBERS[1].profile_id,
          ],
        }}
      />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='custom-clear-all']",
      ) as HTMLButtonElement,
    );
    const checked = container.querySelectorAll(
      "[data-slot='custom-picker-row'][data-checked='true']",
    );
    expect(checked).toHaveLength(0);
  });

  it("search narrows the list by name (case-insensitive substring)", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='custom-picker-search']",
      ) as HTMLInputElement,
      { target: { value: "wessel" } },
    );
    const rows = container.querySelectorAll("[data-slot='custom-picker-row']");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Wessel Coetzee");
  });

  it("search narrows by BSA number", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='custom-picker-search']",
      ) as HTMLInputElement,
      { target: { value: "WP-3088" } },
    );
    const rows = container.querySelectorAll("[data-slot='custom-picker-row']");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Jolene Williams");
  });

  it("shows 'no matches' when search excludes everyone", () => {
    const { container } = render(
      <Harness
        initial={{
          audience_kind: "custom",
          audience_tournament_id: null,
          audience_profile_ids: [],
        }}
      />,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='custom-picker-search']",
      ) as HTMLInputElement,
      { target: { value: "no-such-name" } },
    );
    expect(container.textContent).toContain("No matches.");
  });
});
