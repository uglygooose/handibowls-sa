// app/api/tournaments/matches/submit-score/route.ts
import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type SubmitScoreBody = { match_id?: unknown; score_a?: unknown; score_b?: unknown };
type TeamMemberRow = { team_id?: unknown; player_id?: unknown };
type MatchPatch = {
  score_a: number;
  score_b: number;
  submitted_by_player_id: string;
  submitted_at: string;
  confirmed_by_a: boolean;
  confirmed_by_b: boolean;
};

function minId(ids: string[]) {
  if (!ids.length) return null;
  const sorted = ids.slice().sort();
  return sorted[0] ?? null;
}

function asInt(v: unknown) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/submit-score",
    methods: ["GET", "POST"],
  });
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Resolve player_id
    const { data: me, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (meErr || !me?.id) {
      return NextResponse.json({ error: "Could not resolve your player profile" }, { status: 400 });
    }

    const myPlayerId = String((me as { id: string }).id);

    // 3) Body
    let body: SubmitScoreBody | null = null;
    try {
      body = (await req.json()) as SubmitScoreBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id: string | undefined =
      typeof body?.match_id === "string" ? body.match_id : undefined;
    const score_a = asInt(body?.score_a);
    const score_b = asInt(body?.score_b);

    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });
    if (score_a == null || score_b == null) return NextResponse.json({ error: "Scores must be whole numbers" }, { status: 400 });
    if (score_a < 0 || score_b < 0) return NextResponse.json({ error: "Scores must be >= 0" }, { status: 400 });

    // 4) Load match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, team_a_id, team_b_id, status, finalized_by_admin, score_a, score_b, submitted_by_player_id, confirmed_by_a, confirmed_by_b"
      )
      .eq("id", match_id)
      .single();

    if (mErr || !match?.id) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (!match.tournament_id) {
      return NextResponse.json({ error: "Not a tournament match" }, { status: 400 });
    }
    if (match.finalized_by_admin === true) {
      return NextResponse.json({ error: "Match was admin finalized" }, { status: 400 });
    }
    if (String(match.status ?? "") !== "IN_PLAY") {
      return NextResponse.json({ error: "Match must be IN_PLAY to submit a score" }, { status: 400 });
    }
    if (!match.team_a_id || !match.team_b_id) {
      return NextResponse.json({ error: "Match teams are not set" }, { status: 400 });
    }

    const teamAId = String(match.team_a_id);
    const teamBId = String(match.team_b_id);

    // 5) Determine captains
    const { data: memRows, error: memErr } = await supabase
      .from("tournament_team_members")
      .select("team_id, player_id")
      .in("team_id", [teamAId, teamBId]);

    if (memErr) {
      return NextResponse.json({ error: `Could not load team members: ${memErr.message}` }, { status: 400 });
    }

    const idsA: string[] = [];
    const idsB: string[] = [];

    for (const r of (memRows ?? []) as TeamMemberRow[]) {
      const tid = String(r.team_id ?? "");
      const pid = String(r.player_id ?? "");
      if (!tid || !pid) continue;
      if (tid === teamAId) idsA.push(pid);
      if (tid === teamBId) idsB.push(pid);
    }

    const captainA = minId(idsA);
    const captainB = minId(idsB);

    if (!captainA || !captainB) {
      return NextResponse.json({ error: "Could not resolve captains for both teams" }, { status: 400 });
    }

    const iAmCaptainA = myPlayerId === captainA;
    const iAmCaptainB = myPlayerId === captainB;

    if (!iAmCaptainA && !iAmCaptainB) {
      return NextResponse.json({ error: "Captain access required" }, { status: 403 });
    }

    const nowIso = new Date().toISOString();

    // Submitting captain auto-confirms their side; other side must confirm later.
    const patch: MatchPatch = {
      score_a,
      score_b,
      submitted_by_player_id: myPlayerId,
      submitted_at: nowIso,
      confirmed_by_a: iAmCaptainA ? true : false,
      confirmed_by_b: iAmCaptainB ? true : false,
    };

    const { data: updated, error: upErr } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", match_id)
      .select(
        "id, tournament_id, team_a_id, team_b_id, round_no, status, score_a, score_b, submitted_by_player_id, submitted_at, confirmed_by_a, confirmed_by_b, finalized_by_admin, finalized_at, admin_final_by, admin_final_at"
      )
      .single();

    if (upErr || !updated?.id) {
      return NextResponse.json({ error: upErr?.message ?? "Could not submit score" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, match: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
