import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

function isMissingRelationError(msg: string | undefined) {
  const m = String(msg ?? "").toLowerCase();
  return m.includes("does not exist") && (m.includes("relation") || m.includes("table"));
}

function normalizeRole(v: unknown) {
  return String(v ?? "").toUpperCase();
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const url = new URL(req.url);
    const club_id_param = url.searchParams.get("club_id") ?? "";

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, club_id, is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const profRow = (prof ?? null) as unknown as { club_id: string | null; is_admin: boolean | null; role: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

    const role = normalizeRole(profRow.role);
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdmin = Boolean(profRow.is_admin) || isSuperAdmin;

    if (!isAdmin) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const clubId = isSuperAdmin ? (club_id_param || String(profRow.club_id ?? "")) : String(profRow.club_id ?? "");
    if (!clubId) return NextResponse.json({ error: "Missing club_id" }, { status: 400 });

    const { data: greens, error: gErr } = await supabase
      .from("club_greens")
      .select("id, club_id, name, lane_count, sort_order, is_active, created_at, updated_at")
      .eq("club_id", clubId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (gErr) {
      if (isMissingRelationError(gErr.message)) {
        return NextResponse.json(
          {
            error:
              'Missing DB tables. Run `supabase/migrations/20260217_club_greens_and_lane_bookings.sql` in your Supabase SQL editor.',
          },
          { status: 501 }
        );
      }
      return NextResponse.json({ error: gErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, club_id: clubId, greens: greens ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
