import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

function normalizeRole(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function asInt(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
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

    const club_id = String(body?.club_id ?? "");
    const name = String(body?.name ?? "").trim();
    const lane_count = asInt(body?.lane_count) ?? 6;
    const sort_order = asInt(body?.sort_order) ?? 0;

    if (!club_id || !name) return NextResponse.json({ error: "Missing club_id or name" }, { status: 400 });
    if (lane_count < 1 || lane_count > 24) return NextResponse.json({ error: "lane_count must be 1..24" }, { status: 400 });

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, club_id, is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const profRow = (prof ?? null) as unknown as { club_id: string | null; is_admin: boolean | null; role: string | null } | null;
    if (pErr || !profRow) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

    const role = normalizeRole(profRow.role);
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isClubAdmin = Boolean(profRow.is_admin) && String(profRow.club_id ?? "") === club_id;

    if (!isSuperAdmin && !isClubAdmin) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { data: created, error: insErr } = await supabase
      .from("club_greens")
      .insert({ club_id, name, lane_count, sort_order, is_active: true })
      .select("id, club_id, name, lane_count, sort_order, is_active, created_at, updated_at")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, green: created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
