import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const formActionSpy = vi.fn();
vi.mock("@/app/(club-admin)/manage/messages/_actions", () => ({
  composeMessageFromForm: (...args: unknown[]) => {
    formActionSpy(...args);
    return { kind: "idle" };
  },
}));

afterEach(() => {
  formActionSpy.mockClear();
});

import { ComposeForm } from "@/app/(club-admin)/manage/messages/_components/ComposeForm";
import type {
  MemberOption,
  TournamentOption,
} from "@/app/(club-admin)/manage/messages/_data";

// 11-3c upgrade: ComposeForm now requires tournaments + members
// for the AudiencePicker. Empty arrays are valid — they exercise
// the picker's "no tournaments / no members at this club" empty
// states. Suite-wide default keeps each test focused on the field
// it's actually exercising.
const EMPTY_TOURNAMENTS: TournamentOption[] = [];
const EMPTY_MEMBERS: MemberOption[] = [];
const PROPS = {
  tournaments: EMPTY_TOURNAMENTS,
  members: EMPTY_MEMBERS,
};

// Phase 11 / 11-3b — admin compose form contract.
//
// Covers the Client-island bits:
//   • 5 numbered form sections render
//   • Subject + body length validation drives submit gating
//   • Audience radio defaults to all_members; tournament + custom
//     are disabled until 11-3c lands the picker
//   • Schedule mode toggles the datetime input and swaps the
//     primary CTA between "Send now" and "Schedule"
//   • Channel section is read-only "in-app only" with no toggle
//   • Helper text under the submit button explicitly lists what's
//     missing — Phase 10 manual-QA learning applied from the start
//   • Form-state contract assertion: COMPOSE_INITIAL/_form-state
//     export stays out of the "use server" file
//
// Like the t20 form test, this mocks the action module — the
// integration test (action layer + RPC) covers the wire-up.

describe("<ComposeForm /> — initial render", () => {
  it("renders 5 numbered form sections", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const sections = container.querySelectorAll("[data-slot='form-section']");
    expect(sections).toHaveLength(5);
    const text = container.textContent ?? "";
    expect(text).toContain("1. Subject");
    expect(text).toContain("2. Body");
    expect(text).toContain("3. Audience");
    expect(text).toContain("4. Schedule");
    expect(text).toContain("5. Channel");
  });

  it("Section 5 channel card is locked to in-app, no toggle", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const channelCard = container.querySelector(
      "[data-slot='channel-locked-card']",
    );
    expect(channelCard).not.toBeNull();
    expect(channelCard?.textContent).toContain("In-app only");
    // No checkbox / switch in section 5.
    expect(container.querySelector("input[type='checkbox']")).toBeNull();
  });

  it("audience defaults to all_members; all three radios are enabled (11-3c picker)", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const allMembers = container.querySelector(
      "[data-slot='audience-radio'][data-value='all_members']",
    );
    expect(allMembers?.getAttribute("data-active")).toBe("true");
    // After 11-3c, tournament_entrants + custom are real options.
    const tournament = container.querySelector(
      "[data-slot='audience-radio'][data-value='tournament_entrants']",
    );
    expect(tournament?.getAttribute("data-disabled")).toBe("false");
    expect(tournament?.hasAttribute("disabled")).toBe(false);
    const custom = container.querySelector(
      "[data-slot='audience-radio'][data-value='custom']",
    );
    expect(custom?.getAttribute("data-disabled")).toBe("false");
    expect(custom?.hasAttribute("disabled")).toBe(false);
  });

  it("schedule mode defaults to 'now'; primary CTA is 'Send now'", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const sendNow = container.querySelector("[data-slot='send-now-cta']");
    expect(sendNow).not.toBeNull();
    expect(container.querySelector("[data-slot='schedule-cta']")).toBeNull();
    expect(container.querySelector("[data-slot='schedule-input']")).toBeNull();
  });

  it("toggling schedule to 'later' reveals the datetime input and swaps CTA to 'Schedule'", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='schedule-radio'][data-value='later']",
      ) as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='schedule-input']")).not.toBeNull();
    expect(container.querySelector("[data-slot='schedule-cta']")).not.toBeNull();
    expect(container.querySelector("[data-slot='send-now-cta']")).toBeNull();
  });
});

describe("<ComposeForm /> — submit gating + missing hints", () => {
  it("Send now is disabled with empty subject + body, helper hint lists both", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const cta = container.querySelector(
      "[data-slot='send-now-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    const hint = container.querySelector("[data-slot='missing-hints']");
    expect(hint?.textContent).toContain("subject");
    expect(hint?.textContent).toContain("body");
  });

  it("Save as draft is disabled with empty subject + body", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const cta = container.querySelector(
      "[data-slot='save-draft-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it("Save as draft enables once subject + body are populated (audience can stay default)", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    const subject = container.querySelector(
      "[data-slot='subject-input']",
    ) as HTMLInputElement;
    const body = container.querySelector(
      "[data-slot='body-input']",
    ) as HTMLTextAreaElement;
    fireEvent.change(subject, { target: { value: "Hello" } });
    fireEvent.change(body, { target: { value: "Body content" } });
    const cta = container.querySelector(
      "[data-slot='save-draft-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it("Send now enables once subject + body are populated (audience=all_members default)", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Practice tomorrow" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "17:00 sharp." } },
    );
    const cta = container.querySelector(
      "[data-slot='send-now-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it("Schedule disabled when 'later' is selected but no datetime entered", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Hi" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='schedule-radio'][data-value='later']",
      ) as HTMLButtonElement,
    );
    const cta = container.querySelector(
      "[data-slot='schedule-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    const hint = container.querySelector("[data-slot='missing-hints']");
    expect(hint?.textContent).toContain("future schedule time");
  });

  it("Schedule enables with a future datetime", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Hi" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='schedule-radio'][data-value='later']",
      ) as HTMLButtonElement,
    );
    const future = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 16); // "YYYY-MM-DDTHH:MM"
    fireEvent.change(
      container.querySelector("[data-slot='schedule-input']") as HTMLInputElement,
      { target: { value: future } },
    );
    const cta = container.querySelector(
      "[data-slot='schedule-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it("Schedule stays disabled with a past datetime", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Hi" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='schedule-radio'][data-value='later']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector("[data-slot='schedule-input']") as HTMLInputElement,
      { target: { value: "2020-01-01T00:00" } },
    );
    const cta = container.querySelector(
      "[data-slot='schedule-cta']",
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });
});

describe("<ComposeForm /> — char counts", () => {
  it("subject count tracks the trimmed length", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Hello world" } },
    );
    const count = container.querySelector("[data-slot='subject-count']");
    expect(count?.textContent).toContain("11 / 120");
  });

  it("body count tracks the trimmed length", () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "abcde fghij" } },
    );
    const count = container.querySelector("[data-slot='body-count']");
    expect(count?.textContent).toContain("11 / 5000");
  });
});

describe("<ComposeForm /> — submit action wiring", () => {
  it("Send now submits via the button's name/value carrying compose_action='send_now'", async () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Subject" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );

    // Submit-button name/value avoids React state-batching racing the
    // submit. requestSubmit(submitter) is the JSDOM API that mimics a
    // user click on a specific submit button — the resulting FormData
    // includes only that button's name/value, not its siblings'.
    const form = container.querySelector(
      "[data-slot='compose-form']",
    ) as HTMLFormElement;
    const submitter = container.querySelector(
      "[data-slot='send-now-cta']",
    ) as HTMLButtonElement;
    form.requestSubmit(submitter);
    await new Promise((r) => setTimeout(r, 0));

    expect(formActionSpy).toHaveBeenCalled();
    const fd = formActionSpy.mock.calls[0][1] as FormData;
    expect(fd.get("compose_action")).toBe("send_now");
    expect(fd.get("subject")).toBe("Subject");
    expect(fd.get("body_md")).toBe("Body");
    expect(fd.get("audience_kind")).toBe("all_members");
  });

  it("Save as draft submits with compose_action='save_draft'", async () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Subject" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );
    const form = container.querySelector(
      "[data-slot='compose-form']",
    ) as HTMLFormElement;
    const submitter = container.querySelector(
      "[data-slot='save-draft-cta']",
    ) as HTMLButtonElement;
    form.requestSubmit(submitter);
    await new Promise((r) => setTimeout(r, 0));

    expect(formActionSpy).toHaveBeenCalled();
    const fd = formActionSpy.mock.calls[0][1] as FormData;
    expect(fd.get("compose_action")).toBe("save_draft");
  });

  it("Schedule submits with compose_action='schedule' and the chosen scheduled_at", async () => {
    const { container } = render(<ComposeForm {...PROPS} />);
    fireEvent.change(
      container.querySelector("[data-slot='subject-input']") as HTMLInputElement,
      { target: { value: "Subject" } },
    );
    fireEvent.change(
      container.querySelector("[data-slot='body-input']") as HTMLTextAreaElement,
      { target: { value: "Body" } },
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='schedule-radio'][data-value='later']",
      ) as HTMLButtonElement,
    );
    const future = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 16);
    fireEvent.change(
      container.querySelector("[data-slot='schedule-input']") as HTMLInputElement,
      { target: { value: future } },
    );

    const form = container.querySelector(
      "[data-slot='compose-form']",
    ) as HTMLFormElement;
    const submitter = container.querySelector(
      "[data-slot='schedule-cta']",
    ) as HTMLButtonElement;
    form.requestSubmit(submitter);
    await new Promise((r) => setTimeout(r, 0));

    expect(formActionSpy).toHaveBeenCalled();
    const fd = formActionSpy.mock.calls[0][1] as FormData;
    expect(fd.get("compose_action")).toBe("schedule");
    expect(fd.get("scheduled_at")).toBe(future);
  });
});

describe("form-state module boundary", () => {
  it("COMPOSE_INITIAL is exported from _form-state with kind='idle'", async () => {
    const mod = await import("@/app/(club-admin)/manage/messages/_form-state");
    expect(mod.COMPOSE_INITIAL).toEqual({ kind: "idle" });
  });

  it("_actions does NOT re-export the runtime initial-state constant (Phase 10 fix invariant)", async () => {
    // Bypass the file-level vi.mock so we inspect the real module.
    const actual = await vi.importActual<Record<string, unknown>>(
      "@/app/(club-admin)/manage/messages/_actions",
    );
    expect(actual.COMPOSE_INITIAL).toBeUndefined();
  });
});
