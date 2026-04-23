import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { DistrictRow } from "../../_data";
import { type WizardFormInput, type WizardFormValues } from "../_schema";
import { Step5Review } from "./Step5Review";

const DISTRICTS: DistrictRow[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Gauteng North" },
];

const FILLED: WizardFormValues = {
  details: {
    name: "Gauteng North BC",
    short_name: "GNBC",
    slug: "gauteng-north",
    district_id: DISTRICTS[0].id,
    city: "Pretoria",
    contact_email: "sec@club.co.za",
    contact_phone: "",
    logo_path: "",
    theme_preset: "ocean-blue",
  },
  adminInvite: { admin_email: "admin@club.co.za" },
  greens: { greens: [{ name: "Main", rink_count: 6 }] },
  players: {
    players: [
      {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@club.co.za",
        is_club_admin: false,
      },
    ],
  },
};

type HarnessProps = {
  onJumpTo?: (step: number) => void;
  publishError?: string | null;
};

function Harness({ onJumpTo = vi.fn(), publishError = null }: HarnessProps) {
  const form = useForm<WizardFormInput, unknown, WizardFormValues>({
    defaultValues: FILLED,
  });
  return (
    <FormProvider {...form}>
      <Step5Review
        districts={DISTRICTS}
        logoFile={null}
        publishError={publishError}
        onJumpTo={onJumpTo}
      />
    </FormProvider>
  );
}

describe("Step5Review", () => {
  it("renders all four summary cards", () => {
    render(<Harness />);
    for (const step of [1, 2, 3, 4]) {
      expect(screen.getByTestId(`review-card-${step}`)).toBeInTheDocument();
    }
  });

  it("shows district name, admin email, and player email", () => {
    render(<Harness />);
    expect(screen.getByTestId("review-card-1")).toHaveTextContent(
      "Gauteng North",
    );
    expect(screen.getByTestId("review-card-2")).toHaveTextContent(
      "admin@club.co.za",
    );
    expect(screen.getByTestId("review-card-4")).toHaveTextContent(
      "ada@club.co.za",
    );
  });

  it("fires onJumpTo(N) when the Edit button is clicked", () => {
    const jump = vi.fn();
    render(<Harness onJumpTo={jump} />);
    fireEvent.click(screen.getByTestId("review-edit-3"));
    expect(jump).toHaveBeenCalledWith(3);
  });

  it("renders the publish error alert when publishError is set", () => {
    render(<Harness publishError="Slug already taken" />);
    expect(screen.getByTestId("publish-error")).toHaveTextContent(
      "Slug already taken",
    );
  });
});
