"use client";


import { theme } from "@/lib/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import BottomNav from "../components/BottomNav";

type MatchType = "RANKED" | "FRIENDLY";
type PlayerGender = "MALE" | "FEMALE" | "";

type LadderEntry = {
  // NOTE: position in DB may be stale; UI uses computed position
  position: number;
  player_id: string;

  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;

  shots_for: number | null;
  shots_against: number | null;
  shot_diff: number | null;

  points: number | null;
};

type PlayerRow = { id: string; handicap: number; user_id: string | null; display_name?: string | null; gender?: string | null };
type ProfileMiniRow = {
  id: string;
  full_name: string | null;
  club_id: string | null;
  district_id: string | null;
};

type LadderRow = {
  // DB position kept for reference only; UI uses computed index
  position: number;
  handicap: number;
  full_name: string;
  player_id: string;

  played: number;
  won: number;
  drawn: number;
  lost: number;

  shots_for: number;
  shots_against: number;
  shot_diff: number;

  points: number;
};

type MatchRow = {
  id: string;
  ladder_id: string;
  status: string;
  match_type?: MatchType | null;

  challenger_player_id: string;
  challenged_player_id: string;
  challenger_score: number | null;
  challenged_score: number | null;
  challenger_position_at_start: number | null;
  challenged_position_at_start: number | null;
  created_at: string;
};

type LadderMetaRow = {
  id: string;
  scope: "CLUB" | "DISTRICT" | "NATIONAL";
  club_id: string | null;
  district_id: string | null;
};

type Scope = "CLUB" | "DISTRICT" | "NATIONAL";
type GenderFilter = "ALL" | "MALE" | "FEMALE";
type LadderFormat = "ALL" | "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
function safeDateLabel(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMatchType(v: any): MatchType {
  const t = String(v ?? "RANKED").toUpperCase();
  return t === "FRIENDLY" ? "FRIENDLY" : "RANKED";
}

function isMissingColumnError(errMsg: string | undefined, columnName: string) {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}

function matchTypeBadge(type: MatchType) {
  const isRanked = type === "RANKED";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        background: isRanked ? "rgba(46,125,50,.10)" : "rgba(107,114,128,.10)",
        color: isRanked ? theme.maroon : theme.muted,
        whiteSpace: "nowrap",
      }}
    >
      {isRanked ? "Ranked" : "Friendly"}
    </span>
  );
}

export default function ClubLadderPage() {
  const supabase = createClient();
  const router = useRouter();

  const [scope, setScope] = useState<Scope>("CLUB");
  const [viewType, setViewType] = useState<MatchType>("RANKED"); // Ranked/Friendly toggle for lists + create
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("ALL");
  const [formatFilter, setFormatFilter] = useState<LadderFormat>("SINGLES");
  const [filtersReady, setFiltersReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myGender, setMyGender] = useState<PlayerGender>("" );
  const [genderByPlayerId, setGenderByPlayerId] = useState<Record<string, PlayerGender>>({});

  // IMPORTANT: this is now a COMPUTED position (based on sorted ladder)
  const [myPosition, setMyPosition] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [pendingMatches, setPendingMatches] = useState<MatchRow[]>([]);
  const [nameByPlayerId, setNameByPlayerId] = useState<Map<string, string>>(new Map());

  // my "membership"
  const [myClubId, setMyClubId] = useState<string | null>(null);
  const [myDistrictId, setMyDistrictId] = useState<string | null>(null);

  // ladders for my club/district + national
  const [clubLadderId, setClubLadderId] = useState<string | null>(null);
  const [districtLadderId, setDistrictLadderId] = useState<string | null>(null);
  const [nationalLadderId, setNationalLadderId] = useState<string | null>(null);

  const activeLadderId =
    scope === "CLUB" ? clubLadderId : scope === "DISTRICT" ? districtLadderId : nationalLadderId;

  // --- Horizontal scroll sync: header scrollbar controls row stats scroll ---
  const headerStatsScrollRef = useRef<HTMLDivElement | null>(null);
  const rowStatsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const filtersFromStorageRef = useRef(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function syncStatsScroll(left: number) {
    const map = rowStatsRefs.current;
    for (const k of Object.keys(map)) {
      const el = map[k];
      if (el && el.scrollLeft !== left) el.scrollLeft = left;
    }
  }

  function onHeaderStatsScroll() {
    const left = headerStatsScrollRef.current?.scrollLeft ?? 0;
    syncStatsScroll(left);
  }

  // When rows change (or viewType changes), keep rows aligned to header scroll position
  useEffect(() => {
    const left = headerStatsScrollRef.current?.scrollLeft ?? 0;
    syncStatsScroll(left);
  }, [rows, viewType]);

  // Eligibility:
  // - Friendly: challenge anyone except self
  // - Ranked: must be within ±2 (computed positions)
  function isEligible(targetComputedPos: number, targetPlayerId: string) {
    if (!myPlayerId) return false;
    if (targetPlayerId === myPlayerId) return false;

    if (viewType === "FRIENDLY") return true;

    // Ranked
    if (!myPosition) return false;
    return Math.abs(targetComputedPos - myPosition) <= 2;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    setNotice(null);

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Load my profile (club/district)
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, club_id, district_id")
      .eq("id", user.id)
      .single();

    if (pErr || !prof) {
      setError(`profiles: ${pErr?.message ?? "Profile not found"}`);
      setLoading(false);
      return;
    }

    const myProf = prof as ProfileMiniRow;
    setMyClubId(myProf.club_id ?? null);
    setMyDistrictId(myProf.district_id ?? null);

    // Load my player
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id, gender")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      setError("Your account is signed in, but it is not linked to a player record.");
      setRows([]);
      setMyPlayerId(null);
      setMyPosition(null);
      setMyGender("");
      setGenderByPlayerId({});
      setRecentMatches([]);
      setPendingMatches([]);
      setNameByPlayerId(new Map());
      setLoading(false);
      return;
    }

    setMyPlayerId(mePlayer.id);
    setMyGender(((mePlayer as any).gender ?? "") as PlayerGender);
    if (!filtersFromStorageRef.current) {
      setScope("CLUB");
      setViewType("RANKED");
      setFormatFilter("SINGLES");
      if (((mePlayer as any).gender ?? "") === "MALE" || ((mePlayer as any).gender ?? "") === "FEMALE") {
        setGenderFilter(((mePlayer as any).gender ?? "") as GenderFilter);
      }
    }

    // Load ladders
    const { data: ladders, error: lErr } = await supabase.from("ladders").select("id, scope, club_id, district_id");

    if (lErr) {
      setError(`ladders: ${lErr.message}`);
      setLoading(false);
      return;
    }

    const ladderRows = (ladders ?? []) as LadderMetaRow[];

    const clubLadder = myProf.club_id ? ladderRows.find((l) => l.scope === "CLUB" && l.club_id === myProf.club_id) : null;

    const districtLadder = myProf.district_id
      ? ladderRows.find((l) => l.scope === "DISTRICT" && l.district_id === myProf.district_id)
      : null;

    const nationalLadder = ladderRows.find((l) => l.scope === "NATIONAL") ?? null;

    setClubLadderId(clubLadder?.id ?? null);
    setDistrictLadderId(districtLadder?.id ?? null);
    setNationalLadderId(nationalLadder?.id ?? null);

    // If current tab doesn't exist for user, auto-fallback
    const desired =
      scope === "CLUB" ? clubLadder?.id : scope === "DISTRICT" ? districtLadder?.id : nationalLadder?.id;

    const fallback = desired ?? clubLadder?.id ?? districtLadder?.id ?? nationalLadder?.id ?? null;

    if (!fallback) {
      setError(
        "No ladders found. Ensure you have CLUB ladders per club, DISTRICT ladders per district, and a NATIONAL ladder."
      );
      setLoading(false);
      return;
    }

    if (scope === "CLUB" && !clubLadder?.id) setScope(districtLadder?.id ? "DISTRICT" : "NATIONAL");
    if (scope === "DISTRICT" && !districtLadder?.id) setScope(clubLadder?.id ? "CLUB" : "NATIONAL");
    if (scope === "NATIONAL" && !nationalLadder?.id) setScope(clubLadder?.id ? "CLUB" : "DISTRICT");

    // --------- FILTER PLAYERS PER TAB BY PROFILE CLUB/DISTRICT ----------
    let allowedPlayerIds: string[] | null = null;

    if (scope === "CLUB") {
      if (!myProf.club_id) {
        allowedPlayerIds = [];
      } else {
        const { data: clubProfiles, error: cpErr } = await supabase.from("profiles").select("id").eq("club_id", myProf.club_id);

        if (cpErr) {
          setError(`profiles (club filter): ${cpErr.message}`);
          setLoading(false);
          return;
        }

        const userIds = (clubProfiles ?? []).map((x: any) => x.id);
        const { data: clubPlayersByUser, error: clpErr } = userIds.length
          ? await supabase.from("players").select("id").in("user_id", userIds)
          : { data: [], error: null };

        if (clpErr) {
          setError(`players (club filter): ${clpErr.message}`);
          setLoading(false);
          return;
        }

        const { data: clubPlayersByClub, error: clcErr } = await supabase
          .from("players")
          .select("id")
          .eq("club_id", myProf.club_id);

        if (clcErr) {
          setError(`players (club filter): ${clcErr.message}`);
          setLoading(false);
          return;
        }

        const ids = new Set<string>([...(clubPlayersByUser ?? []).map((x: any) => x.id), ...(clubPlayersByClub ?? []).map((x: any) => x.id)]);
        allowedPlayerIds = Array.from(ids);
      }
    } else if (scope === "DISTRICT") {
      if (!myProf.district_id) {
        allowedPlayerIds = [];
      } else {
        const { data: distProfiles, error: dpErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("district_id", myProf.district_id);

        if (dpErr) {
          setError(`profiles (district filter): ${dpErr.message}`);
          setLoading(false);
          return;
        }

        const userIds = (distProfiles ?? []).map((x: any) => x.id);
        const { data: distPlayersByUser, error: dplErr } = userIds.length
          ? await supabase.from("players").select("id").in("user_id", userIds)
          : { data: [], error: null };

        if (dplErr) {
          setError(`players (district filter): ${dplErr.message}`);
          setLoading(false);
          return;
        }

        const { data: districtClubs, error: dcErr } = await supabase
          .from("clubs")
          .select("id")
          .eq("district_id", myProf.district_id);

        if (dcErr) {
          setError(`clubs (district filter): ${dcErr.message}`);
          setLoading(false);
          return;
        }

        const clubIds = (districtClubs ?? []).map((x: any) => x.id);
        const { data: distPlayersByClub, error: dpcErr } = clubIds.length
          ? await supabase.from("players").select("id").in("club_id", clubIds)
          : { data: [], error: null };

        if (dpcErr) {
          setError(`players (district filter): ${dpcErr.message}`);
          setLoading(false);
          return;
        }

        const ids = new Set<string>([...(distPlayersByUser ?? []).map((x: any) => x.id), ...(distPlayersByClub ?? []).map((x: any) => x.id)]);
        allowedPlayerIds = Array.from(ids);
      }
    } else {
      allowedPlayerIds = null; // NATIONAL
    }

    // 2) Fetch ladder_entries for the active ladder, applying allowedPlayerIds filter when needed
    let ladderEntries: LadderEntry[] = [];

    if (allowedPlayerIds && allowedPlayerIds.length === 0) {
      ladderEntries = [];
    } else {
      const q = supabase
        .from("ladder_entries")
        .select("position, player_id, played, won, drawn, lost, shots_for, shots_against, shot_diff, points")
        .eq("ladder_id", fallback)
        // Bowls convention: PTS -> SD -> SF
        .order("points", { ascending: false })
        .order("shot_diff", { ascending: false })
        .order("shots_for", { ascending: false });

      const { data: entries, error: e1 } =
        allowedPlayerIds && allowedPlayerIds.length > 0 ? await q.in("player_id", allowedPlayerIds) : await q;

      if (e1) {
        setError(`ladder_entries: ${e1.message}`);
        setLoading(false);
        return;
      }

      ladderEntries = (entries ?? []) as LadderEntry[];
    }

    // if empty
    if (!ladderEntries.length) {
      // Fallback: show eligible players alphabetically when no matches yet
      if (allowedPlayerIds && allowedPlayerIds.length === 0) {
        setRows([]);
        setMyPosition(null);
        setRecentMatches([]);
        setPendingMatches([]);
        setNameByPlayerId(new Map());
        setGenderByPlayerId({});
        setLoading(false);
        return;
      }

      const playerQuery = supabase
        .from("players")
        .select("id, handicap, user_id, display_name, gender");

      const scopedQuery =
        allowedPlayerIds && allowedPlayerIds.length > 0 ? playerQuery.in("id", allowedPlayerIds) : playerQuery;

      const genderedQuery =
        genderFilter === "ALL" ? scopedQuery : scopedQuery.eq("gender", genderFilter);

      const { data: players, error: pErr } = await genderedQuery;
      if (pErr) {
        setError(`players: ${pErr.message}`);
        setLoading(false);
        return;
      }

      const playerRows = (players ?? []) as PlayerRow[];
      const genderMap: Record<string, PlayerGender> = {};
      for (const p of playerRows) {
        genderMap[p.id] = ((p.gender ?? "") as PlayerGender) || "";
      }
      setGenderByPlayerId(genderMap);

      const userIds = playerRows.map((p) => p.user_id).filter(Boolean) as string[];
      const { data: profiles, error: prErr } =
        userIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [], error: null };

      if (prErr) {
        setError(`profiles: ${prErr.message}`);
        setLoading(false);
        return;
      }

      const profileRows = (profiles ?? []) as { id: string; full_name: string | null }[];
      const profileById = new Map(profileRows.map((p) => [p.id, p.full_name ?? "Unknown"]));

      const fallback = playerRows
        .map((p) => {
          const name = (p.display_name ?? "").trim() || profileById.get(p.user_id ?? "") || "Unknown";
          return {
            position: 0,
            player_id: p.id,
            handicap: p.handicap ?? 0,
            full_name: name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            shots_for: 0,
            shots_against: 0,
            shot_diff: 0,
            points: 0,
          } as LadderRow;
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }));

      const map = new Map<string, string>();
      for (const lr of fallback) map.set(lr.player_id, lr.full_name);
      setNameByPlayerId(map);
      setRows(fallback);

      const myIdx = myPlayerId ? fallback.findIndex((x) => x.player_id === myPlayerId) : -1;
      setMyPosition(myIdx >= 0 ? myIdx + 1 : null);

      setRecentMatches([]);
      setPendingMatches([]);
      setLoading(false);
      return;
    }

    // 3) Load player details + names for displayed player_ids
    const playerIds = ladderEntries.map((x) => x.player_id);

    const { data: players, error: e2 } = await supabase.from("players").select("id, handicap, user_id, display_name, gender").in("id", playerIds);

    if (e2) {
      setError(`players: ${e2.message}`);
      setLoading(false);
      return;
    }

    const playerRows = (players ?? []) as PlayerRow[];
    const genderMap: Record<string, PlayerGender> = {};
    for (const p of playerRows) {
      genderMap[p.id] = ((p.gender ?? "") as PlayerGender) || "";
    }
    setGenderByPlayerId(genderMap);
    const userIds = playerRows.map((p) => p.user_id).filter(Boolean) as string[];

    const { data: profiles, error: e3 } = await supabase.from("profiles").select("id, full_name").in("id", userIds);

    if (e3) {
      setError(`profiles: ${e3.message}`);
      setLoading(false);
      return;
    }

    const profileRows = (profiles ?? []) as { id: string; full_name: string | null }[];

    const playerById = new Map(playerRows.map((p) => [p.id, p]));
    const profileById = new Map(profileRows.map((p) => [p.id, p]));

    const merged: LadderRow[] = ladderEntries.map((en) => {
      const pl = playerById.get(en.player_id);
      const pr = pl ? profileById.get(pl.user_id) : null;
      const dn = (pl as any)?.display_name ?? "";
      const name = (dn ?? "").trim() ? (dn as string) : pr?.full_name ?? "Unknown";

      return {
        position: en.position,
        player_id: en.player_id,
        handicap: pl?.handicap ?? 0,
        full_name: name,

        played: en.played ?? 0,
        won: en.won ?? 0,
        drawn: en.drawn ?? 0,
        lost: en.lost ?? 0,

        shots_for: en.shots_for ?? 0,
        shots_against: en.shots_against ?? 0,
        shot_diff: en.shot_diff ?? 0,

        points: en.points ?? 0,
      };
    });

    const filteredMerged =
      genderFilter === "ALL"
        ? merged
        : merged.filter((r) => {
            const p = playerById.get(r.player_id) as any;
            return (p?.gender ?? "") === genderFilter;
          });

    const map = new Map<string, string>();
    for (const lr of filteredMerged) map.set(lr.player_id, lr.full_name);
    setNameByPlayerId(map);

    const shouldAlpha = filteredMerged.every((r) =>
      (r.played ?? 0) === 0 &&
      (r.won ?? 0) === 0 &&
      (r.drawn ?? 0) === 0 &&
      (r.lost ?? 0) === 0 &&
      (r.shots_for ?? 0) === 0 &&
      (r.shots_against ?? 0) === 0 &&
      (r.shot_diff ?? 0) === 0 &&
      (r.points ?? 0) === 0
    );

    const finalRows = shouldAlpha
      ? [...filteredMerged].sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }))
      : filteredMerged;

    setRows(finalRows);
    const myIdx = myPlayerId ? finalRows.findIndex((x) => x.player_id === myPlayerId) : -1;
    setMyPosition(myIdx >= 0 ? myIdx + 1 : null);


    // pending matches for me (this ladder) - filter by viewType
    {
      const baseSelect =
        "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const withTypeSelect =
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const q1 = await supabase
        .from("matches")
        .select(withTypeSelect)
        .eq("ladder_id", fallback)
        .in("status", ["OPEN", "RESULT_SUBMITTED"])
        .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
        .eq("match_type", viewType)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!q1.error) {
        setPendingMatches((q1.data ?? []) as MatchRow[]);
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
        // fallback: if no match_type column, only show "Ranked" view (since we can't filter)
        if (viewType === "FRIENDLY") {
          setPendingMatches([]);
        } else {
          const q2 = await supabase
            .from("matches")
            .select(baseSelect)
            .eq("ladder_id", fallback)
            .in("status", ["OPEN", "RESULT_SUBMITTED"])
            .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
            .order("created_at", { ascending: false })
            .limit(10);

          if (q2.error) {
            setError(`pending matches: ${q2.error.message}`);
            setPendingMatches([]);
            setLoading(false);
            return;
          }

          const patched = (q2.data ?? []).map((m: any) => ({ ...m, match_type: "RANKED" as MatchType }));
          setPendingMatches(patched as MatchRow[]);
        }
      } else {
        setError(`pending matches: ${q1.error.message}`);
        setPendingMatches([]);
        setLoading(false);
        return;
      }
    }

    // recent FINAL matches (this ladder) - filter by viewType
    {
      const baseSelect =
        "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const withTypeSelect =
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const q1 = await supabase
        .from("matches")
        .select(withTypeSelect)
        .eq("ladder_id", fallback)
        .eq("status", "FINAL")
        .eq("match_type", viewType)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!q1.error) {
        setRecentMatches((q1.data ?? []) as MatchRow[]);
      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
        if (viewType === "FRIENDLY") {
          setRecentMatches([]);
        } else {
          const q2 = await supabase
            .from("matches")
            .select(baseSelect)
            .eq("ladder_id", fallback)
            .eq("status", "FINAL")
            .order("created_at", { ascending: false })
            .limit(10);

          if (q2.error) {
            setError(`matches: ${q2.error.message}`);
            setRecentMatches([]);
            setLoading(false);
            return;
          }

          const patched = (q2.data ?? []).map((m: any) => ({ ...m, match_type: "RANKED" as MatchType }));
          setRecentMatches(patched as MatchRow[]);
        }
      } else {
        setError(`matches: ${q1.error.message}`);
        setRecentMatches([]);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("clubLadderFilters");
      if (raw) {
        filtersFromStorageRef.current = true;
        const parsed = JSON.parse(raw) as {
          scope?: Scope;
          viewType?: MatchType;
          gender?: GenderFilter;
          format?: LadderFormat;
        };

        if (parsed.scope) setScope(parsed.scope);
        if (parsed.viewType) setViewType(parsed.viewType);
        if (parsed.gender) setGenderFilter(parsed.gender);
        if (parsed.format) setFormatFilter(parsed.format);
      }
    } catch {}
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersReady, scope, viewType, genderFilter]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "clubLadderFilters",
        JSON.stringify({
          scope,
          viewType,
          gender: genderFilter,
          format: formatFilter,
        })
      );
    } catch {}
  }, [scope, viewType, genderFilter, formatFilter]);

  useEffect(() => {
    if (!listScrollRef.current || !myPlayerId || !rows.length) return;
    const row = rowRefs.current[myPlayerId];
    if (!row) return;

    const container = listScrollRef.current;
    const targetTop = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [rows, myPlayerId, scope, viewType, genderFilter]);

  async function createChallenge(challenged_player_id: string) {
    setNotice(null);
    setError(null);

    if (!activeLadderId) {
      setError("No active ladder selected.");
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/challenges/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ladder_id: activeLadderId,
          challenged_player_id,
          match_type: viewType,
        }),
      });
    } catch (e: any) {
      setError(`Network error calling API: ${e?.message ?? String(e)}`);
      return;
    }

    const text = await res.text();
    let json: any = null;

    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text);
      } catch {}
    }

    if (!res.ok) {
      const msg =
        json?.error ??
        (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status}): empty response body`);
      setError(msg);
      return;
    }

    setNotice(json?.ok ? `Challenge created (${viewType}) - expires in 3 days.` : `Challenge created (${viewType}).`);
  }

  // --- Stats helpers (display-only) ---
  const statsCols = "3ch 1ch  2ch 2ch 2ch 2ch  1ch  3.2ch 3.2ch 3.2ch";
  const statsGridBase: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: statsCols,
    columnGap: "0.55ch",
    alignItems: "center",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    justifyContent: "start",
  };

  function valOrDash(v: number | null | undefined, showDash: boolean) {
    if (showDash) return "-";
    if (v == null) return "0";
    return String(v);
  }

  const ladderContent = useMemo(() => {
    if (loading) return <p style={{ color: theme.muted }}>Loading ladder...</p>;
    if (error) return <p style={{ color: theme.danger, whiteSpace: "pre-wrap" }}>Error: {error}</p>;
    if (!rows.length) return <p style={{ color: theme.muted }}>No ladder entries found.</p>;

    const showDash = viewType === "FRIENDLY";

    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 8 }}>
        <div
          ref={listScrollRef}
          style={{
            maxHeight: 560,
            overflowY: "auto",
            paddingBottom: 2,
          }}
        >
          {/* Table header */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              background: theme.surface,
              boxShadow: "0 2px 0 rgba(0,0,0,0.02)",

              display: "grid",
              gridTemplateColumns: "44px minmax(0, 1fr) 72px minmax(0, 1fr)",
              gap: 10,
              padding: "10px 10px",
              borderBottom: `1px solid ${theme.border}`,
              color: theme.muted,
              fontSize: 12,
              fontWeight: 900,
              alignItems: "center",
            }}
          >
            <div>#</div>
            <div>Player</div>
            <div />
            <div
              ref={headerStatsScrollRef}
              onScroll={onHeaderStatsScroll}
              style={{
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch" as any,
              }}
            >
              <div style={statsGridBase}>
                <div>PTS</div>
                <div style={{ textAlign: "center" }}>*</div>
                <div>P</div>
                <div>W</div>
                <div>D</div>
                <div>L</div>
                <div style={{ textAlign: "center" }}>*</div>
                <div>SD</div>
                <div>SF</div>
                <div>SA</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 6, padding: "8px 8px 6px" }}>
            {rows.map((r, idx) => {
              const computedPos = idx + 1;
              const eligible = isEligible(computedPos, r.player_id);
              const isMe = myPlayerId === r.player_id;
              const targetGender = genderByPlayerId[r.player_id] ?? "";
              const canChallengeGender = !!myGender && !!targetGender && myGender === targetGender;

              const buttonTitle =
                viewType === "RANKED"
                  ? eligible
                    ? "Create a ranked challenge (??2 rule)"
                    : "Ranked challenges must be within ??2 positions"
                  : eligible
                  ? "Create a friendly match (no ladder impact)"
                  : "Cannot challenge yourself";
              const finalTitle = !canChallengeGender
                ? "You can only challenge players of the same gender."
                : buttonTitle;

              return (
                <div
                  key={r.player_id}
                  ref={(el) => {
                    if (el) rowRefs.current[r.player_id] = el;
                    else delete rowRefs.current[r.player_id];
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px minmax(0, 1fr) 72px minmax(0, 1fr)",
                    gap: 10,
                    alignItems: "center",
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: `1px solid ${isMe ? theme.maroon : theme.border}`,
                    background: isMe ? "rgba(122,31,43,0.08)" : "#fff",
                  }}
                >
                  {/* Position */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      background: isMe ? "rgba(122,31,43,0.16)" : "rgba(46,125,50,.10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: theme.maroon,
                      fontWeight: 900,
                    }}
                  >
                    {computedPos}
                  </div>

                  {/* Player */}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.full_name} {isMe ? "(You)" : ""}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                      Handicap {Number(r.handicap).toFixed(1)}
                    </div>
                  </div>

                  {/* Action */}
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    {!isMe && canChallengeGender && (
                      <button
                        disabled={!eligible}
                        onClick={() => eligible && createChallenge(r.player_id)}
                        style={{
                          border: eligible ? "none" : `1px solid ${theme.border}`,
                          background: eligible ? theme.maroon : "transparent",
                          color: eligible ? "#fff" : theme.muted,
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: 13,
                          cursor: eligible ? "pointer" : "not-allowed",
                          opacity: eligible ? 1 : 0.55,
                          minWidth: 54,
                        }}
                        title={finalTitle}
                      >
                        Play
                      </button>
                    )}
                  </div>

                  {/* Stats (scroll controlled by header only) */}
                  <div
                    ref={(el) => {
                      if (el) rowStatsRefs.current[r.player_id] = el;
                      else delete rowStatsRefs.current[r.player_id];
                    }}
                    style={{
                      overflowX: "hidden",
                      overflowY: "hidden",
                    }}
                  >
                    <div
                      style={{
                        ...statsGridBase,
                        fontSize: 13,
                        fontWeight: 900,
                        color: theme.muted,
                      }}
                    >
                      <div style={{ color: theme.text, textAlign: "right" }}>{valOrDash(r.points, showDash)}</div>
                      <div style={{ textAlign: "center" }}>*</div>

                      <div style={{ textAlign: "right" }}>{valOrDash(r.played, showDash)}</div>
                      <div style={{ textAlign: "right" }}>{valOrDash(r.won, showDash)}</div>
                      <div style={{ textAlign: "right" }}>{valOrDash(r.drawn, showDash)}</div>
                      <div style={{ textAlign: "right" }}>{valOrDash(r.lost, showDash)}</div>

                      <div style={{ textAlign: "center" }}>*</div>

                      <div style={{ textAlign: "right" }}>{valOrDash(r.shot_diff, showDash)}</div>
                      <div style={{ textAlign: "right" }}>{valOrDash(r.shots_for, showDash)}</div>
                      <div style={{ textAlign: "right" }}>{valOrDash(r.shots_against, showDash)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Friendly note */}
        {viewType === "FRIENDLY" && (
          <div style={{ padding: "10px 10px 2px", color: theme.muted, fontSize: 12, fontWeight: 800 }}>
            Friendly matches do not affect ladder stats or movement (stats shown as -).
          </div>
        )}
      </div>
    );
  }, [loading, error, rows, myPosition, myPlayerId, viewType, genderFilter, myGender, genderByPlayerId]);

  const pendingSection = useMemo(() => {
    if (loading) return null;

    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Your Pending Matches</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {matchTypeBadge(viewType)}
            <div style={{ color: theme.muted, fontSize: 12 }}>OPEN / RESULT_SUBMITTED</div>
          </div>
        </div>

        {!pendingMatches.length ? (
          <div style={{ marginTop: 6, color: theme.muted, fontSize: 13 }}>No pending matches.</div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingMatches.map((m) => {
              const aName = nameByPlayerId.get(m.challenger_player_id) ?? "Challenger";
              const bName = nameByPlayerId.get(m.challenged_player_id) ?? "Challenged";

              const aScore = m.challenger_score ?? 0;
              const bScore = m.challenged_score ?? 0;

              const label = m.status === "OPEN" ? "Open (enter score)" : "Result submitted (confirm if you didn't submit)";
              const mt = normalizeMatchType(m.match_type);

              return (
                <a
                  key={m.id}
                  href={`/match/${m.id}`}
                  style={{
                    textDecoration: "none",
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 14,
                    padding: 10,
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ color: theme.muted, fontSize: 12 }}>{safeDateLabel(m.created_at)}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {matchTypeBadge(mt)}
                      <div style={{ color: theme.muted, fontSize: 12 }}>{label}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {aName}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900 }}>
                      {aScore} - {bScore}
                    </div>
                    <div
                      style={{
                        fontWeight: 900,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {bName}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: theme.maroon, fontWeight: 900 }}>
                    {`Open match \u2192`}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [loading, pendingMatches, nameByPlayerId, viewType]);

  const recentResults = useMemo(() => {
    if (loading) return null;

    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Recent Results</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {matchTypeBadge(viewType)}
            <div style={{ color: theme.muted, fontSize: 12 }}>Last 10 FINAL</div>
          </div>
        </div>

        {!recentMatches.length ? (
          <div style={{ marginTop: 6, color: theme.muted, fontSize: 13 }}>No finalised matches yet.</div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {recentMatches.map((m) => {
              const aName = nameByPlayerId.get(m.challenger_player_id) ?? "Challenger";
              const bName = nameByPlayerId.get(m.challenged_player_id) ?? "Challenged";

              const aScore = m.challenger_score ?? 0;
              const bScore = m.challenged_score ?? 0;

              const aWon = aScore > bScore;
              const bWon = bScore > aScore;

              const mt = normalizeMatchType(m.match_type);

              return (
                <div key={m.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ color: theme.muted, fontSize: 12 }}>{safeDateLabel(m.created_at)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {matchTypeBadge(mt)}
                      <div style={{ color: theme.muted, fontSize: 12 }}>Match: {m.id.slice(0, 8)}...</div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: aWon ? theme.maroon : theme.text,
                      }}
                    >
                      {aName}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900 }}>
                      {aScore} - {bScore}
                      <div style={{ marginTop: 2, fontSize: 12, color: theme.muted }}>
                        {aWon ? "Challenger won" : bWon ? "Challenged won" : "Draw"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 900,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: bWon ? theme.maroon : theme.text,
                      }}
                    >
                      {bName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [loading, recentMatches, nameByPlayerId, viewType]);

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>HandiBowls SA</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              {`Leaderboards | Scope: ${scope} | Gender: ${genderFilter} | Format: ${formatFilter} | Your position: ${myPosition ?? "-"} | Ranked rule: +/-2 | Friendly: any`}
            </div>
          </div>

          <button
            onClick={loadAll}
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
            R
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            marginTop: 12,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Scope</div>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                }}
              >
                <option value="CLUB" disabled={!myClubId || !clubLadderId}>
                  Club
                </option>
                <option value="DISTRICT" disabled={!myDistrictId || !districtLadderId}>
                  District
                </option>
                <option value="NATIONAL" disabled={!nationalLadderId}>
                  National
                </option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Gender</div>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                }}
              >
                <option value="ALL">All</option>
                <option value="MALE">Men</option>
                <option value="FEMALE">Ladies</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Format</div>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as LadderFormat)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                }}
              >
                <option value="ALL">All</option>
                <option value="SINGLES">Singles</option>
                <option value="DOUBLES">Doubles</option>
                <option value="TRIPLES">Triples</option>
                <option value="FOUR_BALL">4 Balls</option>
              </select>
              <div style={{ marginTop: 4, fontSize: 11, color: theme.muted }}>Format filter will apply once ladder data includes formats.</div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Match Type</div>
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value as MatchType)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                }}
              >
                <option value="RANKED">Ranked</option>
                <option value="FRIENDLY">Friendly</option>
              </select>
            </div>
          </div>
        </div>

        {notice && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.maroon,
              fontWeight: 700,
            }}
          >
            {notice}
          </div>
        )}

        <div style={{ marginTop: 12 }}>{ladderContent}</div>
        <div style={{ marginTop: 12 }}>{pendingSection}</div>
        <div style={{ marginTop: 12 }}>{recentResults}</div>
      </div>

      <BottomNav />
    </div>
  );
}
