// app/admin/tournaments/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import BottomNav from "../../../components/BottomNav";

type TournamentScope = "CLUB" | "DISTRICT" | "NATIONAL";
type TournamentStatus = "ANNOUNCED" | "IN_PLAY" | "COMPLETED";
type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";

type MatchStatus = "OPEN" | "FINAL" | "SCHEDULED" | "IN_PLAY" | "COMPLETED" | "BYE";

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
  locked_at?: string | null;
  target_team_handicap?: number | null;
};

type TeamRow = { id: string; team_no: number; team_handicap: number | null };

type MatchRow = {
  id: string;
  tournament_id: string | null;

  round_no: number | null;
  match_no?: number | null;

  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | null;
  slot_b_source_type?: string | null;
  slot_b_source_match_id?: string | null;

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

  winner_team_id?: string | null;
};

type ViewTab = "CONTROL" | "ROUNDS" | "AUDIT";

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

function matchStatusLabel(status: string) {
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "IN_PLAY") return "In play";
  if (status === "COMPLETED") return "Completed";
  if (status === "OPEN") return "Open";
  if (status === "FINAL") return "Final";
  if (status === "BYE") return "BYE";
  return status || "-";
}

function bool(v: any) {
  return v === true;
}

function isMatchBye(m: MatchRow) {
  const st = String(m.status ?? "");
  if (st === "BYE") return true;
  if (m.slot_b_source_type === "BYE") return true;
  return !m.team_b_id && !m.slot_b_source_type;
}

function isMatchDone(m: MatchRow) {
  const st = String(m.status ?? "");
  const hasWinner = m.winner_team_id != null && m.winner_team_id !== "";
  return st === "COMPLETED" || bool(m.finalized_by_admin) || hasWinner;
}

type DrawerMode = "SCORE" | "ADMIN_FINAL";
type DrawerDraft = { a: string; b: string };

export default function AdminTournamentDetailPage() {
  const supabase = createClient();
  const params = useParams();

  const rawId = (params as any)?.id;
  const tournamentId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [entryCount, setEntryCount] = useState(0);

  const [viewTab, setViewTab] = useState<ViewTab>("ROUNDS");

  // Target handicap (required before locking entries for Doubles)
  const [targetInput, setTargetInput] = useState<string>("");

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<string, string[]>>({});
  const [nameByPlayerId, setNameByPlayerId] = useState<Record<string, string>>({});
  const [handicapByPlayerId, setHandicapByPlayerId] = useState<Record<string, number | null>>({});

  const [matches, setMatches] = useState<MatchRow[]>([]);

  // per-match open state + score drafts
  const [adminFinalOpenByMatchId, setAdminFinalOpenByMatchId] = useState<Record<string, boolean>>({});
  const [scoreDraftByMatchId, setScoreDraftByMatchId] = useState<Record<string, { a: string; b: string }>>({});

  // Bulk round scoring mode
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDraftByMatchId, setBulkDraftByMatchId] = useState<Record<string, { a: string; b: string }>>({});

  const [fixturesEditOpen, setFixturesEditOpen] = useState(false);
  const [fixturesDraftByMatchId, setFixturesDraftByMatchId] = useState<Record<string, { a: string; b: string }>>({});

  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [roundsViewMode, setRoundsViewMode] = useState<"LIST" | "TREE">("LIST");

  // top “⋯ More actions” menu
  const [moreOpen, setMoreOpen] = useState(false);

  const [showProblemsOnly, setShowProblemsOnly] = useState(false);

  // Organised collapsible sections inside a round
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [inPlayOpen, setInPlayOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [auditOpenByRound, setAuditOpenByRound] = useState<Record<number, boolean>>({});
  const [auditEditOpenByMatchId, setAuditEditOpenByMatchId] = useState<Record<string, boolean>>({});
  const treeRoundRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Bottom drawer (keeps list stable; stops scroll-jump) — still supported
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMatchId, setDrawerMatchId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("SCORE");
  const [drawerDraft, setDrawerDraft] = useState<DrawerDraft>({ a: "", b: "" });
  const scrollYBeforeAction = useRef<number>(0);

  const matchNoById = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const m of matches) {
      if (!m?.id) continue;
      map[m.id] = m.match_no ?? null;
    }
    return map;
  }, [matches]);

  // Prevent “jump to top” while typing into score inputs (mobile browsers can scroll on rerender/focus)
  const scrollYPinnedForInput = useRef<number>(0);
  const autoByeAttemptsRef = useRef<Record<number, number>>({});

  function pinScrollForInput() {
    scrollYPinnedForInput.current = typeof window !== "undefined" ? window.scrollY : 0;
  }

  function restorePinnedScrollForInput() {
    const y = scrollYPinnedForInput.current || 0;
    if (!y) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  function rememberScroll() {
    scrollYBeforeAction.current = typeof window !== "undefined" ? window.scrollY : 0;
  }

  // ✅ KEY FIX: if we never remembered scroll, do NOT “restore” to 0 (that causes the snap-to-top).
  function restoreScroll() {
    const y = scrollYBeforeAction.current || 0;
    if (!y) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerMatchId(null);
  }

  function openDrawerForMatch(matchId: string, mode: DrawerMode) {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return;

    setDrawerMatchId(matchId);
    setDrawerMode(mode);
    setDrawerDraft({
      a: m.score_a == null ? "" : String(m.score_a),
      b: m.score_b == null ? "" : String(m.score_b),
    });
    setDrawerOpen(true);
  }

  function goBack() {
    window.location.href = "/admin/tournaments";
  }

  function openPlayerView() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    window.location.href = `/tournaments/${tournamentId}`;
  }

  async function adminGate() {
    setAccessDenied(false);

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = "/login";
      return { ok: false as const };
    }

    const au = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (au.error) {
      setError(`Could not verify admin access.\n${au.error.message}`);
      setIsAdmin(false);
      setAccessDenied(true);
      return { ok: false as const };
    }

    if (!au.data?.user_id) {
      setIsAdmin(false);
      setAccessDenied(true);
      return { ok: false as const };
    }

    setIsAdmin(true);
    return { ok: true as const };
  }

  async function load(opts?: { preserveScroll?: boolean }) {
    const preserveScroll = opts?.preserveScroll === true;

    if (preserveScroll) rememberScroll();

    setLoading(true);
    setError(null);

    if (!tournamentId || typeof tournamentId !== "string") {
      setError("Invalid tournament id.");
      setIsAdmin(false);
      setAccessDenied(true);
      setMatches([]);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setLoading(false);
      return;
    }

    const gate = await adminGate();
    if (!gate.ok) {
      setTournament(null);
      setEntryCount(0);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setLoading(false);
      return;
    }

    const tRes = await supabase
      .from("tournaments")
      .select("id, name, scope, format, status, announced_at, starts_at, ends_at, entries_open, locked_at, target_team_handicap")
      .eq("id", tournamentId)
      .single();

    if (tRes.error || !tRes.data?.id) {
      setError(`Tournament not found.\n${tRes.error?.message ?? ""}`.trim());
      setTournament(null);
      setEntryCount(0);
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
      setMatches([]);
      setLoading(false);
      return;
    }

    const tRow = tRes.data as TournamentRow;
    setTournament(tRow);

    setTargetInput(tRow.target_team_handicap == null ? "" : String(tRow.target_team_handicap));

    const eRes = await supabase.from("tournament_entries").select("tournament_id").eq("tournament_id", tournamentId);
    if (!eRes.error) setEntryCount((eRes.data ?? []).length);

    const teamRes = await supabase
      .from("tournament_teams")
      .select("id, team_no, team_handicap")
      .eq("tournament_id", tournamentId)
      .order("team_no", { ascending: true });

    if (teamRes.error) {
      setError((prev) => prev ?? `Could not load teams.\n${teamRes.error?.message ?? ""}`.trim());
      setTeams([]);
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setHandicapByPlayerId({});
    } else {
      const teamRows = (teamRes.data ?? []).map((r: any) => ({
        id: String(r.id),
        team_no: Number(r.team_no ?? 0),
        team_handicap: r.team_handicap == null ? null : typeof r.team_handicap === "number" ? r.team_handicap : Number(r.team_handicap),
      })) as TeamRow[];

      setTeams(teamRows);

      const teamIds = teamRows.map((t) => t.id);
      if (!teamIds.length) {
        setTeamMembersByTeamId({});
        setNameByPlayerId({});
        setHandicapByPlayerId({});
      } else {
        const memRes = await supabase.from("tournament_team_members").select("team_id, player_id").in("team_id", teamIds);

        if (memRes.error) {
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
              const nameByPlayer: Record<string, string> = {};
              const handicapByPlayer: Record<string, number | null> = {};

              for (const p of pRes.data ?? []) {
                const pid = String((p as any).id);
                nameByPlayer[pid] = String((p as any).display_name ?? "Unknown");

                const h = (p as any).handicap;
                if (h == null || h === "") handicapByPlayer[pid] = null;
                else {
                  const hn = typeof h === "number" ? h : Number(h);
                  handicapByPlayer[pid] = Number.isFinite(hn) ? hn : null;
                }
              }

              setNameByPlayerId(nameByPlayer);
              setHandicapByPlayerId(handicapByPlayer);
            }
          }
        }
      }
    }

    const mRes = await supabase
      .from("matches")
      .select(
        "id, tournament_id, team_a_id, team_b_id, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id, round_no, match_no, status, score_a, score_b, submitted_by_player_id, submitted_at, confirmed_by_a, confirmed_by_b, finalized_by_admin, finalized_at, admin_final_by, admin_final_at, winner_team_id"
      )
      .eq("tournament_id", tournamentId)
      .order("round_no", { ascending: true })
      .order("match_no", { ascending: true })
      .order("id", { ascending: true });

    if (mRes.error) {
      setMatches([]);
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

      const roundNos = Array.from(new Set(ms.map((m) => Number(m.round_no ?? 0)).filter((n) => n && !Number.isNaN(n)))).sort((a, b) => a - b);

      const first = roundNos[0] ?? null;
      const nextSelected = selectedRound ?? first;
      setSelectedRound(nextSelected);

      if (tRow.status === "COMPLETED") setViewTab("AUDIT");
      else if (tRow.status === "ANNOUNCED") setViewTab("CONTROL");
      else if (!ms.length) setViewTab("CONTROL");
      else setViewTab("ROUNDS");
    }

    setLoading(false);

    if (preserveScroll) restoreScroll();
  }

  useEffect(() => {
    if (!tournamentId || typeof tournamentId !== "string") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const entriesOpen = tournament?.entries_open !== false && !tournament?.locked_at;
  const hasTeams = teams.length > 0;
  const hasMatches = matches.length > 0;

  const isDoubles = tournament?.format === "DOUBLES";
  const targetNum = Number((targetInput ?? "").trim());
  const targetValid = (targetInput ?? "").trim() !== "" && Number.isFinite(targetNum) && !Number.isNaN(targetNum) && targetNum >= 0;

  const mustSetTargetBeforeLock = isDoubles && !targetValid;

  const teamById = useMemo(() => {
    const m: Record<string, TeamRow> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  function teamLabel(teamId: string | null) {
    if (!teamId) return "Team -";
    const t = teamById[teamId];
    if (!t) return "Team -";
    return `Team ${t.team_no}`;
  }

  function teamDisplayName(teamId: string | null) {
    if (!teamId) return "BYE";
    const memberIds = teamMembersByTeamId[teamId] ?? [];
    const names = memberIds.map((pid) => nameByPlayerId[pid]).filter(Boolean);

    if (tournament?.format === "SINGLES") {
      return (names[0] as string) ?? teamLabel(teamId);
    }
    if (names.length) return (names as string[]).join(" • ");
    return teamLabel(teamId);
  }

  function teamMembersLine(teamId: string | null) {
    if (!teamId) return "—";
    const memberIds = teamMembersByTeamId[teamId] ?? [];
    const names = memberIds.map((pid) => nameByPlayerId[pid]).filter(Boolean);
    if (tournament?.format === "SINGLES") return (names[0] as string) ?? teamLabel(teamId);
    return names.length ? (names as string[]).join(" • ") : teamLabel(teamId);
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

  function largestPowerOfTwoLE(n: number) {
    let p = 1;
    while (p * 2 <= n) p *= 2;
    return p;
  }

  function roundLabel(roundNo: number | null | undefined) {
    const r = Number(roundNo ?? 0);
    if (!r) return "Round -";

    const totalTeams =
      teams.length > 0 ? teams.length : tournament?.format === "SINGLES" && entryCount > 0 ? entryCount : 0;

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

    // If either handicap unknown, show "-" and no +diff
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
  // Prefer first name or first token for compact “+X to …”
  const first = t.split(" ")[0] ?? t;
  return first.length ? first : t;
}

function singlesHandicapLine(m: MatchRow) {
  const hc = singlesHandicapInfo(m);
  if (!hc) return null;

  if (hc.diff == null) return "Handicap: —";
  if (hc.diff === 0) return "Handicap: level";
  const to = hc.plusTo === "A" ? shortName(hc.nameA) : shortName(hc.nameB);
  return `Handicap: +${hc.diff} to ${to}`;
}

  function selectRound(r: number) {
    setSelectedRound(r);
    setBulkOpen(false);
    setBulkDraftByMatchId({});
  }

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

  const roundMeta = useMemo(() => {
    const byRound: Record<number, { total: number; completed: number; byes: number; byesPending: number; hasAny: boolean }> = {};
    for (const m of matches) {
      const rn = Number(m.round_no ?? 0);
      if (!rn) continue;
      byRound[rn] = byRound[rn] ?? { total: 0, completed: 0, byes: 0, byesPending: 0, hasAny: false };
      byRound[rn].hasAny = true;
      byRound[rn].total += 1;

      const bye = isMatchBye(m);
      const done = isMatchDone(m);

      if (bye) {
        byRound[rn].byes += 1;
        if (!done) byRound[rn].byesPending += 1;
      }
      if (done) byRound[rn].completed += 1;
    }

    const rounds = Object.keys(byRound)
      .map((n) => Number(n))
      .filter((n) => n && !Number.isNaN(n))
      .sort((a, b) => a - b);

    const selected = selectedRound ?? (rounds[0] ?? null);
    const cur = selected ? byRound[selected] : null;

    const roundIsComplete = !!selected && !!cur && cur.total > 0 && cur.completed >= cur.total && cur.byesPending === 0;

    return { byRound, rounds, selectedRound: selected, roundIsComplete };
  }, [matches, selectedRound]);

  useEffect(() => {
    if (roundsViewMode !== "TREE") return;
    const r = roundMeta.selectedRound;
    if (!r) return;
    const el = treeRoundRefs.current[r];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, [roundsViewMode, roundMeta.selectedRound]);

  useEffect(() => {
    if (!fixturesEditOpen) return;

    const roundNos = matches
      .map((m) => Number(m.round_no ?? 0))
      .filter((n) => n && !Number.isNaN(n))
      .sort((a, b) => a - b);

    const firstRound = roundNos[0] ?? null;
    if (!firstRound) {
      setFixturesDraftByMatchId({});
      return;
    }

    const roundMatches = matches
      .filter((m) => Number(m.round_no ?? 0) === firstRound)
      .sort((a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id)));

    const next: Record<string, { a: string; b: string }> = {};
    for (const m of roundMatches) {
      next[m.id] = {
        a: m.team_a_id ? String(m.team_a_id) : "",
        b: m.team_b_id ? String(m.team_b_id) : "",
      };
    }
    setFixturesDraftByMatchId(next);
  }, [fixturesEditOpen, matches]);

  useEffect(() => {
    if (!tournamentId || typeof tournamentId !== "string") return;
    const r = roundMeta.selectedRound;
    if (!r) return;
    const p = roundMeta.byRound[r];
    if (!p) return;

    if (p.byesPending === 0) {
      if (autoByeAttemptsRef.current[r]) delete autoByeAttemptsRef.current[r];
      return;
    }

    if (busy) return;

    const attempts = autoByeAttemptsRef.current[r] ?? 0;
    if (attempts >= 2) return;

    autoByeAttemptsRef.current[r] = attempts + 1;
    processByesForSelectedRound();
  }, [matches, roundMeta.selectedRound, busy, tournamentId]);

  async function saveTarget() {
    if (!tournamentId || typeof tournamentId !== "string") return;

    const raw = (targetInput ?? "").trim();
    const v = raw === "" ? null : Number(raw);

    if (v === null || Number.isNaN(v)) {
      setError("Target team handicap must be a number.");
      return;
    }
    if (v < 0) {
      setError("Target team handicap must be >= 0.");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await supabase.rpc("tournament_set_target_handicap", {
      p_tournament_id: tournamentId,
      p_target: v,
    });

    if (res.error) {
      setError(`Could not set target handicap.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function suggestTargetFromEntries() {
    if (!tournamentId || typeof tournamentId !== "string") return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("tournament_entries").select("player_id").eq("tournament_id", tournamentId);

    if (res.error) {
      setError(`Could not load entrants.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    const playerIds = Array.from(new Set((res.data ?? []).map((r: any) => String(r.player_id)).filter(Boolean)));

    if (playerIds.length === 0) {
      setError("No entrants yet.");
      setBusy(false);
      return;
    }

    const pRes = await supabase.from("players").select("id, handicap").in("id", playerIds);

    if (pRes.error) {
      setError(`Could not load handicaps.\n${pRes.error.message}`);
      setBusy(false);
      return;
    }

    const hs = (pRes.data ?? [])
      .map((p: any) => (typeof p.handicap === "number" ? Number(p.handicap) : p.handicap != null ? Number(p.handicap) : null))
      .filter((v: any) => v !== null && !Number.isNaN(v)) as number[];

    if (hs.length === 0) {
      setError("No handicaps available for entrants.");
      setBusy(false);
      return;
    }

    const avgPlayer = hs.reduce((a, b) => a + b, 0) / hs.length;
    const suggestedTeam = Math.round(avgPlayer * 2 * 10) / 10;

    setTargetInput(String(suggestedTeam));
    setBusy(false);
  }

  async function lockEntries() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    setBusy(true);
    setError(null);

    const res = await supabase.rpc("tournament_lock_entries", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not lock entries.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function generateDoublesTeams() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    setBusy(true);
    setError(null);

    const res = await supabase.rpc("tournament_generate_doubles_teams", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not generate doubles teams.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function generateMatches() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    setBusy(true);
    setError(null);

    const fn = tournament?.format === "SINGLES" ? "generate_round1_singles_matches" : "tournament_generate_knockout_matches";

    const res = await supabase.rpc(fn, { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not generate matches.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function startTournament() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    setBusy(true);
    setError(null);

    const res = await supabase.rpc("tournament_start", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not start tournament.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    const roundNos = matches
      .map((m) => Number(m.round_no ?? 0))
      .filter((n) => n && !Number.isNaN(n))
      .sort((a, b) => a - b);
    const firstRound = roundNos[0] ?? null;

    if (firstRound) {
      const up = await supabase
        .from("matches")
        .update({ status: "IN_PLAY" })
        .eq("tournament_id", tournamentId)
        .eq("round_no", firstRound)
        .eq("status", "SCHEDULED")
        .not("team_b_id", "is", null);

      if (up.error) {
        setError(`Could not start round ${firstRound} matches.\n${up.error.message}`);
        setBusy(false);
        return;
      }
    }

    await load({ preserveScroll: true });
    setViewTab("ROUNDS");
    setBusy(false);
  }

  async function endTournament() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    if (!tournament) return;

    const ok = window.confirm(`Mark tournament as Completed?\n\nTournament: ${tournament.name}`);
    if (!ok) return;

    setBusy(true);
    setError(null);

    const res = await supabase.from("tournaments").update({ status: "COMPLETED" }).eq("id", tournamentId);

    if (res.error) {
      setError(`Could not complete tournament.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function cancelTournament() {
    if (!tournament || !tournamentId || typeof tournamentId !== "string") return;

    const ok = window.confirm(
      `Cancel tournament?\n\nThis will permanently delete:\n• entries\n• teams\n• fixtures\n\nTournament: ${tournament.name}\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);

    const res = await supabase.rpc("tournament_cancel", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not cancel tournament.\n${res.error.message}`);
      setBusy(false);
      return;
    }

    window.location.href = "/admin/tournaments";
  }

  async function updateMatchStatus(matchId: string, status: MatchStatus) {
    if (!matchId) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    const res = await supabase.from("matches").update({ status }).eq("id", matchId);

    if (res.error) {
      setError(`Could not update match status.\n${res.error.message}`);
      setBusy(false);
      restoreScroll();
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function adminFinalScore(matchId: string) {
    if (!matchId) return;

    const draft = scoreDraftByMatchId[matchId] ?? drawerDraft;

    const scoreA = Number((draft?.a ?? "").trim());
    const scoreB = Number((draft?.b ?? "").trim());

    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
      setError("Scores must be whole numbers.");
      return;
    }
    if (scoreA < 0 || scoreB < 0) {
      setError("Scores must be >= 0.");
      return;
    }

    const ok = window.confirm(`Admin final this match with score ${scoreA}-${scoreB}?\n\nThis will complete the match.`);
    if (!ok) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/matches/admin-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, score_a: scoreA, score_b: scoreB }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not admin-final match.");
        setBusy(false);
        restoreScroll();
        return;
      }

      closeDrawer();
      await load({ preserveScroll: true });
      setBusy(false);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
      restoreScroll();
    }
  }

  async function processByesForSelectedRound() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    const r = roundMeta.selectedRound;
    if (!r) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    const res = await supabase.rpc("knockout_process_byes", { p_tournament_id: tournamentId, p_round_no: r });

    if (res.error) {
      setError(`Could not process BYEs.\n${res.error.message}`);
      setBusy(false);
      restoreScroll();
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function startAllInSelectedRound() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    const r = roundMeta.selectedRound;
    if (!r) return;

    const ok = window.confirm(`Start all scheduled matches in ${roundLabel(r)}?\n\nThis sets status to IN_PLAY.`);
    if (!ok) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    // Only start matches that are scheduled, not done, and not BYEs
    const res = await supabase
      .from("matches")
      .update({ status: "IN_PLAY" })
      .eq("tournament_id", tournamentId)
      .eq("round_no", r)
      .eq("status", "SCHEDULED")
      .not("team_b_id", "is", null)
      .is("winner_team_id", null);

    if (res.error) {
      setError(`Could not start all matches.\n${res.error.message}`);
      setBusy(false);
      restoreScroll();
      return;
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function completeAllWithScoresInSelectedRound() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    const r = roundMeta.selectedRound;
    if (!r) return;

    // Gather eligible matches from local state first (safer than guessing in SQL)
    const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
    const eligible = roundMatches.filter((m) => {
      if (isMatchBye(m)) return false;
      if (isMatchDone(m)) return false;
      if (m.score_a == null || m.score_b == null) return false;
      // Allow SCHEDULED or IN_PLAY; admin final route will handle completing
      return true;
    });

    if (!eligible.length) {
      setError("No matches with scores to complete in this round.");
      return;
    }

    const ok = window.confirm(
      `Complete ${eligible.length} match(es) in ${roundLabel(r)} that already have scores?\n\nThis will admin-final them and set winners.`
    );
    if (!ok) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    for (const m of eligible) {
      try {
        const res = await fetch("/api/tournaments/matches/admin-final", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: m.id, score_a: m.score_a, score_b: m.score_b }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error ?? `Could not complete match ${m.match_no ?? ""}.`);
          setBusy(false);
          restoreScroll();
          return;
        }
      } catch (e: any) {
        setError(e?.message ?? "Network error.");
        setBusy(false);
        restoreScroll();
        return;
      }
    }

    await load({ preserveScroll: true });
    setBusy(false);
  }

  async function advanceSelectedRound() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    const r = roundMeta.selectedRound;
    if (!r) return;

    rememberScroll();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/advance-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId, round_no: r }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not advance round.");
        setBusy(false);
        restoreScroll();
        return;
      }

      await load({ preserveScroll: true });
      setBusy(false);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
      restoreScroll();
    }
  }

  function SegmentedTabs() {
    const base = (active: boolean) => ({
      border: `1px solid ${theme.border}`,
      background: active ? theme.maroon : "#fff",
      color: active ? "#fff" : theme.text,
      padding: "10px 12px",
      borderRadius: 999,
      fontWeight: 900 as const,
      cursor: "pointer",
      width: "100%",
    });

    return (
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <button type="button" onClick={() => setViewTab("CONTROL")} style={base(viewTab === "CONTROL")}>
          Control
        </button>
        <button type="button" onClick={() => setViewTab("ROUNDS")} style={base(viewTab === "ROUNDS")}>
          Rounds
        </button>
        <button type="button" onClick={() => setViewTab("AUDIT")} style={base(viewTab === "AUDIT")}>
          Audit
        </button>
      </div>
    );
  }

  function StatusPill({ label, tone }: { label: string; tone?: "neutral" | "good" | "warn" | "danger" }) {
    const bg = tone === "good" ? "#ECFDF5" : tone === "warn" ? "#FFF7ED" : tone === "danger" ? "#FEF2F2" : "#fff";
    const fg = tone === "good" ? "#047857" : tone === "warn" ? "#9A3412" : tone === "danger" ? theme.danger : theme.text;

    return (
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: 999,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 900,
          background: bg,
          color: fg,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    );
  }

  function PrimaryButton({
    label,
    onClick,
    disabled,
    variant,
    title,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "solid" | "outline" | "danger";
    title?: string;
  }) {
    const isSolid = variant === "solid";
    const isDanger = variant === "danger";

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!!disabled}
        title={title}
        style={{
          width: "100%",
          border: isSolid ? "none" : `1px solid ${theme.border}`,
          background: disabled ? "#9CA3AF" : isDanger ? "#fff" : isSolid ? theme.maroon : "#fff",
          color: disabled ? "#fff" : isDanger ? theme.danger : isSolid ? "#fff" : theme.text,
          padding: "10px 12px",
          borderRadius: 12,
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Working..." : label}
      </button>
    );
  }

  function SectionCard({
    title,
    count,
    open,
    onToggle,
    tone,
    children,
    subtitle,
  }: {
    title: string;
    count?: number;
    open: boolean;
    onToggle: () => void;
    tone?: "neutral" | "good" | "warn" | "danger";
    subtitle?: string;
    children: React.ReactNode;
  }) {
    return (
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            width: "100%",
            border: "none",
            background: "#fff",
            color: theme.text,
            padding: "12px 12px",
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
          title="Show/hide section"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ whiteSpace: "nowrap" }}>{title}</div>
            {typeof count === "number" ? <div style={{ color: theme.muted, fontSize: 12, fontWeight: 900 }}>({count})</div> : null}
            {tone ? <StatusPill label={tone === "warn" ? "In progress" : tone === "good" ? "OK" : tone === "danger" ? "Attention" : "—"} tone={tone} /> : null}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{open ? "▾" : "▸"}</div>
        </button>

        {subtitle ? <div style={{ padding: "0 12px 10px", fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>{subtitle}</div> : null}

        {open ? <div style={{ borderTop: `1px solid ${theme.border}`, padding: 12 }}>{children}</div> : null}
      </div>
    );
  }

  function TournamentControlBar() {
    const t = tournament;
    const fmt = t?.format ?? "SINGLES";

    const canLock = !!t && entriesOpen && !busy && !mustSetTargetBeforeLock;
    const canGenTeams = !!t && fmt === "DOUBLES" && !entriesOpen && !busy;
    const canGenMatches = !!t && !entriesOpen && !busy && !hasMatches && (t.format === "SINGLES" || hasTeams);
    const canStart = !!t && t.status === "ANNOUNCED" && !entriesOpen && (fmt !== "DOUBLES" || hasTeams) && !busy;
    const canEnd = !!t && t.status === "IN_PLAY" && !busy;

    const entriesTone = entriesOpen ? "good" : "danger";
    const tourTone = t?.status === "IN_PLAY" ? "warn" : t?.status === "COMPLETED" ? "neutral" : "good";

    const bracketLabel = hasMatches ? "Bracket generated ✓" : fmt === "SINGLES" ? "Generate round 1" : "Generate matches";
    const bracketTitle = entriesOpen
      ? "Lock entries first"
      : !hasTeams
      ? "Generate teams first"
      : hasMatches
      ? "Matches already exist for this tournament"
      : "Generate fixtures";

    return (
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Tournament control</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusPill label={t ? statusLabel(t.status) : "—"} tone={tourTone as any} />
            <StatusPill label={entriesOpen ? "Entries open" : "Entries locked"} tone={entriesTone as any} />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Entrants</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{entryCount}</div>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Teams</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{teams.length}</div>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Matches</div>
              <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{matches.length}</div>
            </div>
          </div>

          {t?.format === "DOUBLES" ? (
            <div style={{ marginTop: 12, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Target team handicap</div>
              <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>Required before locking entries for Doubles.</div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  inputMode="decimal"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e.g. 18"
                  disabled={busy || !entriesOpen}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 900,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !entriesOpen}
                  onClick={suggestTargetFromEntries}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: busy || !entriesOpen ? "not-allowed" : "pointer",
                  }}
                  title={!entriesOpen ? "Entries are locked" : "Suggest from current entrants"}
                >
                  Suggest
                </button>
              </div>

              <button
                type="button"
                disabled={busy || !entriesOpen || !targetValid}
                onClick={saveTarget}
                style={{
                  marginTop: 8,
                  width: "100%",
                  border: "none",
                  background: entriesOpen && targetValid ? theme.maroon : "#9CA3AF",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy || !entriesOpen || !targetValid ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Working..." : "Save target"}
              </button>
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <PrimaryButton
              label={!entriesOpen ? "Entries locked" : "Lock entries"}
              onClick={lockEntries}
              disabled={!canLock}
              variant="outline"
              title={!entriesOpen ? "Entries already locked" : mustSetTargetBeforeLock ? "Set target team handicap first" : "Lock entries"}
            />

            {t?.format === "DOUBLES" ? (
              <PrimaryButton
                label="Generate teams"
                onClick={generateDoublesTeams}
                disabled={!canGenTeams}
                variant="solid"
                title={entriesOpen ? "Lock entries first" : "Generate doubles teams"}
              />
            ) : null}

            <PrimaryButton label={bracketLabel} onClick={generateMatches} disabled={!canGenMatches} variant={hasMatches ? "outline" : "solid"} title={bracketTitle} />

            {t?.status === "ANNOUNCED" ? (
              <PrimaryButton label="Start tournament" onClick={startTournament} disabled={!canStart} variant="solid" title="Move tournament to In-play" />
            ) : null}

            {t?.status === "IN_PLAY" ? <PrimaryButton label="End tournament" onClick={endTournament} disabled={!canEnd} variant="outline" title="Mark tournament as Completed" /> : null}
          </div>
        </div>
      </div>
    );
  }

  function Round1PreviewCard() {
    // Only show once fixtures exist
    if (!matches.length) return null;

    const roundNos = matches
      .map((m) => Number(m.round_no ?? 0))
      .filter((n) => n && !Number.isNaN(n))
      .sort((a, b) => a - b);

    const firstRound = roundNos[0] ?? null;
    if (!firstRound) return null;

    const round1 = matches
      .filter((m) => Number(m.round_no ?? 0) === firstRound)
      .sort((a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id)));

    if (!round1.length) return null;

    const playable = round1.filter((m) => !isMatchBye(m));
    const byes = round1.filter((m) => isMatchBye(m));

    const canEdit = tournament?.status === "ANNOUNCED" && !busy;

    async function saveFixtureEdits() {
      if (!tournamentId || typeof tournamentId !== "string") return;
      if (!canEdit) return;

      const used = new Set<string>();

      for (const m of round1) {
        const d = fixturesDraftByMatchId[m.id] ?? { a: "", b: "" };
        const a = (d.a ?? "").trim();
        const b = (d.b ?? "").trim();

        if (!a) {
          setError("Each match must have Team A set.");
          return;
        }
        if (a && b && a === b) {
          setError("A team cannot play itself.");
          return;
        }
        if (used.has(a)) {
          setError("Each team can only appear once in the round.");
          return;
        }
        used.add(a);
        if (b) {
          if (used.has(b)) {
            setError("Each team can only appear once in the round.");
            return;
          }
          used.add(b);
        }
      }

      setBusy(true);
      setError(null);

      for (const m of round1) {
        const d = fixturesDraftByMatchId[m.id] ?? { a: "", b: "" };
        const a = (d.a ?? "").trim();
        const b = (d.b ?? "").trim();

        const status = b ? "SCHEDULED" : "BYE";

        const up = await supabase
          .from("matches")
          .update({
            team_a_id: a,
            team_b_id: b || null,
            status,
            score_a: null,
            score_b: null,
            confirmed_by_a: false,
            confirmed_by_b: false,
            finalized_by_admin: false,
            finalized_at: null,
            admin_final_by: null,
            admin_final_at: null,
            submitted_by_player_id: null,
            submitted_at: null,
            winner_team_id: null,
          })
          .eq("id", m.id);

        if (up.error) {
          setError(`Could not update match ${m.match_no ?? ""}.\n${up.error.message}`.trim());
          setBusy(false);
          return;
        }
      }

      setFixturesEditOpen(false);
      await load({ preserveScroll: true });
      setBusy(false);
    }

    return (
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{roundLabel(firstRound)} fixtures</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
            {playable.length} matches{byes.length ? ` • ${byes.length} BYE` : ""}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
          <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
            Review fixtures before starting. You can switch to <span style={{ fontWeight: 900, color: theme.text }}>Rounds</span> to manage scoring and admin actions.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setFixturesEditOpen((v) => !v)}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.text,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: canEdit ? "pointer" : "not-allowed",
              }}
              title={canEdit ? "Edit fixtures before starting" : "Start tournament to edit fixtures"}
            >
              {fixturesEditOpen ? "Close fixture editor" : "Edit fixtures"}
            </button>

            {fixturesEditOpen ? (
              <button
                type="button"
                disabled={busy}
                onClick={saveFixtureEdits}
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
              >
                {busy ? "Working..." : "Save fixture edits"}
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {round1.map((m) => {
              const leftName = teamDisplayName(m.team_a_id);
              const rightName = teamDisplayName(m.team_b_id);
              const hc = singlesHandicapInfo(m);
              const leftHC =
                tournament?.format === "SINGLES" && hc ? (hc.ha == null ? "" : ` (HC ${hc.ha})`) : "";
              const rightHC =
                tournament?.format === "SINGLES" && hc ? (hc.hb == null ? "" : ` (HC ${hc.hb})`) : "";

              const isBye = isMatchBye(m);

              return (
                <div key={`r1-prev-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, minWidth: 0 }}>
                      {fixturesEditOpen ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <select
                            value={fixturesDraftByMatchId[m.id]?.a ?? ""}
                            onChange={(e) =>
                              setFixturesDraftByMatchId((p) => ({
                                ...p,
                                [m.id]: { a: e.target.value, b: p[m.id]?.b ?? "" },
                              }))
                            }
                            style={{
                              width: "100%",
                              border: `1px solid ${theme.border}`,
                              borderRadius: 10,
                              padding: "8px 8px",
                              fontWeight: 900,
                            }}
                          >
                            <option value="">Select Team A</option>
                            {teams.map((t) => (
                              <option key={`team-a-${m.id}-${t.id}`} value={t.id}>
                                {tournament?.format === "SINGLES"
                                  ? teamDisplayName(t.id)
                                  : `${teamDisplayName(t.id)} (${teamLabel(t.id)})`}
                              </option>
                            ))}
                          </select>
                          <select
                            value={fixturesDraftByMatchId[m.id]?.b ?? ""}
                            onChange={(e) =>
                              setFixturesDraftByMatchId((p) => ({
                                ...p,
                                [m.id]: { a: p[m.id]?.a ?? "", b: e.target.value },
                              }))
                            }
                            style={{
                              width: "100%",
                              border: `1px solid ${theme.border}`,
                              borderRadius: 10,
                              padding: "8px 8px",
                              fontWeight: 900,
                            }}
                          >
                            <option value="">BYE / empty</option>
                            {teams.map((t) => (
                              <option key={`team-b-${m.id}-${t.id}`} value={t.id}>
                                {tournament?.format === "SINGLES"
                                  ? teamDisplayName(t.id)
                                  : `${teamDisplayName(t.id)} (${teamLabel(t.id)})`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isBye ? `${leftName}${leftHC} — Auto-advance (BYE)` : `${leftName}${leftHC} vs ${rightName}${rightHC}`}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                        {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)}
                      </div>

                      {hc && !isBye && !fixturesEditOpen ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 800, lineHeight: 1.25 }}>
                          {singlesHandicapLine(m)}
                        </div>
                      ) : null}
                    </div>

                    <StatusPill label={isBye ? "BYE" : matchStatusLabel(String(m.status ?? ""))} tone={isBye ? "warn" : "neutral"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function RoundSelector() {
    if (!roundMeta.rounds.length) return null;

    return (
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {roundMeta.rounds.map((r) => {
          const p = roundMeta.byRound[r];
          const done = p?.completed ?? 0;
          const total = p?.total ?? 0;
          const active = (roundMeta.selectedRound ?? roundMeta.rounds[0]) === r;

          return (
            <button
              key={`chip-${r}`}
              type="button"
              onClick={() => selectRound(r)}
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
    );
  }

  function RoundAdminBar() {
    const r = roundMeta.selectedRound;
    if (!r) return null;

    const p = roundMeta.byRound[r];
    const total = p?.total ?? 0;
    const done = p?.completed ?? 0;
    const byesPending = p?.byesPending ?? 0;

    const isComplete = roundMeta.roundIsComplete;

    // Guardrails
    const nextRoundNo = r + 1;
    const nextRoundExists = matches.some((m) => Number(m.round_no ?? 0) === nextRoundNo);
    const latestRound = roundMeta.rounds[roundMeta.rounds.length - 1] ?? r;
    const isLatestRound = r === latestRound;
    const hasIncompleteEarlierRound = roundMeta.rounds.some((rn) => {
      if (rn >= r) return false;
      const meta = roundMeta.byRound[rn];
      if (!meta) return false;
      return meta.total > 0 && (meta.completed < meta.total || meta.byesPending > 0);
    });

    const canAdvance =
      !!tournament &&
      tournament.status !== "COMPLETED" &&
      isLatestRound &&
      !hasIncompleteEarlierRound &&
      !nextRoundExists &&
      !busy;

    const advanceTitle = nextRoundExists
      ? `${roundLabel(nextRoundNo)} fixtures already exist`
      : !tournament
      ? "Tournament not loaded"
      : tournament.status === "COMPLETED"
      ? "Tournament is completed"
      : !isLatestRound
      ? "Only the latest round can be advanced"
      : hasIncompleteEarlierRound
      ? "Finish earlier rounds before advancing"
      : byesPending > 0
      ? "BYEs are being auto-processed"
      : "Advance to the next round";

    const advanceHint = nextRoundExists
      ? `Next round (${roundLabel(nextRoundNo)}) already exists.`
      : tournament?.status === "COMPLETED"
      ? "Tournament is completed."
      : !isLatestRound
      ? "Select the latest round to advance (only one round ahead)."
      : hasIncompleteEarlierRound
      ? "Complete earlier rounds (including Pre-Rd) before advancing."
      : byesPending > 0
      ? "BYEs still pending — auto-processing now."
      : "Advance now (next round will use placeholders if needed).";

    const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
    const scheduledCount = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m) && String(m.status ?? "") === "SCHEDULED").length;

    const withScoresCount = roundMatches.filter((m) => {
      if (isMatchBye(m)) return false;
      if (isMatchDone(m)) return false;
      return m.score_a != null && m.score_b != null;
    }).length;

    // Optional strictness applied: only allow these bulk ops while tournament is IN_PLAY
    const canStartAll = !!tournament && tournament.status === "IN_PLAY" && scheduledCount > 0 && !busy;
    const canCompleteWithScores = !!tournament && tournament.status === "IN_PLAY" && withScoresCount > 0 && !busy;

    return (
      <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{roundLabel(r)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusPill label={isComplete ? "Complete" : "In progress"} tone={isComplete ? "good" : "warn"} />
            <StatusPill label={`${done}/${total} complete${byesPending ? ` • ${byesPending} BYE pending` : ""}`} tone={byesPending ? "warn" : "neutral"} />
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <button
            type="button"
            disabled={!canStartAll}
            onClick={startAllInSelectedRound}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canStartAll ? "pointer" : "not-allowed",
            }}
            title={scheduledCount ? `Start ${scheduledCount} scheduled match(es)` : "No scheduled matches to start"}
          >
            {busy ? "Working..." : `Start all matches${scheduledCount ? ` (${scheduledCount})` : ""}`}
          </button>

          <button
            type="button"
            disabled={!canCompleteWithScores}
            onClick={completeAllWithScoresInSelectedRound}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canCompleteWithScores ? "pointer" : "not-allowed",
            }}
            title={withScoresCount ? `Complete ${withScoresCount} match(es) that already have scores` : "No scored matches to complete"}
          >
            {busy ? "Working..." : `Complete all with scores${withScoresCount ? ` (${withScoresCount})` : ""}`}
          </button>

          <button
            type="button"
            disabled={!canAdvance}
            onClick={advanceSelectedRound}
            style={{
              width: "100%",
              border: "none",
              background: canAdvance ? theme.maroon : "#9CA3AF",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canAdvance ? "pointer" : "not-allowed",
            }}
            title={advanceTitle}
          >
            {busy ? "Working..." : "Advance round"}
          </button>

          {!isLatestRound ? (
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.danger }}>
              Select the latest round to enable advancing.
            </div>
          ) : null}

        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
          {advanceHint} Tip: keep match edits minimal. Use <span style={{ fontWeight: 900, color: theme.text }}>Admin final</span> only if captains can’t resolve.
        </div>
      </div>
    );
  }

  function ControlView() {
    return (
      <>
        <TournamentControlBar />
        <Round1PreviewCard />
      </>
    );
  }
  function RoundsView() {
    const selectedRound = roundMeta.selectedRound;

    const roundMatches = matchesByRound.find((x) => x.round === selectedRound)?.matches ?? (selectedRound == null ? matches : []);

    const playable = roundMatches.filter((m) => !isMatchBye(m));

    const inPlay = playable.filter((m) => String(m.status ?? "") === "IN_PLAY" && !isMatchDone(m));
    const completed = playable.filter((m) => isMatchDone(m));
    const attention = playable.filter((m) => !isMatchDone(m) && String(m.status ?? "") !== "IN_PLAY");
    const attentionList = showProblemsOnly ? attention : attention;
    const inPlayList = showProblemsOnly ? inPlay : inPlay;
    const completedList = showProblemsOnly ? [] : completed;

    function renderBulkRoundScoring() {
      const r = roundMeta.selectedRound;
      if (!r) return null;

      const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
      const editable = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m) && !!m.team_a_id && !!m.team_b_id);

      if (!editable.length) {
        return (
          <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Bulk scoring</div>
            <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No editable matches in this round.</div>
          </div>
        );
      }

      async function saveOnly() {
        setBusy(true);
        setError(null);

        for (const m of editable) {
          const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
          const aRaw = (d.a ?? "").trim();
          const bRaw = (d.b ?? "").trim();
          if (!aRaw || !bRaw) continue; // allow partial saves

          const a = Number(aRaw);
          const b = Number(bRaw);

          if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
            setError("Bulk scoring: scores must be whole numbers >= 0.");
            setBusy(false);
            return;
          }

          const up = await supabase.from("matches").update({ score_a: a, score_b: b }).eq("id", m.id);
          if (up.error) {
            setError(`Could not save score for match ${m.match_no ?? ""}.\n${up.error.message}`.trim());
            setBusy(false);
            return;
          }
        }

        await load({ preserveScroll: true });
        setBusy(false);
      }

      async function finaliseAll() {
        const ok = window.confirm(`Finalise all entered scores for ${roundLabel(r)}?\n\nThis will complete each match and set the winner.`);
        if (!ok) return;

        setBusy(true);
        setError(null);

        for (const m of editable) {
          const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
          const a = Number((d.a ?? "").trim());
          const b = Number((d.b ?? "").trim());

          if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
            setError("Bulk finalise: every match must have valid whole-number scores (>= 0).");
            setBusy(false);
            return;
          }

          try {
            const res = await fetch("/api/tournaments/matches/admin-final", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ match_id: m.id, score_a: a, score_b: b }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
              setError(json?.error ?? `Could not admin-final match ${m.match_no ?? ""}.`);
              setBusy(false);
              return;
            }
          } catch (e: any) {
            setError(e?.message ?? "Network error.");
            setBusy(false);
            return;
          }
        }

        setBulkOpen(false);
        await load({ preserveScroll: true });
        setBusy(false);
      }

      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Bulk scoring • {roundLabel(r)}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{editable.length} matches</div>
          </div>

          <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14, display: "grid", gap: 10 }}>
            {editable.map((m) => {
              const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
              const left = teamDisplayName(m.team_a_id);
              const right = teamDisplayName(m.team_b_id);

              return (
                <div key={`bulk-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.match_no != null ? `Match ${m.match_no} · ` : ""}
                    {left} vs {right}
                  </div>

                  {tournament?.format === "SINGLES" ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 900 }}>
                      {singlesHandicapLine(m)}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 46px 1fr", gap: 8, alignItems: "center" }}>
                    <input
                      inputMode="numeric"
                      value={(d.a ?? "").toString()}
                      onFocus={pinScrollForInput}
                      onBlur={restorePinnedScrollForInput}
                      onChange={(e) => setBulkDraftByMatchId((p) => ({ ...p, [m.id]: { a: e.target.value, b: p[m.id]?.b ?? "" } }))}
                      placeholder="A"
                      disabled={busy}
                      style={{ width: "100%", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 10px", fontWeight: 900 }}
                    />
                    <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
                    <input
                      inputMode="numeric"
                      value={(d.b ?? "").toString()}
                      onFocus={pinScrollForInput}
                      onBlur={restorePinnedScrollForInput}
                      onChange={(e) => setBulkDraftByMatchId((p) => ({ ...p, [m.id]: { a: p[m.id]?.a ?? "", b: e.target.value } }))}
                      placeholder="B"
                      disabled={busy}
                      style={{ width: "100%", border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 10px", fontWeight: 900 }}
                    />
                  </div>
                </div>
              );
            })}

            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                disabled={busy}
                onClick={saveOnly}
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
              >
                {busy ? "Working..." : "Save scores (no finalise)"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={finaliseAll}
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
              >
                {busy ? "Working..." : "Save & finalise all"}
              </button>

              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                Tip: “Save & finalise” completes each match and sets the winner. Use Admin actions per match only when needed.
              </div>
            </div>
          </div>
        </div>
      );
    }

    function renderMatchCard(m: MatchRow) {
      const st = String(m.status ?? "");
      const hasWinner = m.winner_team_id != null && m.winner_team_id !== "";
      const isFinal = bool(m.finalized_by_admin) || st === "COMPLETED" || hasWinner;
      const locked = isFinal;

      const canStart = st === "SCHEDULED" && !locked;
      const canComplete = st === "IN_PLAY" && !locked;

      const confirmedA = bool(m.confirmed_by_a);
      const confirmedB = bool(m.confirmed_by_b);

      const scoreLine = m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;

      const leftName = slotLabel(m, "A");
      const rightName = slotLabel(m, "B");

      const leftHC =
        tournament?.format === "SINGLES"
          ? (() => {
              const pid = m.team_a_id ? (teamMembersByTeamId[m.team_a_id]?.[0] ?? null) : null;
              const h = pid ? (handicapByPlayerId[pid] ?? null) : null;
              return h == null ? "" : ` (HC ${h})`;
            })()
          : "";

      const rightHC =
        tournament?.format === "SINGLES"
          ? (() => {
              const pid = m.team_b_id ? (teamMembersByTeamId[m.team_b_id]?.[0] ?? null) : null;
              const h = pid ? (handicapByPlayerId[pid] ?? null) : null;
              return h == null ? "" : ` (HC ${h})`;
            })()
          : "";

      const headerTitle = isMatchBye(m) ? `${leftName}${leftHC} — BYE` : `${leftName}${leftHC} vs ${rightName}${rightHC}`;

      const needsAdmin = !locked && (m.score_a == null || m.score_b == null || !(confirmedA && confirmedB));

      const statusTone = locked
        ? "complete"
        : st === "IN_PLAY"
        ? "inplay"
        : "pending";

      const cardBorder =
        statusTone === "complete" ? "#16A34A" : statusTone === "inplay" ? "#FACC15" : theme.border;
      const cardBg =
        statusTone === "complete" ? "#F0FDF4" : statusTone === "inplay" ? "#FEFCE8" : "#fff";

      return (
        <div
          key={m.id}
          style={{
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            background: cardBg,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14, minWidth: 0 }}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={headerTitle}>
                  {headerTitle}
                </div>
              </div>

              <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)}
                {tournament?.format === "SINGLES"
                  ? ""
                  : m.team_a_id && m.team_b_id
                  ? ` • ${teamLabel(m.team_a_id)} • ${teamLabel(m.team_b_id)}`
                  : ""}
              </div>

              {tournament?.format === "SINGLES" && !isMatchBye(m) ? (
                <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, fontWeight: 900, lineHeight: 1.25 }}>
                  {singlesHandicapLine(m)}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <StatusPill label={matchStatusLabel(st)} tone={locked ? "good" : st === "IN_PLAY" ? "warn" : "neutral"} />

              {canStart ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateMatchStatus(m.id, "IN_PLAY")}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Start
                </button>
              ) : null}

              {canComplete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateMatchStatus(m.id, "COMPLETED")}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Complete
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
            >
              Score: {scoreLine}
            </div>

            {locked ? <StatusPill label="Locked" tone="neutral" /> : needsAdmin ? <StatusPill label="Needs attention" tone="warn" /> : null}
          </div>

          {!locked && !isMatchBye(m) ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 46px 1fr", gap: 8, alignItems: "center" }}>
                <input
                  inputMode="numeric"
                  value={(scoreDraftByMatchId[m.id]?.a ?? (m.score_a == null ? "" : String(m.score_a))).toString()}
                  onFocus={pinScrollForInput}
                  onBlur={restorePinnedScrollForInput}
                  onChange={(e) =>
                    setScoreDraftByMatchId((p) => ({
                      ...p,
                      [m.id]: { a: e.target.value, b: p[m.id]?.b ?? (m.score_b == null ? "" : String(m.score_b)) },
                    }))
                  }
                  placeholder="A"
                  disabled={busy}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 10px",
                    fontWeight: 900,
                  }}
                />
                <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
                <input
                  inputMode="numeric"
                  value={(scoreDraftByMatchId[m.id]?.b ?? (m.score_b == null ? "" : String(m.score_b))).toString()}
                  onFocus={pinScrollForInput}
                  onBlur={restorePinnedScrollForInput}
                  onChange={(e) =>
                    setScoreDraftByMatchId((p) => ({
                      ...p,
                      [m.id]: { a: p[m.id]?.a ?? (m.score_a == null ? "" : String(m.score_a)), b: e.target.value },
                    }))
                  }
                  placeholder="B"
                  disabled={busy}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 10px",
                    fontWeight: 900,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => adminFinalScore(m.id)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  border: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
                title="Finalise this match with the scores entered above"
              >
                Finalise match
              </button>

              <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                This uses Admin final to complete the match quickly. Captains can still submit normally.
              </div>
            </div>
          ) : null}

          {!locked ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAdminFinalOpenByMatchId((p) => ({ ...p, [m.id]: !p[m.id] }));
                }}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>Admin actions</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{adminFinalOpenByMatchId[m.id] ? "▾" : "▸"}</div>
              </button>

              {adminFinalOpenByMatchId[m.id] ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                    Use admin final if captains can’t resolve. This completes the match.
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 900 }}>
                    Confirmed: A {confirmedA ? "✓" : "—"} • B {confirmedB ? "✓" : "—"}
                    {bool(m.finalized_by_admin) ? <span style={{ marginLeft: 8, color: theme.danger }}>Admin final</span> : null}
                  </div>

                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 8, alignItems: "center" }}>
                    <input
                      inputMode="numeric"
                      value={(scoreDraftByMatchId[m.id]?.a ?? "").toString()}
                      onFocus={pinScrollForInput}
                      onBlur={restorePinnedScrollForInput}
                      onChange={(e) =>
                        setScoreDraftByMatchId((p) => ({
                          ...p,
                          [m.id]: { a: e.target.value, b: p[m.id]?.b ?? "" },
                        }))
                      }
                      placeholder="A"
                      disabled={busy}
                      style={{
                        width: "100%",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: "10px 10px",
                        fontWeight: 900,
                      }}
                    />
                    <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
                    <input
                      inputMode="numeric"
                      value={(scoreDraftByMatchId[m.id]?.b ?? "").toString()}
                      onFocus={pinScrollForInput}
                      onBlur={restorePinnedScrollForInput}
                      onChange={(e) =>
                        setScoreDraftByMatchId((p) => ({
                          ...p,
                          [m.id]: { a: p[m.id]?.a ?? "", b: e.target.value },
                        }))
                      }
                      placeholder="B"
                      disabled={busy}
                      style={{
                        width: "100%",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: "10px 10px",
                        fontWeight: 900,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => adminFinalScore(m.id)}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      background: "#fff",
                      color: theme.danger,
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? "Working..." : "Admin final & complete"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
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

      const selected = roundMeta.selectedRound;
      const roundsToShow = selected
        ? matchesByRound.filter((r) => r.round >= selected)
        : matchesByRound;

      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>
              Show rounds from
            </div>
            <RoundSelector />
          </div>

          <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              Bracket view{selected ? ` • from ${roundLabel(selected)}` : ""}
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
              {roundsToShow.reduce((acc, r) => acc + (r.matches?.length ?? 0), 0)} matches
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${theme.border}`,
              padding: 14,
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "minmax(220px, 1fr)",
              gap: 12,
              overflowX: "auto",
            }}
          >
            {roundsToShow.map((round) => {
              const list = [...(round.matches ?? [])].sort(
                (a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id))
              );
              const meta = roundMeta.byRound[round.round];
              const total = meta?.total ?? list.length;
              const completed = meta?.completed ?? 0;
              const focused = selected ? round.round === selected : true;

              return (
                <div
                  key={`tree-round-${round.round}`}
                  ref={(el) => {
                    treeRoundRefs.current[round.round] = el;
                  }}
                  style={{
                    display: "grid",
                    gap: 10,
                    alignContent: "start",
                    opacity: focused ? 1 : 0.5,
                    transform: focused ? "scale(1)" : "scale(0.98)",
                    transition: "opacity 160ms ease, transform 160ms ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: theme.text }}>{roundLabel(round.round)}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted }}>
                      {completed}/{total}
                    </div>
                  </div>

                  {list.map((m) => {
                    const left = slotLabel(m, "A");
                    const right = slotLabel(m, "B");
                    const score = m.score_a == null || m.score_b == null ? "-" : `${m.score_a}-${m.score_b}`;
                    const winnerId = m.winner_team_id ? String(m.winner_team_id) : null;
                    const winnerName = winnerId ? teamDisplayName(winnerId) : null;
                    const isBye = isMatchBye(m);
                    const winA = winnerId && m.team_a_id && winnerId === String(m.team_a_id);
                    const winB = winnerId && m.team_b_id && winnerId === String(m.team_b_id);
                    const done = isMatchDone(m);

                    return (
                      <div
                        key={`tree-${m.id}`}
                        style={{
                          border: `1px solid ${done ? "#16A34A" : String(m.status ?? "") === "IN_PLAY" ? "#FACC15" : theme.border}`,
                          borderRadius: 12,
                          padding: 10,
                          background: done ? "#F0FDF4" : String(m.status ?? "") === "IN_PLAY" ? "#FEFCE8" : "#fff",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                          {m.match_no != null ? `Match ${m.match_no}` : "Match"}
                        </div>
                        <div style={{ marginTop: 4, fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isBye ? (
                            `${left} - BYE`
                          ) : (
                            <>
                              <span style={{ color: winA ? "#16A34A" : theme.text }}>{left}</span>{" "}
                              <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                              <span style={{ color: winB ? "#16A34A" : theme.text }}>{right}</span>
                            </>
                          )}
                        </div>

                        {tournament?.format === "SINGLES" && !isBye ? (
                          <div style={{ marginTop: 6, fontSize: 11, color: theme.muted, fontWeight: 800 }}>{singlesHandicapLine(m)}</div>
                        ) : null}

                        <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                          {matchStatusLabel(String(m.status ?? ""))} - {score}
                        </div>
                        {winnerName ? (
                          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 900, color: theme.maroon }}>Winner: {winnerName}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <>
        <div style={{ marginTop: 14 }}>
          <RoundSelector />
          <RoundAdminBar />

          {roundMeta.roundIsComplete ? (
            <div
              style={{
                marginTop: 10,
                background: "#fff",
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: 12,
                fontWeight: 900,
              }}
            >
              ✅ Round complete. You can advance to the next round.
            </div>
          ) : null}

          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setRoundsViewMode((v) => (v === "LIST" ? "TREE" : "LIST"))}
              style={{
                border: `1px solid ${theme.border}`,
                background: roundsViewMode === "TREE" ? theme.maroon : "#fff",
                color: roundsViewMode === "TREE" ? "#fff" : theme.text,
                padding: "8px 10px",
                borderRadius: 999,
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {roundsViewMode === "TREE" ? "Tree view on" : "Tree view"}
            </button>

            {roundsViewMode === "LIST" ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowProblemsOnly((v) => !v)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: showProblemsOnly ? theme.maroon : "#fff",
                    color: showProblemsOnly ? "#fff" : theme.text,
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title="Show only matches that still need action"
                >
                  {showProblemsOnly ? "Showing problems only" : "Show problems only"}
                </button>

                <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Tip: problems = not done + not BYE</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Tree view is read-only.</div>
            )}
          </div>

          {roundsViewMode === "LIST" ? (
            <>
              <button
                type="button"
                disabled={!tournament || tournament.status === "COMPLETED" || busy || !roundMeta.selectedRound}
                onClick={() => {
                  const r = roundMeta.selectedRound;
                  if (!r) return;

                  const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
                  const playable = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m));

                  const next: Record<string, { a: string; b: string }> = {};
                  for (const m of playable) {
                    next[m.id] = {
                      a: m.score_a == null ? "" : String(m.score_a),
                      b: m.score_b == null ? "" : String(m.score_b),
                    };
                  }
                  setBulkDraftByMatchId(next);
                  setBulkOpen((v) => !v);
                }}
                style={{
                  marginTop: 10,
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: !tournament || tournament.status === "COMPLETED" || busy || !roundMeta.selectedRound ? "not-allowed" : "pointer",
                }}
                title="Enter many scores at once for this round"
              >
                {bulkOpen ? "Close bulk scoring" : "Bulk score this round"}
              </button>

              {bulkOpen ? renderBulkRoundScoring() : null}
            </>
          ) : null}
        </div>

        {roundsViewMode === "TREE" ? (
          renderTreeView()
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {SectionCard({
              title: "Needs attention",
              count: attentionList.length,
              open: attentionOpen,
              onToggle: () => setAttentionOpen((v) => !v),
              tone: attentionList.length ? "warn" : "good",
              children: attentionList.length ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {attentionList.map((m) => renderMatchCard(m))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>Nothing needs attention right now.</div>
              ),
            })}

            {SectionCard({
              title: "In play",
              count: inPlayList.length,
              open: inPlayOpen,
              onToggle: () => setInPlayOpen((v) => !v),
              tone: inPlayList.length ? "warn" : "neutral",
              children: inPlayList.length ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {inPlayList.map((m) => renderMatchCard(m))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No matches in progress.</div>
              ),
            })}

            {SectionCard({
              title: "Completed",
              count: completedList.length,
              open: completedOpen,
              onToggle: () => setCompletedOpen((v) => !v),
              tone: completedList.length ? "good" : "neutral",
              children: completedList.length ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {completedList.map((m) => renderMatchCard(m))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No completed matches yet.</div>
              ),
            })}
          </div>
        )}
      </>
    );
  }
  function AuditView() {
    if (!matches.length) {
      return (
        <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
          <div style={{ marginTop: 6, color: theme.muted, fontSize: 13, lineHeight: 1.35 }}>No matches yet.</div>
        </div>
      );
    }

    // Completed/finalised matches (include BYEs once processed/finalised)
    const done = matches
      .filter((m) => isMatchDone(m))
      .sort(
        (a, b) =>
          Number(a.round_no ?? 0) - Number(b.round_no ?? 0) ||
          Number(a.match_no ?? 0) - Number(b.match_no ?? 0) ||
          String(a.id).localeCompare(String(b.id))
      );

    if (!done.length) {
      return (
        <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
          <div style={{ marginTop: 6, color: theme.muted, fontSize: 13, lineHeight: 1.35 }}>
            No completed matches yet. Completed / admin-finalled matches will appear here automatically.
          </div>
        </div>
      );
    }

    const byRound: Record<number, MatchRow[]> = {};
    for (const m of done) {
      const rn = Number(m.round_no ?? 0);
      const key = rn || 0;
      byRound[key] = byRound[key] ?? [];
      byRound[key].push(m);
    }

    const rounds = Object.keys(byRound)
      .map((n) => Number(n))
      .sort((a, b) => a - b);

    // Try infer "current winner" if there's exactly one non-BYE winner in the latest round
    const latestRound = rounds[rounds.length - 1] ?? null;
    const latestDone = latestRound != null ? byRound[latestRound] ?? [] : [];
    const latestWinners = latestDone
      .map((m) => m.winner_team_id)
      .filter((x) => x != null && x !== "")
      .map((x) => String(x));

    const uniqLatestWinners = Array.from(new Set(latestWinners));
    const inferredWinnerTeamId = uniqLatestWinners.length === 1 ? uniqLatestWinners[0] : null;
    const inferredWinnerName = inferredWinnerTeamId ? teamDisplayName(inferredWinnerTeamId) : null;

    function auditLine(m: MatchRow) {
      const left = teamDisplayName(m.team_a_id);
      const right = teamDisplayName(m.team_b_id);

      const isBye = isMatchBye(m);
      const score = m.score_a == null || m.score_b == null ? "-" : `${m.score_a}-${m.score_b}`;

      const winnerId = m.winner_team_id ? String(m.winner_team_id) : null;
      const winA = winnerId && m.team_a_id && String(m.team_a_id) === winnerId;
      const winB = winnerId && m.team_b_id && String(m.team_b_id) === winnerId;

      const baseTitle = isBye ? `${left} — BYE` : `${left} vs ${right}`;

      const winnerName = winnerId ? teamDisplayName(winnerId) : null;

      const winnerTag = winnerName ? ` • Winner: ${winnerName}` : "";

      const adminFinalTag = bool(m.finalized_by_admin) ? " • Admin final" : "";

      const editOpen = auditEditOpenByMatchId[m.id] === true;

      return (
        <div key={`audit-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={baseTitle}>
                {isBye ? (
                  baseTitle
                ) : (
                  <>
                    <span style={{ color: winA ? "#16A34A" : theme.text }}>{left}</span>{" "}
                    <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                    <span style={{ color: winB ? "#16A34A" : theme.text }}>{right}</span>
                  </>
                )}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)} • Score: {score}
                {winnerTag}
                {adminFinalTag}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusPill label={isBye ? "BYE" : "Completed"} tone={isBye ? "warn" : "good"} />
              {!isBye ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAuditEditOpenByMatchId((p) => ({ ...p, [m.id]: !p[m.id] }))}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {editOpen ? "Close edit" : "Edit score"}
                </button>
              ) : null}
            </div>
          </div>

          {editOpen && !isBye ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                Edit the final score. This will re-finalise the match and update any linked next-round slots.
              </div>

              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 8, alignItems: "center" }}>
                <input
                  inputMode="numeric"
                  value={(scoreDraftByMatchId[m.id]?.a ?? "").toString()}
                  onFocus={pinScrollForInput}
                  onBlur={restorePinnedScrollForInput}
                  onChange={(e) =>
                    setScoreDraftByMatchId((p) => ({
                      ...p,
                      [m.id]: { a: e.target.value, b: p[m.id]?.b ?? "" },
                    }))
                  }
                  placeholder="A"
                  disabled={busy}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 10px",
                    fontWeight: 900,
                  }}
                />
                <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
                <input
                  inputMode="numeric"
                  value={(scoreDraftByMatchId[m.id]?.b ?? "").toString()}
                  onFocus={pinScrollForInput}
                  onBlur={restorePinnedScrollForInput}
                  onChange={(e) =>
                    setScoreDraftByMatchId((p) => ({
                      ...p,
                      [m.id]: { a: p[m.id]?.a ?? "", b: e.target.value },
                    }))
                  }
                  placeholder="B"
                  disabled={busy}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 10px",
                    fontWeight: 900,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => adminFinalScore(m.id)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.danger,
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Working..." : "Save edited score"}
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{done.length} completed</div>
          </div>

          {inferredWinnerName ? (
            <div style={{ marginTop: 8, fontSize: 13, color: theme.text, fontWeight: 900 }}>
              Current leader (inferred): <span style={{ color: theme.maroon }}>{inferredWinnerName}</span>
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
              Completed matches are listed below. Winner will show automatically once a single winner emerges in the latest round.
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {rounds.map((r) => {
            const list = byRound[r] ?? [];
            const isOpen = auditOpenByRound[r] === true;
            return (
              <div key={`audit-round-${r}`} style={{ background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setAuditOpenByRound((p) => ({ ...p, [r]: !p[r] }))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "none",
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "baseline",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{roundLabel(r)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{list.length}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{isOpen ? "▾" : "▸"}</div>
                  </div>
                </button>
                {isOpen ? (
                  <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14, display: "grid", gap: 10 }}>
                    {list.map((m) => auditLine(m))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {tournament?.name ?? "Admin • Tournament"}
            </div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 1.25 }}>
              {loading
                ? "Loading..."
                : tournament
                ? `${scopeLabel(tournament.scope)} • ${formatLabel(tournament.format)} • ${statusLabel(tournament.status)}`
                : accessDenied
                ? "No access"
                : isAdmin
                ? "-"
                : "Checking access..."}
            </div>
          </div>

          <button
            onClick={() => load({ preserveScroll: true })}
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
            ↻
          </button>
        </div>

        {/* Back + More */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={goBack}
            style={{
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "9px 10px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
            title="Back to admin tournaments"
          >
            ← Admin tournaments
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            style={{
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "9px 10px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="More actions"
          >
            ⋯
          </button>
        </div>

        {moreOpen ? (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={openPlayerView}
              disabled={!tournamentId || typeof tournamentId !== "string"}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.text,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: !tournamentId || typeof tournamentId !== "string" ? "not-allowed" : "pointer",
              }}
            >
              Player →
            </button>

            <button
              type="button"
              disabled={busy || !tournament || tournament.status !== "ANNOUNCED"}
              onClick={cancelTournament}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: busy || !tournament || tournament.status !== "ANNOUNCED" ? "#F3F4F6" : "#fff",
                color: busy || !tournament || tournament.status !== "ANNOUNCED" ? theme.muted : theme.danger,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy || !tournament || tournament.status !== "ANNOUNCED" ? "not-allowed" : "pointer",
              }}
              title={
                !tournament
                  ? "Cancel tournament"
                  : tournament.status !== "ANNOUNCED"
                  ? "Cancel is only available while tournament is Upcoming"
                  : "Cancel tournament"
              }
            >
              Cancel tournament
            </button>
          </div>
        ) : null}

        {/* Tabs */}
        <SegmentedTabs />

        {/* Error */}
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

        {/* Access denied */}
        {!loading && accessDenied ? (
          <div
            style={{
              marginTop: 14,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
              color: theme.muted,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            You don't have admin access for this page.
          </div>
        ) : null}

        {/* Main content */}
        {isAdmin && !accessDenied ? (
          loading ? (
            <div
              style={{
                marginTop: 14,
                background: "#fff",
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: 14,
                color: theme.muted,
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              Loading tournament...
            </div>
          ) : viewTab === "CONTROL" ? (
            ControlView()
          ) : viewTab === "ROUNDS" ? (
            RoundsView()
          ) : (
            AuditView()
          )
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
