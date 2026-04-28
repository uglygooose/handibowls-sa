import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { EndStepper } from "@/components/player/EndStepper";

describe("<EndStepper />", () => {
  it("renders label + value", () => {
    render(
      <EndStepper label="You" value={3} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onIncrement when +/− tapped", () => {
    const inc = vi.fn();
    const dec = vi.fn();
    render(<EndStepper label="You" value={2} onIncrement={inc} onDecrement={dec} />);
    fireEvent.click(screen.getByLabelText("You increase"));
    fireEvent.click(screen.getByLabelText("You decrease"));
    expect(inc).toHaveBeenCalledTimes(1);
    expect(dec).toHaveBeenCalledTimes(1);
  });

  it("disables decrement at min and increment at max", () => {
    const { rerender } = render(
      <EndStepper label="You" value={0} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    expect(screen.getByLabelText("You decrease")).toBeDisabled();
    expect(screen.getByLabelText("You increase")).not.toBeDisabled();

    rerender(
      <EndStepper label="You" value={8} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    expect(screen.getByLabelText("You decrease")).not.toBeDisabled();
    expect(screen.getByLabelText("You increase")).toBeDisabled();
  });

  it("data-wet-hands tracks the wetHands prop", () => {
    const { rerender, container } = render(
      <EndStepper label="You" value={0} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    const root = container.querySelector("[data-slot='end-stepper']")!;
    expect(root.getAttribute("data-wet-hands")).toBe("false");
    rerender(
      <EndStepper label="You" value={0} wetHands onIncrement={() => {}} onDecrement={() => {}} />,
    );
    expect(root.getAttribute("data-wet-hands")).toBe("true");
  });

  it("data-active reflects whether value > 0", () => {
    const { rerender, container } = render(
      <EndStepper label="You" value={0} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    const root = container.querySelector("[data-slot='end-stepper']")!;
    expect(root.getAttribute("data-active")).toBe("false");
    rerender(
      <EndStepper label="You" value={3} onIncrement={() => {}} onDecrement={() => {}} />,
    );
    expect(root.getAttribute("data-active")).toBe("true");
  });

  it("respects custom min/max", () => {
    const { rerender } = render(
      <EndStepper
        label="You"
        value={5}
        min={5}
        max={10}
        onIncrement={() => {}}
        onDecrement={() => {}}
      />,
    );
    expect(screen.getByLabelText("You decrease")).toBeDisabled();
    rerender(
      <EndStepper
        label="You"
        value={10}
        min={5}
        max={10}
        onIncrement={() => {}}
        onDecrement={() => {}}
      />,
    );
    expect(screen.getByLabelText("You increase")).toBeDisabled();
  });
});
