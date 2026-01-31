import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
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

    const challenge_id = body?.challenge_id as string | undefined;
    if (!challenge_id) {
      return NextResponse.json({ error: "Missing challenge_id" }, { status: 400 });
    }

    // Current player (gameplay key)
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (meErr || !mePlayer) {
      return NextResponse.json({ error: "Signed-in user not linked to a player record" }, { status: 400 });
    }

    // Load challenge (defensive)
    let challenge: any = null;

    {
      const q1 = await supabase
        .from("challenges")
        .select("id, challenger_player_id, status, expires_at, match_id")
        .eq("id", challenge_id)
        .single();

      if (!q1.error && q1.data) {
        challenge = q1.data;
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_id")) {
        const q2 = await supabase
          .from("challenges")
          .select("id, challenger_player_id, status, expires_at")
          .eq("id", challenge_id)
          .single();

        if (q2.error || !q2.data) {
          return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }
        challenge = q2.data;
      } else {
        return NextResponse.json({ error: q1.error?.message ?? "Challenge not found" }, { status: 404 });
      }
    }

    // Only challenger can cancel
    if (challenge.challenger_player_id !== mePlayer.id) {
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
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
