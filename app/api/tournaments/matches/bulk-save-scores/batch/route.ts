// app/api/tournaments/matches/bulk-save-scores/batch/route.ts
//
// Bulk save score_a/score_b on a set of matches in one tournament, without
// finalising. Wraps the `bulk_save_match_scores_batch` RPC. Rows with null
// or empty scores are skipped server-side (mirrors the singular client loop
// which allowed partial saves).
import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type BulkEntry = {
  match_id: string;
  score_a: number | null;
  score_b: number | null;
};
type ProfileAdminRow = { role?: string | null; is_admin?: boolean | null; club_id?: string | null };
type TournamentScopeRow = { id?: string | null; scope?: string | null; club_id?: string | null };
type BulkSaveBatchBody = { tournament_id?: unknown; matches?: unknown };

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/bulk-save-scores/batch",
    methods: ["GET", "POST"],
  });
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: prof, error: prErr } = await supabase
      .from("profiles")
      .select("role, is_admin, club_id")
      .eq("id", user.id)
      .single();

    if (prErr) {
      return NextResponse.json(
        { error: `Could not verify admin access: ${prErr.message}` },
        { status: 400 }
      );
    }
    const profRow = (prof ?? null) as ProfileAdminRow | null;
    const role = String(profRow?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean(profRow?.is_admin);
    const adminClubId = profRow?.club_id ? String(profRow.club_id) : "";

    if (!isSuperAdmin && !isAdminFlag) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    let body: BulkSaveBatchBody | null = null;
    try {
      body = (await req.json()) as BulkSaveBatchBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const tournamentId: string | undefined =
      typeof body?.tournament_id === "string" ? body.tournament_id : undefined;
    if (!tournamentId) {
      return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });
    }

    const rawMatches = body?.matches;
    if (!Array.isArray(rawMatches) || rawMatches.length === 0) {
      return NextResponse.json({ error: "matches must be a non-empty array" }, { status: 400 });
    }

    const normalised: BulkEntry[] = [];
    for (let i = 0; i < rawMatches.length; i++) {
      const m = rawMatches[i] as
        | { match_id?: unknown; score_a?: unknown; score_b?: unknown }
        | null
        | undefined;
      const mid = typeof m?.match_id === "string" ? m.match_id : "";
      if (!mid) {
        return NextResponse.json({ error: `matches[${i}]: missing match_id` }, { status: 400 });
      }

      const hasA = m?.score_a !== null && m?.score_a !== undefined && String(m.score_a).trim() !== "";
      const hasB = m?.score_b !== null && m?.score_b !== undefined && String(m.score_b).trim() !== "";

      const sa = hasA ? Number(m.score_a) : null;
      const sb = hasB ? Number(m.score_b) : null;

      if (sa != null && (!Number.isInteger(sa) || sa < 0)) {
        return NextResponse.json(
          { error: `matches[${i}]: score_a must be a whole number >= 0` },
          { status: 400 }
        );
      }
      if (sb != null && (!Number.isInteger(sb) || sb < 0)) {
        return NextResponse.json(
          { error: `matches[${i}]: score_b must be a whole number >= 0` },
          { status: 400 }
        );
      }

      normalised.push({ match_id: mid, score_a: sa, score_b: sb });
    }

    if (!isSuperAdmin) {
      const tRes = await supabase
        .from("tournaments")
        .select("id, scope, club_id")
        .eq("id", tournamentId)
        .single();
      const tRow = (tRes.data ?? null) as TournamentScopeRow | null;
      if (tRes.error || !tRow?.id) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
      const tScope = String(tRow.scope ?? "");
      const tClub = String(tRow.club_id ?? "");
      if (!adminClubId || tScope !== "CLUB" || tClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    const rpc = await supabase.rpc("bulk_save_match_scores_batch", {
      p_tournament_id: tournamentId,
      p_matches: normalised,
    });

    if (rpc.error) {
      return NextResponse.json({ error: rpc.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: rpc.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
