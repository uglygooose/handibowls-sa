import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type Session = "AM" | "PM";
type GameFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";

function normalizeSession(v: unknown): Session | null {
  const t = String(v ?? "").toUpperCase();
  if (t === "AM") return "AM";
  if (t === "PM") return "PM";
  return null;
}

function normalizeFormat(v: unknown): GameFormat {
  const t = String(v ?? "SINGLES").toUpperCase();
  if (t === "DOUBLES") return "DOUBLES";
  if (t === "TRIPLES") return "TRIPLES";
  if (t === "FOUR_BALL") return "FOUR_BALL";
  return "SINGLES";
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asInt(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function isUniqueViolation(msg: string | undefined) {
  const m = String(msg ?? "").toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint");
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

    const invitee_player_id = String(body?.invitee_player_id ?? "");
    const green_id = String(body?.green_id ?? "");
    const booking_date = String(body?.date ?? "");
    const session = normalizeSession(body?.session);
    const lane_number = asInt(body?.lane_number);
    const game_format = normalizeFormat(body?.game_format);

    if (!invitee_player_id) return NextResponse.json({ error: "Missing invitee_player_id" }, { status: 400 });
    if (!green_id) return NextResponse.json({ error: "Missing green_id" }, { status: 400 });
    if (!isValidDateOnly(booking_date)) return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
    if (!session) return NextResponse.json({ error: "Invalid session (AM/PM)" }, { status: 400 });
    if (lane_number == null || lane_number < 1) return NextResponse.json({ error: "Invalid lane_number" }, { status: 400 });

    const { data: prof, error: pErr } = await supabase.from("profiles").select("id, club_id").eq("id", user.id).maybeSingle();
    const profRow = (prof ?? null) as unknown as { club_id: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

    const clubId = String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id on profile" }, { status: 400 });

    const { data: mePlayer, error: meErr } = await supabase.from("players").select("id, club_id").eq("user_id", user.id).maybeSingle();
    const mePlayerRow = (mePlayer ?? null) as unknown as { id?: string; club_id?: string | null } | null;
    if (meErr || !mePlayerRow?.id) return NextResponse.json({ error: "No player record for this user" }, { status: 400 });
    const myPlayerId = String(mePlayerRow.id);

    if (invitee_player_id === myPlayerId) return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });

    const { data: invitee, error: iErr } = await supabase
      .from("players")
      .select("id, club_id")
      .eq("id", invitee_player_id)
      .maybeSingle();

    const inviteeRow = (invitee ?? null) as unknown as { id?: string; club_id?: string | null } | null;
    if (iErr || !inviteeRow?.id) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });
    if (String(inviteeRow.club_id ?? "") !== clubId) return NextResponse.json({ error: "Invitee is not in your club" }, { status: 403 });

    const { data: green, error: gErr } = await supabase
      .from("club_greens")
      .select("id, club_id, lane_count, is_active")
      .eq("id", green_id)
      .maybeSingle();

    const greenRow = (green ?? null) as unknown as { club_id?: string | null; lane_count?: number | null; is_active?: boolean | null } | null;
    if (gErr || !greenRow) return NextResponse.json({ error: "Green not found" }, { status: 404 });
    if (String(greenRow.club_id ?? "") !== clubId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (greenRow.is_active === false) return NextResponse.json({ error: "Green is not active" }, { status: 400 });

    const maxLanes = Number(greenRow.lane_count ?? 6);
    if (lane_number > maxLanes) return NextResponse.json({ error: `lane_number must be 1..${maxLanes}` }, { status: 400 });

    // 1) Reserve the slot
    const bookingIns = await supabase
      .from("lane_bookings")
      .insert({
        club_id: clubId,
        green_id,
        booking_date,
        session,
        lane_number,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (bookingIns.error || !bookingIns.data?.id) {
      if (isUniqueViolation(bookingIns.error?.message)) {
        return NextResponse.json({ error: "That lane is already booked for this session." }, { status: 409 });
      }
      return NextResponse.json({ error: bookingIns.error?.message ?? "Could not create booking" }, { status: 400 });
    }

    const bookingId = String(bookingIns.data.id);

    // 2) Create invite
    const inviteIns = await supabase
      .from("game_invites")
      .insert({
        club_id: clubId,
        inviter_player_id: myPlayerId,
        invitee_player_id,
        booking_id: bookingId,
        game_format,
        status: "PROPOSED",
      })
      .select("id")
      .single();

    if (inviteIns.error || !inviteIns.data?.id) {
      // best-effort cleanup
      await supabase.from("lane_bookings").delete().eq("id", bookingId);
      return NextResponse.json({ error: inviteIns.error?.message ?? "Could not create invite" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, invite_id: String(inviteIns.data.id), booking_id: bookingId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}

