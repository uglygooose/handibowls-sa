"use client";

import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { adminGate } from "@/lib/auth/adminGate";
import {
  cleanTournamentName,
  formatLabel,
  genderLabel,
  ruleLabel,
  scopeLabel,
  statusLabel,
  type TournamentFormat,
  type TournamentGender,
  type TournamentRule,
  type TournamentScope,
  type TournamentStatus,
} from "@/lib/tournaments/labels";
import BottomNav from "../../components/BottomNav";
import { toIsoOrNull } from "./utils/dates";
import TournamentsListView from "./views/TournamentsListView";
import CreateTournamentModal from "./views/CreateTournamentModal";

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
  gender?: TournamentGender | null;
  club_id?: string | null;
  rule_type?: TournamentRule | null;
};

export type AdminTab = "HOME" | "ISSUES";

type ClubNameRow = { id: string | number; name: string | null };
type TournamentIdRow = { tournament_id?: string | number | null };
type RawTeamRow = {
  id?: string | number | null;
  tournament_id?: string | number | null;
  team_no?: number | string | null;
  team_handicap?: number | string | null;
};
type RawTeamMemberRow = { team_id?: string | number | null; player_id?: string | number | null };
type PlayerNameRow = { id?: string | number | null; display_name?: string | null };
type PlayerIdRow = { player_id?: string | number | null };
type PlayerHandicapRow = { handicap?: number | string | null };

type NewTournamentPayload = {
  name: string;
  scope: TournamentScope;
  format: TournamentFormat;
  gender: TournamentGender;
  rule_type: TournamentRule;
  club_id: string | null;
  status: TournamentStatus;
  entries_open: boolean;
  locked_at: string | null;
  target_team_handicap: number;
  announced_at: string;
  starts_at: string | null;
  ends_at: string | null;
};

export default function AdminTournamentsPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<AdminTab>("HOME");

  // Create Tournament modal + form state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createScope, setCreateScope] = useState<TournamentScope>("CLUB");
  const [createFormat, setCreateFormat] = useState<TournamentFormat>("DOUBLES");
  const [createGender, setCreateGender] = useState<TournamentGender>("MALE");
  const [createRule, setCreateRule] = useState<TournamentRule>("HANDICAP_START");
  const [createClubId, setCreateClubId] = useState("");
  const [createStartsAt, setCreateStartsAt] = useState(""); // datetime-local string
  const [createEndsAt, setCreateEndsAt] = useState(""); // datetime-local string
  const [createBusy, setCreateBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [entryCountByTournamentId, setEntryCountByTournamentId] = useState<Record<string, number>>({});
  const [matchCountByTournamentId, setMatchCountByTournamentId] = useState<Record<string, number>>({});

  const [teamsByTournamentId, setTeamsByTournamentId] = useState<
    Record<string, { id: string; team_no: number; team_handicap: number | null }[]>
  >({});
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<string, string[]>>({});
  const [nameByPlayerId, setNameByPlayerId] = useState<Record<string, string>>({});

  const [targetInputByTournamentId, setTargetInputByTournamentId] = useState<Record<string, string>>({});
  const [busyByTournamentId, setBusyByTournamentId] = useState<Record<string, boolean>>({});

  const [teamsOpenByTournamentId, setTeamsOpenByTournamentId] = useState<Record<string, boolean>>({});
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminClubId, setAdminClubId] = useState<string | null>(null);

  const [bucketOpenByTitle, setBucketOpenByTitle] = useState<Record<string, boolean>>({
    "Club Tournaments": false,
    "District Tournaments": false,
    "National Tournaments": false,
  });

  const [sectionOpenByKey, setSectionOpenByKey] = useState<Record<string, boolean>>({});

  const issuesCount = 0;

  function setBusy(tournamentId: string, v: boolean) {
    setBusyByTournamentId((m) => ({ ...m, [tournamentId]: v }));
  }

  async function runAdminGate() {
    setAccessDenied(false);
    const gate = await adminGate(supabase);
    if (!gate.ok) {
      if (gate.reason === "NOT_AUTHENTICATED") {
        window.location.href = "/login";
        return { ok: false as const };
      }
      if (gate.reason === "PROFILE_ERROR") {
        setError(`Could not verify admin access.\n${gate.message ?? ""}`);
      }
      setIsAdmin(false);
      setAccessDenied(true);
      return { ok: false as const };
    }
    setIsSuperAdmin(gate.isSuperAdmin);
    setAdminClubId(gate.adminClubId);
    setIsAdmin(true);
    return { ok: true as const };
  }

  async function load() {
    setLoading(true);
    setError(null);

    const gate = await runAdminGate();
    if (!gate.ok) {
      setRows([]);
      setEntryCountByTournamentId({});
      setMatchCountByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const clubQuery = supabase.from("clubs").select("id, name").order("name", { ascending: true });
    const clubRes = adminClubId ? await clubQuery.eq("id", adminClubId) : await clubQuery;
    if (!clubRes.error) {
      const list = ((clubRes.data ?? []) as ClubNameRow[]).map((c) => ({
        id: String(c.id),
        name: String(c.name ?? "Club"),
      }));
      setClubs(list);
      if (!createClubId && list.length) {
        setCreateClubId(list[0].id);
      }
    }
    if (adminClubId) {
      setCreateScope("CLUB");
      setCreateClubId(adminClubId);
    }

    const tRes = await supabase
      .from("tournaments")
      .select(
        "id, name, scope, format, status, announced_at, starts_at, ends_at, entries_open, locked_at, target_team_handicap, gender, club_id, rule_type"
      )
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("announced_at", { ascending: false })
      .limit(500);

    if (tRes.error) {
      setError(`Could not load tournaments.\n${tRes.error.message}`);
      setRows([]);
      setEntryCountByTournamentId({});
      setMatchCountByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const tournaments = (tRes.data ?? []) as TournamentRow[];
    const scopedTournaments = adminClubId
      ? tournaments.filter((t) => t.scope === "CLUB" && String(t.club_id ?? "") === adminClubId)
      : tournaments;
    setRows(scopedTournaments);

    // Prime target inputs from DB
    setTargetInputByTournamentId((prev) => {
      const next = { ...prev };
      for (const t of scopedTournaments) {
        if (next[t.id] == null) {
          next[t.id] = t.target_team_handicap != null ? String(t.target_team_handicap) : "";
        }
      }
      return next;
    });

    const ids = scopedTournaments.map((t) => t.id);
    if (!ids.length) {
      setEntryCountByTournamentId({});
      setMatchCountByTournamentId({});
      setTeamsByTournamentId({});
      setTeamMembersByTeamId({});
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    // Entry counts
    const eRes = await supabase.from("tournament_entries").select("tournament_id").in("tournament_id", ids);

    if (eRes.error) {
      setEntryCountByTournamentId({});
      setError((prev) => prev ?? `Could not load entry counts.\n${eRes.error?.message ?? ""}`.trim());
    } else {
      const counts: Record<string, number> = {};
      for (const r of ((eRes.data ?? []) as TournamentIdRow[])) {
        const tid = String(r.tournament_id ?? "");
        if (!tid) continue;
        counts[tid] = (counts[tid] ?? 0) + 1;
      }
      setEntryCountByTournamentId(counts);
    }

    // Match counts (tournament fixtures only)
    const mRes = await supabase.from("matches").select("tournament_id").in("tournament_id", ids);

    if (mRes.error) {
      setMatchCountByTournamentId({});
    } else {
      const counts: Record<string, number> = {};
      for (const r of ((mRes.data ?? []) as TournamentIdRow[])) {
        const tid = String(r.tournament_id ?? "");
        if (!tid) continue;
        counts[tid] = (counts[tid] ?? 0) + 1;
      }
      setMatchCountByTournamentId(counts);
    }

    // Teams
    const teamRes = await supabase
      .from("tournament_teams")
      .select("id, tournament_id, team_no, team_handicap")
      .in("tournament_id", ids)
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

    const memRes = await supabase.from("tournament_team_members").select("team_id, player_id").in("team_id", teamIds);

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
      const playerId = String(r.player_id ?? "");
      if (!teamId || !playerId) continue;

      membersByTeam[teamId] = membersByTeam[teamId] ?? [];
      membersByTeam[teamId].push(playerId);
      allPlayerIds.push(playerId);
    }

    setTeamMembersByTeamId(membersByTeam);

    const uniquePlayerIds = Array.from(new Set(allPlayerIds));
    if (!uniquePlayerIds.length) {
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    // Use players.display_name (supports guest players where user_id is null)
    const pRes = await supabase.from("players").select("id, display_name").in("id", uniquePlayerIds);

    if (pRes.error) {
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const nameByPlayer: Record<string, string> = {};
    for (const p of ((pRes.data ?? []) as PlayerNameRow[])) {
      nameByPlayer[String(p.id ?? "")] = String(p.display_name ?? "Unknown");
    }

    setNameByPlayerId(nameByPlayer);
    setLoading(false);
    return;
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

  async function lockEntries(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    const res = await supabase.rpc("tournament_lock_entries", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not lock entries.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    await load();
    setBusy(tournamentId, false);
  }

  async function startTournament(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    const res = await supabase.rpc("tournament_start", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not start tournament.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    await load();
    setBusy(tournamentId, false);
  }

  async function saveTarget(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    const raw = (targetInputByTournamentId[tournamentId] ?? "").trim();
    const v = raw === "" ? null : Number(raw);

    if (v === null || Number.isNaN(v)) {
      setError("Target team handicap must be a number.");
      setBusy(tournamentId, false);
      return;
    }

    const res = await supabase.rpc("tournament_set_target_handicap", { p_tournament_id: tournamentId, p_target: v });

    if (res.error) {
      setError(`Could not set target handicap.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    await load();
    setBusy(tournamentId, false);
  }

  async function suggestTargetFromEntries(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    const res = await supabase.from("tournament_entries").select("player_id").eq("tournament_id", tournamentId);

    if (res.error) {
      setError(`Could not load entrants.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    const playerIds = Array.from(new Set(((res.data ?? []) as PlayerIdRow[]).map((r) => String(r.player_id ?? "")).filter(Boolean)));
    if (playerIds.length === 0) {
      setError("No entrants yet.");
      setBusy(tournamentId, false);
      return;
    }

    const pRes = await supabase.from("players").select("id, handicap").in("id", playerIds);

    if (pRes.error) {
      setError(`Could not load handicaps.\n${pRes.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    const hs = ((pRes.data ?? []) as PlayerHandicapRow[])
      .map((p) =>
        typeof p.handicap === "number" ? Number(p.handicap) : p.handicap != null ? Number(p.handicap) : null
      )
      .filter((v): v is number => v !== null && !Number.isNaN(v));

    if (hs.length === 0) {
      setError("No handicaps available for entrants.");
      setBusy(tournamentId, false);
      return;
    }

    const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
    // Doubles target = avg player handicap × 2
    const suggested = Math.round(avg * 2 * 10) / 10; // 1 decimal

    setTargetInputByTournamentId((m) => ({ ...m, [tournamentId]: String(suggested) }));
    setBusy(tournamentId, false);
  }
  async function generateDoublesTeams(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    const res = await supabase.rpc("tournament_generate_doubles_teams", { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not generate doubles teams.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    await load();
    setBusy(tournamentId, false);
  }

  async function generateMatches(tournamentId: string) {
    setBusy(tournamentId, true);
    setError(null);

    // Singles uses knockout round 1 generator
    const t = rows.find((x) => x.id === tournamentId);
    const fn = t?.format === "SINGLES" ? "generate_round1_singles_matches" : "tournament_generate_knockout_matches";

    const res = await supabase.rpc(fn, { p_tournament_id: tournamentId });

    if (res.error) {
      setError(`Could not generate matches.\n${res.error.message}`);
      setBusy(tournamentId, false);
      return;
    }

    await load();
    setBusy(tournamentId, false);
  }

  function closeCreateModal() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  async function createTournament() {
    setError(null);

    const name = createName.trim();
    if (!name) {
      setError("Tournament name is required.");
      return;
    }

    if (createScope === "CLUB" && !createClubId) {
      setError("Please select a host club.");
      return;
    }

    const startsIso = toIsoOrNull(createStartsAt);
    const endsIso = toIsoOrNull(createEndsAt);

    if (createStartsAt && !startsIso) {
      setError("Starts at is invalid.");
      return;
    }
    if (createEndsAt && !endsIso) {
      setError("Ends at is invalid.");
      return;
    }
    if (startsIso && endsIso && new Date(endsIso).getTime() < new Date(startsIso).getTime()) {
      setError("Ends at cannot be before Starts at.");
      return;
    }

    setCreateBusy(true);

    const payload: NewTournamentPayload = {
      name,
      scope: createScope,
      format: createFormat,
      gender: createGender,
      rule_type: createRule,
      club_id: createScope === "CLUB" ? (createClubId || null) : null,
      status: "ANNOUNCED",
      entries_open: true,
      locked_at: null,
      target_team_handicap: 0,
      announced_at: new Date().toISOString(),
      starts_at: startsIso,
      ends_at: endsIso,
    };

    const ins = await supabase.from("tournaments").insert(payload).select("id").single();

    if (ins.error || !ins.data?.id) {
      setError(`Could not create tournament.\n${ins.error?.message ?? ""}`.trim());
      setCreateBusy(false);
      return;
    }

    const newId = String(ins.data.id);

    // Reset + close
    setCreateName("");
    setCreateScope("CLUB");
    setCreateFormat("DOUBLES");
    setCreateGender("MALE");
    setCreateRule("HANDICAP_START");
    setCreateStartsAt("");
    setCreateEndsAt("");
    setCreateOpen(false);

    // Refresh list + redirect to relevant tournament
    await load();
    setCreateBusy(false);
    window.location.href = `/admin/tournaments/${newId}`;
  }

  async function cancelTournament(t: TournamentRow) {
    const tid = t.id;
    const ok = window.confirm(
      `Cancel tournament?\n\nThis will permanently delete:\n• entries\n• teams\n• fixtures\n\nTournament: ${cleanTournamentName(t.name)}\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setBusy(tid, true);
    setError(null);

    const res = await supabase.rpc("tournament_cancel", { p_tournament_id: tid });

    if (res.error) {
      setError(`Could not cancel tournament.\n${res.error.message}`);
      setBusy(tid, false);
      return;
    }

    await load();
    setBusy(tid, false);
  }

  function AdminTabs() {
    const pillBase =
      "w-full rounded-full border px-2 py-2 text-center text-xs font-semibold transition whitespace-nowrap";

    function pill(active: boolean) {
      return `${pillBase} ${
        active ? "border-green-700 bg-green-700 text-white" : "border-green-700 bg-white text-green-700"
      }`;
    }

    return (
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button type="button" className={pill(tab === "HOME")} onClick={() => setTab("HOME")}>
          Home
        </button>

        <button type="button" className={pill(tab === "ISSUES")} onClick={() => setTab("ISSUES")}>
          Issues{issuesCount > 0 ? ` (${issuesCount})` : ""}
        </button>

        <button
          type="button"
          className={pill(false)}
          onClick={() => {
            setError(null);
            setCreateOpen(true);
          }}
        >
          Create
        </button>
      </div>
    );
  }

  function TopQuickNav() {
    return (
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <button
          type="button"
          onClick={() => (window.location.href = "/admin/tournaments")}
          style={{
            width: "100%",
            border: `1px solid ${theme.border}`,
            background: "#fff",
            color: theme.text,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
          title="Admin tournaments"
        >
          Admin tournaments
        </button>

        <button
          type="button"
          onClick={() => (window.location.href = "/admin/greens")}
          style={{
            width: "100%",
            border: `1px solid ${theme.border}`,
            background: "#fff",
            color: theme.text,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
          title="Admin greens"
        >
          Greens
        </button>

        <button
          type="button"
          onClick={() => (window.location.href = "/tournaments")}
          style={{
            width: "100%",
            border: `1px solid ${theme.border}`,
            background: "#fff",
            color: theme.text,
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
          title="Player tournaments"
        >
          Player tournaments →
        </button>
      </div>
    );
  }


  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Admin • Tournaments</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 1.25 }}>
              {loading
                ? "Loading..."
                : accessDenied
                ? "No access."
                : isAdmin
                ? "Admin controls for tournaments."
                : "Checking access..."}
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

        <TopQuickNav />

        <AdminTabs />

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

        {loading ? (
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
            Loading admin tournaments...
          </div>
        ) : (
          <TournamentsListView
            tab={tab}
            byScope={byScope}
            entryCountByTournamentId={entryCountByTournamentId}
            matchCountByTournamentId={matchCountByTournamentId}
            teamsByTournamentId={teamsByTournamentId}
            teamMembersByTeamId={teamMembersByTeamId}
            nameByPlayerId={nameByPlayerId}
            teamsOpenByTournamentId={teamsOpenByTournamentId}
            setTeamsOpenByTournamentId={setTeamsOpenByTournamentId}
            bucketOpenByTitle={bucketOpenByTitle}
            setBucketOpenByTitle={setBucketOpenByTitle}
            sectionOpenByKey={sectionOpenByKey}
            setSectionOpenByKey={setSectionOpenByKey}
            busyByTournamentId={busyByTournamentId}
            isSuperAdmin={isSuperAdmin}
            cancelTournament={cancelTournament}
          />
        )}
      </div>

      <CreateTournamentModal
        open={createOpen}
        busy={createBusy}
        onClose={closeCreateModal}
        onSubmit={createTournament}
        name={createName}
        setName={setCreateName}
        scope={createScope}
        setScope={setCreateScope}
        format={createFormat}
        setFormat={setCreateFormat}
        gender={createGender}
        setGender={setCreateGender}
        rule={createRule}
        setRule={setCreateRule}
        clubId={createClubId}
        setClubId={setCreateClubId}
        startsAt={createStartsAt}
        setStartsAt={setCreateStartsAt}
        endsAt={createEndsAt}
        setEndsAt={setCreateEndsAt}
        clubs={clubs}
        isSuperAdmin={isSuperAdmin}
      />

      <BottomNav />
    </div>
  );
}
