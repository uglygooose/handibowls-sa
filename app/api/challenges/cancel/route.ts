import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}

type ChallengeRow = {
  id: string;
  challenger_player_id: string;
  status: string;
  expires_at: string;
  match_id?: string | null;
};

type CancelRequestBody = {
  challenge_id?: unknown;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: CancelRequestBody | null = null;
    try {
      body = (await req.json()) as CancelRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const challenge_id = typeof body?.challenge_id === "string" ? body.challenge_id : undefined;
    if (!challenge_id) {
      return NextResponse.json({ error: "Missing challenge_id" }, { status: 400 });
    }

    // Current player (gameplay key)
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      return NextResponse.json({ error: "Signed-in user not linked to a player record" }, { status: 400 });
    }

    // Load challenge (defensive)
    let challenge: ChallengeRow | null = null;

    {
      const q1 = await supabase
        .from("challenges")
        .select("id, challenger_player_id, status, expires_at, match_id")
        .eq("id", challenge_id)
        .single();

      if (!q1.error && q1.data) {
        challenge = q1.data as ChallengeRow;
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_id")) {
        const q2 = await supabase
          .from("challenges")
          .select("id, challenger_player_id, status, expires_at")
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

    // Only challenger can cancel
    if (challenge.challenger_player_id !== String(mePlayer.id)) {
      return NextResponse.json({ error: "Only the challenger can cancel" }, { status: 403 });
    }

    // Idempotency:
    // - If already DECLINED, treat as OK (already cancelled/declined)
    if (challenge.status === "DECLINED") {
      return NextResponse.json({ ok: true, already_cancelled: true });
    }

    // Must still be PROPOSED (ACCEPTED not cancellable)
    if (challenge.status !== "PROPOSED") {
      return NextResponse.json(
        { error: `Challenge not PROPOSED (current: ${challenge.status})` },
        { status: 400 }
      );
    }

    // Must not be expired
    const expiresMs = Date.parse(challenge.expires_at);
    if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    // Cancel = mark as DECLINED (no new enum)
    const { error: upErr } = await supabase
      .from("challenges")
      .update({ status: "DECLINED" })
      .eq("id", challenge_id)
      .eq("status", "PROPOSED"); // extra guard

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
