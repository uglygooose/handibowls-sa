import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type MatchType = "RANKED" | "FRIENDLY";

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = String(errMsg).toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let body: Record<string, unknown> | null = null;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const invite_id = String(body?.invite_id ?? "");
    const action = String(body?.action ?? "").toUpperCase();
    if (!invite_id) return NextResponse.json({ error: "Missing invite_id" }, { status: 400 });
    if (action !== "ACCEPT" && action !== "DECLINE") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const { data: prof, error: pErr } = await supabase.from("profiles").select("id, club_id").eq("id", user.id).maybeSingle();
    const profRow = (prof ?? null) as unknown as { club_id: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    const clubId = String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id on profile" }, { status: 400 });

    const { data: mePlayer, error: meErr } = await supabase.from("players").select("id").eq("user_id", user.id).maybeSingle();
    const mePlayerRow = (mePlayer ?? null) as unknown as { id?: string } | null;
    if (meErr || !mePlayerRow?.id) return NextResponse.json({ error: "No player record for this user" }, { status: 400 });
    const myPlayerId = String(mePlayerRow.id);

    const inviteQ = await supabase
      .from("game_invites")
      .select("id, club_id, inviter_player_id, invitee_player_id, booking_id, game_format, status, match_id")
      .eq("id", invite_id)
      .maybeSingle();

    if (inviteQ.error || !inviteQ.data) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    const invite = inviteQ.data as unknown as {
      id: string;
      club_id: string;
      inviter_player_id: string;
      invitee_player_id: string;
      booking_id: string | null;
      game_format: string;
      status: string;
      match_id: string | null;
    };

    if (String(invite.club_id ?? "") !== clubId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (String(invite.invitee_player_id ?? "") !== myPlayerId) return NextResponse.json({ error: "Only the invited player can respond" }, { status: 403 });
    if (String(invite.status ?? "") !== "PROPOSED") return NextResponse.json({ error: `Invite not PROPOSED (current: ${invite.status})` }, { status: 400 });

    if (action === "DECLINE") {
      const up = await supabase
        .from("game_invites")
        .update({ status: "DECLINED", responded_at: new Date().toISOString() })
        .eq("id", invite_id);
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

      // free slot
      const bid = String(invite.booking_id ?? "");
      if (bid) await supabase.from("lane_bookings").delete().eq("id", bid);
      return NextResponse.json({ ok: true });
    }

    // ACCEPT: create match + link schedule
    const laddersQ = await supabase.from("ladders").select("id, scope, club_id").eq("scope", "CLUB").eq("club_id", clubId).limit(1);
    if (laddersQ.error) return NextResponse.json({ error: laddersQ.error.message }, { status: 400 });
    const ladderId = String((laddersQ.data ?? [])[0]?.id ?? "");
    if (!ladderId) return NextResponse.json({ error: "Club ladder not found" }, { status: 400 });

    let matchId: string | null = null;

    const insertBase: Record<string, unknown> = {
      ladder_id: ladderId,
      challenger_player_id: String(invite.inviter_player_id),
      challenged_player_id: String(invite.invitee_player_id),
      status: "OPEN",
    };

    const match_type: MatchType = "FRIENDLY";
    const withType = await supabase.from("matches").insert({ ...insertBase, match_type }).select("id").single();
    if (!withType.error && withType.data?.id) {
      matchId = String(withType.data.id);
    } else if (withType.error && isMissingColumnError(withType.error.message, "match_type")) {
      const retry = await supabase.from("matches").insert(insertBase).select("id").single();
      if (retry.error || !retry.data?.id) {
        return NextResponse.json({ error: retry.error?.message ?? "Could not create match" }, { status: 400 });
      }
      matchId = String(retry.data.id);
    } else {
      return NextResponse.json({ error: withType.error?.message ?? "Could not create match" }, { status: 400 });
    }

    const sched = await supabase.from("match_schedules").insert({
      match_id: matchId,
      club_id: clubId,
      booking_id: invite.booking_id,
      game_format: String(invite.game_format ?? "SINGLES"),
    });

    if (sched.error) {
      // don't block acceptance if schedule insert fails (match still exists)
      // ignore
    }

    const up = await supabase
      .from("game_invites")
      .update({ status: "ACCEPTED", match_id: matchId, responded_at: new Date().toISOString() })
      .eq("id", invite_id);
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, match_id: matchId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
