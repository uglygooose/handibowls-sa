import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import {
  WIZARD_DEFAULTS,
  type WizardFormInput,
  type WizardFormValues,
} from "../_schema";
import { Step3Greens } from "./Step3Greens";

function Harness({ initial }: { initial?: Partial<WizardFormInput> }) {
  const form = useForm<WizardFormInput, unknown, WizardFormValues>({
    defaultValues: { ...WIZARD_DEFAULTS, ...initial },
    mode: "onChange",
  });
  return (
    <FormProvider {...form}>
      <Step3Greens />
    </FormProvider>
  );
}

describe("Step3Greens", () => {
  it("renders the single default green with rink_count 6", () => {
    render(<Harness />);
    const rinks = screen.getByTestId("green-0-rinks") as HTMLInputElement;
    expect(rinks.value).toBe("6");
  });

  it("disables remove when only one green remains", () => {
    render(<Harness />);
    const remove = screen.getByTestId("green-0-remove");
    expect(remove).toBeDisabled();
  });

  it("appends a new green on Add", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("greens-add"));
    expect(screen.getByTestId("green-1-rinks")).toBeInTheDocument();
    // Both rows now have active remove buttons.
    expect(screen.getByTestId("green-0-remove")).not.toBeDisabled();
    expect(screen.getByTestId("green-1-remove")).not.toBeDisabled();
  });

  it("stops adding after 10 greens (MAX_GREENS)", () => {
    render(<Harness />);
    const addButton = screen.getByTestId("greens-add");
    // Start with one — click 9 more to reach 10.
    for (let i = 0; i < 9; i++) fireEvent.click(addButton);
    expect(screen.getByTestId("green-9-rinks")).toBeInTheDocument();
    expect(addButton).toBeDisabled();
  });
});
