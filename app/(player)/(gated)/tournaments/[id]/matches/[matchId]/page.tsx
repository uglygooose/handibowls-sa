import { notFound, redirect } from "next/navigation";

import { getScorecardMatch } from "./_data";
import { Scorecard } from "./_components/Scorecard";

// Phase 8c — scorecard route. Server Component fetcher → Client Component
// surface. Routes that don't resolve to a participant match send the
// player back to the tournament detail (read-only); a missing match
// 404s through Next's notFound().
//
// The Client Component renders as a fixed-position full-bleed overlay
// (z-60) — it sits on top of the player layout chrome. The bottom nav
// (z-40) and TopBar (sticky z-30) are visually obscured but still in
// the DOM, which is fine for SR accessibility (close button uses a
// real <Link> back to the tournament detail).

type Props = {
  params: Promise<{ id: string; matchId: string }>;
};

export const metadata = {
  title: "Scorecard · HandiBowls",
};

export default async function ScorecardPage({ params }: Props) {
  const { id, matchId } = await params;
  const match = await getScorecardMatch(matchId);

  if (!match) notFound();
  if (match.tournament.id !== id) {
    // Tournament/match URL mismatch — bounce back to the canonical
    // detail rather than 404. Defence-in-depth against link drift.
    redirect(`/tournaments/${match.tournament.id}/matches/${matchId}`);
  }

  return <Scorecard match={match} backHref={`/tournaments/${id}`} />;
}
