import { NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server";

type MatchType = "RANKED" | "FRIENDLY";
type GenderFilter = "ALL" | "MALE" | "FEMALE";

type CreateChallengeBody = {
  ladder_id?: unknown;
  challenged_player_id?: unknown;
  match_type?: unknown;
  gender_filter?: unknown;
};
type PlayerRow = { id?: string | null; gender?: string | null };
type LadderEntryRow = {
  player_id?: string | null;
  points?: number | null;
  shot_diff?: number | null;
  shots_for?: number | null;
  position?: number | null;
  played?: number | null;
};
type InsertChallengeBase = {
  ladder_id: string;
  challenger_player_id: string;
  challenged_player_id: string;
  status: "PROPOSED";
  expires_at: string;
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

function normalizeGenderFilter(v: unknown): GenderFilter {
  const t = String(v ?? "ALL").toUpperCase();
  if (t === "MALE") return "MALE";
  if (t === "FEMALE") return "FEMALE";
  return "ALL";
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
    // 1) Auth check
    const { supabase, user } = await createAuthedServerClient();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2) Parse body
    let body: CreateChallengeBody | null = null;
    try {
      body = (await req.json()) as CreateChallengeBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const ladder_id: string | undefined =
      typeof body?.ladder_id === "string" ? body.ladder_id : undefined;
    const challenged_player_id: string | undefined =
      typeof body?.challenged_player_id === "string" ? body.challenged_player_id : undefined;
    const match_type: MatchType = normalizeMatchType(body?.match_type);
    const gender_filter: GenderFilter = normalizeGenderFilter(body?.gender_filter);

    if (!ladder_id || !challenged_player_id) {
      return NextResponse.json({ error: "Missing ladder_id or challenged_player_id" }, { status: 400 });
    }

    if (match_type === "FRIENDLY") {
      return NextResponse.json(
        { error: "Friendly games have moved to Games. Use the Games page to invite a member and book a lane." },
        { status: 400 }
      );
    }

    // 3) Find challenger player
    const { data: challenger, error: chErr } = await supabase
      .from("players")
      .select("id, gender")
      .eq("user_id", user.id)
      .single();

    if (chErr || !challenger) {
      return NextResponse.json({ error: "Signed-in user is not linked to a player record" }, { status: 400 });
    }

    const challengerRow = challenger as PlayerRow;
    if (String(challengerRow.id) === challenged_player_id) {
      return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
    }

    const challengerGender = String(challengerRow.gender ?? "");

    // 4) Load challenged player (for gender + existence)
    const { data: challengedPlayer, error: cpErr } = await supabase
      .from("players")
      .select("id, gender")
      .eq("id", challenged_player_id)
      .single();

    const challengedRow = (challengedPlayer ?? null) as PlayerRow | null;
    if (cpErr || !challengedRow?.id) {
      return NextResponse.json({ error: "Challenged player not found" }, { status: 400 });
    }

    const challengedGender = String(challengedRow.gender ?? "");

    if (challengerGender && challengedGender && challengerGender !== challengedGender) {
      return NextResponse.json({ error: "You can only challenge players of the same gender" }, { status: 400 });
    }

    if (gender_filter !== "ALL" && challengerGender && gender_filter !== challengerGender) {
      return NextResponse.json({ error: "Gender filter does not match your profile" }, { status: 400 });
    }

    // 5) Ensure both players exist on this ladder
    const { data: existingEntries, error: exEntriesErr } = await supabase
      .from("ladder_entries")
      .select("player_id")
      .eq("ladder_id", ladder_id)
      .in("player_id", [String(challengerRow.id), challenged_player_id]);

    if (exEntriesErr) {
      return NextResponse.json({ error: `ladder_entries: ${exEntriesErr.message}` }, { status: 400 });
    }

    if (!existingEntries || existingEntries.length !== 2) {
      return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
    }

    // 6) Ranked rule enforcement (+/-2) MUST match UI ordering:
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

      const list = (leaderboard ?? []) as LadderEntryRow[];

      // Enforce +/-2 within the leaderboard the user is viewing (ALL / MALE / FEMALE).
      let listForRule: LadderEntryRow[] = list;
      if (gender_filter !== "ALL") {
        const ids = Array.from(
          new Set(list.map((r: LadderEntryRow) => String(r.player_id ?? "")).filter(Boolean))
        );
        const { data: genders, error: gErr } = ids.length
          ? await supabase.from("players").select("id, gender").in("id", ids)
          : { data: [] as PlayerRow[], error: null as Error | null };

        if (!gErr) {
          const genderById = new Map(
            ((genders ?? []) as PlayerRow[]).map((p) => [String(p.id ?? ""), String(p.gender ?? "")])
          );
          listForRule = list.filter(
            (r: LadderEntryRow) => genderById.get(String(r.player_id ?? "")) === gender_filter
          );
        }
      }

      const challengerIdx = listForRule.findIndex(
        (r: LadderEntryRow) => String(r.player_id ?? "") === String(challengerRow.id)
      );
      const challengedIdx = listForRule.findIndex(
        (r: LadderEntryRow) => String(r.player_id ?? "") === String(challenged_player_id)
      );

      if (challengerIdx < 0 || challengedIdx < 0) {
        return NextResponse.json({ error: "Both players must be on the ladder" }, { status: 400 });
      }

      const challengerPos = challengerIdx + 1; // computed position in this rule set
      const challengedPos = challengedIdx + 1;

      if (Math.abs(challengedPos - challengerPos) > 2) {
        return NextResponse.json({ error: "Ranked challenge must be within +/-2 ladder positions" }, { status: 400 });
      }
    }

    // 7) Prevent duplicates: any active PROPOSED between these two players on same ladder
    const { data: existing, error: exErr } = await supabase
      .from("challenges")
      .select("id, status")
      .eq("ladder_id", ladder_id)
      .eq("challenger_player_id", String(challengerRow.id))
      .eq("challenged_player_id", challenged_player_id)
      .in("status", ["PROPOSED"]);

    if (!exErr && existing && existing.length > 0) {
      return NextResponse.json({ error: "A challenge is already pending for this opponent." }, { status: 400 });
    }

    // 8) Insert challenge (3-day expiry)
    const expires_at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const insertBase: InsertChallengeBase = {
      ladder_id,
      challenger_player_id: String(challengerRow.id),
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
