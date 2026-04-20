import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

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
    if (!invite_id) return NextResponse.json({ error: "Missing invite_id" }, { status: 400 });

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
      .select("id, club_id, inviter_player_id, invitee_player_id, booking_id, status")
      .eq("id", invite_id)
      .maybeSingle();

    if (inviteQ.error || !inviteQ.data) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

    const invite = inviteQ.data as unknown as { club_id: string; inviter_player_id: string; booking_id: string | null; status: string };
    if (String(invite.club_id ?? "") !== clubId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (String(invite.inviter_player_id ?? "") !== myPlayerId) return NextResponse.json({ error: "Only the inviter can cancel" }, { status: 403 });
    if (String(invite.status ?? "") !== "PROPOSED") return NextResponse.json({ error: `Invite not PROPOSED (current: ${invite.status})` }, { status: 400 });

    const up = await supabase
      .from("game_invites")
      .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
      .eq("id", invite_id);
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const bid = String(invite.booking_id ?? "");
    if (bid) await supabase.from("lane_bookings").delete().eq("id", bid);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
