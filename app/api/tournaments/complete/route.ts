// app/api/tournaments/complete/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { completeTournamentIfDone } from "@/lib/tournaments/completeTournamentIfDone";

function hasValue(v: any) {
  return v != null && String(v) !== "";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/complete",
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
      return NextResponse.json(
        { error: `Could not verify admin access: ${prErr.message}` },
        { status: 400 }
      );
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

    const tournament_id: string | undefined = body?.tournament_id;
    if (!tournament_id) return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });

    // 4) Tournament exists + club gate
    const { data: t, error: tErr } = await supabase
      .from("tournaments")
      .select("id, status, scope, club_id")
      .eq("id", tournament_id)
      .single();

    if (tErr || !t?.id) {
      return NextResponse.json({ error: tErr?.message ?? "Tournament not found" }, { status: 404 });
    }

    if (!isSuperAdmin) {
      const tClub = String((t as any)?.club_id ?? "");
      const tScope = String((t as any)?.scope ?? "");
      if (!adminClubId || tScope !== "CLUB" || tClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    if (String((t as any)?.status ?? "") === "COMPLETED") {
      return NextResponse.json({ ok: true, completed: true, already_completed: true });
    }

    // Cleanup: remove any stray rounds created past the real final (e.g. 1-team placeholder round).
    // Determine the last round that actually had two teams playing.
    try {
      const { data: ms, error: mErr } = await supabase
        .from("matches")
        .select(
          "id, round_no, status, score_a, score_b, winner_team_id, finalized_by_admin, team_a_id, team_b_id, slot_b_source_type"
        )
        .eq("tournament_id", tournament_id);

      if (!mErr && (ms ?? []).length) {
        const fullRounds = (ms ?? [])
          .filter((m: any) => {
            const rn = Number(m?.round_no ?? 0);
            if (!rn) return false;
            const a = hasValue(m?.team_a_id);
            const b = hasValue(m?.team_b_id);
            return a && b;
          })
          .map((m: any) => Number(m?.round_no ?? 0))
          .filter((n: number) => n > 0);

        const maxFullRound = fullRounds.length ? Math.max(...fullRounds) : null;
        if (maxFullRound != null) {
          const extra = (ms ?? []).filter((m: any) => Number(m?.round_no ?? 0) > maxFullRound);
          if (extra.length) {
            const extraIds = extra
              .filter((m: any) => {
                // Only delete obvious placeholders: no winner, no scores, not admin-final.
                const hasWinner = hasValue(m?.winner_team_id);
                const adminFinal = m?.finalized_by_admin === true;
                const hasScores = m?.score_a != null || m?.score_b != null;
                if (hasWinner || adminFinal || hasScores) return false;

                // Must be missing at least one team (single-team "round").
                const a = hasValue(m?.team_a_id);
                const b = hasValue(m?.team_b_id);
                return !(a && b);
              })
              .map((m: any) => String(m.id))
              .filter(Boolean);

            if (extraIds.length) {
              await supabase.from("matches").delete().in("id", extraIds);
            }
          }
        }
      }
    } catch {
      // best-effort only
    }

    const done = await completeTournamentIfDone({ supabase, tournamentId: String(tournament_id) });
    if (!done.attempted) {
      return NextResponse.json(
        { error: "Final is not complete yet (winner required before completing tournament)." },
        { status: 400 }
      );
    }
    if (!done.completed) {
      return NextResponse.json({ error: done.error ?? "Could not complete tournament" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, completed: true, completed_at: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err?.message ?? String(err)}` }, { status: 500 });
  }
}
