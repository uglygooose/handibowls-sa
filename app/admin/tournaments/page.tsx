"use client";

import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "../../components/BottomNav";

type TournamentScope = "CLUB" | "DISTRICT" | "NATIONAL";
type TournamentStatus = "ANNOUNCED" | "IN_PLAY" | "COMPLETED";
type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
type TournamentGender = "MALE" | "FEMALE";
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
  locked_at?: string | null;
  target_team_handicap?: number | null;
  gender?: TournamentGender | null;
  club_id?: string | null;
  rule_type?: TournamentRule | null;
};

type AdminTab = "HOME" | "ISSUES" | "CREATE";
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

function genderLabel(g: TournamentGender | null | undefined) {
  if (g === "MALE") return "Men";
  if (g === "FEMALE") return "Ladies";
  return "Open";
}

function ruleLabel(rule: TournamentRule | null | undefined) {
  if (rule === "SCRATCH") return "Scratch (no handicap)";
  return "Handicap start";
}

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

  const [bucketOpenByTitle, setBucketOpenByTitle] = useState<Record<string, boolean>>({
    "Club Tournaments": false,
    "District Tournaments": false,
    "National Tournaments": false,
  });

  const [sectionOpenByKey, setSectionOpenByKey] = useState<Record<string, boolean>>({});

  const issuesCount = 0; // placeholder for next steps

  function setBusy(tournamentId: string, v: boolean) {
    setBusyByTournamentId((m) => ({ ...m, [tournamentId]: v }));
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

  async function load() {
    setLoading(true);
    setError(null);

    const gate = await adminGate();
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

    const clubRes = await supabase.from("clubs").select("id, name").order("name", { ascending: true });
    if (!clubRes.error) {
      const list = (clubRes.data ?? []).map((c: any) => ({
        id: String(c.id),
        name: String(c.name ?? "Club"),
      }));
      setClubs(list);
      if (!createClubId && list.length) {
        setCreateClubId(list[0].id);
      }
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
    setRows(tournaments);

    // Prime target inputs from DB
    setTargetInputByTournamentId((prev) => {
      const next = { ...prev };
      for (const t of tournaments) {
        if (next[t.id] == null) {
          next[t.id] = t.target_team_handicap != null ? String(t.target_team_handicap) : "";
        }
      }
      return next;
    });

    const ids = tournaments.map((t) => t.id);
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
      for (const r of eRes.data ?? []) {
        const tid = String((r as any).tournament_id ?? "");
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
      for (const r of mRes.data ?? []) {
        const tid = String((r as any).tournament_id ?? "");
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

    const memRes = await supabase.from("tournament_team_members").select("team_id, player_id").in("team_id", teamIds);

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
      const playerId = String((r as any).player_id ?? "");
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

    // ✅ FIX 1: Use players.display_name (supports guest players where user_id is null)
    const pRes = await supabase.from("players").select("id, display_name").in("id", uniquePlayerIds);

    if (pRes.error) {
      setNameByPlayerId({});
      setLoading(false);
      return;
    }

    const nameByPlayer: Record<string, string> = {};
    for (const p of pRes.data ?? []) {
      nameByPlayer[String((p as any).id)] = String((p as any).display_name ?? "Unknown");
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

    const playerIds = Array.from(new Set((res.data ?? []).map((r: any) => String(r.player_id)).filter(Boolean)));
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

    const hs = (pRes.data ?? [])
      .map((p: any) =>
        typeof p.handicap === "number" ? Number(p.handicap) : p.handicap != null ? Number(p.handicap) : null
      )
      .filter((v: any) => v !== null && !Number.isNaN(v)) as number[];

    if (hs.length === 0) {
      setError("No handicaps available for entrants.");
      setBusy(tournamentId, false);
      return;
    }

    const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
    // ✅ FIX 3: Doubles target = avg player handicap × 2
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

    // ✅ FIX 2: Singles uses knockout round 1 generator
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

  function toIsoOrNull(dtLocal: string) {
    const v = (dtLocal ?? "").trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
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

    const payload: any = {
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
      `Cancel tournament?\n\nThis will permanently delete:\n• entries\n• teams\n• fixtures\n\nTournament: ${t.name}\n\nThis cannot be undone.`
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
          className={pill(tab === "CREATE")}
          onClick={() => {
            setTab("CREATE");
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
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

  function renderTournamentCard(t: TournamentRow) {
    const count = entryCountByTournamentId[t.id] ?? 0;
    const matchCount = matchCountByTournamentId[t.id] ?? 0;
    const busy = !!busyByTournamentId[t.id];

    const entriesOpen = t.entries_open !== false; // treat null as open
    const lockedLabel = entriesOpen ? "Open" : "Locked";

    const hasTeams = (teamsByTournamentId[t.id]?.length ?? 0) > 0;
    const hasMatches = matchCount > 0;

    const canGenerateTeams = t.format === "DOUBLES" && !entriesOpen && !hasTeams;
    const canGenerateMatches = !entriesOpen && hasTeams && !hasMatches;
    const canStartTournament = t.status === "ANNOUNCED" && !entriesOpen && (t.format !== "DOUBLES" || hasTeams);

    const nextStep = t.status === "COMPLETED" ? "View" : "Manage";

    function goManage() {
      window.location.href = `/admin/tournaments/${t.id}`;
    }

    function openPlayerView() {
      window.location.href = `/tournaments/${t.id}`;
    }

    function runNextStep() {
      goManage();
    }

    const statusPillBg = t.status === "IN_PLAY" ? "#ECFDF5" : t.status === "COMPLETED" ? "#F3F4F6" : "#EFF6FF";
    const statusPillColor = t.status === "IN_PLAY" ? "#047857" : t.status === "COMPLETED" ? theme.muted : "#1D4ED8";

    const cancelDisabled = busy || t.status !== "ANNOUNCED";
    const cancelTitle =
      t.status !== "ANNOUNCED" ? "Cancel is only available while tournament is Upcoming" : "Cancel tournament";

    return (
      <div
        key={t.id}
        style={{
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 15, minWidth: 0 }}>
            <div
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={t.name}
            >
              {t.name}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 900,
                color: theme.text,
                background: "#fff",
                whiteSpace: "nowrap",
              }}
              title="Tournament format"
            >
              {formatLabel(t.format)}
            </div>

            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 900,
                color: statusPillColor,
                background: statusPillBg,
                whiteSpace: "nowrap",
              }}
              title="Tournament status"
            >
              {statusLabel(t.status)}
            </div>
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
            {statusLabel(t.status)}
          </span>
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Entries
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {count} <span style={{ color: entriesOpen ? theme.maroon : theme.danger }}>• {lockedLabel}</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Teams / Matches
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {hasTeams ? teamsByTournamentId[t.id].length : 0} • {matchCount}
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Starts
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {t.starts_at ? new Date(t.starts_at).toLocaleString() : "TBC"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Ends
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {t.ends_at ? new Date(t.ends_at).toLocaleString() : "TBC"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={runNextStep}
            style={{
              width: "100%",
              border: "none",
              background: theme.maroon,
              color: "#fff",
              padding: "12px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            title="Open admin tournament page"
          >
            {busy ? "Working..." : nextStep}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={openPlayerView}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            title="Open player view"
          >
            Open player view →
          </button>

          {t.status === "ANNOUNCED" ? (
            <button
              type="button"
              disabled={cancelDisabled}
              onClick={() => cancelTournament(t)}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: cancelDisabled ? "#F3F4F6" : "#fff",
                color: cancelDisabled ? theme.muted : theme.danger,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: cancelDisabled ? "not-allowed" : "pointer",
              }}
              title={cancelTitle}
            >
              Cancel tournament
            </button>
          ) : null}

          {teamsByTournamentId[t.id]?.length ? (
            <div
              style={{
                marginTop: 10,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                background: "#fff",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setTeamsOpenByTournamentId((m) => ({ ...m, [t.id]: !m[t.id] }))}
                style={{
                  width: "100%",
                  border: "none",
                  background: "#F3F8F3",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                }}
                title="Toggle teams"
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>Teams</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
                  {teamsByTournamentId[t.id].length} {teamsByTournamentId[t.id].length === 1 ? "team" : "teams"}{" "}
                  <span style={{ marginLeft: 8 }}>{teamsOpenByTournamentId[t.id] ? "▾" : "▸"}</span>
                </div>
              </button>

              {teamsOpenByTournamentId[t.id] ? (
                <div style={{ padding: 10, display: "grid", gap: 8, borderTop: `1px solid ${theme.border}` }}>
                  {teamsByTournamentId[t.id].map((tm) => {
                    const memberIds = teamMembersByTeamId[tm.id] ?? [];
                    const memberNames = memberIds.map((pid) => nameByPlayerId[pid] ?? "Unknown");

                    return (
                      <div
                        key={tm.id}
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: 12,
                          padding: 10,
                          background: "#fff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>Team {tm.team_no}</div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                            HCP {tm.team_handicap == null ? "-" : tm.team_handicap}
                          </div>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 13, color: theme.text, fontWeight: 800, lineHeight: 1.35 }}>
                          {memberNames.length ? memberNames.join(" \u2022 ") : "Members not loaded"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBucket(title: string, items: TournamentRow[]) {
    const upcoming = items.filter((r) => r.status === "ANNOUNCED");
    const inplay = items.filter((r) => r.status === "IN_PLAY");
    const past = items.filter((r) => r.status === "COMPLETED");

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
            {section("Past", past)}
          </div>
        ) : null}
      </div>
    );
  }

  function renderHome() {
    return (
      <>
        {renderBucket("Club Tournaments", byScope.club)}
        {renderBucket("District Tournaments", byScope.district)}
        {renderBucket("National Tournaments", byScope.national)}
      </>
    );
  }

  function renderIssues() {
    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Issues</div>
        <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
          Coming next: score disputes and admin review queues (Club / District / Tournament host).
        </div>
      </div>
    );
  }

  function renderCreate() {
    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Create Tournament</div>
        <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
          Use the <b>Create</b> tab to open the popup and create a new tournament.
        </div>
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
            ↻
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
        ) : tab === "HOME" ? (
          renderHome()
        ) : tab === "ISSUES" ? (
          renderIssues()
        ) : (
          renderCreate()
        )}
      </div>

      {createOpen ? (
        <div
          onClick={closeCreateModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 80,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#fff",
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${theme.border}`,
                background: "#F3F8F3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 15 }}>Create tournament</div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createBusy}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  cursor: createBusy ? "not-allowed" : "pointer",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Tournament name</div>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Saturday Club Doubles"
                disabled={createBusy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Scope</div>
                  <select
                    value={createScope}
                    onChange={(e) => setCreateScope(e.target.value as TournamentScope)}
                    disabled={createBusy}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="CLUB">Club</option>
                    <option value="DISTRICT">District</option>
                    <option value="NATIONAL">National</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Format</div>
                  <select
                    value={createFormat}
                    onChange={(e) => setCreateFormat(e.target.value as TournamentFormat)}
                    disabled={createBusy}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="SINGLES">Singles</option>
                    <option value="DOUBLES">Doubles</option>
                    <option value="TRIPLES">Triples</option>
                    <option value="FOUR_BALL">4 Balls</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Gender</div>
                  <select
                    value={createGender}
                    onChange={(e) => setCreateGender(e.target.value as TournamentGender)}
                    disabled={createBusy}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Host club</div>
                  <select
                    value={createClubId}
                    onChange={(e) => setCreateClubId(e.target.value)}
                    disabled={createBusy || createScope !== "CLUB"}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    {clubs.length ? (
                      clubs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No clubs found</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Rule</div>
                <select
                  value={createRule}
                  onChange={(e) => setCreateRule(e.target.value as TournamentRule)}
                  disabled={createBusy}
                  style={{
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 800,
                    outline: "none",
                    background: "#fff",
                  }}
                >
                  <option value="HANDICAP_START">{ruleLabel("HANDICAP_START")}</option>
                  <option value="SCRATCH">{ruleLabel("SCRATCH")}</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Starts at (optional)</div>
                  <input
                    type="datetime-local"
                    value={createStartsAt}
                    onChange={(e) => setCreateStartsAt(e.target.value)}
                    disabled={createBusy}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Ends at (optional)</div>
                  <input
                    type="datetime-local"
                    value={createEndsAt}
                    onChange={(e) => setCreateEndsAt(e.target.value)}
                    disabled={createBusy}
                    style={{
                      width: "100%",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={createTournament}
                disabled={createBusy}
                style={{
                  width: "100%",
                  border: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "12px 12px",
                  borderRadius: 14,
                  fontWeight: 900,
                  cursor: createBusy ? "not-allowed" : "pointer",
                  marginTop: 2,
                }}
                title="Create tournament"
              >
                {createBusy ? "Creating..." : "Create tournament"}
              </button>

              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                After creating, you'll be taken to the admin tournament page to lock entries, generate teams, and create
                fixtures.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
