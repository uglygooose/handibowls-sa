// app/admin/tournaments/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import { adminGate } from "@/lib/auth/adminGate";
import { deriveTournamentCompletion } from "@/lib/tournaments/deriveTournamentCompletion";
import {
  cleanTournamentName,
  formatLabel,
  scopeLabel,
  statusLabel,
  type TournamentFormat,
  type TournamentRule,
  type TournamentScope,
  type TournamentStatus,
} from "@/lib/tournaments/labels";
import {
  isMatchBye,
  isMatchDone,
} from "@/lib/tournaments/match";
import { roundLabel as libRoundLabel } from "@/lib/tournaments/bracket";
import { singlesHandicapLine as libSinglesHandicapLine } from "@/lib/tournaments/handicap";
import {
  slotLabel as libSlotLabel,
  slotMembersLine as libSlotMembersLine,
  teamDisplayName as libTeamDisplayName,
  teamLabel as libTeamLabel,
  teamMembersLine as libTeamMembersLine,
  winnerLabelForMatch as libWinnerLabelForMatch,
} from "@/lib/tournaments/teams";
import BottomNav from "../../../components/BottomNav";
import { singlesHandicapInfo as computeSinglesHandicapInfo } from "./utils/matchHelpers";
import type { SinglesHandicapInfo } from "./utils/matchHelpers";
import AuditView from "./views/AuditView";
import ControlView from "./views/ControlView";
import RoundsView from "./views/RoundsView";

type MatchStatus = "OPEN" | "FINAL" | "SCHEDULED" | "IN_PLAY" | "COMPLETED" | "BYE";

export type TournamentRow = {
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
  rule_type?: TournamentRule | null;
};

export type TeamRow = { id: string; team_no: number; team_handicap: number | null };

export type QuickTournament = {
  id: string;
  name: string;
  scope: TournamentScope;
  status: TournamentStatus;
  gender?: "MALE" | "FEMALE" | null;
};

export type MatchRow = {
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

export type Labelers = {
  teamLabel: (teamId: string | null) => string;
  teamDisplayName: (teamId: string | null) => string;
  teamMembersLine: (teamId: string | null) => string;
  slotLabel: (m: MatchRow, side: "A" | "B") => string;
  slotMembersLine: (m: MatchRow, side: "A" | "B") => string;
  roundLabel: (roundNo: number | null | undefined) => string;
  singlesHandicapLine: (m: MatchRow) => string | null;
  singlesHandicapInfo: (m: MatchRow) => SinglesHandicapInfo | null;
  isHandicapTournament: () => boolean;
};

export type ScrollHelpers = {
  pinScrollForInput: () => void;
  restorePinnedScrollForInput: () => void;
};

export type RoundMetaEntry = { total: number; completed: number; byes: number; byesPending: number; hasAny: boolean };
export type RoundMeta = {
  byRound: Record<number, RoundMetaEntry>;
  rounds: number[];
  selectedRound: number | null;
  roundIsComplete: boolean;
};

type TournamentScopeClubRow = { club_id?: string | null; scope?: string | null };
type ParamsWithId = { id?: string | string[] | null };
type RawQuickTournamentRow = {
  id: string | number;
  name?: string | null;
  scope?: string | null;
  status?: string | null;
  gender?: string | null;
};
type RawTeamRow = {
  id?: string | number | null;
  team_no?: number | string | null;
  team_handicap?: number | string | null;
};
type RawTeamMemberRow = { team_id?: string | number | null; player_id?: string | number | null };
type PlayerDetailRow = { id?: string | number | null; display_name?: string | null; handicap?: number | string | null };
type PlayerIdFKRow = { player_id?: string | number | null };
type PlayerHandicapRow = { handicap?: number | string | null };
type RawMatchRow = {
  id: string | number;
  tournament_id?: string | number | null;
  team_a_id?: string | number | null;
  team_b_id?: string | number | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | number | null;
  slot_b_source_type?: string | null;
  slot_b_source_match_id?: string | number | null;
  round_no?: number | string | null;
  match_no?: number | string | null;
  status?: string | null;
  score_a?: number | string | null;
  score_b?: number | string | null;
  submitted_by_player_id?: string | number | null;
  submitted_at?: string | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
  finalized_by_admin?: boolean | null;
  finalized_at?: string | null;
  admin_final_by?: string | number | null;
  admin_final_at?: string | null;
  winner_team_id?: string | number | null;
};

export default function AdminTournamentDetailPage() {
  const supabase = createClient();
  const params = useParams();

  const rawId = (params as ParamsWithId | null)?.id;
  const tournamentId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminClubId, setAdminClubId] = useState<string | null>(null);

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
  const [quickTournaments, setQuickTournaments] = useState<QuickTournament[]>([]);

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

  // if we never remembered scroll, do NOT "restore" to 0 (that causes the snap-to-top).
  function restoreScroll() {
    const y = scrollYBeforeAction.current || 0;
    if (!y) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  function goBack() {
    window.location.href = "/admin/tournaments";
  }

  function openPlayerView() {
    if (!tournamentId || typeof tournamentId !== "string") return;
    window.location.href = `/tournaments/${tournamentId}`;
  }

  async function runAdminGate(): Promise<
    | { ok: true; isSuperAdmin: boolean; adminClubId: string | null }
    | { ok: false; isSuperAdmin: false; adminClubId: null }
  > {
    setAccessDenied(false);
    const gate = await adminGate(supabase);
    if (!gate.ok) {
      if (gate.reason === "NOT_AUTHENTICATED") {
        window.location.href = "/login";
        return { ok: false, isSuperAdmin: false, adminClubId: null };
      }
      if (gate.reason === "PROFILE_ERROR") {
        setError(`Could not verify admin access.\n${gate.message ?? ""}`);
      }
      setIsAdmin(false);
      setAccessDenied(true);
      return { ok: false, isSuperAdmin: false, adminClubId: null };
    }
    setIsSuperAdmin(gate.isSuperAdmin);
    setAdminClubId(gate.adminClubId);
    setIsAdmin(true);
    return { ok: true, isSuperAdmin: gate.isSuperAdmin, adminClubId: gate.adminClubId };
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

    const gate = await runAdminGate();
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
      .select("id, name, scope, format, status, announced_at, starts_at, ends_at, entries_open, locked_at, target_team_handicap, rule_type, club_id")
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
    if (!gate.isSuperAdmin) {
      const tScopeRow = tRes.data as TournamentScopeClubRow | null;
      const cid = String(tScopeRow?.club_id ?? "");
      if (!gate.adminClubId || !cid || cid !== gate.adminClubId || String(tScopeRow?.scope ?? "") !== "CLUB") {
        setError("You do not have access to this tournament.");
        setTournament(null);
        setAccessDenied(true);
        setLoading(false);
        return;
      }
    }
    setTournament(tRow);

    setTargetInput(tRow.target_team_handicap == null ? "" : String(tRow.target_team_handicap));

    const quickQuery = supabase
      .from("tournaments")
      .select("id, name, scope, status, gender, starts_at, announced_at, club_id")
      .eq("scope", "CLUB")
      .eq("status", "IN_PLAY")
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("announced_at", { ascending: true })
      .limit(10);
    const quickRes = gate.adminClubId ? await quickQuery.eq("club_id", gate.adminClubId) : await quickQuery;

    if (!quickRes.error) {
      const list = ((quickRes.data ?? []) as RawQuickTournamentRow[]).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? "Tournament"),
        scope: String(r.scope ?? "CLUB") as TournamentScope,
        status: String(r.status ?? "ANNOUNCED") as TournamentStatus,
        gender: (r.gender ?? null) as "MALE" | "FEMALE" | null,
      }));
      setQuickTournaments(list);
    }

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
      const teamRows = ((teamRes.data ?? []) as RawTeamRow[]).map((r) => ({
        id: String(r.id ?? ""),
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

          for (const r of ((memRes.data ?? []) as RawTeamMemberRow[])) {
            const teamId = String(r.team_id ?? "");
            const pid = String(r.player_id ?? "");
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

              for (const p of ((pRes.data ?? []) as PlayerDetailRow[])) {
                const pid = String(p.id ?? "");
                nameByPlayer[pid] = String(p.display_name ?? "Unknown");

                const h = p.handicap;
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
      const ms = ((mRes.data ?? []) as RawMatchRow[]).map((r) => ({
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
      const fullRoundNos = Array.from(
        new Set(
          ms
            .filter((m) => !isMatchBye(m) && !!m.team_a_id && !!m.team_b_id)
            .map((m) => Number(m.round_no ?? 0))
            .filter((n) => n && !Number.isNaN(n))
        )
      ).sort((a, b) => a - b);

      const latest = roundNos[roundNos.length - 1] ?? null;
      const latestFull = fullRoundNos[fullRoundNos.length - 1] ?? null;

      const nextSelected = selectedRound ?? latestFull ?? latest;
      setSelectedRound(nextSelected);

      if (tRow.status === "COMPLETED") {
        setViewTab(ms.length ? "ROUNDS" : "CONTROL");
        setRoundsViewMode("TREE");
      } else if (tRow.status === "ANNOUNCED") setViewTab("CONTROL");
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

  const teamLabel = (teamId: string | null) => libTeamLabel(teamId, teamById);

  const isHandicapTournament = () => tournament?.rule_type !== "SCRATCH";

  const teamDisplayName = (teamId: string | null) =>
    libTeamDisplayName({
      teamId,
      format: tournament?.format ?? null,
      teamMembersByTeamId,
      teamById,
      nameByPlayerId,
      handicapByPlayerId,
      isHandicapTournament: isHandicapTournament(),
    });

  const teamMembersLine = (teamId: string | null) =>
    libTeamMembersLine({
      teamId,
      teamMembersByTeamId,
      nameByPlayerId,
      handicapByPlayerId,
      isHandicapTournament: isHandicapTournament(),
    });

  const winnerLabelForMatch = (matchId: string | null | undefined) =>
    libWinnerLabelForMatch(matchId ?? null, matchNoById);

  const slotLabel = (m: MatchRow, side: "A" | "B") =>
    libSlotLabel({
      teamId: side === "A" ? m.team_a_id : m.team_b_id,
      sourceType: side === "A" ? m.slot_a_source_type ?? null : m.slot_b_source_type ?? null,
      sourceMatchId: side === "A" ? m.slot_a_source_match_id ?? null : m.slot_b_source_match_id ?? null,
      format: tournament?.format ?? null,
      teamMembersByTeamId,
      teamById,
      nameByPlayerId,
      handicapByPlayerId,
      isHandicapTournament: isHandicapTournament(),
      matchNoById,
    });

  const slotMembersLine = (m: MatchRow, side: "A" | "B") =>
    libSlotMembersLine({
      teamId: side === "A" ? m.team_a_id : m.team_b_id,
      sourceType: side === "A" ? m.slot_a_source_type ?? null : m.slot_b_source_type ?? null,
      sourceMatchId: side === "A" ? m.slot_a_source_match_id ?? null : m.slot_b_source_match_id ?? null,
      teamMembersByTeamId,
      nameByPlayerId,
      handicapByPlayerId,
      isHandicapTournament: isHandicapTournament(),
    });

  const roundLabel = (roundNo: number | null | undefined) =>
    libRoundLabel({
      totalTeams:
        teams.length > 0
          ? teams.length
          : tournament?.format === "SINGLES" && entryCount > 0
          ? entryCount
          : 0,
      roundNo: roundNo ?? null,
    });

  const singlesHandicapInfo = (m: MatchRow) =>
    computeSinglesHandicapInfo({
      format: tournament?.format ?? null,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
      teamMembersByTeamId,
      handicapByPlayerId,
      teamDisplayName,
    });

  const singlesHandicapLine = (m: MatchRow) =>
    libSinglesHandicapLine(
      {
        format: tournament?.format ?? null,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        teamMembersByTeamId,
        handicapByPlayerId,
        nameByPlayerId,
      },
      tournament?.rule_type ?? null
    );

  function selectRound(r: number) {
    setSelectedRound(r);
    setBulkOpen(false);
    setBulkDraftByMatchId({});
  }

  const maxFullRound = useMemo(() => {
    const rounds = matches
      .filter((m) => {
        const rn = Number(m?.round_no ?? 0);
        if (!rn) return false;
        if (isMatchBye(m)) return false;
        return !!m.team_a_id && !!m.team_b_id;
      })
      .map((m) => Number(m.round_no ?? 0))
      .filter((n) => n && !Number.isNaN(n));

    return rounds.length ? Math.max(...rounds) : null;
  }, [matches]);

  const matchesForUi = useMemo(() => {
    if (maxFullRound == null) return matches;
    return matches.filter((m) => {
      const rn = Number(m?.round_no ?? 0);
      if (!rn) return true;
      return rn <= maxFullRound;
    });
  }, [matches, maxFullRound]);

  const matchesByRound = useMemo(() => {
    const map: Record<number, MatchRow[]> = {};
    for (const m of matchesForUi) {
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
  }, [matchesForUi]);

  const derived = useMemo(() => {
    return deriveTournamentCompletion(matchesForUi);
  }, [matchesForUi]);

  const inferredCompleted = derived.completed;
  const maxPlayableRound = maxFullRound ?? derived.maxPlayableRound;

  const roundMeta = useMemo(() => {
    const byRound: Record<number, { total: number; completed: number; byes: number; byesPending: number; hasAny: boolean }> = {};
    for (const m of matchesForUi) {
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

    const selected = selectedRound ?? (rounds[rounds.length - 1] ?? null);
    const cur = selected ? byRound[selected] : null;

    const roundIsComplete = !!selected && !!cur && cur.total > 0 && cur.completed >= cur.total && cur.byesPending === 0;

    return { byRound, rounds, selectedRound: selected, roundIsComplete };
  }, [matchesForUi, selectedRound]);

  const treeRoundsToShow = useMemo(() => {
    const selected = roundMeta.selectedRound;
    return selected ? matchesByRound.filter((r) => r.round >= selected) : matchesByRound;
  }, [matchesByRound, roundMeta.selectedRound]);

  const treeRoundsDisplay = useMemo(() => {
    return treeRoundsToShow.filter((r) => roundLabel(r.round) !== "Pre-Rd");
  }, [treeRoundsToShow, teams, entryCount, tournament?.format]);


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

    const playerIds = Array.from(new Set(((res.data ?? []) as PlayerIdFKRow[]).map((r) => String(r.player_id ?? "")).filter(Boolean)));

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

    const hs = ((pRes.data ?? []) as PlayerHandicapRow[])
      .map((p) => (typeof p.handicap === "number" ? Number(p.handicap) : p.handicap != null ? Number(p.handicap) : null))
      .filter((v): v is number => v !== null && !Number.isNaN(v));

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

    const ok = window.confirm(`Complete tournament?\n\nTournament: ${tournament.name}\n\nThis will mark it as Completed and publish the winner.`);
    if (!ok) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not complete tournament.");
        setBusy(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
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

    const draft = scoreDraftByMatchId[matchId] ?? { a: "", b: "" };

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

      await load({ preserveScroll: true });
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
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

    try {
      const res = await fetch("/api/tournaments/matches/admin-final/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: tournamentId,
          matches: eligible.map((m) => ({ match_id: m.id, score_a: m.score_a, score_b: m.score_b })),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not complete matches.");
        setBusy(false);
        restoreScroll();
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
      restoreScroll();
      return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
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

  const labelers: Labelers = {
    teamLabel,
    teamDisplayName,
    teamMembersLine,
    slotLabel,
    slotMembersLine,
    roundLabel,
    singlesHandicapLine,
    singlesHandicapInfo,
    isHandicapTournament,
  };

  const scrollHelpers: ScrollHelpers = {
    pinScrollForInput,
    restorePinnedScrollForInput,
  };

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {tournament?.name ? cleanTournamentName(tournament.name) : "Admin • Tournament"}
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
            {"\u21BB"}
          </button>
        </div>

        {quickTournaments.length > 1 ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900, marginBottom: 6 }}>Active tournaments</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {quickTournaments.map((t) => {
                const active = t.id === tournamentId;
                const label =
                  (t.gender ? (t.gender === "MALE" ? "Men" : "Ladies") : "Open") +
                  " • " +
                  (t.status === "IN_PLAY" ? "In-play" : "Upcoming");
                return (
                  <button
                    key={`quick-${t.id}`}
                    type="button"
                    onClick={() => {
                      if (t.id === tournamentId) return;
                      window.location.href = `/admin/tournaments/${t.id}`;
                    }}
                    style={{
                      border: `1px solid ${theme.border}`,
                      background: active ? theme.maroon : "#fff",
                      color: active ? "#fff" : theme.text,
                      padding: "8px 10px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      minWidth: 160,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cleanTournamentName(t.name)}
                    </div>
                    <div style={{ fontSize: 11, opacity: active ? 0.95 : 0.7 }}>{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
            <ControlView
              tournament={tournament}
              tournamentId={tournamentId}
              entryCount={entryCount}
              teams={teams}
              matches={matches}
              busy={busy}
              entriesOpen={entriesOpen}
              hasTeams={hasTeams}
              hasMatches={hasMatches}
              mustSetTargetBeforeLock={mustSetTargetBeforeLock}
              targetInput={targetInput}
              targetValid={targetValid}
              fixturesEditOpen={fixturesEditOpen}
              fixturesDraftByMatchId={fixturesDraftByMatchId}
              setTargetInput={setTargetInput}
              setFixturesEditOpen={setFixturesEditOpen}
              setFixturesDraftByMatchId={setFixturesDraftByMatchId}
              setBusy={setBusy}
              setError={setError}
              reload={load}
              lockEntries={lockEntries}
              generateDoublesTeams={generateDoublesTeams}
              generateMatches={generateMatches}
              startTournament={startTournament}
              endTournament={endTournament}
              saveTarget={saveTarget}
              suggestTargetFromEntries={suggestTargetFromEntries}
              labelers={labelers}
            />
          ) : viewTab === "ROUNDS" ? (
            <RoundsView
              tournament={tournament}
              tournamentId={tournamentId}
              matches={matches}
              matchesByRound={matchesByRound}
              busy={busy}
              maxPlayableRound={maxPlayableRound}
              roundMeta={roundMeta}
              roundsViewMode={roundsViewMode}
              treeRoundsDisplay={treeRoundsDisplay}
              matchNoById={matchNoById}
              teamMembersByTeamId={teamMembersByTeamId}
              handicapByPlayerId={handicapByPlayerId}
              scoreDraftByMatchId={scoreDraftByMatchId}
              bulkOpen={bulkOpen}
              bulkDraftByMatchId={bulkDraftByMatchId}
              adminFinalOpenByMatchId={adminFinalOpenByMatchId}
              showProblemsOnly={showProblemsOnly}
              attentionOpen={attentionOpen}
              inPlayOpen={inPlayOpen}
              completedOpen={completedOpen}
              setScoreDraftByMatchId={setScoreDraftByMatchId}
              setBulkOpen={setBulkOpen}
              setBulkDraftByMatchId={setBulkDraftByMatchId}
              setAdminFinalOpenByMatchId={setAdminFinalOpenByMatchId}
              setShowProblemsOnly={setShowProblemsOnly}
              setRoundsViewMode={setRoundsViewMode}
              setAttentionOpen={setAttentionOpen}
              setInPlayOpen={setInPlayOpen}
              setCompletedOpen={setCompletedOpen}
              setBusy={setBusy}
              setError={setError}
              selectRound={selectRound}
              startAllInSelectedRound={startAllInSelectedRound}
              completeAllWithScoresInSelectedRound={completeAllWithScoresInSelectedRound}
              advanceSelectedRound={advanceSelectedRound}
              endTournament={endTournament}
              adminFinalScore={adminFinalScore}
              updateMatchStatus={updateMatchStatus}
              reload={load}
              treeRoundRefsSetter={(round) => (el) => {
                treeRoundRefs.current[round] = el;
              }}
              labelers={labelers}
              scrollHelpers={scrollHelpers}
            />
          ) : (
            <AuditView
              matches={matches}
              busy={busy}
              auditOpenByRound={auditOpenByRound}
              auditEditOpenByMatchId={auditEditOpenByMatchId}
              scoreDraftByMatchId={scoreDraftByMatchId}
              setAuditOpenByRound={setAuditOpenByRound}
              setAuditEditOpenByMatchId={setAuditEditOpenByMatchId}
              setScoreDraftByMatchId={setScoreDraftByMatchId}
              adminFinalScore={adminFinalScore}
              labelers={labelers}
              scrollHelpers={scrollHelpers}
            />
          )
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}

