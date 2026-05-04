import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import HelpIndexPage from "@/app/(public)/help/page";
import {
  ARTICLES,
  ARTICLE_ORDER,
} from "@/app/(public)/help/_articles/articles";

// Phase 13 / 13-6 / Batch B — /help index covers the article-link
// contract. We don't pin per-article copy here (operator review is
// the content gate); just that the four canonical slugs render
// with the right hrefs, in the right order, with the right titles
// and summaries.

describe("HelpIndexPage", () => {
  it("renders all four articles in canonical order with correct hrefs", () => {
    const { container } = render(<HelpIndexPage />);
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        "[data-slot='help-article-link']",
      ),
    );

    expect(links).toHaveLength(4);

    const slugs = links.map((l) => l.dataset.helpSlug);
    expect(slugs).toEqual(ARTICLE_ORDER);

    for (const link of links) {
      const slug = link.dataset.helpSlug as keyof typeof ARTICLES;
      expect(link.getAttribute("href")).toBe(`/help/${slug}`);
      expect(link.textContent).toContain(ARTICLES[slug].title);
      expect(link.textContent).toContain(ARTICLES[slug].summary);
    }
  });

  it("renders the page heading and lead", () => {
    const { container } = render(<HelpIndexPage />);
    expect(container.textContent).toContain("How to use HandiBowls");
    expect(container.textContent).toContain("HandiBowls help");
  });
});
