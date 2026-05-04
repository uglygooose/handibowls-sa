import Link from "next/link";

import { PROSE_H2, PROSE_LINK, PROSE_UL } from "./styles";

export default function BookingARink() {
  return (
    <>
      <p>
        <Link className={PROSE_LINK} href="/book">
          /book
        </Link>{" "}
        is your club&apos;s rink-booking surface. Anyone with an active
        membership at the club can book a rink during the hours your admin
        has opened.
      </p>

      <h2 className={PROSE_H2}>Opening the book</h2>
      <p>
        Sign in and tap <strong>Book</strong> in the bottom nav, or go to{" "}
        <Link className={PROSE_LINK} href="/book">
          /book
        </Link>{" "}
        directly. The top of the page is a horizontal date strip &mdash;
        today is highlighted; swipe or tap to move forward up to the booking
        window your club allows.
      </p>
      <p>
        Below the date strip is the slot list for that day, grouped by green
        and rink. Each slot shows the start time and either &ldquo;Available&rdquo;
        or the booker&apos;s display name if it&apos;s already taken.
      </p>

      <h2 className={PROSE_H2}>Picking a slot</h2>
      <p>
        Tap an available slot to open the booking sheet. You&apos;ll be asked
        for:
      </p>
      <ul className={PROSE_UL}>
        <li>
          The purpose &mdash; Roll-up, Practice, Coaching, Match, or Social.
        </li>
        <li>
          The number of players you&apos;re bringing, so the next person knows
          whether to share the rink.
        </li>
        <li>An optional note for the club admin.</li>
      </ul>
      <p>
        Confirm to lock the slot in. You&apos;ll see it on{" "}
        <Link className={PROSE_LINK} href="/me">
          /me
        </Link>{" "}
        under &ldquo;My bookings&rdquo;, and the slot disappears from the
        available list for everyone else.
      </p>

      <h2 className={PROSE_H2}>If someone beat you to it</h2>
      <p>
        If two players tap the same slot at the same moment, only one
        booking goes through &mdash; the database has a hard guard against
        rink overlaps. The other player gets a quick &ldquo;Slot just taken
        &mdash; pick another?&rdquo; prompt with the next nearest options.
        Annoying when it happens, but it means the booking list is always
        truthful.
      </p>

      <h2 className={PROSE_H2}>Cancelling</h2>
      <p>
        Open{" "}
        <Link className={PROSE_LINK} href="/me">
          /me
        </Link>
        , find the booking under &ldquo;My bookings&rdquo;, and tap to cancel.
        The slot reopens immediately for someone else.
      </p>

      <h2 className={PROSE_H2}>What admins control</h2>
      <p>
        Behind the scenes, club admins set weekly availability per rink (which
        days, which time blocks) and can mark a rink unavailable for
        maintenance. If a rink you usually book has gone dark, your club
        admin has either disabled it or hasn&apos;t set its availability yet
        &mdash; message them via{" "}
        <Link className={PROSE_LINK} href="/me/inbox">
          /me/inbox
        </Link>{" "}
        if you&apos;re not sure.
      </p>
    </>
  );
}
