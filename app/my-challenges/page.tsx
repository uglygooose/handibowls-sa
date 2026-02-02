"use client";


import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "../components/BottomNav";

type MatchType = "RANKED" | "FRIENDLY";
type Tab = "INCOMING" | "OUTGOING" | "MATCHES";

type ChallengeRow = {
  id: string;
  ladder_id: string;
  challenger_player_id: string;
  challenged_player_id: string;
  status: string;
  expires_at: string;
  match_id?: string | null;
  created_at?: string;

  match_type?: MatchType | null;
};

type MatchRow = {
  id: string;
  ladder_id: string;
  match_type?: MatchType | null;

  status: string;

  challenger_player_id: string;
  challenged_player_id: string;

  challenger_score: number | null;
  challenged_score: number | null;

  submitted_by_player_id: string | null;
  submitted_at: string | null;

  created_at: string;
};

type PlayerRow = { id: string; user_id: string };
type ProfileRow = { id: string; full_name: string | null };

type LadderScope = "CLUB" | "DISTRICT" | "NATIONAL";
type LadderRow = { id: string; scope: LadderScope };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeParseMs(iso: string) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function formatTimeRemaining(expiresAtIso: string) {
  const end = safeParseMs(expiresAtIso);
  if (end === null) return "-";

  const ms = end - Date.now();
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function normalizeMatchType(v: any): MatchType {
  const t = String(v ?? "RANKED").toUpperCase();
  return t === "FRIENDLY" ? "FRIENDLY" : "RANKED";
}

function isMissingColumnError(msg: string | null | undefined, col: string) {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes(`column "${col.toLowerCase()}"`) && m.includes("does not exist");
}

function badge(matchType: MatchType) {
  const isFriendly = matchType === "FRIENDLY";
  const bg = isFriendly ? "rgba(107,114,128,.10)" : "rgba(46,125,50,.10)";
  const color = isFriendly ? theme.muted : theme.maroon;

  return (
    <span
      style={{
        flex: "0 0 auto",
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        background: bg,
        color,
        border: `1px solid ${theme.border}`,
      }}
      title={isFriendly ? "Friendly (no ladder impact)" : "Ranked (affects ladder)"}
    >
      {isFriendly ? "Friendly" : "Ranked"}
    </span>
  );
}

function scopeBadge(scope: LadderScope | "UNKNOWN") {
  const label = scope === "UNKNOWN" ? "-" : scope;
  return (
    <span
      style={{
        flex: "0 0 auto",
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(31,41,55,.06)",
        color: theme.text,
        border: `1px solid ${theme.border}`,
      }}
      title="Ladder scope"
    >
      {label}
    </span>
  );
}

function splitCounts(items: Array<{ match_type?: any }>) {
  const ranked = items.filter((x) => normalizeMatchType(x.match_type) === "RANKED").length;
  const friendly = items.filter((x) => normalizeMatchType(x.match_type) === "FRIENDLY").length;
  return { ranked, friendly };
}

function applyTypeFilter<T extends { match_type?: any }>(items: T[], filter: MatchType | null) {
  if (!filter) return items;
  return items.filter((x) => normalizeMatchType(x.match_type) === filter);
}

export default function MyChallengesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [tab, setTab] = useState<Tab>("INCOMING");

  // Row 2 filter: null = ALL (no filter), otherwise RANKED / FRIENDLY
  const [typeFilter, setTypeFilter] = useState<MatchType | null>(null);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [nameByPlayerId, setNameByPlayerId] = useState<Map<string, string>>(new Map());
  const [scopeByLadderId, setScopeByLadderId] = useState<Map<string, LadderScope>>(new Map());

  // prevent double-cancel / double-action clicks
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // tick to update expiry labels
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);

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

    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (meErr || !mePlayer) {
      if (superAdmin) {
        setNotice("Super admin: no player record, so personal challenges are hidden.");
        setChallenges([]);
        setMatches([]);
        setNameByPlayerId(new Map());
        setScopeByLadderId(new Map());
        setLoading(false);
        return;
      } else {
        setError("This signed-in account is not linked to a player record.");
        setLoading(false);
        return;
      }
    }

    setMyPlayerId(mePlayer.id);

    // ---------- challenges (with match_type fallback) ----------
    let challengeRows: ChallengeRow[] = [];
    {
      const q1 = await supabase
        .from("challenges")
        .select(
          "id, ladder_id, challenger_player_id, challenged_player_id, status, expires_at, match_id, created_at, match_type"
        )
        .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
        .order("created_at", { ascending: false });

      if (!q1.error) {
        challengeRows = (q1.data ?? []) as ChallengeRow[];
      } else if (isMissingColumnError(q1.error.message, "match_type")) {
        const q2 = await supabase
          .from("challenges")
          .select(
            "id, ladder_id, challenger_player_id, challenged_player_id, status, expires_at, match_id, created_at"
          )
          .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
          .order("created_at", { ascending: false });

        if (q2.error) {
          setError(`challenges: ${q2.error.message}`);
          setLoading(false);
          return;
        }
        challengeRows = (q2.data ?? []) as ChallengeRow[];
      } else {
        setError(`challenges: ${q1.error.message}`);
        setLoading(false);
        return;
      }
    }

    challengeRows = challengeRows.map((c) => ({
      ...c,
      match_type: normalizeMatchType(c.match_type),
    }));

    // ---------- matches (with match_type fallback) ----------
    let matchRows: MatchRow[] = [];
    {
      const m1 = await supabase
        .from("matches")
        .select(
          "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at, created_at"
        )
        .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!m1.error) {
        matchRows = (m1.data ?? []) as MatchRow[];
      } else if (isMissingColumnError(m1.error.message, "match_type")) {
        const m2 = await supabase
          .from("matches")
          .select(
            "id, ladder_id, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at, created_at"
          )
          .or(`challenger_player_id.eq.${mePlayer.id},challenged_player_id.eq.${mePlayer.id}`)
          .order("created_at", { ascending: false })
          .limit(100);

        if (m2.error) {
          setError(`matches: ${m2.error.message}`);
          setLoading(false);
          return;
        }
        matchRows = (m2.data ?? []) as MatchRow[];
      } else {
        setError(`matches: ${m1.error.message}`);
        setLoading(false);
        return;
      }
    }

    matchRows = matchRows.map((m) => ({
      ...m,
      match_type: normalizeMatchType(m.match_type),
    }));

    setChallenges(challengeRows);
    setMatches(matchRows);

    // ---------- ladder scope map ----------
    const ladderIds = Array.from(
      new Set([...challengeRows.map((c) => c.ladder_id), ...matchRows.map((m) => m.ladder_id)])
    ).filter((x) => typeof x === "string" && UUID_RE.test(String(x)));

    if (ladderIds.length > 0) {
      const { data: ladders, error: lErr } = await supabase
        .from("ladders")
        .select("id, scope")
        .in("id", ladderIds);

      if (!lErr) {
        const rows = (ladders ?? []) as LadderRow[];
        setScopeByLadderId(new Map(rows.map((r) => [r.id, r.scope])));
      } else {
        setScopeByLadderId(new Map());
      }
    } else {
      setScopeByLadderId(new Map());
    }

    // ---------- name map for all players in challenges + matches ----------
    const playerIds = Array.from(
      new Set([
        ...challengeRows.flatMap((x) => [x.challenger_player_id, x.challenged_player_id]),
        ...matchRows.flatMap((x) => [x.challenger_player_id, x.challenged_player_id]),
      ])
    ).filter((x) => typeof x === "string" && UUID_RE.test(String(x)));

    if (playerIds.length === 0) {
      setNameByPlayerId(new Map());
      setLoading(false);
      return;
    }

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, user_id, display_name")
      .in("id", playerIds);

    if (pErr) {
      setError(`players name-map: ${pErr.message}`);
      setLoading(false);
      return;
    }

    const playerRows = (players ?? []) as PlayerRow[];
    const userIds = Array.from(
      new Set(playerRows.map((p) => p.user_id).filter((id): id is string => typeof id === "string" && UUID_RE.test(id)))
    );

    const { data: profiles, error: prErr } =
      userIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [], error: null };

    if (prErr) {
      setError(`profiles name-map: ${prErr.message}`);
      setLoading(false);
      return;
    }

    const profileRows = (profiles ?? []) as ProfileRow[];
    const profileByUserId = new Map(profileRows.map((p) => [p.id, p.full_name ?? "Unknown"]));

    const map = new Map<string, string>();
    for (const pl of playerRows) {
      const display = (pl as any).display_name ?? "";
      const name =
        (display ?? "").toString().trim()
          ? (display as string)
          : profileByUserId.get(pl.user_id ?? "") ?? "Unknown";
      map.set(pl.id, name);
    }
    setNameByPlayerId(map);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset filter to ALL when switching tabs (so you see the total by default)
  useEffect(() => {
    setTypeFilter(null);
  }, [tab]);

  // -------------------- Base derived lists (NOT type-filtered) --------------------
  const now = Date.now();

  const incomingBase = useMemo(() => {
    if (!myPlayerId) return [];
    return challenges.filter((c) => {
      if (c.challenged_player_id !== myPlayerId) return false;
      if (c.status !== "PROPOSED") return false;
      const end = safeParseMs(c.expires_at);
      return end === null || end > now;
    });
  }, [challenges, myPlayerId, now]);

  const outgoingBase = useMemo(() => {
    if (!myPlayerId) return [];
    return challenges.filter((c) => {
      if (c.challenger_player_id !== myPlayerId) return false;
      if (c.status !== "PROPOSED") return false;
      const end = safeParseMs(c.expires_at);
      return end === null || end > now;
    });
  }, [challenges, myPlayerId, now]);

  const matchesInvolvingMe = useMemo(() => {
    if (!myPlayerId) return [];
    return matches.filter(
      (m) => m.challenger_player_id === myPlayerId || m.challenged_player_id === myPlayerId
    );
  }, [matches, myPlayerId]);

  const activeMatchesBase = useMemo(() => {
    return matchesInvolvingMe.filter((m) => m.status === "OPEN" || m.status === "RESULT_SUBMITTED");
  }, [matchesInvolvingMe]);

  const completedMatchesBase = useMemo(() => {
    return matchesInvolvingMe.filter((m) => m.status === "FINAL");
  }, [matchesInvolvingMe]);

  // -------------------- Tab totals (Row 1 counters) --------------------
  const incomingCount = incomingBase.length;
  const outgoingCount = outgoingBase.length;
  const matchesCount = activeMatchesBase.length; // ACTIVE ONLY

  // -------------------- Row 2 split counts depend on active tab --------------------
  const splitForActiveTab = useMemo(() => {
    if (tab === "INCOMING") return splitCounts(incomingBase);
    if (tab === "OUTGOING") return splitCounts(outgoingBase);
    return splitCounts(activeMatchesBase); // MATCHES tab uses ACTIVE ONLY
  }, [tab, incomingBase, outgoingBase, activeMatchesBase]);

  // -------------------- Filtered lists for display (Row 2 filter) --------------------
  const incomingShown = useMemo(
    () => applyTypeFilter(incomingBase, typeFilter),
    [incomingBase, typeFilter]
  );
  const outgoingShown = useMemo(
    () => applyTypeFilter(outgoingBase, typeFilter),
    [outgoingBase, typeFilter]
  );
  const activeMatchesShown = useMemo(
    () => applyTypeFilter(activeMatchesBase, typeFilter),
    [activeMatchesBase, typeFilter]
  );
  const completedMatchesShown = useMemo(
    () => applyTypeFilter(completedMatchesBase, typeFilter),
    [completedMatchesBase, typeFilter]
  );

  // -------------------- Actions --------------------
  async function respond(challenge_id: string, action: "ACCEPT" | "DECLINE") {
    setNotice(null);
    setError(null);

    const res = await fetch("/api/challenges/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id, action }),
    });

    const text = await res.text();
    let json: any = null;
    if (text?.trim()) {
      try {
        json = JSON.parse(text);
      } catch {}
    }

    if (!res.ok) {
      setError(
        json?.error ??
          (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status})`)
      );
      return;
    }

    setNotice(action === "ACCEPT" ? "Challenge accepted." : "Challenge declined.");
    await loadAll();
  }

  async function cancelChallenge(challenge_id: string) {
    if (cancellingId) return;

    setNotice(null);
    setError(null);
    setCancellingId(challenge_id);

    try {
      const res = await fetch("/api/challenges/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id }),
      });

      const text = await res.text();
      let json: any = null;
      if (text?.trim()) {
        try {
          json = JSON.parse(text);
        } catch {}
      }

      if (!res.ok) {
        setError(
          json?.error ??
            (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status})`)
        );
        return;
      }

      setNotice("Challenge cancelled.");
      // ensure any lingering error is cleared after successful refresh
      await loadAll();
      setError(null);
    } finally {
      setCancellingId(null);
    }
  }

  // -------------------- Render helpers --------------------
  function scopeForLadder(ladderId: string): LadderScope | "UNKNOWN" {
    return scopeByLadderId.get(ladderId) ?? "UNKNOWN";
  }

  function opponentForChallenge(c: ChallengeRow, mode: "incoming" | "outgoing") {
    const oppId = mode === "incoming" ? c.challenger_player_id : c.challenged_player_id;
    return {
      id: oppId,
      name: nameByPlayerId.get(oppId) ?? "Unknown",
    };
  }

  function renderChallengeCard(c: ChallengeRow, mode: "incoming" | "outgoing") {
    const mt = normalizeMatchType(c.match_type);
    const opp = opponentForChallenge(c, mode);

    const canRespond = mode === "incoming";
    const canCancel = mode === "outgoing";
    const expiresIn = formatTimeRemaining(c.expires_at);
    const scope = scopeForLadder(c.ladder_id);

    const cancelDisabled = cancellingId === c.id;

    return (
      <div
        key={c.id}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
          opacity: cancelDisabled ? 0.75 : 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
              <div
                style={{
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mode === "incoming" ? "From: " : "To: "}
                {opp.name}
              </div>
              {badge(mt)}
              {scopeBadge(scope)}
            </div>
            <div style={{ marginTop: 4, color: theme.muted, fontSize: 12 }}>
              Expires in: {expiresIn}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, color: theme.muted }}>PROPOSED</div>
          </div>
        </div>

        {(canRespond || canCancel) && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {canRespond && (
              <>
                <button
                  onClick={() => respond(c.id, "ACCEPT")}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 12,
                    border: "none",
                    background: theme.maroon,
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Accept
                </button>

                <button
                  onClick={() => respond(c.id, "DECLINE")}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 12,
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Decline
                </button>
              </>
            )}

            {canCancel && (
              <button
                onClick={() => cancelChallenge(c.id)}
                disabled={cancelDisabled}
                style={{
                  padding: "9px 10px",
                  borderRadius: 12,
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.danger,
                  fontWeight: 900,
                  cursor: cancelDisabled ? "not-allowed" : "pointer",
                }}
                title="Cancel this outgoing challenge"
              >
                {cancelDisabled ? "Cancelling..." : "Cancel"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function opponentForMatch(m: MatchRow) {
    if (!myPlayerId) return { name: "Opponent", id: "" };
    const oppId =
      m.challenger_player_id === myPlayerId ? m.challenged_player_id : m.challenger_player_id;
    return { id: oppId, name: nameByPlayerId.get(oppId) ?? "Opponent" };
  }

  function matchActionLabel(m: MatchRow) {
    if (!myPlayerId) return m.status;

    if (m.status === "OPEN") return "Enter score";

    if (m.status === "RESULT_SUBMITTED") {
      if (m.submitted_by_player_id === myPlayerId) return "Waiting for confirmation";
      return "Confirm result";
    }

    if (m.status === "FINAL") return "Final";
    return m.status;
  }

  function renderMatchCard(m: MatchRow) {
    const mt = normalizeMatchType(m.match_type);
    const opp = opponentForMatch(m);
    const scope = scopeForLadder(m.ladder_id);

    const aScore = m.challenger_score ?? 0;
    const bScore = m.challenged_score ?? 0;

    const label = matchActionLabel(m);

    return (
      <a
        key={m.id}
        href={`/match/${m.id}`}
        style={{
          textDecoration: "none",
          color: theme.text,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
          display: "block",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontWeight: 900,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            vs {opp.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {badge(mt)}
            {scopeBadge(scope)}
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{label}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nameByPlayerId.get(m.challenger_player_id) ?? "Challenger"}
          </div>

          <div style={{ textAlign: "center", fontWeight: 900 }}>
            {aScore} - {bScore}
          </div>

          <div
            style={{
              textAlign: "right",
              fontWeight: 900,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {nameByPlayerId.get(m.challenged_player_id) ?? "Challenged"}
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: theme.maroon, fontWeight: 900 }}>
          {"Open match ->"}
        </div>
      </a>
    );
  }

  function SectionHeader(props: { title: string; count: number }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>{props.title}</div>
        <div style={{ color: theme.muted, fontSize: 12, fontWeight: 900 }}>{props.count}</div>
      </div>
    );
  }

  function renderGroupedChallenges(list: ChallengeRow[], mode: "incoming" | "outgoing") {
    const order: Array<LadderScope> = ["CLUB", "DISTRICT", "NATIONAL"];

    const byScope = new Map<LadderScope | "UNKNOWN", ChallengeRow[]>();
    for (const c of list) {
      const s = scopeForLadder(c.ladder_id);
      const arr = byScope.get(s) ?? [];
      arr.push(c);
      byScope.set(s, arr);
    }

    const sections: Array<{ scope: LadderScope | "UNKNOWN"; items: ChallengeRow[] }> = [
      ...order.map((s) => ({ scope: s, items: byScope.get(s) ?? [] })),
      ...(byScope.get("UNKNOWN")
        ? [{ scope: "UNKNOWN" as const, items: byScope.get("UNKNOWN")! }]
        : []),
    ].filter((x) => x.items.length > 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map((sec) => (
          <div
            key={sec.scope}
            style={{
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <SectionHeader title={sec.scope === "UNKNOWN" ? "Other" : sec.scope} count={sec.items.length} />
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {sec.items.map((c) => renderChallengeCard(c, mode))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderGroupedMatches(list: MatchRow[]) {
    const order: Array<LadderScope> = ["CLUB", "DISTRICT" , "NATIONAL"];

    const byScope = new Map<LadderScope | "UNKNOWN", MatchRow[]>();
    for (const m of list) {
      const s = scopeForLadder(m.ladder_id);
      const arr = byScope.get(s) ?? [];
      arr.push(m);
      byScope.set(s, arr);
    }

    const sections: Array<{ scope: LadderScope | "UNKNOWN"; items: MatchRow[] }> = [
      ...order.map((s) => ({ scope: s, items: byScope.get(s) ?? [] })),
      ...(byScope.get("UNKNOWN")
        ? [{ scope: "UNKNOWN" as const, items: byScope.get("UNKNOWN")! }]
        : []),
    ].filter((x) => x.items.length > 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map((sec) => (
          <div
            key={sec.scope}
            style={{
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <SectionHeader title={sec.scope === "UNKNOWN" ? "Other" : sec.scope} count={sec.items.length} />
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {sec.items.map((m) => renderMatchCard(m))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const headerRight = (
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
  );

  const tabButtonStyle = (active: boolean) => ({
    border: `1px solid ${theme.border}`,
    background: active ? theme.maroon : "#fff",
    color: active ? "#fff" : theme.text,
    padding: "10px 10px",
    borderRadius: 14,
    fontWeight: 900 as const,
    cursor: "pointer",
  });

  const typeButtonStyle = (active: boolean) => ({
    border: `1px solid ${theme.border}`,
    background: active ? theme.maroon : "#fff",
    color: active ? "#fff" : theme.text,
    padding: "10px 10px",
    borderRadius: 14,
    fontWeight: 900 as const,
    cursor: "pointer",
  });

  function toggleType(next: MatchType) {
    setTypeFilter((prev) => (prev === next ? null : next)); // click again => ALL
  }

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text, paddingBottom: 92 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>HandiBowls SA</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>My Challenges</div>
          </div>
          {headerRight}
        </div>

        {notice && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.maroon,
              fontWeight: 800,
            }}
          >
            {notice}
          </div>
        )}

        {/* Row 1: Tabs (TOTAL counts) */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <button onClick={() => setTab("INCOMING")} style={tabButtonStyle(tab === "INCOMING")}>
            Incoming ({incomingCount})
          </button>

          <button onClick={() => setTab("OUTGOING")} style={tabButtonStyle(tab === "OUTGOING")}>
            Outgoing ({outgoingCount})
          </button>

          <button onClick={() => setTab("MATCHES")} style={tabButtonStyle(tab === "MATCHES")}>
            Matches ({matchesCount})
          </button>
        </div>

        {/* Row 2: Ranked / Friendly (split for selected tab) */}
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => toggleType("RANKED")} style={typeButtonStyle(typeFilter === "RANKED")}>
            Ranked ({splitForActiveTab.ranked})
          </button>

          <button onClick={() => toggleType("FRIENDLY")} style={typeButtonStyle(typeFilter === "FRIENDLY")}>
            Friendly ({splitForActiveTab.friendly})
          </button>
        </div>

        {loading && <p style={{ color: theme.muted, marginTop: 12 }}>Loading...</p>}

        {error && (
          <p style={{ color: theme.danger, whiteSpace: "pre-wrap", marginTop: 12 }}>
            Error: {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {tab === "INCOMING" && (
              <div style={{ marginTop: 14 }}>
                {incomingShown.length === 0 ? (
                  <p style={{ color: theme.muted }}>
                    No incoming challenges{typeFilter ? ` (${typeFilter.toLowerCase()})` : ""}.
                  </p>
                ) : (
                  <div style={{ marginTop: 12 }}>{renderGroupedChallenges(incomingShown, "incoming")}</div>
                )}
              </div>
            )}

            {tab === "OUTGOING" && (
              <div style={{ marginTop: 14 }}>
                {outgoingShown.length === 0 ? (
                  <p style={{ color: theme.muted }}>
                    No outgoing challenges{typeFilter ? ` (${typeFilter.toLowerCase()})` : ""}.
                  </p>
                ) : (
                  <div style={{ marginTop: 12 }}>{renderGroupedChallenges(outgoingShown, "outgoing")}</div>
                )}
              </div>
            )}

            {tab === "MATCHES" && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <SectionHeader title="Active Matches" count={activeMatchesShown.length} />

                  {activeMatchesShown.length === 0 ? (
                    <div style={{ marginTop: 8, color: theme.muted, fontSize: 13 }}>
                      No active matches{typeFilter ? ` (${typeFilter.toLowerCase()})` : ""}.
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }}>{renderGroupedMatches(activeMatchesShown)}</div>
                  )}
                </div>

                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <SectionHeader title="Completed Matches" count={completedMatchesShown.length} />

                  {completedMatchesShown.length === 0 ? (
                    <div style={{ marginTop: 8, color: theme.muted, fontSize: 13 }}>
                      No completed matches yet{typeFilter ? ` (${typeFilter.toLowerCase()})` : ""}.
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }}>{renderGroupedMatches(completedMatchesShown)}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
