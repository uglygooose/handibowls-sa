import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// notFound throws inside Next at runtime; we mirror that here so the
// unknown-slug branch is observable as a thrown error in tests.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import HelpArticlePage from "@/app/(public)/help/[slug]/page";
import {
  ARTICLES,
  ARTICLE_ORDER,
} from "@/app/(public)/help/_articles/articles";

async function renderPage(slug: string) {
  const tree = await HelpArticlePage({ params: Promise.resolve({ slug }) });
  return render(tree as React.ReactElement);
}

describe("HelpArticlePage", () => {
  it.each(ARTICLE_ORDER)(
    "renders the title for the %s article",
    async (slug) => {
      const { container } = await renderPage(slug);
      expect(container.textContent).toContain(ARTICLES[slug].title);
      expect(container.textContent).toContain(ARTICLES[slug].kicker);
    },
  );

  it("renders a back-link to /help", async () => {
    const { container } = await renderPage(ARTICLE_ORDER[0]);
    const backLink = container.querySelector<HTMLAnchorElement>(
      "[data-slot='help-back-link']",
    );
    expect(backLink).not.toBeNull();
    expect(backLink?.getAttribute("href")).toBe("/help");
  });

  it("calls notFound() on an unknown slug", async () => {
    await expect(renderPage("not-a-real-slug")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
