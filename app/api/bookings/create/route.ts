import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type Session = "AM" | "PM";

function normalizeSession(v: unknown): Session | null {
  const t = String(v ?? "").toUpperCase();
  if (t === "AM") return "AM";
  if (t === "PM") return "PM";
  return null;
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

    const green_id = String(body?.green_id ?? "");
    const booking_date = String(body?.date ?? "");
    const session = normalizeSession(body?.session);
    const lane_number = asInt(body?.lane_number);

    if (!green_id) return NextResponse.json({ error: "Missing green_id" }, { status: 400 });
    if (!isValidDateOnly(booking_date)) return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
    if (!session) return NextResponse.json({ error: "Invalid session (AM/PM)" }, { status: 400 });
    if (lane_number == null || lane_number < 1) return NextResponse.json({ error: "Invalid lane_number" }, { status: 400 });

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, club_id")
      .eq("id", user.id)
      .maybeSingle();

    const profRow = (prof ?? null) as unknown as { club_id: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    const clubId = String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id on profile" }, { status: 400 });

    const { data: green, error: gErr } = await supabase
      .from("club_greens")
      .select("id, club_id, lane_count, is_active")
      .eq("id", green_id)
      .maybeSingle();

    if (gErr || !green) return NextResponse.json({ error: "Green not found" }, { status: 404 });
    const greenRow = (green ?? null) as unknown as { club_id: string | null; lane_count: number | null; is_active: boolean | null } | null;
    if (!greenRow) return NextResponse.json({ error: "Green not found" }, { status: 404 });
    if (String(greenRow.club_id ?? "") !== clubId) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (greenRow.is_active === false) return NextResponse.json({ error: "Green is not active" }, { status: 400 });

    const maxLanes = Number(greenRow.lane_count ?? 6);
    if (lane_number > maxLanes) return NextResponse.json({ error: `lane_number must be 1..${maxLanes}` }, { status: 400 });

    const { data: created, error: insErr } = await supabase
      .from("lane_bookings")
      .insert({
        club_id: clubId,
        green_id,
        booking_date,
        session,
        lane_number,
        created_by: user.id,
      })
      .select("id, club_id, green_id, booking_date, session, lane_number, created_by, created_at")
      .single();

    if (insErr) {
      if (isUniqueViolation(insErr.message)) {
        return NextResponse.json({ error: "That lane is already booked for this session." }, { status: 409 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, booking: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
