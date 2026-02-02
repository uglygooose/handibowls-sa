import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// Debug GET - confirms route is alive
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/challenges/create",
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

    // 1) Auth check
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Parse body
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ladder_id: string | undefined = body?.ladder_id;
    const challenged_player_id: string | undefined = body?.challenged_player_id;
    const match_type: MatchType = normalizeMatchType(body?.match_type);

    if (!ladder_id || !challenged_player_id) {
      return NextResponse.json({ error: "Missing ladder_id or challenged_player_id" }, { status: 400 });
    }

    // 3) Find challenger player
    const { data: challenger, error: chErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (chErr || !challenger) {
      return NextResponse.json({ error: "Signed-in user is not linked to a player record" }, { status: 400 });
    }

    if (challenger.id === challenged_player_id) {
      return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
    }

    // 4) Ensure both players exist on this ladder
    const { data: existingEntries, error: exEntriesErr } = await supabase
      .from("ladder_entries")
      .select("player_id, played")
      .eq("ladder_id", ladder_id)
      .in("player_id", [challenger.id, challenged_player_id]);

    if (exEntriesErr) {
      return NextResponse.json({ error: `ladder_entries: ${exEntriesErr.message}` }, { status: 400 });
    }

    if (!existingEntries || existingEntries.length !== 2) {
      return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
    }

    const playedById = new Map(existingEntries.map((e: any) => [String(e.player_id), Number(e.played ?? 0)]));

    // 5) Ranked rule enforcement (+/-2 after both have 3+ games) MUST match UI ordering:
    // Bowls convention: PTS -> SD -> SF, with position as tie-break for determinism.
    if (match_type === "RANKED") {
      const { data: leaderboard, error: lbErr } = await supabase
        .from("ladder_entries")
        .select("player_id, points, shot_diff, shots_for, position, played")
        .eq("ladder_id", ladder_id)
        .order("points", { ascending: false })
        .order("shot_diff", { ascending: false })
        .order("shots_for", { ascending: false })
        .order("position", { ascending: true });

      if (lbErr) {
        return NextResponse.json({ error: `ladder_entries: ${lbErr.message}` }, { status: 400 });
      }

      const list = leaderboard ?? [];
      const challengerRow = list.find((r: any) => r.player_id === challenger.id);
      const challengedRow = list.find((r: any) => r.player_id === challenged_player_id);

      if (!challengerRow || !challengedRow) {
        return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
      }

      const challengerPlayed = playedById.get(String(challenger.id)) ?? Number(challengerRow.played ?? 0);
      const challengedPlayed = playedById.get(String(challenged_player_id)) ?? Number(challengedRow.played ?? 0);

      // Until both have played 3+, allow any ranked challenge.
      if (challengerPlayed >= 3 && challengedPlayed >= 3) {
        const qualified = list.filter((r: any) => Number(r.played ?? 0) >= 3);
        const challengerIdx = qualified.findIndex((r: any) => r.player_id === challenger.id);
        const challengedIdx = qualified.findIndex((r: any) => r.player_id === challenged_player_id);

        if (challengerIdx < 0 || challengedIdx < 0) {
          return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
        }

        const challengerPos = challengerIdx + 1; // computed position among 3+ players
        const challengedPos = challengedIdx + 1; // computed position among 3+ players

        if (Math.abs(challengedPos - challengerPos) > 2) {
          return NextResponse.json(
            { error: "Ranked challenge must be within +/-2 ladder positions (after 3 games)" },
            { status: 400 }
          );
        }
      }
    }

    // 6) Prevent duplicates: any active PROPOSED between these two players on same ladder
    const { data: existing, error: exErr } = await supabase
      .from("challenges")
      .select("id, status")
      .eq("ladder_id", ladder_id)
      .eq("challenger_player_id", challenger.id)
      .eq("challenged_player_id", challenged_player_id)
      .in("status", ["PROPOSED"]);

    if (!exErr && existing && existing.length > 0) {
      return NextResponse.json({ error: "A challenge is already pending for this opponent." }, { status: 400 });
    }

    // 7) Insert challenge (3-day expiry)
    const expires_at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const insertBase: any = {
      ladder_id,
      challenger_player_id: challenger.id,
      challenged_player_id,
      status: "PROPOSED",
      expires_at,
    };

    // Try insert WITH match_type; fallback if challenges.match_type doesn't exist
    const withType = await supabase.from("challenges").insert({ ...insertBase, match_type }).select().single();

    if (!withType.error && withType.data) {
      return NextResponse.json({ ok: true, challenge: withType.data });
    }

    if (withType.error && isMissingColumnError(withType.error.message, "match_type")) {
      const retry = await supabase.from("challenges").insert(insertBase).select().single();
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, challenge: retry.data });
    }

    return NextResponse.json({ error: withType.error?.message ?? "Unknown insert error" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
