// app/api/tournaments/matches/confirm-score/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { completeTournamentIfDone } from "@/lib/tournaments/completeTournamentIfDone";

function minId(ids: string[]) {
  if (!ids.length) return null;
  const sorted = ids.slice().sort();
  return sorted[0] ?? null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/confirm-score",
    methods: ["GET", "POST"],
  });
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // 1) Auth
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Resolve player_id
    const { data: me, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (meErr || !me?.id) {
      return NextResponse.json({ error: "Could not resolve your player profile" }, { status: 400 });
    }

    const myPlayerId = String(me.id);

    // 3) Body
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id: string | undefined = body?.match_id;
    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

    // 4) Load match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, team_a_id, team_b_id, status, score_a, score_b, submitted_by_player_id, confirmed_by_a, confirmed_by_b, finalized_by_admin"
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
    if (match.score_a == null || match.score_b == null) {
      return NextResponse.json({ error: "No score to confirm yet" }, { status: 400 });
    }
    if (!match.submitted_by_player_id) {
      return NextResponse.json({ error: "Score has not been submitted" }, { status: 400 });
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

    for (const r of memRows ?? []) {
      const tid = String((r as any).team_id ?? "");
      const pid = String((r as any).player_id ?? "");
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

    // Submitting captain cannot confirm again
    if (match.submitted_by_player_id === myPlayerId) {
      return NextResponse.json({ error: "Submitting captain cannot confirm their own score" }, { status: 400 });
    }

    // Already confirmed?
    if (iAmCaptainA && match.confirmed_by_a === true) {
      return NextResponse.json({ error: "Team A already confirmed" }, { status: 400 });
    }
    if (iAmCaptainB && match.confirmed_by_b === true) {
      return NextResponse.json({ error: "Team B already confirmed" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const patch: any = {
      confirmed_by_a: iAmCaptainA ? true : match.confirmed_by_a,
      confirmed_by_b: iAmCaptainB ? true : match.confirmed_by_b,
    };

    // If both confirmed, complete the match
    const willBeConfirmedA = iAmCaptainA ? true : match.confirmed_by_a === true;
    const willBeConfirmedB = iAmCaptainB ? true : match.confirmed_by_b === true;

    if (willBeConfirmedA && willBeConfirmedB) {
      if (match.score_a === match.score_b) {
        return NextResponse.json({ error: "Scores are tied. A winner is required to finalise." }, { status: 400 });
      }

      const winnerTeamId = match.score_a > match.score_b ? teamAId : teamBId;
      patch.status = "COMPLETED";
      patch.finalized_at = nowIso;
      patch.winner_team_id = winnerTeamId;
    }

    const { data: updated, error: upErr } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", match_id)
      .select(
        "id, tournament_id, team_a_id, team_b_id, round_no, status, score_a, score_b, submitted_by_player_id, submitted_at, confirmed_by_a, confirmed_by_b, finalized_by_admin, finalized_at, admin_final_by, admin_final_at"
      )
      .single();

    if (upErr || !updated?.id) {
      return NextResponse.json({ error: upErr?.message ?? "Could not confirm score" }, { status: 400 });
    }

    if (patch.winner_team_id && updated?.tournament_id) {
      const winnerTeamId = String(patch.winner_team_id);

      await supabase
        .from("matches")
        .update({
          team_a_id: winnerTeamId,
          slot_a_source_type: "TEAM",
          slot_a_source_match_id: null,
        })
        .eq("tournament_id", updated.tournament_id)
        .eq("slot_a_source_type", "WINNER_OF_MATCH")
        .eq("slot_a_source_match_id", match_id)
        .is("team_a_id", null);

      await supabase
        .from("matches")
        .update({
          team_b_id: winnerTeamId,
          slot_b_source_type: "TEAM",
          slot_b_source_match_id: null,
        })
        .eq("tournament_id", updated.tournament_id)
        .eq("slot_b_source_type", "WINNER_OF_MATCH")
        .eq("slot_b_source_match_id", match_id)
        .is("team_b_id", null);

      await supabase
        .from("matches")
        .update({ status: "SCHEDULED" })
        .eq("tournament_id", updated.tournament_id)
        .eq("status", "OPEN")
        .not("team_a_id", "is", null)
        .not("team_b_id", "is", null);

      // Best-effort: if the final has been played, mark the tournament completed.
      // (May be blocked by RLS for non-admin users; do not fail match confirmation.)
      try {
        await completeTournamentIfDone({ supabase, tournamentId: String(updated.tournament_id) });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ ok: true, match: updated });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
