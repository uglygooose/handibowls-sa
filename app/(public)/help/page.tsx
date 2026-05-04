import Link from "next/link";

import { ARTICLES, ARTICLE_ORDER } from "./_articles/articles";

// Phase 13 / 13-6 / Batch B — public help index. Lean v1 shape: 4
// plain-JSX articles, no search, no taxonomy. Mirrors the inline
// header rhythm of /privacy + /terms (kicker → display h1 → muted
// lead) so the legal-adjacent surfaces read as siblings.

export const dynamic = "force-static";

export const metadata = {
  title: "Help · HandiBowls",
  description:
    "Short guides covering tournaments, scoring, bookings, and Twenty 20 assessments.",
};

export default function HelpIndexPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <header className="mb-10 border-b border-border pb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          HandiBowls help
        </p>
        <h1 className="mt-3 font-display text-[44px] font-black italic leading-[0.95] tracking-tight">
          How to use HandiBowls
        </h1>
        <p className="mt-4 text-[16px] leading-[1.55] text-ink-muted">
          Short, plain-language guides covering the four things you&apos;ll
          do most: running a tournament, scoring a match, booking a rink, and
          going through a Twenty 20 assessment.
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {ARTICLE_ORDER.map((slug) => {
          const article = ARTICLES[slug];
          return (
            <li key={slug}>
              <Link
                href={`/help/${slug}`}
                className="block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-ink"
                data-slot="help-article-link"
                data-help-slug={slug}
              >
                <h2 className="font-display text-[20px] font-extrabold italic tracking-tight">
                  {article.title}
                </h2>
                <p className="mt-1 text-[14px] leading-[1.55] text-ink-muted">
                  {article.summary}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
