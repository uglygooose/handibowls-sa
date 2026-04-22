// app/api/tournaments/matches/admin-final/batch/route.ts
//
// Batched admin-finalise for a set of matches inside one tournament.
// Wraps the `admin_finalize_matches_batch` RPC (atomic per batch) and
// calls `completeTournamentIfDone` once at the end.
import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";
import { completeTournamentIfDone } from "@/lib/tournaments/completeTournamentIfDone";

type BatchEntry = { match_id: string; score_a: number; score_b: number };

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/admin-final/batch",
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
    const role = String((prof as any)?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean((prof as any)?.is_admin);
    const adminClubId = (prof as any)?.club_id ? String((prof as any).club_id) : "";

    if (!isSuperAdmin && !isAdminFlag) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    let body: any = null;
    try {
      body = await req.json();
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

    // Pre-validate client-side so we surface a clear error before the RPC runs.
    const normalised: BatchEntry[] = [];
    for (let i = 0; i < rawMatches.length; i++) {
      const m = rawMatches[i];
      const mid = typeof m?.match_id === "string" ? m.match_id : "";
      const sa = Number(m?.score_a);
      const sb = Number(m?.score_b);

      if (!mid) {
        return NextResponse.json({ error: `matches[${i}]: missing match_id` }, { status: 400 });
      }
      if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) {
        return NextResponse.json(
          { error: `matches[${i}]: scores must be whole numbers >= 0` },
          { status: 400 }
        );
      }
      if (sa === sb) {
        return NextResponse.json(
          { error: `matches[${i}]: scores are tied — a winner is required to finalise` },
          { status: 400 }
        );
      }
      normalised.push({ match_id: mid, score_a: sa, score_b: sb });
    }

    // Club admins must own the tournament.
    if (!isSuperAdmin) {
      const tRes = await supabase
        .from("tournaments")
        .select("id, scope, club_id")
        .eq("id", tournamentId)
        .single();
      if (tRes.error || !tRes.data?.id) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
      const tScope = String((tRes.data as any).scope ?? "");
      const tClub = String((tRes.data as any).club_id ?? "");
      if (!adminClubId || tScope !== "CLUB" || tClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    const rpc = await supabase.rpc("admin_finalize_matches_batch", {
      p_tournament_id: tournamentId,
      p_matches: normalised,
    });

    if (rpc.error) {
      return NextResponse.json({ error: rpc.error.message }, { status: 400 });
    }

    // Best-effort tournament close-out (mirrors singular route).
    try {
      await completeTournamentIfDone({ supabase, tournamentId });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, result: rpc.data });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err?.message ?? String(err)}` },
      { status: 500 }
    );
  }
}
