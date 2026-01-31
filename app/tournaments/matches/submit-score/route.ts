// app/api/tournaments/matches/submit-score/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function asInt(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

async function getCaptainPlayerId(supabase: any, teamId: string) {
  const { data, error } = await supabase
    .from("tournament_team_members")
    .select("player_id")
    .eq("team_id", teamId)
    .order("player_id", { ascending: true })
    .limit(1);

  if (error) return { error: error.message, captainId: null as string | null };
  const pid = data?.[0]?.player_id;
  return { error: null as string | null, captainId: pid ? String(pid) : null };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/submit-score",
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

    // 2) Body
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const match_id: string | undefined = body?.match_id;
    const score_a = asInt(body?.score_a);
    const score_b = asInt(body?.score_b);

    if (!match_id) {
      return NextResponse.json({ error: "Missing match_id" }, { status: 400 });
    }
    if (score_a == null || score_b == null) {
      return NextResponse.json({ error: "Invalid score_a or score_b" }, { status: 400 });
    }
    if (score_a < 0 || score_b < 0) {
      return NextResponse.json({ error: "Scores must be >= 0" }, { status: 400 });
    }

    // 3) Resolve my player_id
    const { data: me, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (meErr || !me?.id) {
      return NextResponse.json(
        { error: "Signed-in user is not linked to a player record" },
        { status: 400 }
      );
    }

    const myPlayerId = String(me.id);

    // 4) Fetch match (must be tournament match)
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, team_a_id, team_b_id, status, finalized_by_admin, score_a, score_b, confirmed_by_a, confirmed_by_b"
      )
      .eq("id", match_id)
      .single();

    if (mErr || !match?.id) {
      return NextResponse.json({ error: `Match not found` }, { status: 404 });
    }

    if (!match.tournament_id) {
      return NextResponse.json({ error: "Not a tournament match" }, { status: 400 });
    }

    if (match.finalized_by_admin) {
      return NextResponse.json({ error: "Match has been finalized by admin" }, { status: 409 });
    }

    const status = String(match.status ?? "");
    if (status !== "IN_PLAY") {
      return NextResponse.json({ error: "Scores can only be submitted when match is In-play" }, { status: 409 });
    }

    const teamAId = match.team_a_id ? String(match.team_a_id) : "";
    const teamBId = match.team_b_id ? String(match.team_b_id) : "";

    if (!teamAId || !teamBId) {
      return NextResponse.json({ error: "Match teams not set" }, { status: 400 });
    }

    // 5) Captain check
    const capA = await getCaptainPlayerId(supabase, teamAId);
    if (capA.error) return NextResponse.json({ error: `Captain lookup failed: ${capA.error}` }, { status: 400 });

    const capB = await getCaptainPlayerId(supabase, teamBId);
    if (capB.error) return NextResponse.json({ error: `Captain lookup failed: ${capB.error}` }, { status: 400 });

    const isCaptainA = capA.captainId === myPlayerId;
    const isCaptainB = capB.captainId === myPlayerId;

    if (!isCaptainA && !isCaptainB) {
      return NextResponse.json({ error: "Only team captains can submit scores" }, { status: 403 });
    }

    // 6) Write submission:
    // - set scores
    // - set submitted_by_player_id/submitted_at
    // - auto-confirm my side, reset other side to false (fresh submission)
    const nowIso = new Date().toISOString();

    const patch: any = {
      score_a,
      score_b,
      submitted_by_player_id: myPlayerId,
      submitted_at: nowIso,
      confirmed_by_a: isCaptainA ? true : false,
      confirmed_by_b: isCaptainB ? true : false,
      // clear any previous admin-final markers if they exist (shouldn't, but safe)
      admin_final_by: null,
      admin_final_at: null,
      finalized_by_admin: false,
      finalized_at: null,
    };

    const { data: updated, error: upErr } = await supabase
      .from("matches")
      .update(patch)
      .eq("id", match_id)
      .select(
        "id, tournament_id, team_a_id, team_b_id, round_no, status, score_a, score_b, submitted_by_player_id, submitted_at, confirmed_by_a, confirmed_by_b, finalized_by_admin, finalized_at, admin_final_by, admin_final_at"
      )
      .single();

    if (upErr || !updated?.id) {
      return NextResponse.json({ error: upErr?.message ?? "Could not submit score" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, match: updated });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
