// app/tournaments/page.tsx
"use client";

import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cleanTournamentName,
  formatLabel,
  genderLabel,
  matchStatusLabel,
  ruleLabel,
  scopeLabel,
  statusLabel,
  type TournamentFormat,
  type TournamentRule,
  type TournamentScope,
  type TournamentStatus,
} from "@/lib/tournaments/labels";
import {
  bool,
  hasValue,
  isMatchBye as isByeMatch,
  isMatchDone,
  winnerTeamIdFromMatch as inferWinnerTeamId,
} from "@/lib/tournaments/match";
import {
  finishPlacementLabel as libFinishPlacementLabel,
  roundLabel as libRoundLabel,
} from "@/lib/tournaments/bracket";
import BottomNav from "../components/BottomNav";
import TournamentCardView from "./views/TournamentCardView";

type PlayerGender = "MALE" | "FEMALE";
type TournamentGender = "MALE" | "FEMALE" | null;

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
  gender?: TournamentGender | null;
  club_id?: string | null;
  rule_type?: TournamentRule | null;
};

export type MatchLite = {
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

type ProfileRoleRow = { role?: string | null };
type PlayerGenderRow = { gender?: PlayerGender | null };
type ClubNameRow = { id: string; name: string | null };
type TournamentEntryRow = { tournament_id?: string | null };
type RawTeamRow = {
  id?: string | number | null;
  tournament_id?: string | number | null;
  team_no?: number | string | null;
  team_handicap?: number | string | null;
};
type RawTeamMemberRow = { team_id?: string | number | null; player_id?: string | number | null };
type ProfileNameRow = { id?: string | null; full_name?: string | null };
type RawMatchRow = {
  id: string | number;
  tournament_id?: string | number | null;
  round_no?: number | string | null;
  match_no?: number | string | null;
  status?: string | null;
  score_a?: number | string | null;
  score_b?: number | string | null;
  submitted_by_player_id?: string | number | null;
  confirmed_by_a?: boolean | null;
  confirmed_by_b?: boolean | null;
  finalized_by_admin?: boolean | null;
  winner_team_id?: string | number | null;
  team_a_id?: string | number | null;
  team_b_id?: string | number | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | number | null;
  slot_b_source_type?: string | null;
  slot_b_source_match_id?: string | number | null;
};

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
    const role = ((profRes.data as ProfileRoleRow | null)?.role ?? "").toString().toUpperCase();
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
    const myGender = ((me.data as PlayerGenderRow | null)?.gender ?? "") as PlayerGender | "";
    setPlayerGender(myGender);

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
    const visible = tournaments;
    setRows(visible);

    const clubIds = Array.from(
      new Set(
        visible
          .map((t) => (t.club_id ?? "").toString())
          .filter((id) => id)
      )
    );

    if (clubIds.length) {
      const clubRes = await supabase.from("clubs").select("id, name").in("id", clubIds);
      if (!clubRes.error) {
        const next: Record<string, string> = {};
        for (const c of ((clubRes.data ?? []) as ClubNameRow[])) {
          next[String(c.id)] = String(c.name ?? "Club");
        }
        setClubNameById(next);
      }
    }

    const tournamentIds = visible.map((t) => t.id);
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
    for (const r of ((ent.data ?? []) as TournamentEntryRow[])) {
      const tid = String(r.tournament_id ?? "");
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

    for (const r of ((teamRes.data ?? []) as RawTeamRow[])) {
      const tid = String(r.tournament_id ?? "");
      const teamId = String(r.id ?? "");
      if (!tid || !teamId) continue;

      teamIds.push(teamId);

      const team = {
        id: teamId,
        team_no: Number(r.team_no ?? 0),
        team_handicap:
          r.team_handicap == null
            ? null
            : typeof r.team_handicap === "number"
            ? r.team_handicap
            : Number(r.team_handicap),
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
        for (const pr of ((profRes.data ?? []) as ProfileNameRow[])) {
          nameByUser[String(pr.id ?? "")] = String(pr.full_name ?? "Unknown");
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
    const idsForMatches = visible.filter((t) => t.status !== "ANNOUNCED").map((t) => t.id);
    const completed = visible.filter((t) => t.status === "COMPLETED");

    if (idsForMatches.length) {
      const mRes = await supabase
        .from("matches")
        .select(
          "id, tournament_id, round_no, match_no, status, score_a, score_b, submitted_by_player_id, confirmed_by_a, confirmed_by_b, finalized_by_admin, winner_team_id, team_a_id, team_b_id, slot_a_source_type, slot_a_source_match_id, slot_b_source_type, slot_b_source_match_id"
        )
        .in("tournament_id", idsForMatches);

      if (!mRes.error) {
        const matchRows = ((mRes.data ?? []) as RawMatchRow[]).map((r) => ({
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

  function canEnterTournamentRow(t: TournamentRow | null | undefined) {
    if (!t) return { ok: false, reason: "Tournament not found." };

    const tg = (t.gender ?? null) as TournamentGender | null;
    if (!tg) return { ok: true, reason: null as string | null };

    if (!playerGender) return { ok: false, reason: "Select your gender to enter this tournament." };
    if (tg !== playerGender) return { ok: false, reason: "This tournament is not available for your gender." };

    return { ok: true, reason: null as string | null };
  }

  async function enterTournament(tournamentId: string) {
    if (!playerId) return;

    const t = rows.find((r) => r.id === tournamentId) ?? null;
    const elig = canEnterTournamentRow(t);
    if (!elig.ok) {
      setError(elig.reason ?? "You are not eligible to enter this tournament.");
      return;
    }

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

  const roundLabelForTournament = (t: TournamentRow, roundNo: number | null | undefined) =>
    libRoundLabel({
      totalTeams: (teamsByTournamentId[t.id] ?? []).length,
      roundNo: roundNo ?? null,
    });

  const finishPlacementLabel = (t: TournamentRow, roundNo: number | null | undefined) =>
    libFinishPlacementLabel({
      totalTeams: (teamsByTournamentId[t.id] ?? []).length,
      roundNo: roundNo ?? null,
    });


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
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {list.map((t) => (
                  <TournamentCardView
                    key={t.id}
                    t={t}
                    entered={!!enteredByTournamentId[t.id]}
                    winnerName={(winnerNameByTournamentId[t.id] ?? "").trim()}
                    teams={teamsByTournamentId[t.id] ?? []}
                    teamMembersByTeamId={teamMembersByTeamId}
                    nameByPlayerId={nameByPlayerId}
                    matches={matchesByTournamentId[t.id] ?? []}
                    clubName={t.club_id ? clubNameById[t.club_id] : undefined}
                    playerId={playerId}
                    teamDisplayName={teamDisplayName}
                    roundLabelForTournament={roundLabelForTournament}
                    finishPlacementLabel={finishPlacementLabel}
                    canEnterTournamentRow={canEnterTournamentRow}
                    enterTournament={enterTournament}
                  />
                ))}
              </div>
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
	              {loading ? "Loading..." : "All tournaments. Entering may be gender-restricted."}
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
	              Choose a gender to enter gender-specific tournaments.
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
