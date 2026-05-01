import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Checkbox } from "@/app/(auth)/_components/Checkbox";

// Phase 12 / 12-6: smoke test for the auth Checkbox after swapping
// the hand-rolled `peer-checked:[&>svg]:opacity-100` component for
// the shadcn Checkbox primitive (Radix Checkbox under the hood).
//
// Form-attribute pass-through (`name`, `required`) is Radix's own
// concern and gets a hidden form-associated input only when the
// component is mounted under a <form>; that path uses
// ResizeObserver (via @radix-ui/react-use-size) which isn't in
// jsdom's globals — exercising it here would need a jsdom polyfill.
// The smoke test below pins the parts of the contract we actually
// care about: the swap still renders, children sit next to the box,
// and `defaultChecked` propagates to the underlying checkbox state.

describe("auth Checkbox · shadcn primitive wrapper", () => {
  it("renders children next to a checkbox role", () => {
    render(
      <Checkbox>Remember me on this device</Checkbox>,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(
      screen.getByText("Remember me on this device"),
    ).toBeInTheDocument();
  });

  it("starts checked when defaultChecked is true (login remember-me default)", () => {
    render(
      <Checkbox defaultChecked>Remember me</Checkbox>,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "checked",
    );
  });

  it("starts unchecked by default (signup terms / invite code-of-conduct rows)", () => {
    render(
      <Checkbox>I agree to the terms</Checkbox>,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });
});
