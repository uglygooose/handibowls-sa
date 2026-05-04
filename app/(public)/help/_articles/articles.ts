import type { ComponentType } from "react";

import BookingARink from "./booking-a-rink";
import CreatingATournament from "./creating-a-tournament";
import ScoringAMatch from "./scoring-a-match";
import Twenty20Walkthrough from "./twenty-20-walkthrough";

// Phase 13 / 13-6 / Batch B — slug → article manifest. Slugs are
// URL-stable: treat them as part of the public contract. Adding a
// new article means appending a new slug + entry; renaming a slug
// is a breaking change for anyone holding a /help/<slug> link.

export type HelpSlug =
  | "creating-a-tournament"
  | "scoring-a-match"
  | "booking-a-rink"
  | "twenty-20-walkthrough";

export type HelpArticle = {
  title: string;
  summary: string;
  kicker: string;
  Component: ComponentType;
};

export const ARTICLES: Record<HelpSlug, HelpArticle> = {
  "creating-a-tournament": {
    title: "Creating a tournament",
    summary:
      "How club admins set up a new tournament, manage entries, and generate the first round.",
    kicker: "Help · For club admins",
    Component: CreatingATournament,
  },
  "scoring-a-match": {
    title: "Scoring a match",
    summary:
      "How team captains record an end-by-end scorecard and confirm the result with the opposing captain.",
    kicker: "Help · For team captains",
    Component: ScoringAMatch,
  },
  "booking-a-rink": {
    title: "Booking a rink",
    summary:
      "How players reserve a rink for practice, a roll-up, or a coaching session.",
    kicker: "Help · For players",
    Component: BookingARink,
  },
  "twenty-20-walkthrough": {
    title: "Twenty 20 walkthrough",
    summary:
      "How players request a Twenty 20 skills assessment and how coaches capture and grade it.",
    kicker: "Help · For players & coaches",
    Component: Twenty20Walkthrough,
  },
};

// Render order on the index page. Mirrors the most-common reader
// journey: club admins set up tournaments → captains score them →
// players book rinks → players + coaches engage with Twenty 20.
export const ARTICLE_ORDER: HelpSlug[] = [
  "creating-a-tournament",
  "scoring-a-match",
  "booking-a-rink",
  "twenty-20-walkthrough",
];
