import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

    // Confirm admin
    const { data: profile, error: prErr } = await supabase
      .from("profiles")
      .select("is_admin, role, club_id")
      .eq("id", authData.user.id)
      .single();

    if (prErr) return NextResponse.json({ error: `profiles: ${prErr.message}` }, { status: 400 });
    const role = String((profile as any)?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean((profile as any)?.is_admin);
    const adminClubId = (profile as any)?.club_id ? String((profile as any).club_id) : "";
    if (!isSuperAdmin && !isAdminFlag) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id = body?.match_id as string | undefined;
    if (!match_id) return NextResponse.json({ error: "Missing match_id" }, { status: 400 });

    // Load match (include match_type)
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score"
      )
      .eq("id", match_id)
      .single();

    if (mErr || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    if (!match.ladder_id) return NextResponse.json({ error: "Match missing ladder_id" }, { status: 400 });

    if (!isSuperAdmin) {
      const ladderRes = await supabase
        .from("ladders")
        .select("id, scope, club_id")
        .eq("id", match.ladder_id)
        .single();

      if (ladderRes.error || !ladderRes.data?.id) {
        return NextResponse.json({ error: "Ladder not found" }, { status: 404 });
      }
      const ladderClub = String((ladderRes.data as any)?.club_id ?? "");
      const ladderScope = String((ladderRes.data as any)?.scope ?? "");
      if (!adminClubId || ladderScope !== "CLUB" || ladderClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    // Must have scores to finalise
    if (match.challenger_score == null || match.challenged_score == null) {
      return NextResponse.json({ error: "Match has no scores set (cannot finalise)" }, { status: 400 });
    }

    // If already final, do nothing
    if (match.status === "FINAL") {
      return NextResponse.json(
        { ok: true, ladder_moved: false, stats_recalced: false, reason: "already final", match },
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

    const isRanked = (match.match_type ?? "RANKED") === "RANKED";

    // Helper: recalc ladder stats + positions (ranked only)
    const recalc = async () => {
      if (!isRanked) return { stats_recalced: false as const };
      const r1 = await supabase.rpc("recalc_ladder", { ladder_uuid: match.ladder_id });
      if (r1.error) throw new Error(`recalc_ladder: ${r1.error.message}`);
      const r2 = await supabase.rpc("recalc_ladder_positions", { ladder_uuid: match.ladder_id });
      if (r2.error) throw new Error(`recalc_ladder_positions: ${r2.error.message}`);
      return { stats_recalced: true as const };
    };

    // Determine winner (no ladder move on draw)
    const draw = match.challenger_score === match.challenged_score;
    if (draw) {
      // Draws still affect ladder stats in bowls
      try {
        const { stats_recalced } = await recalc();
        return NextResponse.json({ ok: true, match: finalised, ladder_moved: false, reason: "draw", stats_recalced });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
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

    const challengerWon = match.challenger_score > match.challenged_score;
    const winnerPlayerId = challengerWon ? match.challenger_player_id : match.challenged_player_id;
    const loserPlayerId = challengerWon ? match.challenged_player_id : match.challenger_player_id;

    // Auto-seed ladder entries at bottom if missing (same rule as confirm)
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

    // Only move if winner was below loser
    const { data: entries, error: eErr } = await supabase
      .from("ladder_entries")
      .select("player_id, position")
      .eq("ladder_id", match.ladder_id)
      .in("player_id", [winnerPlayerId, loserPlayerId]);

    if (eErr) return NextResponse.json({ error: `ladder entries: ${eErr.message}` }, { status: 400 });

    const winnerEntry = (entries ?? []).find((x: any) => x.player_id === winnerPlayerId);
    const loserEntry = (entries ?? []).find((x: any) => x.player_id === loserPlayerId);

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
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    if (winnerEntry.position <= loserEntry.position) {
      try {
        const { stats_recalced } = await recalc();
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

    // Swap winner up one position
    const { error: swapErr } = await supabase.rpc("ladder_swap_up_one", {
      p_ladder_id: match.ladder_id,
      p_winner_player_id: winnerPlayerId,
    });

    if (swapErr) {
      return NextResponse.json({ error: `ladder swap: ${swapErr.message}` }, { status: 400 });
    }

    // ✅ Recalc stats + set positions after swap
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
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
