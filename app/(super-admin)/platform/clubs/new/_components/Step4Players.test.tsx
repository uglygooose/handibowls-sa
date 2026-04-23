import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { WIZARD_DEFAULTS, type WizardFormValues } from "../_schema";
import { Step4Players } from "./Step4Players";

function Harness({ initial }: { initial?: Partial<WizardFormValues> }) {
  const merged = {
    ...WIZARD_DEFAULTS,
    ...initial,
    adminInvite: {
      ...WIZARD_DEFAULTS.adminInvite,
      ...(initial?.adminInvite ?? {}),
    },
  };
  const form = useForm<WizardFormValues>({
    defaultValues: merged,
    mode: "onChange",
  });
  return (
    <FormProvider {...form}>
      <Step4Players />
    </FormProvider>
  );
}

function fillDraft(first: string, last: string, email: string) {
  fireEvent.change(screen.getByTestId("draft-first-name"), {
    target: { value: first },
  });
  fireEvent.change(screen.getByTestId("draft-last-name"), {
    target: { value: last },
  });
  fireEvent.change(screen.getByTestId("draft-email"), {
    target: { value: email },
  });
}

describe("Step4Players", () => {
  it("appends a valid player and clears the draft", () => {
    render(<Harness />);
    fillDraft("Ada", "Lovelace", "ada@club.co.za");
    fireEvent.click(screen.getByTestId("draft-add"));
    expect(screen.getByTestId("player-row-0")).toHaveTextContent("Ada Lovelace");
    expect(
      (screen.getByTestId("draft-first-name") as HTMLInputElement).value,
    ).toBe("");
  });

  it("rejects an invalid email with a visible error", () => {
    render(<Harness />);
    fillDraft("Bad", "Email", "not-an-email");
    fireEvent.click(screen.getByTestId("draft-add"));
    expect(screen.getByTestId("draft-error")).toBeInTheDocument();
    expect(screen.queryByTestId("player-row-0")).toBeNull();
  });

  it("blocks a duplicate email (case-insensitive)", () => {
    render(<Harness />);
    fillDraft("Ada", "Lovelace", "ada@club.co.za");
    fireEvent.click(screen.getByTestId("draft-add"));

    fillDraft("Ada2", "Dup", "ADA@club.co.za");
    fireEvent.click(screen.getByTestId("draft-add"));
    expect(screen.getByTestId("draft-error")).toHaveTextContent(
      /already in the list/i,
    );
    expect(screen.queryByTestId("player-row-1")).toBeNull();
  });

  it("blocks the club-admin email from also being added as a player", () => {
    render(
      <Harness initial={{ adminInvite: { admin_email: "admin@club.co.za" } }} />,
    );
    fillDraft("Admin", "Copy", "admin@club.co.za");
    fireEvent.click(screen.getByTestId("draft-add"));
    expect(screen.getByTestId("draft-error")).toHaveTextContent(
      /already in the list/i,
    );
  });
});
