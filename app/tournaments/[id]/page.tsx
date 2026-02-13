// app/tournaments/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import BottomNav from "../../components/BottomNav";
import { deriveTournamentCompletion } from "@/lib/tournaments/deriveTournamentCompletion";

type TournamentScope = "CLUB" | "DISTRICT" | "NATIONAL";
type TournamentStatus = "ANNOUNCED" | "IN_PLAY" | "COMPLETED";
type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
type TournamentGender = "MALE" | "FEMALE" | null;
type PlayerGender = "MALE" | "FEMALE" | "";
type TournamentRule = "SCRATCH" | "HANDICAP_START";

type MatchRow = {
  id: string;
  tournament_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | null;
  slot_b_source_type?: string | null;
  slot_b_source_match_id?: string | null;
  match_no?: number | null;
  round_no: number | null;
  status: string;

  score_a: number | null;
  score_b: number | null;

  submitted_by_player_id: string | null;
  submitted_at: string | null;

  confirmed_by_a: boolean | null;
  confirmed_by_b: boolean | null;

  finalized_by_admin: boolean | null;
  finalized_at: string | null;

  admin_final_by: string | null;
  admin_final_at: string | null;

  winner_team_id: string | null;
};

type TournamentRow = {
  id: string;
  name: string;
  scope: TournamentScope;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_at: string | null;
  ends_at: string | null;
  entries_open?: boolean | null;
  gender?: TournamentGender | null;
  rule_type?: TournamentRule | null;
};
function scopeLabel(scope: TournamentScope) {
  if (scope === "CLUB") return "Club";
  if (scope === "DISTRICT") return "District";
  return "National";
}

function statusLabel(status: TournamentStatus) {
  if (status === "ANNOUNCED") return "Upcoming";
  if (status === "IN_PLAY") return "In-play";
  return "Past";
}

function formatLabel(fmt: TournamentFormat) {
  if (fmt === "FOUR_BALL") return "4 Balls";
  return fmt.charAt(0) + fmt.slice(1).toLowerCase();
}


function ruleLabel(rule: TournamentRule | null | undefined) {
  if (rule === "SCRATCH") return "Scratch";
  return "Handicap start";
}

function cleanTournamentName(name: string) {
  const raw = (name ?? "").toString();
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function matchStatusLabel(status: string) {
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "IN_PLAY") return "In play";
  if (status === "COMPLETED") return "Completed";
  if (status === "OPEN") return "Open";
  if (status === "FINAL") return "Final";
  return status || "-";
}

function bool(v: any) {
  return v === true;
}

function hasWinnerTeamId(m: MatchRow) {
  return m?.winner_team_id != null && String(m.winner_team_id) !== "";
}

function isMatchDone(m: MatchRow) {
  const st = String(m?.status ?? "");
  return st === "COMPLETED" || bool(m?.finalized_by_admin) || hasWinnerTeamId(m);
}

function isMatchBye(m: MatchRow) {
  const st = String(m?.status ?? "");
  if (st === "BYE") return true;
  if (m.slot_b_source_type === "BYE") return true;
  return !m.team_b_id && !m.slot_b_source_type;
}

function winnerTeamIdFromMatch(m: MatchRow) {
  if (hasWinnerTeamId(m)) return String(m.winner_team_id);
  if (!isMatchDone(m)) return null;

  // BYE finalisation can legitimately have no team_b_id.
  if (isMatchBye(m)) return m.team_a_id ? String(m.team_a_id) : null;

  if (!m.team_a_id || !m.team_b_id) return null;
  if (m.score_a == null || m.score_b == null) return null;
  if (m.score_a === m.score_b) return null;

  return m.score_a > m.score_b ? String(m.team_a_id) : String(m.team_b_id);
}

function largestPowerOfTwoLE(n: number) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export default function TournamentRoomPage() {
  const supabase = createClient();
  const params = useParams();

  const rawId = (params as any)?.id;
  const tournamentId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [playerId, setPlayerId] = useState<string>("");

  const [tournament, setTournament] = useState<TournamentRow | null>(null);

  const [teams, setTeams] = useState<{ id: string; team_no: number; team_handicap: number | null }[]>([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<string, string[]>>({});
  const [nameByPlayerId, setNameByPlayerId] = useState<Record<string, string>>({});
  const [handicapByPlayerId, setHandicapByPlayerId] = useState<Record<string, number | null>>({});

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [fixturesOpen, setFixturesOpen] = useState(false);
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});
  const [bracketRound, setBracketRound] = useState<number | null>(null);
  const [bracketViewMode, setBracketViewMode] = useState<"LIST" | "TREE">("LIST");
  const [treeFromRound, setTreeFromRound] = useState<number | null>(null);

  // score UI state per match
  const [scoreDraftByMatchId, setScoreDraftByMatchId] = useState<Record<string, { a: string; b: string }>>({});

  const matchNoById = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const m of matches) {
      if (!m?.id) continue;
      map[m.id] = m.match_no ?? null;
    }
    return map;
  }, [matches]);

  function roundLabel(roundNo: number | null | undefined) {
    const r = Number(roundNo ?? 0);
    if (!r) return "Round -";

    const totalTeams = teams.length;
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

  async function load() {
    setLoading(true);
    setError(null);

    if (!tournamentId || typeof tournamentId !== "string") {
      setError("Invalid tournament id.");
      setTournament(null);
      setPlayerId("");
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setOpenRounds({});
      setLoading(false);
      return;
    }

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

    // Resolve my player_id
    const me = await supabase.from("players").select("id, gender").eq("user_id", user.id).single();
    if (me.error || !me.data?.id) {
      if (!superAdmin) {
        setError("Could not resolve your player profile.");
        setTournament(null);
        setPlayerId("");
        setTeams([]);
        setTeamMembersByTeamId({});
        setNameByPlayerId({});
        setHandicapByPlayerId({});
        setMatches([]);
        setOpenRounds({});
        setLoading(false);
        return;
      }
      setPlayerId("");
    }

    const myPlayerId = me.data?.id ? String(me.data.id) : "";
    if (myPlayerId) setPlayerId(myPlayerId);
    const myGender = ((me.data as any)?.gender ?? "") as PlayerGender;

    if (!myGender && !superAdmin) {
      setError("Please select your gender to view tournaments.");
      setTournament(null);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setOpenRounds({});
      setLoading(false);
      return;
    }

    // Load tournament
    const tRes = await supabase
      .from("tournaments")
      .select("id, name, scope, format, status, starts_at, ends_at, entries_open, gender, rule_type")
      .eq("id", tournamentId)
      .single();

    if (tRes.error || !tRes.data?.id) {
      setError("Tournament not found or you are not permitted to view it.");
      setTournament(null);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setOpenRounds({});
      setLoading(false);
      return;
    }

    // ✅ Normalize entries_open so null behaves as OPEN for any strict UI checks
    const tRaw = tRes.data as any;
    const normalizedTournament: TournamentRow = {
      ...(tRaw as TournamentRow),
      entries_open: tRaw.entries_open === false ? false : true,
    };

    const tGender = (normalizedTournament.gender ?? null) as TournamentGender | null;
    if (!superAdmin && myGender && tGender && myGender !== tGender) {
      setError("This tournament is not available for your gender.");
      setTournament(null);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setOpenRounds({});
      setLoading(false);
      return;
    }

    setTournament(normalizedTournament);

    // Teams (RLS: entrants only)
    const teamRes = await supabase
      .from("tournament_teams")
      .select("id, team_no, team_handicap")
      .eq("tournament_id", tournamentId)
      .order("team_no", { ascending: true });

    if (teamRes.error) {
      setError(`Could not load teams.\n${teamRes.error.message}`);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setOpenRounds({});
      setLoading(false);
      return;
    }

    const teamRows = (teamRes.data ?? []).map((r: any) => ({
      id: String(r.id),
      team_no: Number(r.team_no ?? 0),
      team_handicap:
        r.team_handicap == null ? null : typeof r.team_handicap === "number" ? r.team_handicap : Number(r.team_handicap),
    }));

    let finalTeams = teamRows.slice();

    const teamIds = teamRows.map((t) => t.id);
    if (!teamIds.length) {
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
    } else {
      const memRes = await supabase.from("tournament_team_members").select("team_id, player_id").in("team_id", teamIds);

      if (memRes.error) {
        setError(`Could not load team members.\n${memRes.error.message}`);
        setTeamMembersByTeamId({});
        setNameByPlayerId({});
        setHandicapByPlayerId({});
      } else {
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

        if (myPlayerId) {
          const hasMyTeam = Object.values(membersByTeam).some((ids) => ids.includes(myPlayerId));
          if (!hasMyTeam) {
            const myMemRes = await supabase
              .from("tournament_team_members")
              .select("team_id")
              .eq("player_id", myPlayerId);

            if (!myMemRes.error) {
              const extraTeamIds = Array.from(
                new Set((myMemRes.data ?? []).map((r: any) => String(r.team_id ?? "")).filter(Boolean))
              );

              if (extraTeamIds.length) {
                const extraTeamsRes = await supabase
                  .from("tournament_teams")
                  .select("id, team_no, team_handicap")
                  .eq("tournament_id", tournamentId)
                  .in("id", extraTeamIds);

                if (!extraTeamsRes.error) {
                  const extras = (extraTeamsRes.data ?? []).map((r: any) => ({
                    id: String(r.id),
                    team_no: Number(r.team_no ?? 0),
                    team_handicap:
                      r.team_handicap == null ? null : typeof r.team_handicap === "number" ? r.team_handicap : Number(r.team_handicap),
                  }));

                  for (const t of extras) {
                    if (!finalTeams.some((row) => row.id === t.id)) finalTeams.push(t);
                    membersByTeam[t.id] = membersByTeam[t.id] ?? [];
                    if (!membersByTeam[t.id].includes(myPlayerId)) membersByTeam[t.id].push(myPlayerId);
                  }

                  allPlayerIds.push(myPlayerId);
                }
              }
            }
          }
        }

        setTeamMembersByTeamId(membersByTeam);

        const uniquePlayerIds = Array.from(new Set(allPlayerIds));
        if (!uniquePlayerIds.length) {
          setNameByPlayerId({});
          setHandicapByPlayerId({});
        } else {
          const pRes = await supabase.from("players").select("id, display_name, handicap").in("id", uniquePlayerIds);
          if (pRes.error) {
            setNameByPlayerId({});
            setHandicapByPlayerId({});
          } else {
            const playerRows2 = (pRes.data ?? []) as { id: string; display_name?: string | null; handicap?: number | null }[];

            const nameByPlayer: Record<string, string> = {};
            const handicapByPlayer: Record<string, number | null> = {};

            for (const p of playerRows2) {
              const name = (p.display_name ?? "").trim();
              nameByPlayer[p.id] = name || "Unknown";
              handicapByPlayer[p.id] = p.handicap == null ? null : Number(p.handicap);
            }

            setNameByPlayerId(nameByPlayer);
            setHandicapByPlayerId(handicapByPlayer);
          }
        }
      }
    }

    setTeams(finalTeams);

    // Matches (fixtures)
    const mRes = await supabase
      .from("matches")
      .select(
        "id, tournament_id, team_a_id, team_b_id, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id, round_no, match_no, status, score_a, score_b, submitted_by_player_id, submitted_at, confirmed_by_a, confirmed_by_b, finalized_by_admin, finalized_at, admin_final_by, admin_final_at, winner_team_id"
      )
      .eq("tournament_id", tournamentId)
      .order("round_no", { ascending: true })
      .order("id", { ascending: true });

    if (mRes.error) {
      setMatches([]);
      setOpenRounds({});
    } else {
      const ms = (mRes.data ?? []).map((r: any) => ({
        id: String(r.id),
        tournament_id: r.tournament_id == null ? null : String(r.tournament_id),
        team_a_id: r.team_a_id == null ? null : String(r.team_a_id),
        team_b_id: r.team_b_id == null ? null : String(r.team_b_id),
        slot_a_source_type: r.slot_a_source_type == null ? null : String(r.slot_a_source_type),
        slot_a_source_match_id: r.slot_a_source_match_id == null ? null : String(r.slot_a_source_match_id),
        slot_b_source_type: r.slot_b_source_type == null ? null : String(r.slot_b_source_type),
        slot_b_source_match_id: r.slot_b_source_match_id == null ? null : String(r.slot_b_source_match_id),
        round_no: r.round_no == null ? null : Number(r.round_no),
        match_no: r.match_no == null ? null : Number(r.match_no),
        status: String(r.status ?? ""),
        score_a: r.score_a == null ? null : Number(r.score_a),
        score_b: r.score_b == null ? null : Number(r.score_b),
        submitted_by_player_id: r.submitted_by_player_id == null ? null : String(r.submitted_by_player_id),
        submitted_at: r.submitted_at == null ? null : String(r.submitted_at),
        confirmed_by_a: r.confirmed_by_a == null ? null : Boolean(r.confirmed_by_a),
        confirmed_by_b: r.confirmed_by_b == null ? null : Boolean(r.confirmed_by_b),
        finalized_by_admin: r.finalized_by_admin == null ? null : Boolean(r.finalized_by_admin),
        finalized_at: r.finalized_at == null ? null : String(r.finalized_at),
        admin_final_by: r.admin_final_by == null ? null : String(r.admin_final_by),
        admin_final_at: r.admin_final_at == null ? null : String(r.admin_final_at),
        winner_team_id: r.winner_team_id == null ? null : String(r.winner_team_id),
      })) as MatchRow[];

      setMatches(ms);

      const nextOpenRounds: Record<number, boolean> = {};
      for (const m of ms) {
        const rn = Number(m.round_no ?? 0);
        if (!rn) continue;
        if (nextOpenRounds[rn] == null) nextOpenRounds[rn] = false;
      }
      setOpenRounds(nextOpenRounds);

      // initialize score drafts from server values
      setScoreDraftByMatchId((prev) => {
        const next = { ...prev };
        for (const m of ms) {
          if (!next[m.id]) {
            next[m.id] = {
              a: m.score_a == null ? "" : String(m.score_a),
              b: m.score_b == null ? "" : String(m.score_b),
            };
          } else {
            // if already exists, keep user's edits
          }
        }
        return next;
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!tournamentId || typeof tournamentId !== "string") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const myTeam = useMemo(() => {
    if (!playerId || !teams.length) return null;
    return teams.find((tm) => (teamMembersByTeamId[tm.id] ?? []).includes(playerId)) ?? null;
  }, [playerId, teams, teamMembersByTeamId]);

  const nextMatch = useMemo(() => {
    if (!myTeam) return null;
    const mine = matches.filter((m) => m.team_a_id === myTeam.id || m.team_b_id === myTeam.id);
    const pending = mine.filter((m) => !isMatchDone(m));
    const list = (pending.length ? pending : mine).slice();
    list.sort(
      (a, b) =>
        Number(a.round_no ?? 0) - Number(b.round_no ?? 0) ||
        Number((a as any).match_no ?? 0) - Number((b as any).match_no ?? 0) ||
        String(a.id).localeCompare(String(b.id))
    );
    return list[0] ?? null;
  }, [myTeam, matches]);

  const myMatches = useMemo(() => {
    if (!myTeam) return [] as MatchRow[];
    return matches.filter((m) => m.team_a_id === myTeam.id || m.team_b_id === myTeam.id);
  }, [myTeam, matches]);

  const hasPendingMatch = useMemo(() => {
    if (!myMatches.length) return false;
    return myMatches.some((m) => !isMatchDone(m));
  }, [myMatches]);

  const isViewerMode = !myTeam || !hasPendingMatch;

  const teamById = useMemo(() => {
    const m: Record<string, { id: string; team_no: number; team_handicap: number | null }> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  function finishPlacementLabel(roundNo: number | null | undefined) {
    const r = Number(roundNo ?? 0);
    if (!r) return null;

    const totalTeams = teams.length;
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

  function winnerNameFromMatches() {
    if (!matches.length) return null;
    const maxRound =
      (maxPlayableRound ?? null) ||
      Math.max(...matches.map((m) => Number(m.round_no ?? 0)).filter((r) => r > 0));
    if (!maxRound) return null;
    const finals = matches.filter((m) => Number(m.round_no ?? 0) === maxRound && !isMatchBye(m));
    const finalMatch = finals.find((m) => winnerTeamIdFromMatch(m)) ?? finals[0];
    if (!finalMatch) return null;

    const winnerId = winnerTeamIdFromMatch(finalMatch);
    if (!winnerId) return null;

    return slotLabel(finalMatch, finalMatch.team_a_id && String(finalMatch.team_a_id) === winnerId ? "A" : "B");
  }

  function myFinishSummary() {
    if (!myTeam) return null;
    const done = myMatches.filter((m) => isMatchDone(m));
    if (!done.length) return null;
    const sorted = done.slice().sort(
      (a, b) =>
        Number(b.round_no ?? 0) - Number(a.round_no ?? 0) ||
        Number((b as any).match_no ?? 0) - Number((a as any).match_no ?? 0)
    );
    const last = sorted[0];
    const winnerId = last ? winnerTeamIdFromMatch(last) : null;
    if (winnerId && winnerId === myTeam.id) {
      return { label: "Champion", detail: null as string | null };
    }
    const round = roundLabel(last?.round_no ?? null);
    const place = finishPlacementLabel(last?.round_no ?? null);
    return { label: `Knocked out: ${round}`, detail: place ? `Finish: ${place}` : null };
  }


  function teamLabel(teamId: string | null) {
    if (!teamId) return "Team -";
    const t = teamById[teamId];
    if (!t) return "Team -";
    return `Team ${t.team_no}`;
  }

  function formatHandicapValue(v: number | null | undefined) {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Number.isInteger(n) ? String(n) : String(n);
  }

  function isHandicapTournament() {
    return tournament?.rule_type !== "SCRATCH";
  }

  function memberNameWithHandicap(playerId: string) {
    const base = nameByPlayerId[playerId] ?? "Unknown";
    if (!isHandicapTournament()) return base;
    const h = formatHandicapValue(handicapByPlayerId[playerId]);
    return h ? `${base} (${h})` : base;
  }

  function teamDisplayName(teamId: string | null) {
    if (!teamId) return "BYE";
    const memberIds = teamMembersByTeamId[teamId] ?? [];
    const names = memberIds.map((pid) => memberNameWithHandicap(pid)).filter(Boolean);

    if (tournament?.format === "SINGLES") {
      return (names[0] as string) ?? teamLabel(teamId);
    }
    return teamLabel(teamId);
  }

  function winnerLabelForMatch(matchId: string | null | undefined) {
    if (!matchId) return "Winner";
    const no = matchNoById[matchId];
    if (!no) return "Winner";
    return `M${no} W`;
  }

  function slotLabel(m: MatchRow, side: "A" | "B") {
    const teamId = side === "A" ? m.team_a_id : m.team_b_id;
    const sourceType = side === "A" ? m.slot_a_source_type : m.slot_b_source_type;
    const sourceMatchId = side === "A" ? m.slot_a_source_match_id : m.slot_b_source_match_id;

    if (teamId) return teamDisplayName(teamId);
    if (sourceType === "WINNER_OF_MATCH") return winnerLabelForMatch(sourceMatchId);
    if (sourceType === "BYE") return "BYE";
    return "TBD";
  }

  function slotMembersLine(m: MatchRow, side: "A" | "B") {
    const teamId = side === "A" ? m.team_a_id : m.team_b_id;
    const sourceType = side === "A" ? m.slot_a_source_type : m.slot_b_source_type;
    if (teamId) return teamMembersLine(teamId);
    if (sourceType === "WINNER_OF_MATCH") return "Pending winner";
    if (sourceType === "BYE") return "BYE";
    return "Pending";
  }

  function teamMembersLine(teamId: string | null) {
    if (!teamId) return "-";
    const memberIds = teamMembersByTeamId[teamId] ?? [];
    const memberNames = memberIds.map((pid) => memberNameWithHandicap(pid));
    return memberNames.length ? memberNames.join(" * ") : "Members not loaded";
  }

  function singlesHandicapInfo(m: MatchRow) {
    if (tournament?.format !== "SINGLES") return null;
    if (!m.team_a_id || !m.team_b_id) return null;

    const pa = teamMembersByTeamId[m.team_a_id]?.[0] ?? null;
    const pb = teamMembersByTeamId[m.team_b_id]?.[0] ?? null;
    if (!pa || !pb) return null;

    const ha = handicapByPlayerId[pa] ?? null;
    const hb = handicapByPlayerId[pb] ?? null;

    const nameA = teamDisplayName(m.team_a_id);
    const nameB = teamDisplayName(m.team_b_id);

    if (ha == null || hb == null) {
      return {
        nameA,
        nameB,
        ha: ha as number | null,
        hb: hb as number | null,
        diff: null as number | null,
        plusTo: null as "A" | "B" | null,
      };
    }

    const diff = Math.abs(ha - hb);
    const plusTo = diff === 0 ? null : ha < hb ? "A" : "B"; // lower handicap gets the plus

    return { nameA, nameB, ha, hb, diff, plusTo };
  }

  function shortName(s: string) {
    const t = (s ?? "").trim();
    if (!t) return t;
    const first = t.split(" ")[0] ?? t;
    return first.length ? first : t;
  }

  function singlesHandicapLine(m: MatchRow) {
    if (!isHandicapTournament()) return null;
    const hc = singlesHandicapInfo(m);
    if (!hc) return null;

    if (hc.diff == null) return "Handicap: -";
    if (hc.diff === 0) return "Handicap: level";
    const to = hc.plusTo === "A" ? shortName(hc.nameA) : shortName(hc.nameB);
    return `Handicap: +${hc.diff} to ${to}`;
  }

  const captainByTeamId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teams) {
      const ids = (teamMembersByTeamId[t.id] ?? []).slice().sort();
      if (ids.length) m[t.id] = ids[0];
    }
    return m;
  }, [teams, teamMembersByTeamId]);

  const matchesByRound = useMemo(() => {
    const map: Record<number, MatchRow[]> = {};
    for (const m of matches) {
      const rn = Number(m.round_no ?? 0);
      if (!rn) continue;
      if (!map[rn]) map[rn] = [];
      map[rn].push(m);
    }
    const rounds = Object.keys(map)
      .map((k) => Number(k))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    return rounds.map((r) => ({ round: r, matches: map[r] ?? [] }));
  }, [matches]);

  useEffect(() => {
    if (!matchesByRound.length) return;
    if (bracketRound && matchesByRound.some((r) => r.round === bracketRound)) return;
    setBracketRound(matchesByRound[matchesByRound.length - 1].round);
  }, [matchesByRound, bracketRound]);

  useEffect(() => {
    if (isViewerMode) setBracketViewMode("TREE");
  }, [isViewerMode]);

  function toggleRound(round: number) {
    setOpenRounds((prev) => ({ ...prev, [round]: !prev[round] }));
  }

  function isCaptainOfTeam(teamId: string | null) {
    if (!teamId || !playerId) return false;
    return captainByTeamId[teamId] === playerId;
  }

  function sideForCaptain(match: MatchRow) {
    const isA = isCaptainOfTeam(match.team_a_id);
    const isB = isCaptainOfTeam(match.team_b_id);
    if (isA) return "A";
    if (isB) return "B";
    return null;
  }

  function canSubmitScore(match: MatchRow) {
    if (String(match.status ?? "") !== "IN_PLAY") return false;
    if (bool(match.finalized_by_admin)) return false;
    return sideForCaptain(match) != null;
  }

  function canConfirmScore(match: MatchRow) {
    if (bool(match.finalized_by_admin)) return false;
    if (match.score_a == null || match.score_b == null) return false;
    if (!match.submitted_by_player_id) return false;

    const mySide = sideForCaptain(match);
    if (!mySide) return false;

    // Submitting captain auto-confirmed their own side; only the other side should confirm.
    if (match.submitted_by_player_id === playerId) return false;

    if (mySide === "A") return !bool(match.confirmed_by_a);
    if (mySide === "B") return !bool(match.confirmed_by_b);
    return false;
  }

  async function submitScore(matchId: string) {
    if (!matchId) return;
    const draft = scoreDraftByMatchId[matchId] ?? { a: "", b: "" };

    const scoreA = Number(draft.a);
    const scoreB = Number(draft.b);

    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
      setError("Scores must be whole numbers.");
      return;
    }
    if (scoreA < 0 || scoreB < 0) {
      setError("Scores must be >= 0.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/matches/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, score_a: scoreA, score_b: scoreB }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not submit score.");
        setBusy(false);
        return;
      }

      await load();
      setBusy(false);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
    }
  }

  async function confirmScore(matchId: string) {
    if (!matchId) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/matches/confirm-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not confirm score.");
        setBusy(false);
        return;
      }

      await load();
      setBusy(false);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
    }
  }

  function renderTreeView() {
    if (!matchesByRound.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const roundMeta = (() => {
      const byRound: Record<number, { total: number; completed: number }> = {};
      for (const m of matches) {
        const rn = Number(m.round_no ?? 0);
        if (!rn) continue;
        byRound[rn] = byRound[rn] ?? { total: 0, completed: 0 };
        byRound[rn].total += 1;
        if (isMatchDone(m)) byRound[rn].completed += 1;
      }

      const rounds = Object.keys(byRound)
        .map((n) => Number(n))
        .filter((n) => n && !Number.isNaN(n))
        .sort((a, b) => a - b);

      const selectedRound = treeFromRound ?? (rounds[rounds.length - 1] ?? null);
      return { byRound, rounds, selectedRound };
    })();

    if (!roundMeta.rounds.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const roundsToShow = roundMeta.selectedRound
      ? matchesByRound.filter((r) => r.round >= roundMeta.selectedRound)
      : matchesByRound;
    const roundsDisplay = roundsToShow.filter((r) => roundLabel(r.round) !== "Pre-Rd");
    if (!roundsDisplay.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const preRound = matchesByRound.find((r) => roundLabel(r.round) === "Pre-Rd");
    const selectedRound = roundMeta.selectedRound ?? roundsDisplay[0]?.round ?? null;
    const selectedLabel = selectedRound ? roundLabel(selectedRound) : null;
    const selectedIsPre = selectedLabel === "Pre-Rd";
    const displayRounds = matchesByRound.filter((r) => roundLabel(r.round) !== "Pre-Rd");
    const selectedIndex = selectedIsPre
      ? -1
      : selectedRound
      ? displayRounds.findIndex((r) => r.round === selectedRound)
      : -1;
    const nextRound = selectedIsPre
      ? displayRounds[0] ?? null
      : selectedIndex >= 0 && selectedIndex < displayRounds.length - 1
      ? displayRounds[selectedIndex + 1]
      : null;

    const feederSourceIds = new Set<string>();
    const collectFeederIds = (roundMatches: MatchRow[] | undefined) => {
      (roundMatches ?? []).forEach((m) => {
        if (m.slot_a_source_match_id) feederSourceIds.add(String(m.slot_a_source_match_id));
        if (m.slot_b_source_match_id) feederSourceIds.add(String(m.slot_b_source_match_id));
      });
    };
    if (nextRound) {
      collectFeederIds(nextRound.matches);
    }

    const roundsForTree = (() => {
      const selectedMatchesRaw = selectedIsPre
        ? preRound?.matches ?? []
        : selectedRound
        ? displayRounds.find((r) => r.round === selectedRound)?.matches ?? []
        : [];
      const nextMatches = nextRound?.matches ?? [];
      const filteredNextMatches = feederSourceIds.size
        ? nextMatches.filter(
            (m) =>
              (m.slot_a_source_match_id && feederSourceIds.has(String(m.slot_a_source_match_id))) ||
              (m.slot_b_source_match_id && feederSourceIds.has(String(m.slot_b_source_match_id)))
          )
        : nextMatches;
      const selectedMatches = feederSourceIds.size
        ? selectedMatchesRaw.filter((m) => feederSourceIds.has(String(m.id)))
        : selectedMatchesRaw;

      if (selectedRound && nextRound) {
        return [
          { round: selectedRound, matches: selectedMatches },
          { round: nextRound.round, matches: filteredNextMatches },
        ];
      }

      return selectedRound ? [{ round: selectedRound, matches: selectedMatches }] : roundsDisplay;
    })();

    const fromLabelRaw = roundMeta.selectedRound ? roundLabel(roundMeta.selectedRound) : null;
    const fromLabel =
      fromLabelRaw === "Pre-Rd" && roundsForTree.length ? roundLabel(roundsForTree[0].round) : fromLabelRaw;

    const cardW = 230;
    const cardH = 44;
    const baseGap = 18;
    const colGap = 110;
    const headerOffset = 28;
    const baseStep = cardH + baseGap;

    const roundLayouts = roundsForTree.map((round, roundIndex) => {
      const list = [...(round.matches ?? [])].sort(
        (a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id))
      );
      return { round, roundIndex, list };
    });

    type MatchPos = { id: string; roundIndex: number; x: number; top: number; centerY: number };
    const posById: Record<string, MatchPos> = {};
    const roundPositions: { roundIndex: number; matches: MatchPos[] }[] = [];

    roundLayouts.forEach((layout, roundIndex) => {
      const x = roundIndex * (cardW + colGap);
      const list = layout.list;
      const matches: MatchPos[] = [];

      list.forEach((m, i) => {
        const centerY = headerOffset + baseStep * ((i + 0.5) * Math.pow(2, roundIndex));
        const top = centerY - cardH / 2;
        const pos = { id: m.id, roundIndex, x, top, centerY };
        matches.push(pos);
        posById[m.id] = pos;
      });

      roundPositions.push({ roundIndex, matches });
    });

    let maxBottom = 0;
    roundPositions.forEach((layout) => {
      layout.matches.forEach((m) => {
        maxBottom = Math.max(maxBottom, m.top + cardH);
      });
    });

    const width = roundLayouts.length ? roundLayouts.length * (cardW + colGap) - colGap : cardW;
    const height = Math.max(maxBottom + baseGap, cardH + headerOffset);

    const lines: string[] = [];
    const positionsByRoundIndex = new Map<number, MatchPos[]>(
      roundPositions.map((layout) => [layout.roundIndex, layout.matches])
    );
    for (const layout of roundLayouts) {
      if (layout.roundIndex === 0) continue;
      const list = layout.list;
      list.forEach((m) => {
        const childPos = posById[m.id];
        if (!childPos) return;
        const childX = childPos.x;
        const childCenterY = childPos.centerY;

        const sourceIds = [m.slot_a_source_match_id, m.slot_b_source_match_id].filter(
          (id): id is string => typeof id === "string" && id.length > 0
        );
        const parentPositions = sourceIds
          .map((id) => posById[id])
          .filter((p) => p && p.roundIndex === layout.roundIndex - 1) as MatchPos[];

        if (parentPositions.length === 0) {
          const fallbackParents = positionsByRoundIndex.get(layout.roundIndex - 1) ?? [];
          const i = list.indexOf(m);
          const aIdx = i * 2;
          const bIdx = i * 2 + 1;
          [aIdx, bIdx].forEach((idx) => {
            const parentPos = fallbackParents[idx];
            if (!parentPos) return;
            const parentX = parentPos.x + cardW;
            const parentCenterY = parentPos.centerY;
            const midX = (parentX + childX) / 2;
            lines.push(`M ${parentX} ${parentCenterY} H ${midX} V ${childCenterY} H ${childX}`);
          });
          return;
        }

        parentPositions.forEach((parentPos) => {
          const parentX = parentPos.x + cardW;
          const parentCenterY = parentPos.centerY;
          const midX = (parentX + childX) / 2;
          lines.push(`M ${parentX} ${parentCenterY} H ${midX} V ${childCenterY} H ${childX}`);
        });
      });
    }

    return (
      <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Show rounds from</div>
          <div style={{ marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roundMeta.rounds.map((r) => {
              const p = roundMeta.byRound[r];
              const done = p?.completed ?? 0;
              const total = p?.total ?? 0;
              const active = (roundMeta.selectedRound ?? roundMeta.rounds[0]) === r;

              return (
                <button
                  key={`tree-from-${r}`}
                  type="button"
                  onClick={() => setTreeFromRound(r)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: active ? theme.maroon : "#fff",
                    color: active ? "#fff" : theme.text,
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  title={`${done}/${total} complete`}
                >
                  <span>{roundLabel(r)}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, opacity: active ? 0.95 : 0.8, whiteSpace: "nowrap" }}>
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            Bracket view{fromLabel ? ` • from ${fromLabel}` : ""}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
            {roundsForTree.reduce((acc, r) => acc + (r.matches?.length ?? 0), 0)} matches
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14, overflowX: "auto" }}>
          <div style={{ position: "relative", width, height }}>
            <svg
              width={width}
              height={height}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {lines.map((d, idx) => (
                <path key={`path-${idx}`} d={d} stroke="#CBBBA3" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              ))}
            </svg>

            {roundLayouts.map((layout) => {
              const meta = roundMeta.byRound[layout.round.round];
              const total = meta?.total ?? layout.list.length;
              const completed = meta?.completed ?? 0;
              const focused = roundMeta.selectedRound ? layout.round.round === roundMeta.selectedRound : true;
              const colX = layout.roundIndex * (cardW + colGap);
              const positioned = roundPositions.find((r) => r.roundIndex === layout.roundIndex)?.matches ?? [];
              const matchPos = new Map(positioned.map((p) => [p.id, p]));

              return (
                <div
                  key={`tree-round-${layout.round.round}`}
                  style={{
                    position: "absolute",
                    left: colX,
                    top: 0,
                    width: cardW,
                    opacity: focused ? 1 : 0.8,
                    transition: "opacity 160ms ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontWeight: 900,
                      fontSize: 14,
                      color: theme.text,
                      paddingBottom: 6,
                    }}
                  >
                    <div>{roundLabel(layout.round.round)}</div>
                    <div style={{ fontSize: 11, color: theme.muted, fontWeight: 900 }}>{completed}/{total}</div>
                  </div>

                  {layout.list.map((m) => {
                    const pos = matchPos.get(m.id);
                    const y = pos ? pos.top : headerOffset;
                    const left = slotLabel(m, "A");
                    const right = slotLabel(m, "B");
                    const winnerId = winnerTeamIdFromMatch(m);
                    const winA = winnerId && m.team_a_id && String(m.team_a_id) === winnerId;
                    const winB = winnerId && m.team_b_id && String(m.team_b_id) === winnerId;

                    return (
                      <div
                        key={`tree-match-${m.id}`}
                        style={{
                          position: "absolute",
                          top: y,
                          left: 0,
                          width: cardW,
                          border: `1px solid ${theme.border}`,
                          borderRadius: 10,
                          background: "#fff",
                          padding: "6px 10px",
                          display: "grid",
                          alignContent: "center",
                          gap: 2,
                          fontSize: 12,
                          fontWeight: 900,
                          overflow: "hidden",
                          zIndex: 2,
                        }}
                      >
                        <div
                          style={{
                            color: winA ? "#16A34A" : left === "TBD" ? theme.muted : theme.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {left}
                        </div>
                        <div
                          style={{
                            color: winB ? "#16A34A" : right === "TBD" ? theme.muted : theme.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {right}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }




  const derived = useMemo(() => deriveTournamentCompletion(matches), [matches]);
  const inferredCompleted = derived.completed;
  const maxPlayableRound = derived.maxPlayableRound;

  const effectiveStatus: TournamentStatus | null = tournament
    ? tournament.status === "COMPLETED" || inferredCompleted
      ? "COMPLETED"
      : tournament.status
    : null;

  const winnerName = winnerNameFromMatches();
  const finish = myFinishSummary();

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {tournament?.name ? cleanTournamentName(tournament.name) : "Tournament"}
            </div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 1.25 }}>
              {loading
                ? "Loading..."
                : tournament
                ? `${scopeLabel(tournament.scope)} * ${formatLabel(tournament.format)} * ${statusLabel(effectiveStatus ?? tournament.status)}`
                : "-"}
            </div>
          </div>

          <button
            onClick={load}
            style={{
              border: `1px solid ${theme.border}`,
              background: "#fff",
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
              background: "#fff",
              color: theme.danger,
              fontWeight: 800,
              whiteSpace: "pre-wrap",
            }}
          >
            Error: {error}
          </div>
        )}

        {/* NEXT MATCH / SUMMARY */}
        {!isViewerMode ? (
          <div
            style={{
              marginTop: 14,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Your next match</div>
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
              Knockout bracket - winners advance.
            </div>



            <div style={{ marginTop: 10 }}>
              {!nextMatch ? (
                <div style={{ color: theme.muted, fontSize: 13 }}>
                  {myTeam ? "No upcoming match found yet." : "Join the tournament to see your next match."}
                </div>
              ) : (
                (() => {
                  const isBye = isMatchBye(nextMatch);
                  const scoreLine =
                    nextMatch.score_a == null || nextMatch.score_b == null ? "-" : `${nextMatch.score_a} - ${nextMatch.score_b}`;

                  return (
                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {isBye
                          ? `${slotLabel(nextMatch, "A")} - Auto-advance (BYE)`
                          : `${slotLabel(nextMatch, "A")} vs ${slotLabel(nextMatch, "B")}`}
                      </div>
                      {tournament?.format !== "SINGLES" && !isBye ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                          {slotMembersLine(nextMatch, "A")} * {slotMembersLine(nextMatch, "B")}
                        </div>
                      ) : null}
                      {tournament?.format === "SINGLES" && !isBye && isHandicapTournament() ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                          {singlesHandicapLine(nextMatch)}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div
                          style={{
                            border: `1px solid ${theme.border}`,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                            background: "#fff",
                            color: theme.text,
                          }}
                        >
                          {roundLabel(nextMatch.round_no)}
                        </div>
                        <div
                          style={{
                            border: `1px solid ${theme.border}`,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                            background: "#fff",
                            color: theme.text,
                          }}
                        >
                          Score: {scoreLine}
                        </div>
                        <div
                          style={{
                            border: `1px solid ${theme.border}`,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                            background: "#fff",
                            color: theme.text,
                          }}
                        >
                          {matchStatusLabel(nextMatch.status)}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Tournament summary</div>
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
              {myTeam ? "You are viewing as a past participant." : "You are viewing as a spectator."}
            </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13, color: theme.muted }}>
                <div><span style={{ fontWeight: 800, color: theme.text }}>Type</span> {formatLabel(tournament?.format ?? "SINGLES")} knockout</div>
                <div><span style={{ fontWeight: 800, color: theme.text }}>Rule</span> {tournament ? ruleLabel(tournament.rule_type ?? "HANDICAP_START") : "-"}</div>
                <div><span style={{ fontWeight: 800, color: theme.text }}>Status</span> {effectiveStatus ? statusLabel(effectiveStatus) : "-"}</div>
                <div><span style={{ fontWeight: 800, color: theme.text }}>Starts</span> {tournament?.starts_at ? new Date(tournament.starts_at).toLocaleString() : "TBC"}</div>
                <div><span style={{ fontWeight: 800, color: theme.text }}>Ends</span> {tournament?.ends_at ? new Date(tournament.ends_at).toLocaleString() : "TBC"}</div>
              </div>

              {winnerName && effectiveStatus === "COMPLETED" ? (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 900 }}>Winner:</span> {winnerName}
                </div>
              ) : null}

            {finish ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 900 }}>{finish.label}</div>
                {finish.detail ? <div style={{ color: theme.muted }}>{finish.detail}</div> : null}
              </div>
            ) : null}
          </div>
        )}

        {/* BRACKET VIEW */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket</div>
          <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
            Follow the knockout path. Winners advance to the next round.
          </div>
          {isViewerMode ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setBracketViewMode(bracketViewMode === "TREE" ? "LIST" : "TREE")}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "8px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {bracketViewMode === "TREE" ? "View brackets" : "View tree"}
              </button>
            </div>
          ) : null}


          <div style={{ marginTop: 12 }}>
            {isViewerMode && bracketViewMode === "TREE" ? (
              renderTreeView()
            ) : !matches.length ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>No fixtures yet.</div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {matchesByRound.map(({ round }) => {
                    const active = round === bracketRound;
                    return (
                      <button
                        key={`bracket-tab-${round}`}
                        type="button"
                        onClick={() => setBracketRound(round)}
                        style={{
                          border: `1px solid ${theme.border}`,
                          background: active ? theme.maroon : "#fff",
                          color: active ? "#fff" : theme.text,
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {roundLabel(round)}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {(matchesByRound.find((r) => r.round === bracketRound)?.matches ?? []).map((m) => {
                    const isBye = isMatchBye(m);
                    const scoreLine = m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;
                    const isMine = myTeam && (m.team_a_id === myTeam.id || m.team_b_id === myTeam.id);
                    const winnerId = winnerTeamIdFromMatch(m);
                    const winA = winnerId && m.team_a_id === winnerId;
                    const winB = winnerId && m.team_b_id === winnerId;
                    const cardBorder = isMine ? theme.maroon : theme.border;
                    const cardBg = isMine ? "rgba(122,31,43,0.05)" : "#fff";

                    return (
                      <div
                        key={`bracket-match-${m.id}`}
                        style={{
                          border: `1px solid ${cardBorder}`,
                          borderRadius: 14,
                          padding: 10,
                          background: cardBg,
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 14, minWidth: 0 }}>
                          {isBye ? (
                            `${slotLabel(m, "A")} - Auto-advance (BYE)`
                          ) : (
                            <>
                              <span style={{ color: winA ? "#0F7A3D" : theme.text }}>{slotLabel(m, "A")}</span>{" "}
                              <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                              <span style={{ color: winB ? "#0F7A3D" : theme.text }}>{slotLabel(m, "B")}</span>
                            </>
                          )}
                        </div>
                        {tournament?.format !== "SINGLES" && !isBye ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: theme.muted,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {slotMembersLine(m, "A")} * {slotMembersLine(m, "B")}
                          </div>
                        ) : null}
                        {tournament?.format === "SINGLES" && !isBye && isHandicapTournament() ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                            {singlesHandicapLine(m)}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <div
                            style={{
                              border: `1px solid ${theme.border}`,
                              borderRadius: 999,
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 900,
                              background: "#fff",
                              color: theme.text,
                            }}
                          >
                            {matchStatusLabel(m.status)}
                          </div>
                          <div
                            style={{
                              border: `1px solid ${theme.border}`,
                              borderRadius: 999,
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 900,
                              background: "#fff",
                              color: theme.text,
                            }}
                          >
                            {scoreLine}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ALL ROUNDS LIST */}
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
            onClick={() => setFixturesOpen((v) => !v)}
            style={{
              width: "100%",
              border: "none",
              background: "#fff",
              color: theme.text,
              padding: "12px 14px",
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
            title="Toggle fixtures"
          >
            <span style={{ fontSize: 16 }}>All rounds</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
              {matches.length ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}` : "No fixtures"}{" "}
              <span style={{ marginLeft: 8 }}>{fixturesOpen ? "▾" : "▸"}</span>
            </span>
          </button>

          {fixturesOpen ? (
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
              <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
              Matches follow a knockout bracket. Home/away has no special meaning.
              </div>

              <div style={{ marginTop: 10 }}>
                {!matches.length ? (
                  <div style={{ color: theme.muted, fontSize: 13 }}>No fixtures yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {matchesByRound.map(({ round, matches: ms }) => {
                      const open = !!openRounds[round];

                      return (
                        <div
                          key={`round-${round}`}
                          style={{
                            border: `1px solid ${theme.border}`,
                            borderRadius: 16,
                            background: "#fff",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleRound(round)}
                            style={{
                              width: "100%",
                              border: "none",
                              background: "#F3F8F3",
                              padding: "10px 12px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                            title={`Toggle ${roundLabel(round)}`}
                          >
                            <div style={{ fontWeight: 900 }}>{roundLabel(round)}</div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                              {ms.length} {ms.length === 1 ? "match" : "matches"}{" "}
                              <span style={{ marginLeft: 8 }}>{open ? "▾" : "▸"}</span>
                            </div>
                          </button>

                          {open ? (
                            <div style={{ display: "grid", borderTop: `1px solid ${theme.border}` }}>
                              {ms.map((m, idx) => {
                                const mySide = sideForCaptain(m);
                                const showSubmit = canSubmitScore(m);
                                const showConfirm = canConfirmScore(m);

                                const confirmedA = bool(m.confirmed_by_a);
                                const confirmedB = bool(m.confirmed_by_b);

                                const scoreLine = m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;

                                const isFinal = bool(m.finalized_by_admin);
                                const winnerId = winnerTeamIdFromMatch(m);
                                const winA = winnerId && m.team_a_id === winnerId;
                                const winB = winnerId && m.team_b_id === winnerId;

                                const draft = scoreDraftByMatchId[m.id] ?? { a: "", b: "" };

                                return (
                                  <div
                                    key={m.id}
                                    style={{
                                      padding: "10px 12px",
                                      borderBottom: idx === ms.length - 1 ? "none" : `1px dashed ${theme.border}`,
                                      background: "#fff",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, fontSize: 14 }}>
                                          <span style={{ color: winA ? "#0F7A3D" : theme.text }}>{slotLabel(m, "A")}</span>{" "}
                                          <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                                          <span style={{ color: winB ? "#0F7A3D" : theme.text }}>{slotLabel(m, "B")}</span>
                                        </div>
                                        {tournament?.format === "SINGLES" ? null : (
                                          <div
                                            style={{
                                              marginTop: 2,
                                              fontSize: 12,
                                              color: theme.muted,
                                              fontWeight: 800,
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                            }}
                                            title={`${slotMembersLine(m, "A")} * ${slotMembersLine(m, "B")}`}
                                          >
                                            {slotMembersLine(m, "A")} * {slotMembersLine(m, "B")}
                                          </div>
                                        )}
                                        {tournament?.format === "SINGLES" && !isMatchBye(m) && isHandicapTournament() ? (
                                          <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                                            {singlesHandicapLine(m)}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div
                                        style={{
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: 999,
                                          padding: "4px 10px",
                                          fontSize: 12,
                                          fontWeight: 900,
                                          background: "#fff",
                                          color: theme.text,
                                          whiteSpace: "nowrap",
                                        }}
                                        title="Match status"
                                      >
                                        {matchStatusLabel(m.status)}
                                      </div>
                                    </div>

                                    <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                      <div
                                        style={{
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: 999,
                                          padding: "5px 10px",
                                          fontSize: 12,
                                          fontWeight: 900,
                                          background: "#fff",
                                          color: theme.text,
                                          whiteSpace: "nowrap",
                                        }}
                                        title="Score"
                                      >
                                        Score: {scoreLine}
                                      </div>

                                      <div
                                        style={{
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: 999,
                                          padding: "5px 10px",
                                          fontSize: 12,
                                          fontWeight: 900,
                                          background: "#fff",
                                          color: theme.muted,
                                          whiteSpace: "nowrap",
                                        }}
                                        title="Confirmations"
                                      >
                                        Conf: A {confirmedA ? "✓" : "-"} * B {confirmedB ? "✓" : "-"}
                                        {isFinal ? <span style={{ marginLeft: 8, color: theme.danger }}>Admin final</span> : null}
                                      </div>

                                      {mySide ? (
                                        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                                          You are captain ({mySide})
                                        </div>
                                      ) : null}
                                    </div>

                                    {showSubmit ? (
                                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                                          Enter score (captain only)
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 8, alignItems: "center" }}>
                                          <input
                                            inputMode="numeric"
                                            value={draft.a}
                                            onChange={(e) =>
                                              setScoreDraftByMatchId((p) => ({ ...p, [m.id]: { ...draft, a: e.target.value } }))
                                            }
                                            placeholder="A"
                                            style={{
                                              width: "100%",
                                              border: `1px solid ${theme.border}`,
                                              borderRadius: 12,
                                              padding: "10px 10px",
                                              fontWeight: 900,
                                              outline: "none",
                                            }}
                                            disabled={busy}
                                          />
                                          <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
                                          <input
                                            inputMode="numeric"
                                            value={draft.b}
                                            onChange={(e) =>
                                              setScoreDraftByMatchId((p) => ({ ...p, [m.id]: { ...draft, b: e.target.value } }))
                                            }
                                            placeholder="B"
                                            style={{
                                              width: "100%",
                                              border: `1px solid ${theme.border}`,
                                              borderRadius: 12,
                                              padding: "10px 10px",
                                              fontWeight: 900,
                                              outline: "none",
                                            }}
                                            disabled={busy}
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => submitScore(m.id)}
                                          style={{
                                            width: "100%",
                                            border: "none",
                                            background: theme.maroon,
                                            color: "#fff",
                                            padding: "10px 12px",
                                            borderRadius: 12,
                                            fontWeight: 900,
                                            cursor: busy ? "not-allowed" : "pointer",
                                          }}
                                          title="Submit score"
                                        >
                                          {busy ? "Working..." : "Submit score"}
                                        </button>
                                      </div>
                                    ) : null}

                                    {showConfirm ? (
                                      <div style={{ marginTop: 10 }}>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => confirmScore(m.id)}
                                          style={{
                                            width: "100%",
                                            border: `1px solid ${theme.border}`,
                                            background: "#fff",
                                            color: theme.text,
                                            padding: "10px 12px",
                                            borderRadius: 12,
                                            fontWeight: 900,
                                            cursor: busy ? "not-allowed" : "pointer",
                                          }}
                                          title="Confirm submitted score"
                                        >
                                          {busy ? "Working..." : "Confirm score"}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            disabled
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.muted,
              padding: "12px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: "not-allowed",
            }}
            title="Coming soon"
          >
            Send message to Admin (Coming soon)
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
