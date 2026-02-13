// app/tournaments/page.tsx
"use client";

import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "../components/BottomNav";

type TournamentScope = "CLUB" | "DISTRICT" | "NATIONAL";
type TournamentStatus = "ANNOUNCED" | "IN_PLAY" | "COMPLETED";
type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
type PlayerGender = "MALE" | "FEMALE";
type TournamentGender = "MALE" | "FEMALE" | null;
type TournamentRule = "SCRATCH" | "HANDICAP_START";

type TournamentRow = {
  id: string;
  name: string;
  scope: TournamentScope;
  format: TournamentFormat;
  status: TournamentStatus;
  announced_at: string;
  starts_at: string | null;
  ends_at: string | null;
  entries_open?: boolean | null;
  gender?: TournamentGender | null;
  club_id?: string | null;
  rule_type?: TournamentRule | null;
};

type MatchLite = {
  id: string;
  tournament_id: string | null;
  round_no: number | null;
  match_no?: number | null;
  status: string | null;
  finalized_by_admin: boolean | null;
  winner_team_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  submitted_by_player_id?: string | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
  score_a: number | null;
  score_b: number | null;
  slot_b_source_type: string | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | null;
  slot_b_source_match_id?: string | null;
};

function scopeLabel(scope: TournamentScope) {
  if (scope === "CLUB") return "Club";
  if (scope === "DISTRICT") return "District";
  return "National";
}

function statusLabel(status: TournamentStatus) {
  if (status === "ANNOUNCED") return "Upcoming";
  if (status === "IN_PLAY") return "In-play";
  return "Completed";
}

function formatLabel(fmt: TournamentFormat) {
  if (fmt === "FOUR_BALL") return "4 Balls";
  return fmt.charAt(0) + fmt.slice(1).toLowerCase();
}

function genderLabel(g: TournamentGender | undefined | null) {
  if (g === "MALE") return "Men";
  if (g === "FEMALE") return "Ladies";
  return "Open";
}

function ruleLabel(rule: TournamentRule | null | undefined) {
  if (rule === "SCRATCH") return "Scratch";
  return "Handicap start";
}

function cleanTournamentName(name: string) {
  const raw = (name ?? "").toString();
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function hasValue(v: any) {
  return v != null && String(v) !== "";
}

function bool(v: any) {
  return v === true;
}

function isByeMatch(m: MatchLite) {
  const st = String(m?.status ?? "");
  if (st === "BYE") return true;
  if (String(m?.slot_b_source_type ?? "") === "BYE") return true;
  return !m?.team_b_id && !m?.slot_b_source_type;
}

function isMatchDone(m: MatchLite) {
  const st = String(m?.status ?? "");
  const hasWinner = hasValue(m?.winner_team_id);
  return st === "COMPLETED" || bool(m?.finalized_by_admin) || hasWinner;
}

function inferWinnerTeamId(m: MatchLite) {
  if (hasValue(m?.winner_team_id)) return String(m.winner_team_id);
  if (!isMatchDone(m)) return null;

  if (isByeMatch(m)) return hasValue(m?.team_a_id) ? String(m.team_a_id) : null;

  if (!hasValue(m?.team_a_id) || !hasValue(m?.team_b_id)) return null;
  if (m?.score_a == null || m?.score_b == null) return null;
  if (Number(m.score_a) === Number(m.score_b)) return null;

  return Number(m.score_a) > Number(m.score_b) ? String(m.team_a_id) : String(m.team_b_id);
}

function matchStatusLabel(status: string) {
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "IN_PLAY") return "In play";
  if (status === "COMPLETED") return "Completed";
  if (status === "OPEN") return "Open";
  if (status === "FINAL") return "Final";
  if (status === "BYE") return "BYE";
  return status || "-";
}

function largestPowerOfTwoLE(n: number) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export default function TournamentsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [playerId, setPlayerId] = useState<string>("");
  const [playerGender, setPlayerGender] = useState<PlayerGender | "">("");
  const [genderSaving, setGenderSaving] = useState(false);
  const [enteredByTournamentId, setEnteredByTournamentId] = useState<Record<string, boolean>>({});
  const [clubNameById, setClubNameById] = useState<Record<string, string>>({});
  const [bucketOpenByTitle, setBucketOpenByTitle] = useState<Record<string, boolean>>({});
  const [sectionOpenByKey, setSectionOpenByKey] = useState<Record<string, boolean>>({});

  const [teamsByTournamentId, setTeamsByTournamentId] = useState<
    Record<string, { id: string; team_no: number; team_handicap: number | null }[]>
  >({});
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<string, string[]>>({});
  const [nameByPlayerId, setNameByPlayerId] = useState<Record<string, string>>({});
  const [winnerNameByTournamentId, setWinnerNameByTournamentId] = useState<Record<string, string>>({});
  const [matchesByTournamentId, setMatchesByTournamentId] = useState<Record<string, MatchLite[]>>({});

  async function saveGender(next: PlayerGender) {
    if (!playerId) return;
    setGenderSaving(true);
    setError(null);

    const up = await supabase.from("players").update({ gender: next }).eq("id", playerId);
    if (up.error) {
      setError(`Could not save gender.\n${up.error.message}`);
      setGenderSaving(false);
      return;
    }

    setPlayerGender(next);
    setGenderSaving(false);
    await load();
  }

  async function load() {
    setLoading(true);
    setError(null);
    setClubNameById({});
    setWinnerNameByTournamentId({});
    setMatchesByTournamentId({});

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const profRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = ((profRes.data as any)?.role ?? "").toString().toUpperCase();
    const superAdmin = role === "SUPER_ADMIN";
    setIsSuperAdmin(superAdmin);

    // Resolve my player_id (single row per user)
    const me = await supabase.from("players").select("id, gender").eq("user_id", user.id).single();
    if (me.error || !me.data?.id) {
      if (!superAdmin) {
        setError("Could not resolve your player profile.");
        setRows([]);
        setPlayerId("");
        setPlayerGender("");
        setEnteredByTournamentId({});
        setTeamsByTournamentId({});
        setTeamMembersByTeamId({});
        setNameByPlayerId({});
        setLoading(false);
        return;
      }
      setPlayerId("");
      setPlayerGender("");
    }

    const myPlayerId = me.data?.id ? String(me.data.id) : "";
    if (myPlayerId) setPlayerId(myPlayerId);
    const myGender = ((me.data as any)?.gender ?? "") as PlayerGender | "";
    setPlayerGender(myGender);

    if (!myGender && !superAdmin) {
      setRows([]);
      setEnteredByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const res = await supabase
      .from("tournaments")
      .select("id, name, scope, format, status, announced_at, starts_at, ends_at, entries_open, gender, club_id, rule_type")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("announced_at", { ascending: false })
      .limit(200);

    if (res.error) {
      setError(`Could not load tournaments.\n${res.error.message}`);
      setRows([]);
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const tournaments = (res.data ?? []) as TournamentRow[];
    const filtered = superAdmin
      ? tournaments
      : tournaments.filter((t) => {
          const tg = (t.gender ?? null) as TournamentGender | null;
          if (!tg) return true;
          return tg === myGender;
        });
    setRows(filtered);

    const clubIds = Array.from(
      new Set(
        filtered
          .map((t) => (t.club_id ?? "").toString())
          .filter((id) => id)
      )
    );

    if (clubIds.length) {
      const clubRes = await supabase.from("clubs").select("id, name").in("id", clubIds);
      if (!clubRes.error) {
        const next: Record<string, string> = {};
        for (const c of clubRes.data ?? []) {
          next[String((c as any).id)] = String((c as any).name ?? "Club");
        }
        setClubNameById(next);
      }
    }

    const tournamentIds = filtered.map((t) => t.id);
    if (!tournamentIds.length) {
      setEnteredByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    if (!myPlayerId) {
      setEnteredByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    // My entries
    const ent = await supabase
      .from("tournament_entries")
      .select("tournament_id")
      .eq("player_id", myPlayerId)
      .in("tournament_id", tournamentIds);

    if (ent.error) {
      setEnteredByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setError((prev) => prev ?? `Could not load your tournament entries.\n${ent.error?.message ?? ""}`.trim());
      setLoading(false);
      return;
    }

    const enteredMap: Record<string, boolean> = {};
    for (const r of ent.data ?? []) {
      const tid = String((r as any).tournament_id ?? "");
      if (tid) enteredMap[tid] = true;
    }
    setEnteredByTournamentId(enteredMap);

    // Teams for tournaments in view (RLS may restrict)
    const teamRes = await supabase
      .from("tournament_teams")
      .select("id, tournament_id, team_no, team_handicap")
      .in("tournament_id", tournamentIds)
      .order("team_no", { ascending: true });

    if (teamRes.error) {
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const tByTid: Record<string, { id: string; team_no: number; team_handicap: number | null }[]> = {};
    const teamIds: string[] = [];

    for (const r of teamRes.data ?? []) {
      const tid = String((r as any).tournament_id ?? "");
      const teamId = String((r as any).id ?? "");
      if (!tid || !teamId) continue;

      teamIds.push(teamId);

      const team = {
        id: teamId,
        team_no: Number((r as any).team_no ?? 0),
        team_handicap:
          (r as any).team_handicap == null
            ? null
            : typeof (r as any).team_handicap === "number"
            ? (r as any).team_handicap
            : Number((r as any).team_handicap),
      };

      tByTid[tid] = tByTid[tid] ?? [];
      tByTid[tid].push(team);
    }

    setTeamsByTournamentId(tByTid);

    if (!teamIds.length) {
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const memRes = await supabase
      .from("tournament_team_members")
      .select("team_id, player_id")
      .in("team_id", teamIds);

    if (memRes.error) {
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const membersByTeam: Record<string, string[]> = {};
    const allPlayerIds: string[] = [];

    for (const r of memRes.data ?? []) {
      const teamId = String((r as any).team_id ?? "");
      const pid = String((r as any).player_id ?? "");
      if (!teamId || !pid) continue;

      membersByTeam[teamId] = membersByTeam[teamId] ?? [];
      membersByTeam[teamId].push(pid);
      allPlayerIds.push(pid);
    }

    setTeamMembersByTeamId(membersByTeam);

    const uniquePlayerIds = Array.from(new Set(allPlayerIds));
    if (!uniquePlayerIds.length) {
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const pRes = await supabase.from("players").select("id, user_id, display_name").in("id", uniquePlayerIds);
    if (pRes.error) {
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const playerRows = (pRes.data ?? []) as { id: string; user_id?: string | null; display_name?: string | null }[];
    const needsProfiles = playerRows.filter((p) => !(p.display_name ?? "").trim() && p.user_id).map((p) => p.user_id as string);
    const userIds = Array.from(new Set(needsProfiles));

    let nameByUser: Record<string, string> = {};
    if (userIds.length) {
      const profRes = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      if (!profRes.error) {
        for (const pr of profRes.data ?? []) {
          nameByUser[String((pr as any).id)] = String((pr as any).full_name ?? "Unknown");
        }
      }
    }

    const nameByPlayer: Record<string, string> = {};
    for (const p of playerRows) {
      const dn = (p.display_name ?? "").trim();
      if (dn) {
        nameByPlayer[p.id] = dn;
      } else if (p.user_id && nameByUser[p.user_id]) {
        nameByPlayer[p.id] = nameByUser[p.user_id];
      } else {
        nameByPlayer[p.id] = "Unknown";
      }
    }

    setNameByPlayerId(nameByPlayer);

    // Matches for IN_PLAY + COMPLETED tournaments (best-effort; may be blocked by RLS)
    const idsForMatches = filtered.filter((t) => t.status !== "ANNOUNCED").map((t) => t.id);
    const completed = filtered.filter((t) => t.status === "COMPLETED");

    if (idsForMatches.length) {
      const mRes = await supabase
        .from("matches")
        .select(
          "id, tournament_id, round_no, match_no, status, score_a, score_b, submitted_by_player_id, confirmed_by_a, confirmed_by_b, finalized_by_admin, winner_team_id, team_a_id, team_b_id, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id"
        )
        .in("tournament_id", idsForMatches);

      if (!mRes.error) {
        const matchRows = (mRes.data ?? []).map((r: any) => ({
          id: String(r.id),
          tournament_id: r.tournament_id == null ? null : String(r.tournament_id),
          round_no: r.round_no == null ? null : Number(r.round_no),
          match_no: r.match_no == null ? null : Number(r.match_no),
          status: r.status == null ? null : String(r.status),
          score_a: r.score_a == null ? null : Number(r.score_a),
          score_b: r.score_b == null ? null : Number(r.score_b),
          submitted_by_player_id: r.submitted_by_player_id == null ? null : String(r.submitted_by_player_id),
          confirmed_by_a: r.confirmed_by_a == null ? null : Boolean(r.confirmed_by_a),
          confirmed_by_b: r.confirmed_by_b == null ? null : Boolean(r.confirmed_by_b),
          finalized_by_admin: r.finalized_by_admin == null ? null : Boolean(r.finalized_by_admin),
          winner_team_id: r.winner_team_id == null ? null : String(r.winner_team_id),
          team_a_id: r.team_a_id == null ? null : String(r.team_a_id),
          team_b_id: r.team_b_id == null ? null : String(r.team_b_id),
          slot_a_source_type: r.slot_a_source_type == null ? null : String(r.slot_a_source_type),
          slot_a_source_match_id: r.slot_a_source_match_id == null ? null : String(r.slot_a_source_match_id),
          slot_b_source_type: r.slot_b_source_type == null ? null : String(r.slot_b_source_type),
          slot_b_source_match_id: r.slot_b_source_match_id == null ? null : String(r.slot_b_source_match_id),
        })) as MatchLite[];

        const byTid: Record<string, MatchLite[]> = {};
        for (const m of matchRows) {
          const tid = String(m.tournament_id ?? "");
          if (!tid) continue;
          byTid[tid] = byTid[tid] ?? [];
          byTid[tid].push(m);
        }
        setMatchesByTournamentId(byTid);

        // Winner names for completed cards
        const winnerMap: Record<string, string> = {};

        for (const t of completed) {
          const ms = byTid[t.id] ?? [];
          const playable = ms.filter((m) => {
            const rn = Number(m.round_no ?? 0);
            if (!rn) return false;
            return !isByeMatch(m);
          });
          if (!playable.length) continue;

          const maxRound = Math.max(...playable.map((m) => Number(m.round_no ?? 0)).filter((r) => r > 0));
          if (!maxRound) continue;

          const finals = playable.filter((m) => Number(m.round_no ?? 0) === maxRound);
          const finalMatch = finals.find((m) => inferWinnerTeamId(m) != null) ?? finals[0];
          if (!finalMatch) continue;

          const winnerTeamId = inferWinnerTeamId(finalMatch);
          if (!winnerTeamId) continue;

          const teams = tByTid[t.id] ?? [];
          const winnerTeam = teams.find((tm) => tm.id === winnerTeamId) ?? null;

          const memberIds = membersByTeam[winnerTeamId] ?? [];
          const memberNames = memberIds.map((pid) => nameByPlayer[pid] ?? "Unknown");

          const winnerName =
            t.format === "SINGLES"
              ? (memberNames[0] as string) ?? "Winner"
              : winnerTeam?.team_no
              ? `Team ${winnerTeam.team_no}`
              : "Winner";

          winnerMap[t.id] = winnerName;
        }

        setWinnerNameByTournamentId(winnerMap);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byScope = useMemo(() => {
    const club = rows.filter((r) => r.scope === "CLUB");
    const district = rows.filter((r) => r.scope === "DISTRICT");
    const national = rows.filter((r) => r.scope === "NATIONAL");
    return { club, district, national };
  }, [rows]);

  async function enterTournament(tournamentId: string) {
    if (!playerId) return;

    setEnteredByTournamentId((m) => ({ ...m, [tournamentId]: true }));

    const ins = await supabase.from("tournament_entries").insert({
      tournament_id: tournamentId,
      player_id: playerId,
      status: "ENTERED",
    });

    if (ins.error) {
      const msg = (ins.error.message ?? "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        setEnteredByTournamentId((m) => ({ ...m, [tournamentId]: true }));
        return;
      }

      setEnteredByTournamentId((m) => {
        const next = { ...m };
        delete next[tournamentId];
        return next;
      });

      setError(`Could not enter tournament.\n${ins.error.message}`);
      return;
    }
  }

  function teamDisplayName(t: TournamentRow, teamId: string | null) {
    if (!teamId) return "TBD";

    const teams = teamsByTournamentId[t.id] ?? [];
    const tm = teams.find((x) => x.id === teamId) ?? null;
    const memberIds = teamMembersByTeamId[teamId] ?? [];
    const memberNames = memberIds.map((pid) => nameByPlayerId[pid] ?? "Unknown");

    if (t.format === "SINGLES") {
      return (memberNames[0] as string) ?? "Entry";
    }
    return tm?.team_no ? `Team ${tm.team_no}` : "Team";
  }

  function roundLabelForTournament(t: TournamentRow, roundNo: number | null | undefined) {
    const r = Number(roundNo ?? 0);
    if (!r) return "Round -";

    const totalTeams = (teamsByTournamentId[t.id] ?? []).length;
    if (!totalTeams || totalTeams < 2) return `Round ${r}`;

    const base = largestPowerOfTwoLE(totalTeams);
    const hasPreRound = totalTeams > base;
    if (hasPreRound && r === 1) return "Pre-Rd";

    const mainRoundNo = hasPreRound ? r - 1 : r;
    const playersLeft = Math.floor(base / Math.pow(2, mainRoundNo - 1));

    if (playersLeft === 2) return "Final";
    if (playersLeft === 4) return "Semis";
    if (playersLeft === 8) return "Quarters";
    if (playersLeft >= 16) return `RD ${mainRoundNo}`;

    return `Round ${r}`;
  }

  function finishPlacementLabel(t: TournamentRow, roundNo: number | null | undefined) {
    const r = Number(roundNo ?? 0);
    if (!r) return null;

    const totalTeams = (teamsByTournamentId[t.id] ?? []).length;
    if (!totalTeams || totalTeams < 2) return null;

    const base = largestPowerOfTwoLE(totalTeams);
    const hasPreRound = totalTeams > base;
    const mainRoundNo = hasPreRound ? r - 1 : r;
    if (mainRoundNo <= 0) return null;

    const playersLeft = Math.floor(base / Math.pow(2, mainRoundNo - 1));
    if (!playersLeft) return null;

    if (playersLeft === 2) return "Runner-up";
    if (playersLeft === 4) return "Tied 3rd";

    const start = playersLeft / 2 + 1;
    const endPos = playersLeft;
    return `Tied ${start}-${endPos}`;
  }

  function renderTournamentCard(t: TournamentRow) {
    const entered = !!enteredByTournamentId[t.id];
    const winnerName = (winnerNameByTournamentId[t.id] ?? "").trim();
    const showWinner = t.status === "COMPLETED" && !!winnerName;

    const teams = teamsByTournamentId[t.id] ?? [];
    const myTeam = entered ? teams.find((tm) => (teamMembersByTeamId[tm.id] ?? []).includes(playerId)) ?? null : null;
    const myTeamId = myTeam?.id ?? null;
    const ms = matchesByTournamentId[t.id] ?? [];

    const myMatches = myTeamId
      ? ms.filter((m) => String(m.team_a_id ?? "") === myTeamId || String(m.team_b_id ?? "") === myTeamId)
      : [];

    const nextMatch = (() => {
      if (t.status !== "IN_PLAY" || !myTeamId) return null;
      const pending = myMatches.filter((m) => !isByeMatch(m) && !isMatchDone(m));
      if (!pending.length) return null;
      const sorted = pending.slice().sort(
        (a, b) =>
          Number(a.round_no ?? 0) - Number(b.round_no ?? 0) ||
          Number(a.match_no ?? 0) - Number(b.match_no ?? 0) ||
          String(a.id).localeCompare(String(b.id))
      );
      return sorted[0] ?? null;
    })();

    const actionNeeded = (() => {
      if (t.status !== "IN_PLAY" || !nextMatch || !myTeamId || !playerId) return null;

      // Captain = min player_id in team (matches tournament room logic)
      const captainForTeam = (teamId: string | null) => {
        if (!teamId) return null;
        const ids = (teamMembersByTeamId[teamId] ?? []).slice().sort();
        return ids[0] ?? null;
      };
      const capA = captainForTeam(nextMatch.team_a_id);
      const capB = captainForTeam(nextMatch.team_b_id);
      const iAmCaptainA = capA && capA === playerId;
      const iAmCaptainB = capB && capB === playerId;

      const mySide = iAmCaptainA ? "A" : iAmCaptainB ? "B" : null;
      if (!mySide) return null;

      const st = String(nextMatch.status ?? "");
      if (st === "IN_PLAY" && !bool(nextMatch.finalized_by_admin)) {
        return "Submit score";
      }

      const hasScores = nextMatch.score_a != null && nextMatch.score_b != null;
      const hasSubmitter = hasValue(nextMatch.submitted_by_player_id);
      if (!bool(nextMatch.finalized_by_admin) && hasScores && hasSubmitter && String(nextMatch.submitted_by_player_id) !== playerId) {
        if (mySide === "A" && !bool(nextMatch.confirmed_by_a)) return "Confirm score";
        if (mySide === "B" && !bool(nextMatch.confirmed_by_b)) return "Confirm score";
      }

      return null;
    })();

    const myFinish = (() => {
      if (t.status !== "COMPLETED" || !myTeamId) return null;
      const done = myMatches.filter((m) => isMatchDone(m));
      if (!done.length) return null;
      const sorted = done.slice().sort(
        (a, b) =>
          Number(b.round_no ?? 0) - Number(a.round_no ?? 0) ||
          Number(b.match_no ?? 0) - Number(a.match_no ?? 0) ||
          String(b.id).localeCompare(String(a.id))
      );
      const last = sorted[0];
      const winnerId = last ? inferWinnerTeamId(last) : null;
      if (winnerId && winnerId === myTeamId) return { label: "Champion", detail: null as string | null };
      const round = roundLabelForTournament(t, last?.round_no ?? null);
      const place = finishPlacementLabel(t, last?.round_no ?? null);
      return { label: `Knocked out: ${round}`, detail: place ? `Finish: ${place}` : null };
    })();

    const primary = (() => {
      if (t.status === "ANNOUNCED" && !entered && t.entries_open !== false) {
        return { label: "Enter tournament", onClick: () => enterTournament(t.id), variant: "solid" as const };
      }
      if (t.status === "COMPLETED") {
        return { label: "View results", onClick: () => (window.location.href = `/tournaments/${t.id}`), variant: "solid" as const };
      }
      if (t.status === "IN_PLAY") {
        return {
          label: entered ? "Open tournament" : "View bracket",
          onClick: () => (window.location.href = `/tournaments/${t.id}`),
          variant: "solid" as const,
        };
      }
      return {
        label: "View tournament",
        onClick: () => (window.location.href = `/tournaments/${t.id}`),
        variant: entered ? ("solid" as const) : ("outline" as const),
      };
    })();

    return (
      <div
        key={t.id}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{cleanTournamentName(t.name)}</div>
          <div
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 900,
              color: theme.text,
              background: theme.surface,
              whiteSpace: "nowrap",
            }}
            title="Tournament format"
          >
            {formatLabel(t.format)}
          </div>
        </div>

        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {scopeLabel(t.scope)}
          </span>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {genderLabel(t.gender ?? null)}
          </span>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {ruleLabel(t.rule_type ?? "HANDICAP_START")}
          </span>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {statusLabel(t.status)}
          </span>
          {entered ? (
            <span
              style={{
                border: `1px solid ${theme.maroon}`,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 12,
                fontWeight: 900,
                color: theme.maroon,
              }}
              title="You have entered this tournament"
            >
              Entered
            </span>
          ) : null}
          {t.scope === "CLUB" && t.club_id && clubNameById[t.club_id] ? (
            <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
              Host: {clubNameById[t.club_id]}
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13, color: theme.muted }}>
          <div><span style={{ fontWeight: 800, color: theme.text }}>Type</span> {formatLabel(t.format)} knockout</div>
          {t.status === "COMPLETED" ? (
            <div><span style={{ fontWeight: 800, color: theme.text }}>Winner</span> {showWinner ? winnerName : "-"}</div>
          ) : t.status === "IN_PLAY" ? (
            <div><span style={{ fontWeight: 800, color: theme.text }}>Status</span> {entered ? "In draw" : "Spectator"}</div>
          ) : (
            <div><span style={{ fontWeight: 800, color: theme.text }}>Entries</span> {t.entries_open === false ? "Locked" : "Open"}</div>
          )}
          <div><span style={{ fontWeight: 800, color: theme.text }}>Starts</span> {t.starts_at ? new Date(t.starts_at).toLocaleString() : "TBC"}</div>
          <div><span style={{ fontWeight: 800, color: theme.text }}>Ends</span> {t.ends_at ? new Date(t.ends_at).toLocaleString() : t.status === "COMPLETED" ? "-" : "TBC"}</div>
          {t.status === "IN_PLAY" && entered ? (
            <>
              <div style={{ gridColumn: "1 / span 2" }}>
                <span style={{ fontWeight: 800, color: theme.text }}>Next match</span>{" "}
                {nextMatch
                  ? `${roundLabelForTournament(t, nextMatch.round_no)} • vs ${teamDisplayName(
                      t,
                      String(nextMatch.team_a_id ?? "") === myTeamId ? nextMatch.team_b_id : nextMatch.team_a_id
                    )} • ${matchStatusLabel(String(nextMatch.status ?? ""))}`
                  : "-"}
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <span style={{ fontWeight: 800, color: theme.text }}>Action</span> {actionNeeded ?? "None"}
              </div>
            </>
          ) : null}
          {t.status === "COMPLETED" && entered && myFinish ? (
            <>
              <div style={{ gridColumn: "1 / span 2" }}>
                <span style={{ fontWeight: 800, color: theme.text }}>Your result</span> {myFinish.label}
                {myFinish.detail ? <span style={{ color: theme.muted }}>{` • ${myFinish.detail}`}</span> : null}
              </div>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={primary.onClick}
            style={{
              width: "100%",
              border: primary.variant === "outline" ? `1px solid ${theme.border}` : "none",
              background: primary.variant === "outline" ? "#fff" : theme.maroon,
              color: primary.variant === "outline" ? theme.text : "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
            title={primary.label}
          >
            {primary.label}
          </button>
        </div>

        {teamsByTournamentId[t.id]?.length ? (
          <details style={{ marginTop: 10 }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 900,
                color: theme.maroon,
                userSelect: "none",
              }}
              title={t.format === "SINGLES" ? "View entries" : "View generated teams"}
            >
              {t.format === "SINGLES" ? "View Entries" : "View Teams"}
            </summary>

            {(() => {
              const teams = teamsByTournamentId[t.id] ?? [];

              const myTeam = teams.find((tm) => (teamMembersByTeamId[tm.id] ?? []).includes(playerId));
              const otherTeams = teams.filter((tm) => tm.id !== myTeam?.id);

              const ordered = myTeam ? [myTeam, ...otherTeams] : otherTeams;

              return (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {ordered.map((tm) => {
                    const memberIds = teamMembersByTeamId[tm.id] ?? [];
                    const memberNames = memberIds.map((pid) => nameByPlayerId[pid] ?? "Unknown");
                    const isMine = myTeam?.id === tm.id;
                    const isSingles = t.format === "SINGLES";

                    return (
                      <div
                        key={tm.id}
                        style={{
                          border: `1px solid ${isMine ? theme.maroon : theme.border}`,
                          borderRadius: 14,
                          padding: 10,
                          background: isMine ? "rgba(122,31,43,0.10)" : theme.surface,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 10,
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>
                            {isSingles ? (isMine ? "You" : "Entry") : isMine ? "Your Team" : `Team ${tm.team_no}`}
                          </div>
                          {!isSingles ? (
                            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                              HCP {tm.team_handicap == null ? "-" : tm.team_handicap}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            color: theme.text,
                            fontWeight: 800,
                            lineHeight: 1.35,
                          }}
                        >
                          {memberNames.length ? memberNames.join(" \u2022 ") : "Members not loaded"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </details>
        ) : null}
      </div>
    );
  }

  function renderBucket(title: string, items: TournamentRow[]) {
    const upcoming = items.filter((r) => r.status === "ANNOUNCED");
    const inplay = items.filter((r) => r.status === "IN_PLAY");
    const completed = items.filter((r) => r.status === "COMPLETED");
    const bucketOpen = bucketOpenByTitle[title] !== false;

    function section(label: string, list: TournamentRow[]) {
      const key = `${title}__${label}`;
      const open = sectionOpenByKey[key] ?? (label === "In-play" ? true : false);
      return (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setSectionOpenByKey((m) => ({ ...m, [key]: !open }))}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#F3F8F3",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 10,
            }}
            title={`Toggle ${label}`}
          >
            <div>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
              {list.length} {list.length === 1 ? "tournament" : "tournaments"}{" "}
              <span style={{ marginLeft: 8 }}>{open ? "▾" : "▸"}</span>
            </div>
          </button>

          {open ? (
            !list.length ? (
              <div style={{ marginTop: 8, color: theme.muted, fontSize: 13 }}>None</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{list.map(renderTournamentCard)}</div>
            )
          ) : null}
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setBucketOpenByTitle((m) => ({ ...m, [title]: !(m[title] !== false) }))}
          style={{
            width: "100%",
            border: "none",
            background: "#fff",
            color: theme.text,
            padding: "12px 14px",
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
          title={`Toggle ${title}`}
        >
          <div style={{ fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
            {items.length} {items.length === 1 ? "tournament" : "tournaments"}{" "}
            <span style={{ marginLeft: 8 }}>{bucketOpen ? "▾" : "▸"}</span>
          </div>
        </button>

        {bucketOpen ? (
          <div style={{ padding: 14, borderTop: `1px solid ${theme.border}` }}>
          {section("Upcoming", upcoming)}
          {section("In-play", inplay)}
          {section("Completed", completed)}
        </div>
      ) : null}
      </div>
    );
  }

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Tournaments</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 1.25 }}>
              {loading ? "Loading..." : "Eligible tournaments only (scope + gender)."}
            </div>
          </div>

          <button
            onClick={load}
            style={{
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              color: theme.text,
              padding: "9px 10px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
            title="Refresh"
          >
            {"\u21BB"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              color: theme.danger,
              fontWeight: 800,
              whiteSpace: "pre-wrap",
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && !playerGender && !isSuperAdmin ? (
          <div
            style={{
              marginTop: 14,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
              color: theme.text,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>Select your gender</div>
            <div style={{ marginTop: 6, color: theme.muted }}>
              You must choose a gender to view eligible tournaments.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button
                type="button"
                disabled={genderSaving}
                onClick={() => saveGender("MALE")}
                style={{
                  width: "100%",
                  border: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: genderSaving ? "not-allowed" : "pointer",
                }}
                title="Set gender to Male"
              >
                {genderSaving ? "Saving..." : "Male"}
              </button>

              <button
                type="button"
                disabled={genderSaving}
                onClick={() => saveGender("FEMALE")}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: genderSaving ? "not-allowed" : "pointer",
                }}
                title="Set gender to Female"
              >
                {genderSaving ? "Saving..." : "Female"}
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && rows.length === 0 && (isSuperAdmin || playerGender) ? (
          <div
            style={{
              marginTop: 14,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
              color: theme.muted,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            No tournaments available for you yet.
          </div>
        ) : null}

        {renderBucket("Club Tournaments", byScope.club)}
        {renderBucket("District Tournaments", byScope.district)}
        {renderBucket("National Tournaments", byScope.national)}
      </div>

      <BottomNav />
    </div>
  );
}
