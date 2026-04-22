import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type MatchType = "RANKED" | "FRIENDLY";

type RespondBody = { challenge_id?: unknown; action?: unknown };
type ChallengeRow = {
  id: string;
  ladder_id: string;
  challenger_player_id: string;
  challenged_player_id: string;
  status: string;
  expires_at: string;
  match_id?: string | null;
  match_type?: string | null;
};
type LadderEntryPositionRow = { player_id?: string | null; position?: number | null };
type MatchInsertBase = {
  challenge_id: string;
  ladder_id: string;
  challenger_player_id: string;
  challenged_player_id: string;
  status: "OPEN";
  challenger_position_at_start: number | null;
  challenged_position_at_start: number | null;
};

function normalizeMatchType(v: unknown): MatchType {
  const t = String(v ?? "RANKED").toUpperCase();
  return t === "FRIENDLY" ? "FRIENDLY" : "RANKED";
}

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: RespondBody | null = null;
    try {
      body = (await req.json()) as RespondBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const challenge_id = typeof body?.challenge_id === "string" ? body.challenge_id : undefined;
    const rawAction = typeof body?.action === "string" ? body.action : undefined;
    const action: "ACCEPT" | "DECLINE" | undefined =
      rawAction === "ACCEPT" || rawAction === "DECLINE" ? rawAction : undefined;

    if (!challenge_id || !action) {
      return NextResponse.json({ error: "Missing challenge_id or action" }, { status: 400 });
    }

    // Current player
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      return NextResponse.json({ error: "Signed-in user not linked to a player record" }, { status: 400 });
    }

    // Load challenge (try with match_type, fallback if not present)
    let challenge: ChallengeRow | null = null;

    {
      const q1 = await supabase
        .from("challenges")
        .select("id, ladder_id, challenger_player_id, challenged_player_id, status, expires_at, match_id, match_type")
        .eq("id", challenge_id)
        .single();

      if (!q1.error && q1.data) {
        challenge = q1.data as ChallengeRow;
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
        const q2 = await supabase
          .from("challenges")
          .select("id, ladder_id, challenger_player_id, challenged_player_id, status, expires_at, match_id")
          .eq("id", challenge_id)
          .single();

        if (q2.error || !q2.data) {
          return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }
        challenge = q2.data as ChallengeRow;
      } else {
        return NextResponse.json({ error: q1.error?.message ?? "Challenge not found" }, { status: 404 });
      }
    }

    if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

    const mePlayerId = String((mePlayer as { id: string }).id);

    // Only challenged player can respond
    if (challenge.challenged_player_id !== mePlayerId) {
      return NextResponse.json({ error: "Only the challenged player can respond" }, { status: 403 });
    }

    // Must be proposed and not expired
    if (challenge.status !== "PROPOSED") {
      return NextResponse.json(
        { error: `Challenge not PROPOSED (current: ${challenge.status})` },
        { status: 400 }
      );
    }

    const expiresMs = Date.parse(challenge.expires_at);
    if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    if (action === "DECLINE") {
      const { error: upErr } = await supabase.from("challenges").update({ status: "DECLINED" }).eq("id", challenge_id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ACCEPT: if already has match_id, avoid double-create
    if (challenge.match_id) {
      const { error: upErr } = await supabase.from("challenges").update({ status: "ACCEPTED" }).eq("id", challenge_id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

      return NextResponse.json({
        ok: true,
        match_id: challenge.match_id,
        match_type: normalizeMatchType(challenge.match_type),
      });
    }

    const match_type: MatchType = normalizeMatchType(challenge.match_type);

    // ===================== OPTION A: PRE-RECALC (RANKED ONLY) =====================
    if (match_type === "RANKED") {
      const r1 = await supabase.rpc("recalc_ladder", { ladder_uuid: challenge.ladder_id });
      if (r1.error) {
        return NextResponse.json({ error: "Could not refresh ladder standings. Please retry." }, { status: 400 });
      }

      const r2 = await supabase.rpc("recalc_ladder_positions", { ladder_uuid: challenge.ladder_id });
      if (r2.error) {
        return NextResponse.json({ error: "Could not refresh ladder positions. Please retry." }, { status: 400 });
      }
    }
    // ============================================================================

    // Resolve stored ladder positions (post-recalc for ranked)
    const { data: posRows, error: posErr } = await supabase
      .from("ladder_entries")
      .select("player_id, position")
      .eq("ladder_id", challenge.ladder_id)
      .in("player_id", [challenge.challenger_player_id, challenge.challenged_player_id]);

    if (posErr) return NextResponse.json({ error: `ladder_entries: ${posErr.message}` }, { status: 400 });

    const posRowsTyped = (posRows ?? []) as LadderEntryPositionRow[];
    const challengerRow = posRowsTyped.find((r) => r.player_id === challenge.challenger_player_id);
    const challengedRow = posRowsTyped.find((r) => r.player_id === challenge.challenged_player_id);

    if (!challengerRow || !challengedRow) {
      return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
    }

    const challengerPos = challengerRow.position ?? null;
    const challengedPos = challengedRow.position ?? null;

    // Create match
    // Attempt insert including match_type + start positions; fallback if those columns don't exist.
    let matchId: string | null = null;

    const insertBase: MatchInsertBase = {
      challenge_id: challenge.id,
      ladder_id: challenge.ladder_id,
      challenger_player_id: challenge.challenger_player_id,
      challenged_player_id: challenge.challenged_player_id,
      status: "OPEN",
      challenger_position_at_start: challengerPos,
      challenged_position_at_start: challengedPos,
    };

    // Try with match_type first
    const withType = await supabase.from("matches").insert({ ...insertBase, match_type }).select("id").single();

    if (!withType.error && withType.data?.id) {
      matchId = withType.data.id;
    } else if (withType.error && isMissingColumnError(withType.error.message, "match_type")) {
      // Retry without match_type
      const retry = await supabase.from("matches").insert(insertBase).select("id").single();
      if (retry.error || !retry.data?.id) {
        return NextResponse.json(
          { error: `matches insert: ${retry.error?.message ?? "unknown error"}` },
          { status: 400 }
        );
      }
      matchId = retry.data.id;
    } else if (
      withType.error &&
      (isMissingColumnError(withType.error.message, "challenger_position_at_start") ||
        isMissingColumnError(withType.error.message, "challenged_position_at_start"))
    ) {
      // Retry without start position fields as well
      const { challenger_position_at_start, challenged_position_at_start, ...minimal } = insertBase;

      const retry = await supabase.from("matches").insert(minimal).select("id").single();
      if (retry.error || !retry.data?.id) {
        return NextResponse.json(
          { error: `matches insert: ${retry.error?.message ?? "unknown error"}` },
          { status: 400 }
        );
      }
      matchId = retry.data.id;
    } else {
      return NextResponse.json({ error: `matches insert: ${withType.error?.message ?? "unknown error"}` }, { status: 400 });
    }

    // Update challenge: status ACCEPTED + attach match_id
    const { error: chUpErr } = await supabase
      .from("challenges")
      .update({ status: "ACCEPTED", match_id: matchId })
      .eq("id", challenge_id);

    if (chUpErr) return NextResponse.json({ error: chUpErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      match_id: matchId,
      match_type,
      positions_used: {
        challenger_position_at_start: challengerPos,
        challenged_position_at_start: challengedPos,
        source: "ladder_entries.position",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
