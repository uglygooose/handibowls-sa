import Link from "next/link";

import { PROSE_H2, PROSE_LINK, PROSE_UL } from "./styles";

export default function ScoringAMatch() {
  return (
    <>
      <p>
        Either captain can open the scorecard once both teams are at the rink
        and ready to play.
      </p>

      <h2 className={PROSE_H2}>Opening the scorecard</h2>
      <p>
        Sign in and go to{" "}
        <Link className={PROSE_LINK} href="/play">
          /play
        </Link>
        . Your upcoming matches appear on the home tab &mdash; tap a match to
        open its scorecard. The first captain to open it claims the scoring
        role for that team. That&apos;s per-team, so both captains can score
        at the same time on different devices.
      </p>

      <h2 className={PROSE_H2}>The per-end grid</h2>
      <p>
        Each end is one row. Tap your team&apos;s column, then enter the
        shots scored that end. The running total updates as you go.
      </p>
      <p>Two scoring-friendly toggles live above the grid:</p>
      <ul className={PROSE_UL}>
        <li>
          <strong>Wake lock</strong> &mdash; keeps the screen on while the
          scorecard is open, so you don&apos;t have to wake the device every
          end.
        </li>
        <li>
          <strong>Wet hands</strong> &mdash; bumps tap targets and the keypad
          to a larger size for damp or gloved hands.
        </li>
      </ul>
      <p>
        Both are off by default and persist per device. Re-confirming an end
        overwrites the previous row, so you can edit any row up until you
        submit.
      </p>

      <h2 className={PROSE_H2}>Captain submitted, then opposing confirmation</h2>
      <p>
        When you&apos;ve finished and the result reads correctly, tap{" "}
        <strong>Submit</strong>. Your row is marked{" "}
        <em>captain submitted</em> and freezes &mdash; you can&apos;t edit
        further from your side. The opposing captain sees your submission and
        either confirms (which moves the match to <em>opponent confirmed</em>,
        awaiting club admin verification) or contests it.
      </p>

      <h2 className={PROSE_H2}>If the scores diverge</h2>
      <p>
        Before submission, just re-tap the end and enter the correct shots
        &mdash; the row overwrites. Once both captains have submitted and the
        scores still don&apos;t match, contact your club admin. They have an
        admin-side override that records who edited what and why; matches
        don&apos;t go in the books with disputed numbers.
      </p>

      <h2 className={PROSE_H2}>If your signal drops</h2>
      <p>
        Scoring works while you&apos;re online. If signal drops briefly, the
        app queues your taps locally and syncs on reconnect &mdash; there&apos;s
        a sync badge above the scorecard so you can see when everything is
        flushed. For v1, plan to score with at least intermittent
        connectivity; long offline stretches aren&apos;t supported yet.
      </p>
    </>
  );
}
