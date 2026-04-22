// app/api/tournaments/advance-round/route.ts
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
type MatchRow = {
  id: string;
  round_no: number | null;
  match_no?: number | null;
  status?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  winner_team_id?: string | null;
  finalized_by_admin?: boolean | null;
};
type TeamRow = { id: string; team_no: number };
type AdvanceRoundBody = { tournament_id?: unknown; round_no?: unknown };
type InsertMatch = {
  tournament_id: string;
  round_no: number;
  match_no: number;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source_type: "TEAM" | "WINNER_OF_MATCH" | null;
  slot_a_source_match_id: string | null;
  slot_b_source_type: "TEAM" | "WINNER_OF_MATCH" | null;
  slot_b_source_match_id: string | null;
  status: "SCHEDULED" | "OPEN";
  score_a: null;
  score_b: null;
  submitted_by_player_id: null;
  submitted_at: null;
  confirmed_by_a: false;
  confirmed_by_b: false;
  finalized_by_admin: false;
  finalized_at: null;
  admin_final_by: null;
  admin_final_at: null;
  winner_team_id: null;
};

function asInt(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

function bool(v: unknown) {
  return v === true;
}

function isMatchBye(m: MatchRow) {
  const st = String(m?.status ?? "");
  return st === "BYE" || !m?.team_b_id;
}

function isMatchDone(m: MatchRow) {
  const st = String(m?.status ?? "");
  const hasWinner = m?.winner_team_id != null && String(m.winner_team_id) !== "";
  return st === "COMPLETED" || bool(m?.finalized_by_admin) || hasWinner;
}

function largestPowerOfTwoLE(n: number) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/tournaments/advance-round",
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
    let body: AdvanceRoundBody | null = null;
    try {
      body = (await req.json()) as AdvanceRoundBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const tournament_id: string | undefined =
      typeof body?.tournament_id === "string" ? body.tournament_id : undefined;
    const round_no = asInt(body?.round_no);

    if (!tournament_id) return NextResponse.json({ error: "Missing tournament_id" }, { status: 400 });
    if (round_no == null || round_no <= 0) return NextResponse.json({ error: "Invalid round_no" }, { status: 400 });

    const nextRoundNo = round_no + 1;

    // 4) Tournament exists
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
    if (String(tRow.status) === "COMPLETED") {
      return NextResponse.json({ error: "Tournament is completed" }, { status: 400 });
    }

    // 5) If next round already exists, block
    const { data: existingNext, error: exErr } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", tournament_id)
      .eq("round_no", nextRoundNo)
      .limit(1);

    if (exErr) return NextResponse.json({ error: `Could not check next round: ${exErr.message}` }, { status: 400 });
    if ((existingNext ?? []).length) {
      return NextResponse.json({ error: `Round ${nextRoundNo} already exists` }, { status: 400 });
    }

    // 6) Load matches in this round
    const { data: ms, error: mErr } = await supabase
      .from("matches")
      .select("id, round_no, match_no, status, team_a_id, team_b_id, winner_team_id, finalized_by_admin")
      .eq("tournament_id", tournament_id)
      .eq("round_no", round_no)
      .order("match_no", { ascending: true })
      .order("id", { ascending: true });

    if (mErr) return NextResponse.json({ error: `Could not load matches: ${mErr.message}` }, { status: 400 });

    const roundMatches = (ms ?? []) as MatchRow[];
    if (!roundMatches.length) {
      return NextResponse.json({ error: `No matches found in round ${round_no}` }, { status: 400 });
    }

    const notDone = roundMatches.filter((m: MatchRow) => !isMatchDone(m) && !isMatchBye(m));
    if (notDone.length) {
      return NextResponse.json({ error: `Round ${round_no} has incomplete matches` }, { status: 400 });
    }

    // 7) Load team order (for fixed bracket seeding)
    const { data: teams, error: teamErr } = await supabase
      .from("tournament_teams")
      .select("id, team_no")
      .eq("tournament_id", tournament_id)
      .order("team_no", { ascending: true });

    if (teamErr) {
      return NextResponse.json({ error: `Could not load teams: ${teamErr.message}` }, { status: 400 });
    }

    const teamRows: TeamRow[] = ((teams ?? []) as Array<{ id: unknown; team_no: unknown }>).map((t) => ({
      id: String(t.id),
      team_no: typeof t.team_no === "number" ? t.team_no : Number(t.team_no ?? 0),
    }));

    const teamNoById = new Map<string, number>();
    for (const t of teamRows) teamNoById.set(t.id, t.team_no);

    const totalTeams = teamRows.length;
    const p = largestPowerOfTwoLE(totalTeams);
    const playInMatchesExpected = totalTeams - p;
    const isPlayInRound = round_no === 1 && playInMatchesExpected > 0 && roundMatches.length === playInMatchesExpected;

    const inserts: InsertMatch[] = [];
    let matchNo = 1;

    if (isPlayInRound) {
      const playInTeamIds = new Set<string>();
      for (const m of roundMatches) {
        if (m.team_a_id) playInTeamIds.add(String(m.team_a_id));
        if (m.team_b_id) playInTeamIds.add(String(m.team_b_id));
      }

      const byeTeams = teamRows.filter((t) => !playInTeamIds.has(t.id));

      const entries: Array<{
        slot: number;
        team_id: string | null;
        source_type: "TEAM" | "WINNER_OF_MATCH";
        source_match_id: string | null;
      }> = [];

      for (const m of roundMatches) {
        const winnerId = m?.winner_team_id
          ? String(m.winner_team_id)
          : isMatchBye(m) && m.team_a_id
          ? String(m.team_a_id)
          : null;

        const aNo = m.team_a_id ? teamNoById.get(String(m.team_a_id)) : undefined;
        const bNo = m.team_b_id ? teamNoById.get(String(m.team_b_id)) : undefined;
        let slot = Math.min(aNo ?? Number.POSITIVE_INFINITY, bNo ?? Number.POSITIVE_INFINITY);
        if (!Number.isFinite(slot)) {
          slot = winnerId ? teamNoById.get(winnerId) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
        }
        if (!Number.isFinite(slot)) slot = 999999;

        entries.push({
          slot,
          team_id: winnerId,
          source_type: winnerId ? "TEAM" : "WINNER_OF_MATCH",
          source_match_id: winnerId ? null : String(m.id),
        });
      }

      for (const t of byeTeams) {
        const slot = Number.isFinite(t.team_no) ? t.team_no : 999999;
        entries.push({ slot, team_id: t.id, source_type: "TEAM", source_match_id: null });
      }

      if (entries.length !== p) {
        return NextResponse.json({ error: `Expected ${p} teams for Round ${nextRoundNo}, found ${entries.length}` }, { status: 400 });
      }

      entries.sort(
        (a, b) =>
          a.slot - b.slot ||
          String(a.team_id ?? a.source_match_id ?? "").localeCompare(String(b.team_id ?? b.source_match_id ?? ""))
      );

      for (let i = 0; i < entries.length; i += 2) {
        const aEntry = entries[i] ?? null;
        const bEntry = entries[i + 1] ?? null;
        const a = aEntry?.team_id ?? null;
        const b = bEntry?.team_id ?? null;

        inserts.push({
          tournament_id,
          round_no: nextRoundNo,
          match_no: matchNo,
          team_a_id: a,
          team_b_id: b,
          slot_a_source_type: aEntry?.source_type ?? null,
          slot_a_source_match_id: aEntry?.source_match_id ?? null,
          slot_b_source_type: bEntry?.source_type ?? null,
          slot_b_source_match_id: bEntry?.source_match_id ?? null,
          status: a && b ? "SCHEDULED" : "OPEN",
          score_a: null,
          score_b: null,
          submitted_by_player_id: null,
          submitted_at: null,
          confirmed_by_a: false,
          confirmed_by_b: false,
          finalized_by_admin: false,
          finalized_at: null,
          admin_final_by: null,
          admin_final_at: null,
          winner_team_id: null,
        });

        matchNo += 1;
      }
    } else {
      // Winners only (ordered by match_no)
      const entries = roundMatches.map((m: MatchRow) => {
        const winnerId = m?.winner_team_id
          ? String(m.winner_team_id)
          : isMatchBye(m) && m.team_a_id
          ? String(m.team_a_id)
          : null;
        return {
          team_id: winnerId,
          source_type: winnerId ? "TEAM" : "WINNER_OF_MATCH",
          source_match_id: winnerId ? null : String(m.id),
        } as { team_id: string | null; source_type: "TEAM" | "WINNER_OF_MATCH"; source_match_id: string | null };
      });

      // If only one winner remains, the tournament is complete (avoid creating a 1-team "next round").
      if (entries.length === 1) {
        const done = await completeTournamentIfDone({ supabase, tournamentId: String(tournament_id) });
        if (done.attempted && !done.completed) {
          return NextResponse.json({ error: done.error ?? "Could not complete tournament" }, { status: 400 });
        }

        return NextResponse.json({
          ok: true,
          tournament_completed: true,
          champion_team_id: entries[0]?.team_id ?? null,
          completed_at: new Date().toISOString(),
        });
      }

      for (let i = 0; i < entries.length; i += 2) {
        const aEntry = entries[i] ?? null;
        const bEntry = entries[i + 1] ?? null;
        const a = aEntry?.team_id ?? null;
        const b = bEntry?.team_id ?? null;

        inserts.push({
          tournament_id,
          round_no: nextRoundNo,
          match_no: matchNo,
          team_a_id: a,
          team_b_id: b,
          slot_a_source_type: aEntry?.source_type ?? null,
          slot_a_source_match_id: aEntry?.source_match_id ?? null,
          slot_b_source_type: bEntry?.source_type ?? null,
          slot_b_source_match_id: bEntry?.source_match_id ?? null,
          status: a && b ? "SCHEDULED" : "OPEN",
          score_a: null,
          score_b: null,
          submitted_by_player_id: null,
          submitted_at: null,
          confirmed_by_a: false,
          confirmed_by_b: false,
          finalized_by_admin: false,
          finalized_at: null,
          admin_final_by: null,
          admin_final_at: null,
          winner_team_id: null,
        });

        matchNo += 1;
      }
    }

    // 8) Build next round fixtures
    const nowIso = new Date().toISOString();

    // 9) Insert
    const { data: created, error: insErr } = await supabase
      .from("matches")
      .insert(inserts)
      .select("id, round_no, match_no, team_a_id, team_b_id, status");

    if (insErr) {
      return NextResponse.json({ error: insErr.message ?? "Could not create next round matches" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      round_created: nextRoundNo,
      created_count: (created ?? []).length,
      matches: created ?? [],
      created_at: nowIso,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
