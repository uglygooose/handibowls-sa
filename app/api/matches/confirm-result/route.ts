import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type MatchType = "RANKED" | "FRIENDLY";

function normalizeMatchType(v: any): MatchType {
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

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id = body?.match_id as string | undefined;
    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

    // Current player
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (meErr || !mePlayer) {
      return NextResponse.json(
        { error: "Signed-in user not linked to a player record" },
        { status: 400 }
      );
    }

    // Load match (try with match_type; fallback if column missing)
    let match: any = null;

    {
      const q1 = await supabase
        .from("matches")
        .select(
          "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at"
        )
        .eq("id", match_id)
        .single();

      if (!q1.error && q1.data) {
        match = q1.data;
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
        match = q2.data;
      } else {
        return NextResponse.json(
          { error: q1.error?.message ?? "Match not found" },
          { status: 404 }
        );
      }
    }

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
    const isParticipant =
      mePlayer.id === match.challenger_player_id || mePlayer.id === match.challenged_player_id;

    if (!isParticipant) {
      return NextResponse.json({ error: "Only participants may confirm" }, { status: 403 });
    }

    // Must NOT be the submitter
    if (match.submitted_by_player_id === mePlayer.id) {
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

        // ✅ revalidate after FINAL is committed (and after recalc if ranked)
        revalidateAfterFinal();

        return NextResponse.json({
          ok: true,
          match: finalised,
          ladder_moved: false,
          reason: "draw",
          stats_recalced,
        });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    // If not ranked, do not swap and do not recalc ladder
    if (!isRanked) {
      // ✅ still revalidate because match moved to FINAL (affects My Challenges + recent results UI)
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
      if (existing?.id) return;

      const { data: maxRow, error: maxErr } = await supabase
        .from("ladder_entries")
        .select("position")
        .eq("ladder_id", match.ladder_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxErr) throw new Error(`ensureEntry max position: ${maxErr.message}`);

      const nextPos = (maxRow?.position ?? 0) + 1;

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
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
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
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    const winnerEntry = entries.find((x: any) => x.player_id === winnerPlayerId);
    const loserEntry = entries.find((x: any) => x.player_id === loserPlayerId);

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
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    // Only move if winner was ranked below loser (higher number = lower rank)
    if (winnerEntry.position <= loserEntry.position) {
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
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
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

    // ✅ Recalc ladder stats + positions after swap (fills SF/SA/SD/PTS)
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
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
