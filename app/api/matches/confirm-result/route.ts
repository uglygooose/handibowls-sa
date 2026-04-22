import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type MatchType = "RANKED" | "FRIENDLY";

type ConfirmResultBody = { match_id?: unknown };
type MatchRow = {
  id: string;
  ladder_id: string | null;
  match_type?: string | null;
  status?: string | null;
  challenger_player_id: string;
  challenged_player_id: string;
  challenger_score?: number | null;
  challenged_score?: number | null;
  submitted_by_player_id?: string | null;
  submitted_at?: string | null;
};
type LadderEntryPositionRow = { player_id?: string | null; position?: number | null };

function normalizeMatchType(v: unknown): MatchType {
  const t = String(v ?? "RANKED").toUpperCase();
  return t === "FRIENDLY" ? "FRIENDLY" : "RANKED";
}

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}

function revalidateAfterFinal() {
  // leaderboard + my challenges should reflect FINAL immediately
  revalidatePath("/club-ladder");
  revalidatePath("/my-challenges");
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: ConfirmResultBody | null = null;
    try {
      body = (await req.json()) as ConfirmResultBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id = typeof body?.match_id === "string" ? body.match_id : undefined;
    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

    // Current player
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

    // Load match (try with match_type; fallback if column missing)
    let match: MatchRow | null = null;

    {
      const q1 = await supabase
        .from("matches")
        .select(
          "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at"
        )
        .eq("id", match_id)
        .single();

      if (!q1.error && q1.data) {
        match = q1.data as MatchRow;
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
        const q2 = await supabase
          .from("matches")
          .select(
            "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at"
          )
          .eq("id", match_id)
          .single();

        if (q2.error || !q2.data) {
          return NextResponse.json({ error: "Match not found" }, { status: 404 });
        }
        match = q2.data as MatchRow;
      } else {
        return NextResponse.json(
          { error: q1.error?.message ?? "Match not found" },
          { status: 404 }
        );
      }
    }

    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    // If already final, do nothing (prevents double-confirm / double-swap)
    if (match.status === "FINAL") {
      // Even if already final, revalidate to help any cached pages catch up
      revalidateAfterFinal();
      return NextResponse.json(
        { ok: true, ladder_moved: false, stats_recalced: false, reason: "already final", match },
        { status: 200 }
      );
    }

    if (match.status !== "RESULT_SUBMITTED") {
      return NextResponse.json(
        { error: `Match not in RESULT_SUBMITTED (current: ${match.status})` },
        { status: 400 }
      );
    }

    if (!match.ladder_id) {
      return NextResponse.json({ error: "Match missing ladder_id" }, { status: 400 });
    }

    // Must be participant
    const mePlayerId = String((mePlayer as { id: string }).id);
    const isParticipant =
      mePlayerId === match.challenger_player_id || mePlayerId === match.challenged_player_id;

    if (!isParticipant) {
      return NextResponse.json({ error: "Only participants may confirm" }, { status: 403 });
    }

    // Must NOT be the submitter
    if (match.submitted_by_player_id === mePlayerId) {
      return NextResponse.json(
        { error: "Opponent must confirm (submitter cannot confirm)" },
        { status: 400 }
      );
    }

    // Ensure scores exist
    if (match.challenger_score == null || match.challenged_score == null) {
      return NextResponse.json({ error: "No submitted scores to confirm" }, { status: 400 });
    }

    // 1) Finalise match
    const { data: finalised, error: upErr } = await supabase
      .from("matches")
      .update({
        status: "FINAL",
        finalized_by_admin: false,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", match_id)
      .select("*")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    // Only ranked matches affect ladder movement/stats
    const isRanked = normalizeMatchType(match.match_type) === "RANKED";

    // Helper: recalc ladder stats + positions (runs only for ranked + final)
    const recalc = async () => {
      if (!isRanked) return { stats_recalced: false as const };
      const r1 = await supabase.rpc("recalc_ladder", { ladder_uuid: match.ladder_id });
      if (r1.error) throw new Error(`recalc_ladder: ${r1.error.message}`);
      const r2 = await supabase.rpc("recalc_ladder_positions", { ladder_uuid: match.ladder_id });
      if (r2.error) throw new Error(`recalc_ladder_positions: ${r2.error.message}`);
      return { stats_recalced: true as const };
    };

    // 2) Draw?
    const draw = match.challenger_score === match.challenged_score;

    if (draw) {
      try {
        const { stats_recalced } = await recalc();

        // revalidate after FINAL is committed (and after recalc if ranked)
        revalidateAfterFinal();

        return NextResponse.json({
          ok: true,
          match: finalised,
          ladder_moved: false,
          reason: "draw",
          stats_recalced,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // If not ranked, do not swap and do not recalc ladder
    if (!isRanked) {
      // still revalidate because match moved to FINAL (affects My Challenges + recent results UI)
      revalidateAfterFinal();

      return NextResponse.json({
        ok: true,
        match: finalised,
        ladder_moved: false,
        reason: "not ranked",
        stats_recalced: false,
      });
    }

    const challengerWon = match.challenger_score > match.challenged_score;
    const winnerPlayerId = challengerWon ? match.challenger_player_id : match.challenged_player_id;
    const loserPlayerId = challengerWon ? match.challenged_player_id : match.challenger_player_id;

    // ---- Auto-seed ladder_entries for both players at bottom (if missing) ----
    const ensureEntry = async (playerId: string) => {
      const { data: existing, error: exErr } = await supabase
        .from("ladder_entries")
        .select("id")
        .eq("ladder_id", match.ladder_id)
        .eq("player_id", playerId)
        .maybeSingle();

      if (exErr) throw new Error(`ensureEntry check: ${exErr.message}`);
      if ((existing as { id?: string } | null)?.id) return;

      const { data: maxRow, error: maxErr } = await supabase
        .from("ladder_entries")
        .select("position")
        .eq("ladder_id", match.ladder_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxErr) throw new Error(`ensureEntry max position: ${maxErr.message}`);

      const nextPos = ((maxRow as { position?: number } | null)?.position ?? 0) + 1;

      const { error: insErr } = await supabase.from("ladder_entries").insert({
        ladder_id: match.ladder_id,
        player_id: playerId,
        position: nextPos,
      });

      if (insErr) throw new Error(`ensureEntry insert: ${insErr.message}`);
    };

    try {
      await ensureEntry(winnerPlayerId);
      await ensureEntry(loserPlayerId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // -----------------------------------------------------------------------

    // Pull both entries so we can apply "only move if winner was below loser"
    const { data: entries, error: eErr } = await supabase
      .from("ladder_entries")
      .select("player_id, position")
      .eq("ladder_id", match.ladder_id)
      .in("player_id", [winnerPlayerId, loserPlayerId]);

    if (eErr) return NextResponse.json({ error: `ladder entries: ${eErr.message}` }, { status: 400 });

    if (!entries || entries.length < 2) {
      try {
        const { stats_recalced } = await recalc();

        revalidateAfterFinal();

        return NextResponse.json(
          {
            ok: true,
            match: finalised,
            ladder_moved: false,
            reason: "missing ladder entries",
            stats_recalced,
          },
          { status: 200 }
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const entryRows = entries as LadderEntryPositionRow[];
    const winnerEntry = entryRows.find((x) => x.player_id === winnerPlayerId);
    const loserEntry = entryRows.find((x) => x.player_id === loserPlayerId);

    if (!winnerEntry || !loserEntry) {
      try {
        const { stats_recalced } = await recalc();

        revalidateAfterFinal();

        return NextResponse.json(
          {
            ok: true,
            match: finalised,
            ladder_moved: false,
            reason: "missing winner/loser entry",
            stats_recalced,
          },
          { status: 200 }
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Only move if winner was ranked below loser (higher number = lower rank)
    if ((winnerEntry.position ?? 0) <= (loserEntry.position ?? 0)) {
      try {
        const { stats_recalced } = await recalc();

        revalidateAfterFinal();

        return NextResponse.json({
          ok: true,
          match: finalised,
          ladder_moved: false,
          reason: "winner already ranked above loser",
          stats_recalced,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Winner swaps with the player directly above (RPC handles locking + swap safely)
    const { error: swapErr } = await supabase.rpc("ladder_swap_up_one", {
      p_ladder_id: match.ladder_id,
      p_winner_player_id: winnerPlayerId,
    });

    if (swapErr) {
      return NextResponse.json({ error: `ladder swap: ${swapErr.message}` }, { status: 400 });
    }

    // Recalc ladder stats + positions after swap (fills SF/SA/SD/PTS)
    try {
      const { stats_recalced } = await recalc();

      revalidateAfterFinal();

      return NextResponse.json({
        ok: true,
        match: finalised,
        ladder_moved: true,
        winner_player_id: winnerPlayerId,
        rule: "winner swaps with player above",
        stats_recalced,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
