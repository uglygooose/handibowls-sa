"use client";


import { theme } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import BottomNav from "../components/BottomNav";
import { isMissingColumnError } from "./utils/ladder";
import LadderContentView from "./views/LadderContentView";
import LadderActivityView from "./views/LadderActivityView";

type MatchType = "RANKED";
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
type MePlayerLadderRow = { id: string; gender?: PlayerGender | null };
type ProfileIdRow = { id: string };
type PlayerIdRow = { id: string };
type ClubIdRow = { id: string };
type ProfileMiniRow = {
  id: string;
  full_name: string | null;
  club_id: string | null;
  district_id: string | null;
  role?: string | null;
};

type ClubMiniRow = {
  id: string;
  name: string;
  district_id: string | null;
};

export type LadderRow = {
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

export type MatchRow = {
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

export default function ClubLadderPage() {
  const supabase = createClient();

  const [scope, setScope] = useState<Scope>("CLUB");
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

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [clubsAll, setClubsAll] = useState<ClubMiniRow[]>([]);
  const [superClubId, setSuperClubId] = useState<string>("");

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

  const filtersFromStorageRef = useRef(false);

  async function loadAllClubs() {
    const res = await supabase.from("clubs").select("id, name, district_id").order("name");
    const list = (res.data ?? []) as ClubMiniRow[];
    if (!res.error) setClubsAll(list);
    return list;
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
      .select("id, full_name, club_id, district_id, role")
      .eq("id", user.id)
      .single();

    if (pErr || !prof) {
      setError(`profiles: ${pErr?.message ?? "Profile not found"}`);
      setLoading(false);
      return;
    }

    const myProf = prof as ProfileMiniRow;
    const role = (myProf.role ?? "").toString().toUpperCase();
    const superAdmin = role === "SUPER_ADMIN";
    setIsSuperAdmin(superAdmin);
    let clubIdForScope: string | null = myProf.club_id ?? null;
    let districtIdForScope: string | null = myProf.district_id ?? null;

    if (superAdmin) {
      let list = clubsAll;
      if (!list.length) {
        list = await loadAllClubs();
      }
      if (!list.length) {
        setError("No clubs found.");
        setLoading(false);
        return;
      }
      let nextClubId = superClubId;
      if (!nextClubId) {
        try {
          nextClubId = localStorage.getItem("superClubId") ?? "";
        } catch {
          nextClubId = "";
        }
      }
      if (!nextClubId) nextClubId = myProf.club_id ?? "";
      if (!nextClubId && list.length) nextClubId = list[0].id;
      if (nextClubId && nextClubId !== superClubId) setSuperClubId(nextClubId);

      const selected = list.find((c) => c.id === nextClubId) ?? null;
      clubIdForScope = selected?.id ?? null;
      districtIdForScope = selected?.district_id ?? null;
      setMyClubId(clubIdForScope);
      setMyDistrictId(districtIdForScope);
    } else {
      setMyClubId(myProf.club_id ?? null);
      setMyDistrictId(myProf.district_id ?? null);
    }

    // Load my player
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id, gender")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      if (!superAdmin) {
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
      setMyPlayerId(null);
      setMyGender("");
    }

    const mePlayerRow = (mePlayer ?? null) as MePlayerLadderRow | null;
    const mePlayerId = mePlayerRow ? String(mePlayerRow.id) : null;
    setMyPlayerId(mePlayerId);
    setMyGender((mePlayerRow?.gender ?? "") as PlayerGender);
    const resolvedGender = (mePlayerRow?.gender ?? "") as PlayerGender;
    const hasGender = resolvedGender === "MALE" || resolvedGender === "FEMALE";
    if (!filtersFromStorageRef.current) {
      setScope("CLUB");
      setFormatFilter("SINGLES");
      if (hasGender) setGenderFilter(resolvedGender as GenderFilter);
    }

    // Load ladders
    const { data: ladders, error: lErr } = await supabase.from("ladders").select("id, scope, club_id, district_id");

    if (lErr) {
      setError(`ladders: ${lErr.message}`);
      setLoading(false);
      return;
    }

    const ladderRows = (ladders ?? []) as LadderMetaRow[];

    const clubLadder = clubIdForScope ? ladderRows.find((l) => l.scope === "CLUB" && l.club_id === clubIdForScope) : null;

    const districtLadder = districtIdForScope
      ? ladderRows.find((l) => l.scope === "DISTRICT" && l.district_id === districtIdForScope)
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
      if (!clubIdForScope) {
        allowedPlayerIds = [];
      } else {
        const { data: clubProfiles, error: cpErr } = await supabase.from("profiles").select("id").eq("club_id", clubIdForScope);

        if (cpErr) {
          setError(`profiles (club filter): ${cpErr.message}`);
          setLoading(false);
          return;
        }

        const userIds = ((clubProfiles ?? []) as ProfileIdRow[]).map((x) => x.id);
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
          .eq("club_id", clubIdForScope);

        if (clcErr) {
          setError(`players (club filter): ${clcErr.message}`);
          setLoading(false);
          return;
        }

        const ids = new Set<string>([...((clubPlayersByUser ?? []) as PlayerIdRow[]).map((x) => x.id), ...((clubPlayersByClub ?? []) as PlayerIdRow[]).map((x) => x.id)]);
        allowedPlayerIds = Array.from(ids);
      }
    } else if (scope === "DISTRICT") {
      if (!districtIdForScope) {
        allowedPlayerIds = [];
      } else {
        const { data: distProfiles, error: dpErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("district_id", districtIdForScope);

        if (dpErr) {
          setError(`profiles (district filter): ${dpErr.message}`);
          setLoading(false);
          return;
        }

        const userIds = ((distProfiles ?? []) as ProfileIdRow[]).map((x) => x.id);
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
          .eq("district_id", districtIdForScope);

        if (dcErr) {
          setError(`clubs (district filter): ${dcErr.message}`);
          setLoading(false);
          return;
        }

        const clubIds = ((districtClubs ?? []) as ClubIdRow[]).map((x) => x.id);
        const { data: distPlayersByClub, error: dpcErr } = clubIds.length
          ? await supabase.from("players").select("id").in("club_id", clubIds)
          : { data: [], error: null };

        if (dpcErr) {
          setError(`players (district filter): ${dpcErr.message}`);
          setLoading(false);
          return;
        }

        const ids = new Set<string>([...((distPlayersByUser ?? []) as PlayerIdRow[]).map((x) => x.id), ...((distPlayersByClub ?? []) as PlayerIdRow[]).map((x) => x.id)]);
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
        .order("shots_for", { ascending: false })
        .order("position", { ascending: true }); // deterministic tie-break (must match API)

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

      const myIdx = mePlayerId ? fallback.findIndex((x) => x.player_id === mePlayerId) : -1;
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
      const pr = pl?.user_id ? profileById.get(pl.user_id) : null;
      const dn = pl?.display_name ?? "";
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
            const p = playerById.get(r.player_id);
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
    const myIdx = mePlayerId ? finalRows.findIndex((x) => x.player_id === mePlayerId) : -1;
    setMyPosition(myIdx >= 0 ? myIdx + 1 : null);


	    // pending matches for me (this ladder) - ranked only
    {
      if (!mePlayerId) {
        setPendingMatches([]);
      } else {
      const baseSelect =
        "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const withTypeSelect =
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const q1 = await supabase
        .from("matches")
        .select(withTypeSelect)
	        .eq("ladder_id", fallback)
	        .in("status", ["OPEN", "RESULT_SUBMITTED"])
	        .or(`challenger_player_id.eq.${mePlayerId},challenged_player_id.eq.${mePlayerId}`)
	        .eq("match_type", "RANKED")
	        .order("created_at", { ascending: false })
	        .limit(10);

      if (!q1.error) {
        setPendingMatches((q1.data ?? []) as MatchRow[]);
	      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
	        // fallback: if no match_type column, show what we can (assumes ranked-only)
	        const q2 = await supabase
	          .from("matches")
	          .select(baseSelect)
	          .eq("ladder_id", fallback)
	          .in("status", ["OPEN", "RESULT_SUBMITTED"])
	          .or(`challenger_player_id.eq.${mePlayerId},challenged_player_id.eq.${mePlayerId}`)
	          .order("created_at", { ascending: false })
	          .limit(10);

	        if (q2.error) {
	          setError(`pending matches: ${q2.error.message}`);
	          setPendingMatches([]);
	          setLoading(false);
	          return;
	        }

	        const patched = ((q2.data ?? []) as Omit<MatchRow, "match_type">[]).map((m) => ({ ...m, match_type: "RANKED" as MatchType }));
	        setPendingMatches(patched as MatchRow[]);
	      } else {
	        setError(`pending matches: ${q1.error.message}`);
	        setPendingMatches([]);
	        setLoading(false);
        return;
      }
      }
    }

	    // recent FINAL matches (this ladder) - ranked only
    {
      if (!mePlayerId) {
        setRecentMatches([]);
      } else {
      const baseSelect =
        "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

      const withTypeSelect =
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, challenger_position_at_start, challenged_position_at_start, created_at";

	      const q1 = await supabase
	        .from("matches")
	        .select(withTypeSelect)
	        .eq("ladder_id", fallback)
	        .eq("status", "FINAL")
	        .eq("match_type", "RANKED")
	        .order("created_at", { ascending: false })
	        .limit(10);

	      if (!q1.error) {
	        setRecentMatches((q1.data ?? []) as MatchRow[]);
	      } else if (q1.error && isMissingColumnError(q1.error.message, "match_type")) {
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

	        const patched = ((q2.data ?? []) as Omit<MatchRow, "match_type">[]).map((m) => ({ ...m, match_type: "RANKED" as MatchType }));
	        setRecentMatches(patched as MatchRow[]);
	      } else {
	        setError(`matches: ${q1.error.message}`);
	        setRecentMatches([]);
	        setLoading(false);
        return;
      }
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
	          gender?: GenderFilter;
	          format?: LadderFormat;
	        };

	        if (parsed.scope) setScope(parsed.scope);
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
	  }, [filtersReady, scope, genderFilter, superClubId]);

	  useEffect(() => {
	    try {
	      window.localStorage.setItem(
	        "clubLadderFilters",
	        JSON.stringify({
	          scope,
	          gender: genderFilter,
	          format: formatFilter,
	        })
	      );
	    } catch {}
	  }, [scope, genderFilter, formatFilter]);

  // Clamp gender filter to the signed-in player's gender (non-admins).
  useEffect(() => {
    if (isSuperAdmin) return;

    if (myGender === "MALE") {
      if (genderFilter === "FEMALE") setGenderFilter("MALE");
      return;
    }
    if (myGender === "FEMALE") {
      if (genderFilter === "MALE") setGenderFilter("FEMALE");
      return;
    }

    // Unknown / unset gender: default to ALL
    if (genderFilter !== "ALL") setGenderFilter("ALL");
  }, [isSuperAdmin, myGender, genderFilter]);

  useEffect(() => {
    if (!isSuperAdmin || !superClubId) return;
    try {
      window.localStorage.setItem("superClubId", superClubId);
    } catch {}
  }, [isSuperAdmin, superClubId]);

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
	          match_type: "RANKED",
	          gender_filter: genderFilter,
	        }),
	      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Network error calling API: ${message}`);
      return;
    }

    const text = await res.text();
    let json: { error?: string; ok?: boolean } | null = null;

    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text) as { error?: string; ok?: boolean };
      } catch {}
    }

    if (!res.ok) {
      const msg =
        json?.error ??
        (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status}): empty response body`);
      setError(msg);
      return;
    }

	    setNotice(json?.ok ? "Challenge created (Ranked) - expires in 3 days." : "Challenge created (Ranked).");
	  }


  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>HandiBowls SA</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              {`Leaderboards | Scope: ${scope} | Gender: ${genderFilter} | Format: ${formatFilter} | Your position: ${myPosition ?? "-"} | Ranked rule: +/-2`}
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
            {"\u21BB"}
          </button>
        </div>

        {isSuperAdmin && (
          <div
            style={{
              marginTop: 12,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>Club context</div>
            <select
              value={superClubId}
              onChange={(e) => setSuperClubId(e.target.value)}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
              }}
            >
              {clubsAll.length ? (
                clubsAll.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="">Loading clubs...</option>
              )}
            </select>
          </div>
        )}

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
	                {isSuperAdmin || myGender === "MALE" ? <option value="MALE">Men</option> : null}
	                {isSuperAdmin || myGender === "FEMALE" ? <option value="FEMALE">Ladies</option> : null}
	              </select>
	            </div>
	          </div>

	          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
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

        <div style={{ marginTop: 12 }}>
          <LadderContentView
            loading={loading}
            error={error}
            rows={rows}
            myPlayerId={myPlayerId}
            myGender={myGender}
            genderByPlayerId={genderByPlayerId}
            scope={scope}
            genderFilter={genderFilter}
            createChallenge={createChallenge}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <LadderActivityView
            loading={loading}
            pendingMatches={pendingMatches}
            recentMatches={recentMatches}
            nameByPlayerId={nameByPlayerId}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
