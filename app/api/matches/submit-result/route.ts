import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type SubmitResultBody = {
  match_id?: unknown;
  challenger_score?: unknown;
  challenged_score?: unknown;
};
type MatchRow = {
  id: string;
  status?: string | null;
  challenger_player_id: string;
  challenged_player_id: string;
  submitted_by_player_id?: string | null;
};

export async function POST(req: Request) {
  try {
    // 1) Auth
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Parse JSON
    let body: SubmitResultBody | null = null;
    try {
      body = (await req.json()) as SubmitResultBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id: string | undefined =
      typeof body?.match_id === "string" ? body.match_id : undefined;

    // Parse scores into guaranteed numbers (or NaN)
    const challenger_score_num = Number(body?.challenger_score);
    const challenged_score_num = Number(body?.challenged_score);

    if (!match_id) {
      return NextResponse.json({ error: "Missing match_id" }, { status: 400 });
    }

    // Must be whole numbers and not NaN
    if (
      !Number.isFinite(challenger_score_num) ||
      !Number.isFinite(challenged_score_num) ||
      !Number.isInteger(challenger_score_num) ||
      !Number.isInteger(challenged_score_num)
    ) {
      return NextResponse.json(
        { error: "Invalid scores. Scores must be whole numbers." },
        { status: 400 }
      );
    }

    if (challenger_score_num < 0 || challenged_score_num < 0) {
      return NextResponse.json({ error: "Scores must be non-negative" }, { status: 400 });
    }

    // 3) Identify player
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      return NextResponse.json(
        { error: "Signed-in user not linked to a player record" },
        { status: 400 }
      );
    }

    // 4) Load match (include submitted_by_player_id so we can prevent overwrites)
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("id, status, challenger_player_id, challenged_player_id, submitted_by_player_id")
      .eq("id", match_id)
      .single();

    const matchRow = (match ?? null) as MatchRow | null;
    if (mErr || !matchRow) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (matchRow.status === "FINAL") {
      return NextResponse.json({ error: "Match already finalised" }, { status: 400 });
    }

    // 5) Permission: only participants may submit
    const mePlayerId = String((mePlayer as { id: string }).id);
    const isParticipant =
      mePlayerId === matchRow.challenger_player_id || mePlayerId === matchRow.challenged_player_id;

    if (!isParticipant) {
      return NextResponse.json(
        { error: "Only match participants may submit results" },
        { status: 403 }
      );
    }

    // Prevent overwriting someone else's submitted result
    if (
      matchRow.status === "RESULT_SUBMITTED" &&
      matchRow.submitted_by_player_id &&
      matchRow.submitted_by_player_id !== mePlayerId
    ) {
      return NextResponse.json(
        { error: "Opponent already submitted. You must confirm (or admin must finalise)." },
        { status: 400 }
      );
    }

    // 6) Update match -> RESULT_SUBMITTED
    const { data: updated, error: upErr } = await supabase
      .from("matches")
      .update({
        challenger_score: challenger_score_num,
        challenged_score: challenged_score_num,
        submitted_by_player_id: mePlayerId,
        submitted_at: new Date().toISOString(),
        status: "RESULT_SUBMITTED",
      })
      .eq("id", match_id)
      .select("*")
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, match: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
