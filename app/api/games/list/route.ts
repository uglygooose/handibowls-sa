import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type GameFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";

function isMissingRelationError(msg: string | undefined) {
  const m = String(msg ?? "").toLowerCase();
  return m.includes("does not exist") && (m.includes("relation") || m.includes("table"));
}

export async function GET() {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, club_id")
      .eq("id", user.id)
      .maybeSingle();

    const profRow = (prof ?? null) as unknown as { club_id: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

    const clubId = String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id on profile" }, { status: 400 });

    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const mePlayerRow = (mePlayer ?? null) as unknown as { id?: string } | null;
    if (meErr || !mePlayerRow?.id) return NextResponse.json({ error: "No player record for this user" }, { status: 400 });
    const myPlayerId = String(mePlayerRow.id);

    const laddersQ = await supabase.from("ladders").select("id, scope, club_id").eq("scope", "CLUB").eq("club_id", clubId).limit(1);
    if (laddersQ.error) return NextResponse.json({ error: laddersQ.error.message }, { status: 400 });
    const ladderId = String((laddersQ.data ?? [])[0]?.id ?? "");

    const greensQ = await supabase
      .from("club_greens")
      .select("id, name, lane_count, sort_order, is_active")
      .eq("club_id", clubId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (greensQ.error) {
      if (isMissingRelationError(greensQ.error.message)) {
        return NextResponse.json(
          {
            error:
              'Missing DB tables. Run `supabase/migrations/20260217_club_greens_and_lane_bookings.sql` and `supabase/migrations/20260217_game_invites_and_match_schedules.sql` in your Supabase SQL editor.',
          },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: greensQ.error.message }, { status: 400 });
    }

    const playersQ = await supabase
      .from("players")
      .select("id, display_name")
      .eq("club_id", clubId)
      .order("display_name", { ascending: true });

    if (playersQ.error) return NextResponse.json({ error: playersQ.error.message }, { status: 400 });

    const invitesQ = await supabase
      .from("game_invites")
      .select("id, club_id, inviter_player_id, invitee_player_id, booking_id, game_format, status, match_id, created_at, responded_at")
      .or(`inviter_player_id.eq.${myPlayerId},invitee_player_id.eq.${myPlayerId}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (invitesQ.error) {
      if (isMissingRelationError(invitesQ.error.message)) {
        return NextResponse.json(
          {
            error:
              'Missing DB tables. Run `supabase/migrations/20260217_game_invites_and_match_schedules.sql` in your Supabase SQL editor.',
          },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: invitesQ.error.message }, { status: 400 });
    }

    const invites = (invitesQ.data ?? []) as unknown as Array<{
      id: string;
      inviter_player_id: string;
      invitee_player_id: string;
      booking_id: string | null;
      game_format: GameFormat;
      status: string;
      match_id: string | null;
      created_at: string;
      responded_at: string | null;
    }>;

    const bookingIds = Array.from(new Set(invites.map((i) => String(i.booking_id ?? "")).filter(Boolean)));

    const bookingsQ: { data: unknown[] | null; error: { message: string } | null } = bookingIds.length
      ? ((await supabase
          .from("lane_bookings")
          .select("id, green_id, booking_date, session, lane_number, created_by, created_at")
          .in("id", bookingIds)) as unknown as { data: unknown[] | null; error: { message: string } | null })
      : { data: [], error: null };

    if (bookingsQ.error) return NextResponse.json({ error: bookingsQ.error.message }, { status: 400 });

    const bookingRows = (bookingsQ.data ?? []) as unknown as Array<{
      id: string;
      green_id: string;
      booking_date: string;
      session: "AM" | "PM";
      lane_number: number;
      created_by: string;
      created_at: string;
    }>;

    const greenIds = Array.from(new Set(bookingRows.map((b) => String(b.green_id ?? "")).filter(Boolean)));
    const greensQ2: { data: unknown[] | null; error: { message: string } | null } = greenIds.length
      ? ((await supabase.from("club_greens").select("id, name, lane_count").in("id", greenIds)) as unknown as {
          data: unknown[] | null;
          error: { message: string } | null;
        })
      : { data: [], error: null };

    if (greensQ2.error) return NextResponse.json({ error: greensQ2.error.message }, { status: 400 });

    const greenMiniRows = (greensQ2.data ?? []) as unknown as Array<{ id: string; name: string | null; lane_count: number | null }>;
    const greenById: Record<string, { id: string; name: string; lane_count: number }> = {};
    for (const g of greenMiniRows) {
      const id = String(g.id ?? "");
      if (!id) continue;
      greenById[id] = { id, name: String(g.name ?? ""), lane_count: Number(g.lane_count ?? 6) };
    }

    const bookingById: Record<
      string,
      {
        id: string;
        green_id: string;
        booking_date: string;
        session: "AM" | "PM";
        lane_number: number;
        created_by: string;
        created_at: string;
      }
    > = {};
    for (const b of bookingRows) bookingById[String(b.id)] = b;

    const matchIds = Array.from(new Set(invites.map((i) => String(i.match_id ?? "")).filter(Boolean)));
    const matchesQ: { data: unknown[] | null; error: { message: string } | null } = matchIds.length
      ? ((await supabase
          .from("matches")
          .select(
            "id, status, match_type, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at, created_at"
          )
          .in("id", matchIds)) as unknown as { data: unknown[] | null; error: { message: string } | null })
      : { data: [], error: null };

    if (matchesQ.error) return NextResponse.json({ error: matchesQ.error.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      me: { player_id: myPlayerId, club_id: clubId, ladder_id: ladderId },
      greens: greensQ.data ?? [],
      players: playersQ.data ?? [],
      invites,
      bookingById,
      greenById,
      matches: matchesQ.data ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
