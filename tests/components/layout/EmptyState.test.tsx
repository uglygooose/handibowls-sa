import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/layout/EmptyState";

// Phase 12.5 / 12.5-1 (audit id `empty-state-primitive`): smoke +
// behaviour coverage for the shared EmptyState primitive.

afterEach(cleanup);

describe("<EmptyState />", () => {
  it("renders the title as an h3 (semantic heading)", () => {
    render(<EmptyState title="Capture your first Twenty 20" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Capture your first Twenty 20" }),
    ).toBeInTheDocument();
  });

  it("renders eyebrow + body copy when provided", () => {
    render(
      <EmptyState
        eyebrow="No assessments yet"
        title="Capture your first Twenty 20"
        body="Pick a player, run them through the 7 sections, sign off."
      />,
    );
    expect(screen.getByText("No assessments yet")).toBeInTheDocument();
    expect(
      screen.getByText("Pick a player, run them through the 7 sections, sign off."),
    ).toBeInTheDocument();
  });

  it("omits eyebrow + body when not provided", () => {
    render(<EmptyState title="Bare bones" />);
    expect(screen.queryByText("eyebrow")).toBeNull();
    // Only the heading; no other paragraph.
    const paras = screen
      .queryAllByText((_, el) => el?.tagName === "P");
    expect(paras).toHaveLength(0);
  });

  it("renders the icon when provided", () => {
    render(
      <EmptyState icon={Inbox} title="Empty inbox" />,
    );
    // lucide renders an svg inside the section — check by data-slot
    // wrapper.
    const section = screen.getByRole("heading", { level: 3 }).closest(
      "[data-slot='empty-state']",
    );
    expect(section?.querySelector("svg")).not.toBeNull();
  });

  it("does not render an icon node when icon prop omitted", () => {
    render(<EmptyState title="No icon" />);
    const section = screen.getByRole("heading", { level: 3 }).closest(
      "[data-slot='empty-state']",
    );
    expect(section?.querySelector("svg")).toBeNull();
  });

  it("renders a primary CTA as a Link when href is provided", () => {
    render(
      <EmptyState
        title="Empty"
        primaryCta={{ label: "New assessment", href: "/manage/t20/new" }}
      />,
    );
    const link = screen.getByRole("link", { name: "New assessment" });
    expect(link).toHaveAttribute("href", "/manage/t20/new");
  });

  it("renders a primary CTA as a button when onClick is provided", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(
      <EmptyState
        title="Empty"
        primaryCta={{ label: "Reset", onClick: handler }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Reset" });
    await user.click(btn);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders both primary + secondary CTAs when supplied", () => {
    render(
      <EmptyState
        title="Empty"
        primaryCta={{ label: "Primary", href: "/p" }}
        secondaryCta={{ label: "Secondary", href: "/s" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Secondary" })).toBeInTheDocument();
  });

  it("applies the bone variant by default (dashed-border card chrome)", () => {
    render(<EmptyState title="Default" />);
    const section = screen.getByRole("heading", { level: 3 }).closest(
      "[data-slot='empty-state']",
    );
    expect(section).toHaveAttribute("data-variant", "bone");
    expect(section).toHaveClass("border-dashed");
    expect(section).toHaveClass("bg-bone");
  });

  it("drops card chrome under variant='on-surface'", () => {
    render(<EmptyState title="On surface" variant="on-surface" />);
    const section = screen.getByRole("heading", { level: 3 }).closest(
      "[data-slot='empty-state']",
    );
    expect(section).toHaveAttribute("data-variant", "on-surface");
    expect(section).not.toHaveClass("border-dashed");
    expect(section).not.toHaveClass("bg-bone");
  });
});
