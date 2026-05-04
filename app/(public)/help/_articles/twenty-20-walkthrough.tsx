import Link from "next/link";

import { PROSE_H2, PROSE_LINK, PROSE_UL } from "./styles";

export default function Twenty20Walkthrough() {
  return (
    <>
      <p>
        Twenty 20 is HandiBowls&apos; BSA-aligned skills assessment. A coach
        takes you through seven sections &mdash; line, zones, length &mdash;
        capturing every delivery, and the rubric grades you Gold, Silver, or
        Bronze, or recommends a reassessment.
      </p>

      <h2 className={PROSE_H2}>Requesting an assessment (players)</h2>
      <p>
        Go to{" "}
        <Link className={PROSE_LINK} href="/t20">
          /t20
        </Link>
        . If your club has an accredited coach, you&apos;ll see a
        &ldquo;Request assessment&rdquo; button. Tap it and pick a coach from
        the list. The coach is notified and either accepts (scheduling a slot
        via{" "}
        <Link className={PROSE_LINK} href="/book">
          /book
        </Link>
        ) or declines.
      </p>
      <p>
        Only one open request per club at a time. Past assessments stay on{" "}
        <Link className={PROSE_LINK} href="/t20">
          /t20
        </Link>{" "}
        with their grade, date, and the coach who graded you.
      </p>

      <h2 className={PROSE_H2}>Running an assessment (coaches)</h2>
      <p>
        Coaches must be{" "}
        <strong>BSA-accredited; Level 2 is preferred.</strong> Open{" "}
        <Link className={PROSE_LINK} href="/manage/t20">
          /manage/t20
        </Link>{" "}
        and tap &ldquo;New assessment&rdquo;. Pick the player and rubric
        version (active by default), then continue to the capture wizard.
      </p>

      <h2 className={PROSE_H2}>The capture wizard</h2>
      <p>
        The wizard walks the coach through all seven sections in order. Eight
        bowls per distance, two rounds &mdash; sixteen deliveries per distance
        bucket.
      </p>
      <ul className={PROSE_UL}>
        <li>
          <strong>Sections 1&ndash;2 (Jacks, Targets)</strong> &mdash; line
          outcome per delivery: on-line, narrow left or right, wide left or
          right.
        </li>
        <li>
          <strong>Sections 3&ndash;5 (Drive, Control, Trail)</strong> &mdash;
          the 8-wedge compass picker. Tap zone 1&ndash;8 to mark where the
          bowl finished, or &ldquo;miss&rdquo; if it didn&apos;t make the
          head.
        </li>
        <li>
          <strong>Sections 6&ndash;7 (Speedhumps Asc/Desc)</strong> &mdash;
          on or off the length.
        </li>
      </ul>
      <p>
        A Fore/Back hand toggle sits next to the picker for sections
        3&ndash;7 &mdash; flip it per delivery so the player&apos;s natural-line
        skew shows up in the heatmap.
      </p>
      <p>
        Capture is <strong>online-only for v1.</strong> Unlike the scorecard,
        there&apos;s no offline outbox here &mdash; don&apos;t start an
        assessment without signal.
      </p>

      <h2 className={PROSE_H2}>Results and reassessment</h2>
      <p>
        After the last section the coach can add written notes against any
        section, then save. The grade is computed from the rubric:
      </p>
      <ul className={PROSE_UL}>
        <li>
          <strong>Gold</strong> &mdash; 80% and above.
        </li>
        <li>
          <strong>Silver</strong> &mdash; 65&ndash;79%.
        </li>
        <li>
          <strong>Bronze</strong> &mdash; 50&ndash;64%.
        </li>
        <li>
          <strong>Reassess</strong> &mdash; under 50%.
        </li>
      </ul>
      <p>
        The result lands on the player&apos;s{" "}
        <Link className={PROSE_LINK} href="/t20">
          /t20
        </Link>{" "}
        page and on{" "}
        <Link className={PROSE_LINK} href="/manage/t20">
          /manage/t20
        </Link>{" "}
        for coaches. A Reassess result lets the player request a new
        assessment immediately; Gold, Silver, or Bronze grades sit until the
        player chooses to chase a higher band.
      </p>

      <h2 className={PROSE_H2}>A note on rubric versions</h2>
      <p>
        At any time exactly one rubric version is active. Existing assessments
        stay pinned to whichever rubric was active when they were captured,
        so historical grades never shift if a new rubric is activated later.
      </p>
    </>
  );
}
