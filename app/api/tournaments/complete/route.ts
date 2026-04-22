// app/api/tournaments/complete/route.ts
import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";
import { completeTournamentIfDone } from "@/lib/tournaments/completeTournamentIfDone";

type ProfileAdminRow = { role?: string | null; is_admin?: boolean | null; club_id?: string | null };
type TournamentRow = {
  id?: string | null;
  status?: string | null;
  scope?: string | null;
  club_id?: string | null;
};
type CompleteTournamentBody = { tournament_id?: unknown };

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/complete",
    methods: ["GET", "POST"],
  });
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Admin gate (profiles)
    const { data: prof, error: prErr } = await supabase
      .from("profiles")
      .select("role, is_admin, club_id")
      .eq("id", user.id)
      .single();

    if (prErr) {
      return NextResponse.json(
        { error: `Could not verify admin access: ${prErr.message}` },
        { status: 400 }
      );
    }

    const profRow = (prof ?? null) as ProfileAdminRow | null;
    const role = String(profRow?.role ?? "").toUpperCase();
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdminFlag = Boolean(profRow?.is_admin);
    const adminClubId = profRow?.club_id ? String(profRow.club_id) : "";

    if (!isSuperAdmin && !isAdminFlag) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 3) Body
    let body: CompleteTournamentBody | null = null;
    try {
      body = (await req.json()) as CompleteTournamentBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const tournament_id: string | undefined =
      typeof body?.tournament_id === "string" ? body.tournament_id : undefined;
    if (!tournament_id) return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });

    // 4) Tournament exists + club gate
    const { data: t, error: tErr } = await supabase
      .from("tournaments")
      .select("id, status, scope, club_id")
      .eq("id", tournament_id)
      .single();

    const tRow = (t ?? null) as TournamentRow | null;
    if (tErr || !tRow?.id) {
      return NextResponse.json({ error: tErr?.message ?? "Tournament not found" }, { status: 404 });
    }

    if (!isSuperAdmin) {
      const tClub = String(tRow.club_id ?? "");
      const tScope = String(tRow.scope ?? "");
      if (!adminClubId || tScope !== "CLUB" || tClub !== adminClubId) {
        return NextResponse.json({ error: "Club admin access denied" }, { status: 403 });
      }
    }

    const alreadyCompleted = String(tRow.status ?? "") === "COMPLETED";

    const done = await completeTournamentIfDone({ supabase, tournamentId: String(tournament_id) });
    if (!done.attempted && !alreadyCompleted) {
      return NextResponse.json(
        { error: "Final is not complete yet (winner required before completing tournament)." },
        { status: 400 }
      );
    }
    if (!done.completed && !alreadyCompleted) {
      return NextResponse.json({ error: done.error ?? "Could not complete tournament" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      completed: alreadyCompleted ? true : done.completed,
      already_completed: alreadyCompleted,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
