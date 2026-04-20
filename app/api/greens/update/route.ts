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

    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const nameRaw = body?.name;
    const laneCountRaw = body?.lane_count;
    const sortOrderRaw = body?.sort_order;
    const isActiveRaw = body?.is_active;

    const patch: { name?: string; lane_count?: number; sort_order?: number; is_active?: boolean } = {};
    if (nameRaw != null) {
      const name = String(nameRaw ?? "").trim();
      if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      patch.name = name;
    }

    if (laneCountRaw != null) {
      const lane_count = asInt(laneCountRaw);
      if (lane_count == null) return NextResponse.json({ error: "lane_count must be an integer" }, { status: 400 });
      if (lane_count < 1 || lane_count > 24) return NextResponse.json({ error: "lane_count must be 1..24" }, { status: 400 });
      patch.lane_count = lane_count;
    }

    if (sortOrderRaw != null) {
      const sort_order = asInt(sortOrderRaw);
      if (sort_order == null) return NextResponse.json({ error: "sort_order must be an integer" }, { status: 400 });
      patch.sort_order = sort_order;
    }

    if (isActiveRaw != null) patch.is_active = Boolean(isActiveRaw);

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

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

    // RLS should enforce club scoping, but keep this defensive.
    const { data: existing, error: exErr } = await supabase.from("club_greens").select("id, club_id").eq("id", id).maybeSingle();
    if (exErr || !existing) return NextResponse.json({ error: "Green not found" }, { status: 404 });

    const existingRow = (existing ?? null) as unknown as { club_id: string | null } | null;
    if (!existingRow) return NextResponse.json({ error: "Green not found" }, { status: 404 });

    if (!isSuperAdmin && String(existingRow.club_id ?? "") !== String(profRow.club_id ?? "")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: updated, error: upErr } = await supabase
      .from("club_greens")
      .update(patch)
      .eq("id", id)
      .select("id, club_id, name, lane_count, sort_order, is_active, created_at, updated_at")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, green: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
