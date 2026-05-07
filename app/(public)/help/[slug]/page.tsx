import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToHome } from "../../_components/BackToHome";

import { ARTICLES, ARTICLE_ORDER, type HelpSlug } from "../_articles/articles";

// Phase 13 / 13-6 / Batch B — single help article renderer. Slug
// resolved from a co-located static map; unknown slugs fall through
// to notFound(). Shell mirrors /privacy + /terms (inline header →
// prose body → bottom back-link). Article body components return a
// Fragment of <p> / <h2> / <ul> nodes; the wrapping <div> below
// gives them the shared spacing rhythm.

export const dynamic = "force-static";

export function generateStaticParams() {
  return ARTICLE_ORDER.map((slug) => ({ slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug as HelpSlug];
  if (!article) {
    return { title: "Article not found · HandiBowls help" };
  }
  return {
    title: `${article.title} · HandiBowls help`,
    description: article.summary,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const article = ARTICLES[slug as HelpSlug];
  if (!article) notFound();

  const Body = article.Component;

  return (
    <>
      <BackToHome />
      <article className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <header className="mb-10 border-b border-border pb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {article.kicker}
        </p>
        <h1 className="mt-3 font-display text-[44px] font-black italic leading-[0.95] tracking-tight">
          {article.title}
        </h1>
        <p className="mt-4 text-[16px] leading-[1.55] text-ink-muted">
          {article.summary}
        </p>
      </header>

      <div
        className="flex flex-col gap-3 text-[15px] leading-[1.6]"
        data-slot="help-article-body"
      >
        <Body />
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-[13px] text-ink-muted">
        <Link
          className="font-medium text-ink underline underline-offset-[3px] decoration-border hover:decoration-ink"
          href="/help"
          data-slot="help-back-link"
        >
          &larr; All help articles
        </Link>
      </footer>
    </article>
    </>
  );
}
