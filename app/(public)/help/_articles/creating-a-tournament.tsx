import Link from "next/link";

import { PROSE_H2, PROSE_LINK, PROSE_UL } from "./styles";

export default function CreatingATournament() {
  return (
    <>
      <p>
        Creating a tournament takes about two minutes if you have the basics
        ready: name, format, structure, dates, and a sense of how you&apos;ll
        seed entries.
      </p>

      <h2 className={PROSE_H2}>The New Tournament form</h2>
      <p>
        Open{" "}
        <Link className={PROSE_LINK} href="/manage/tournaments">
          /manage/tournaments
        </Link>{" "}
        and tap &ldquo;New tournament&rdquo;. You&apos;ll be asked for:
      </p>
      <ul className={PROSE_UL}>
        <li>A name members will recognise on the entries list.</li>
        <li>A discipline &mdash; Singles, Pairs, Triples, Fours, or Mixed Pairs.</li>
        <li>A structure &mdash; Knockout, Round-robin, or Sectional.</li>
        <li>Start and end dates.</li>
        <li>
          An entries-close date &mdash; the cut-off after which round 1 can be
          generated.
        </li>
      </ul>
      <p>
        The form creates the tournament in <strong>draft</strong> status.
        Drafts are visible only to club admins until you publish them.
      </p>

      <h2 className={PROSE_H2}>Choosing how to seed</h2>
      <p>Three seeding methods are available:</p>
      <ul className={PROSE_UL}>
        <li>
          <strong>Random</strong> &mdash; entries are shuffled before round 1
          is generated. Use this when seeding doesn&apos;t matter (social or
          first-time events).
        </li>
        <li>
          <strong>Seeded</strong> &mdash; you assign a seed number per entry.
          The fixture generator places higher-seeded teams to avoid early
          meetings.
        </li>
        <li>
          <strong>Sectional</strong> &mdash; entries are split into sections
          and play within their section first.
        </li>
      </ul>
      <p>
        BSA&apos;s national tournaments use seeding informed by district
        recommendations. HandiBowls supports seeded draws but doesn&apos;t
        claim to reproduce any specific BSA algorithm &mdash; coaches and
        conveners decide the seed values.
      </p>

      <h2 className={PROSE_H2}>Closing entries and generating round 1</h2>
      <p>
        The entries-close date doesn&apos;t automatically transition the
        tournament. It&apos;s the gate after which the &ldquo;Generate round
        1&rdquo; action becomes available. When you generate, the tournament
        moves from <strong>open</strong> to <strong>in_progress</strong> and
        fixtures appear on{" "}
        <Link className={PROSE_LINK} href="/play">
          /play
        </Link>{" "}
        for entered players.
      </p>
      <p>
        Once round 1 is live, entries are frozen for the duration of the
        tournament.
      </p>

      <h2 className={PROSE_H2}>The status timeline</h2>
      <p>A tournament moves through four statuses:</p>
      <ul className={PROSE_UL}>
        <li>
          <strong>draft</strong> &mdash; being set up, visible only to club
          admins.
        </li>
        <li>
          <strong>open</strong> &mdash; published and accepting entries.
        </li>
        <li>
          <strong>in_progress</strong> &mdash; round 1 has been generated and
          play has started.
        </li>
        <li>
          <strong>completed</strong> &mdash; the final has been recorded and
          the tournament is closed.
        </li>
      </ul>
      <p>
        <strong>cancelled</strong> is a terminal state available from any
        status. Use it if a tournament has to be called off before completion;
        existing entries and any played matches stay on record but no further
        play is allowed.
      </p>

      <h2 className={PROSE_H2}>Knockout vs round-robin</h2>
      <p>
        A knockout is single-elimination &mdash; winners advance, losers are
        out, and the bracket halves each round until one team remains. A
        round-robin runs every team against every other team and ranks them
        on shots up once everyone has played everyone. Sectional events
        combine the two: round-robin within each section, then knockout among
        the section winners.
      </p>
    </>
  );
}
