// app/api/tournaments/complete/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { completeTournamentIfDone } from "@/lib/tournaments/completeTournamentIfDone";

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

    const alreadyCompleted = String((t as any)?.status ?? "") === "COMPLETED";

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
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err?.message ?? String(err)}` }, { status: 500 });
  }
}
