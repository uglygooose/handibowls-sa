// app/api/tournaments/matches/save-fixtures/batch/route.ts
//
// Assign team_a_id/team_b_id for a set of matches in a specific round.
// Wraps the `save_round_fixtures_batch` RPC, which also resets score,
// confirmation and finalisation state on each updated row.
import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type FixtureEntry = {
  match_id: string;
  team_a_id: string;
  team_b_id: string | null;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/save-fixtures/batch",
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
    const roundNoRaw = body?.round_no;
    const roundNo = Number(roundNoRaw);

    if (!tournamentId) {
      return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });
    }
    if (!Number.isInteger(roundNo) || roundNo < 1) {
      return NextResponse.json({ error: "round_no must be a positive integer" }, { status: 400 });
    }

    const rawFixtures = body?.fixtures;
    if (!Array.isArray(rawFixtures) || rawFixtures.length === 0) {
      return NextResponse.json({ error: "fixtures must be a non-empty array" }, { status: 400 });
    }

    const seenTeams = new Set<string>();
    const normalised: FixtureEntry[] = [];
    for (let i = 0; i < rawFixtures.length; i++) {
      const f = rawFixtures[i];
      const mid = typeof f?.match_id === "string" ? f.match_id : "";
      const a = typeof f?.team_a_id === "string" ? f.team_a_id.trim() : "";
      const bRaw = typeof f?.team_b_id === "string" ? f.team_b_id.trim() : "";
      const b: string | null = bRaw ? bRaw : null;

      if (!mid) {
        return NextResponse.json({ error: `fixtures[${i}]: missing match_id` }, { status: 400 });
      }
      if (!a) {
        return NextResponse.json(
          { error: `fixtures[${i}]: each match must have team_a_id set` },
          { status: 400 }
        );
      }
      if (b && a === b) {
        return NextResponse.json(
          { error: `fixtures[${i}]: a team cannot play itself` },
          { status: 400 }
        );
      }
      if (seenTeams.has(a)) {
        return NextResponse.json(
          { error: "Each team can only appear once in the round." },
          { status: 400 }
        );
      }
      seenTeams.add(a);
      if (b) {
        if (seenTeams.has(b)) {
          return NextResponse.json(
            { error: "Each team can only appear once in the round." },
            { status: 400 }
          );
        }
        seenTeams.add(b);
      }

      normalised.push({ match_id: mid, team_a_id: a, team_b_id: b });
    }

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

    const rpc = await supabase.rpc("save_round_fixtures_batch", {
      p_tournament_id: tournamentId,
      p_round_no: roundNo,
      p_fixtures: normalised,
    });

    if (rpc.error) {
      return NextResponse.json({ error: rpc.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: rpc.data });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err?.message ?? String(err)}` },
      { status: 500 }
    );
  }
}
