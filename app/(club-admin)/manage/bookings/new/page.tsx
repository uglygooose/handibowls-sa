import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/role";

import { T20BookingForm } from "./_components/T20BookingForm";
import { getBookingFormData } from "./_data";

// Phase 12 / 12-1 followup — admin Twenty 20 assessment scheduling
// surface. v1 supports purpose='t20_assessment' bookings only — the
// general-purpose admin booking creation flow remains unbuilt
// (DRIFT_LOG: Admin general booking creation form deferred).
//
// Pre-fill via query params:
//   ?player_id=<uuid>            — pre-select the player picker
//   ?request_message_id=<uuid>   — display-only, surfaces a back-link
//                                  to the originating /manage/messages
//                                  request row
//
// Both query params are validated as UUIDs server-side before being
// passed to the Client island. Invalid values are silently dropped.

export const metadata = {
  title: "Schedule Twenty 20 assessment · HandiBowls",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Promise<{
  player_id?: string;
  request_message_id?: string;
}>;

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const playerIdParam = isUuid(params.player_id) ? params.player_id ?? null : null;
  const requestMessageIdParam = isUuid(params.request_message_id)
    ? params.request_message_id ?? null
    : null;

  const data = await getBookingFormData();
  if (!data.ok) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="m-0 mb-3 font-display text-[28px] font-black italic uppercase tracking-tight">
          No club resolved.
        </h1>
        <p className="m-0 text-[14px] text-ink-muted">
          Your account is signed in but no host club is currently active. Pick
          a club from the top bar and retry.
        </p>
      </div>
    );
  }

  // Drop pre-fill IDs that don't reference active members of this club —
  // the player picker is constrained to current members anyway, so a
  // stale id from an old request would render as "no selection."
  const initialPlayerId =
    playerIdParam &&
    data.members.some((m) => m.profile_id === playerIdParam)
      ? playerIdParam
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-7">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          {data.club_name}
        </span>
        <h1 className="m-0 font-display text-[28px] font-black italic uppercase tracking-tight">
          Schedule Twenty 20 assessment
        </h1>
        <p className="m-0 text-[13px] text-ink-muted">
          Assigns a rink and time, fires a notification to the player. Only
          purpose=t20_assessment bookings ship through this form for v1.
        </p>
      </header>

      <T20BookingForm
        members={data.members}
        rinks={data.rinks}
        clubName={data.club_name}
        initialPlayerId={initialPlayerId}
        requestMessageId={requestMessageIdParam}
      />
    </div>
  );
}

function isUuid(s: string | undefined): boolean {
  return typeof s === "string" && UUID_RE.test(s);
}
