// app/api/tournaments/matches/admin-final/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function asInt(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/matches/admin-final",
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

    // 2) Admin gate (profiles)
    const { data: prof, error: prErr } = await supabase
      .from("profiles")
      .select("role, is_admin, club_id")
      .eq("id", authData.user.id)
      .single();

    if (prErr) {
      return NextResponse.json({ error: `Could not verify admin access: ${prErr.message}` }, { status: 400 });
    }
    const role = String((prof as any)?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean((prof as any)?.is_admin);
    const adminClubId = (prof as any)?.club_id ? String((prof as any).club_id) : "";

    if (!isSuperAdmin && !isAdminFlag) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 3) Body
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

    // 4) Match must exist + be tournament match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("id, tournament_id")
      .eq("id", match_id)
      .single();

    if (mErr || !match?.id) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (!match.tournament_id) {
      return NextResponse.json({ error: "Not a tournament match" }, { status: 400 });
    }

    if (!isSuperAdmin) {
      const tRes = await supabase.from("tournaments").select("id, scope, club_id").eq("id", match.tournament_id).single();
      if (tRes.error || !tRes.data?.id) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
      }
      const tClub = String((tRes.data as any)?.club_id ?? "");
      const tScope = String((tRes.data as any)?.scope ?? "");
      if (!adminClubId || tScope !== "CLUB" || tClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    const nowIso = new Date().toISOString();

    // 5) Force finalize:
    // - write scores
    // - mark both confirmations true
    // - set admin_final fields
    // - mark finalized_by_admin true (+ timestamps)
    // - set status COMPLETED
    const patch: any = {
      score_a,
      score_b,
      confirmed_by_a: true,
      confirmed_by_b: true,
      admin_final_by: authData.user.id,
      admin_final_at: nowIso,
      finalized_by_admin: true,
      finalized_at: nowIso,
      status: "COMPLETED",
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
      return NextResponse.json({ error: upErr?.message ?? "Could not admin-final match" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, match: updated });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
