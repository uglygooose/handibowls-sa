import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

function normalizeRole(v: unknown) {
  return String(v ?? "").toUpperCase();
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

    const booking_id = String(body?.booking_id ?? "");
    if (!booking_id) return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });

    const { data: prof } = await supabase.from("profiles").select("id, club_id, is_admin, role").eq("id", user.id).maybeSingle();
    const profRow = (prof ?? null) as unknown as { club_id: string | null; is_admin: boolean | null; role: string | null } | null;
    const role = normalizeRole(profRow?.role);
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdmin = Boolean(profRow?.is_admin) || isSuperAdmin;
    const clubId = String(profRow?.club_id ?? "");

    const { data: booking, error: bErr } = await supabase
      .from("lane_bookings")
      .select("id, club_id, created_by")
      .eq("id", booking_id)
      .maybeSingle();

    if (bErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const bookingRow = (booking ?? null) as unknown as { created_by: string | null; club_id: string | null } | null;
    const createdBy = String(bookingRow?.created_by ?? "");
    const bookingClubId = String(bookingRow?.club_id ?? "");

    const allowed = isSuperAdmin || createdBy === user.id || (isAdmin && clubId && bookingClubId === clubId);
    if (!allowed) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { error: delErr } = await supabase.from("lane_bookings").delete().eq("id", booking_id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
