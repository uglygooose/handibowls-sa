import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";

import { getGreensData } from "./_data";
import { RinkDisableToggle } from "./_components/RinkDisableToggle";
import { WeeklyAvailabilityEditor } from "./_components/WeeklyAvailabilityEditor";

// Phase 9-1 — `/manage/greens`. Replaces the Phase 4 stub.
//
// Two surfaces:
//   • WeeklyAvailabilityEditor — recurring closure schedule for the
//     club, snapshot-replace via `replaceWeeklyClosures` action.
//   • Per-green panels with rink-disable toggles. Each toggle is a
//     Client island; the page-level data is fetched server-side and
//     handed down as props so SSR is fully populated.
//
// super_admin viewing this surface lands without a host club —
// renders an empty card pointing at /platform/clubs (matching the
// /manage/members precedent).

export const metadata = {
  title: "Greens · HandiBowls",
};

export default async function ManageGreens() {
  const data = await getGreensData();

  if (!data.ok) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
        <AdminPageHero eyebrow="Club admin" title="Greens" containerWidth="none" />
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow={`Club admin · ${data.clubName}`}
        title="Greens"
        description="Manage the weekly availability schedule and individual rink status. Player surfaces respect both — closed weekday hours hide from the slot grid, and disabled rinks drop out of the available-rinks list per slot."
        containerWidth="none"
      />

      <WeeklyAvailabilityEditor
        clubId={data.clubId}
        initialClosures={data.closures}
      />

      <section data-slot="greens-list" className="flex flex-col gap-4">
        <header>
          <h2 className="font-display text-[18px] font-black uppercase italic tracking-tight">
            Rinks by green
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            Disabling a rink hides it from new bookings — existing
            bookings on the rink stay intact.
          </p>
        </header>

        {data.greens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-ink-muted">
            No greens configured for this club yet. The seed script + super-
            admin tooling create greens; this surface manages availability
            once they exist.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.greens.map((green) => (
              <li
                key={green.id}
                data-slot="green-panel"
                data-green-id={green.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <header className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[16px] font-extrabold tracking-tight">
                      {green.name}
                    </h3>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
                      {green.surface ?? "Surface unknown"} · {green.rink_count}{" "}
                      rinks
                    </p>
                  </div>
                </header>
                {green.rinks.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">
                    No rinks configured on this green yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {green.rinks.map((rink) => (
                      <li key={rink.id}>
                        <RinkDisableToggle
                          rinkId={rink.id}
                          rinkLabel={`${green.name} ${rink.number}`}
                          active={rink.active}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
