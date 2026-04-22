import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type ProfileAdminRow = { is_admin?: boolean | null; role?: string | null; club_id?: string | null };
type LadderScopeRow = { id?: string | null; scope?: string | null; club_id?: string | null };
type AdminFinaliseBody = { match_id?: unknown };
type MatchRow = {
  id: string;
  ladder_id: string | null;
  match_type?: string | null;
  status?: string | null;
  challenger_player_id: string;
  challenged_player_id: string;
  challenger_score?: number | null;
  challenged_score?: number | null;
};
type LadderEntryPositionRow = { player_id?: string | null; position?: number | null };

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Confirm admin
    const { data: profile, error: prErr } = await supabase
      .from("profiles")
      .select("is_admin, role, club_id")
      .eq("id", user.id)
      .single();

    if (prErr) return NextResponse.json({ error: `profiles: ${prErr.message}` }, { status: 400 });
    const profRow = (profile ?? null) as ProfileAdminRow | null;
    const role = String(profRow?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean(profRow?.is_admin);
    const adminClubId = profRow?.club_id ? String(profRow.club_id) : "";
    if (!isSuperAdmin && !isAdminFlag) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    let body: AdminFinaliseBody | null = null;
    try {
      body = (await req.json()) as AdminFinaliseBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id = typeof body?.match_id === "string" ? body.match_id : undefined;
    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

    // Load match (include match_type)
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score"
      )
      .eq("id", match_id)
      .single();

    const matchRow = (match ?? null) as MatchRow | null;
    if (mErr || !matchRow) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    if (!matchRow.ladder_id) return NextResponse.json({ error: "Match missing ladder_id" }, { status: 400 });

    if (!isSuperAdmin) {
      const ladderRes = await supabase
        .from("ladders")
        .select("id, scope, club_id")
        .eq("id", matchRow.ladder_id)
        .single();

      const ladderRow = (ladderRes.data ?? null) as LadderScopeRow | null;
      if (ladderRes.error || !ladderRow?.id) {
        return NextResponse.json({ error: "Ladder not found" }, { status: 404 });
      }
      const ladderClub = String(ladderRow.club_id ?? "");
      const ladderScope = String(ladderRow.scope ?? "");
      if (!adminClubId || ladderScope !== "CLUB" || ladderClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    // Must have scores to finalise
    if (matchRow.challenger_score == null || matchRow.challenged_score == null) {
      return NextResponse.json({ error: "Match has no scores set (cannot finalise)" }, { status: 400 });
    }

    // If already final, do nothing
    if (matchRow.status === "FINAL") {
      return NextResponse.json(
        { ok: true, ladder_moved: false, stats_recalced: false, reason: "already final", match: matchRow },
        { status: 200 }
      );
    }

    // Finalise
    const { data: finalised, error: upErr } = await supabase
      .from("matches")
      .update({
        status: "FINAL",
        finalized_by_admin: true,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", match_id)
      .select("*")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const isRanked = (matchRow.match_type ?? "RANKED") === "RANKED";

    // Helper: recalc ladder stats + positions (ranked only)
    const recalc = async () => {
      if (!isRanked) return { stats_recalced: false as const };
      const r1 = await supabase.rpc("recalc_ladder", { ladder_uuid: matchRow.ladder_id });
      if (r1.error) throw new Error(`recalc_ladder: ${r1.error.message}`);
      const r2 = await supabase.rpc("recalc_ladder_positions", { ladder_uuid: matchRow.ladder_id });
      if (r2.error) throw new Error(`recalc_ladder_positions: ${r2.error.message}`);
      return { stats_recalced: true as const };
    };

    // Determine winner (no ladder move on draw)
    const draw = matchRow.challenger_score === matchRow.challenged_score;
    if (draw) {
      // Draws still affect ladder stats in bowls
      try {
        const { stats_recalced } = await recalc();
        return NextResponse.json({ ok: true, match: finalised, ladder_moved: false, reason: "draw", stats_recalced });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // If not ranked, do not swap and do not recalc ladder
    if (!isRanked) {
      return NextResponse.json({
        ok: true,
        match: finalised,
        ladder_moved: false,
        reason: "not ranked",
        stats_recalced: false,
      });
    }

    const challengerWon = matchRow.challenger_score > matchRow.challenged_score;
    const winnerPlayerId = challengerWon ? matchRow.challenger_player_id : matchRow.challenged_player_id;
    const loserPlayerId = challengerWon ? matchRow.challenged_player_id : matchRow.challenger_player_id;

    // Auto-seed ladder entries at bottom if missing (same rule as confirm)
    const ensureEntry = async (playerId: string) => {
      const { data: existing, error: exErr } = await supabase
        .from("ladder_entries")
        .select("id")
        .eq("ladder_id", matchRow.ladder_id)
        .eq("player_id", playerId)
        .maybeSingle();

      if (exErr) throw new Error(`ensureEntry check: ${exErr.message}`);
      if ((existing as { id?: string } | null)?.id) return;

      const { data: maxRow, error: maxErr } = await supabase
        .from("ladder_entries")
        .select("position")
        .eq("ladder_id", matchRow.ladder_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxErr) throw new Error(`ensureEntry max position: ${maxErr.message}`);

      const nextPos = ((maxRow as { position?: number } | null)?.position ?? 0) + 1;

      const { error: insErr } = await supabase.from("ladder_entries").insert({
        ladder_id: matchRow.ladder_id,
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

    // Only move if winner was below loser
    const { data: entries, error: eErr } = await supabase
      .from("ladder_entries")
      .select("player_id, position")
      .eq("ladder_id", matchRow.ladder_id)
      .in("player_id", [winnerPlayerId, loserPlayerId]);

    if (eErr) return NextResponse.json({ error: `ladder entries: ${eErr.message}` }, { status: 400 });

    const entryRows = (entries ?? []) as LadderEntryPositionRow[];
    const winnerEntry = entryRows.find((x) => x.player_id === winnerPlayerId);
    const loserEntry = entryRows.find((x) => x.player_id === loserPlayerId);

    if (!winnerEntry || !loserEntry) {
      try {
        const { stats_recalced } = await recalc();
        return NextResponse.json({
          ok: true,
          match: finalised,
          ladder_moved: false,
          reason: "missing ladder entries",
          stats_recalced,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if ((winnerEntry.position ?? 0) <= (loserEntry.position ?? 0)) {
      try {
        const { stats_recalced } = await recalc();
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

    // Swap winner up one position
    const { error: swapErr } = await supabase.rpc("ladder_swap_up_one", {
      p_ladder_id: matchRow.ladder_id,
      p_winner_player_id: winnerPlayerId,
    });

    if (swapErr) {
      return NextResponse.json({ error: `ladder swap: ${swapErr.message}` }, { status: 400 });
    }

    // Recalc stats + set positions after swap
    try {
      const { stats_recalced } = await recalc();
      return NextResponse.json({
        ok: true,
        match: finalised,
        ladder_moved: true,
        winner_player_id: winnerPlayerId,
        rule: "admin finalise + winner swaps with player above",
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
