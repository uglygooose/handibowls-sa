import { render } from "@react-email/render";
import type { ReactElement } from "react";

// Phase 11 / 11-1 — pure render helper.
//
// Produces both the HTML and plain-text representation of a React
// Email component in parallel. Pure: no Resend coupling, no env
// reads, so templates are testable in isolation (snapshot tests,
// component tests).
//
// `@react-email/render` v2 returns a Promise<string>. The two
// invocations are independent so they run in parallel — the
// plain-text path internally uses html-to-text on the rendered
// HTML, but the package handles the duplication cost.
//
// `htmlToTextOptions.wordwrap = 80` matches the convention used by
// most transactional email plain-text views. Email clients that
// drop HTML (Outlook plain-text mode, RSS aggregators) get a
// readable fallback rather than a single 1000-character line.

export type RenderedEmail = {
  html: string;
  text: string;
};

export async function renderEmail(node: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(node),
    render(node, { plainText: true, htmlToTextOptions: { wordwrap: 80 } }),
  ]);
  return { html, text };
}
