"use client";


import { theme } from "@/lib/theme";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "./components/BottomNav";

type ProfileRow = {
  id: string;
  full_name: string | null;
  club?: string | null;
  club_name?: string | null;
  club_id?: string | null;
};

type PlayerRow = {
  id: string;
  user_id: string;
  handicap?: number | null;
  club_id?: string | null;
  gender?: "MALE" | "FEMALE" | null;
};

type LadderRow = { id: string };

type LadderEntryRow = {
  player_id: string;
  points: number | null;
  shot_diff: number | null;
  shots_for: number | null;
};

type PlayerMini = {
  player_id: string;
  name: string;
  points: number;
  shot_diff: number;
  shots_for: number;
};

type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
type TournamentGender = "MALE" | "FEMALE" | null;
type GenderFilter = "ALL" | "MALE" | "FEMALE";
type TournamentRule = "SCRATCH" | "HANDICAP_START";

type TournamentMini = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  scope: "CLUB" | "DISTRICT" | "NATIONAL";
  format: TournamentFormat;
  gender?: TournamentGender | null;
  club_id?: string | null;
  rule_type?: TournamentRule | null;
};

function scopeLabel(scope: "CLUB" | "DISTRICT" | "NATIONAL") {
  if (scope === "CLUB") return "Club";
  if (scope === "DISTRICT") return "District";
  return "National";
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
export default function HomePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>("");
  const [clubName, setClubName] = useState<string>("");
  const [clubId, setClubId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");

  const [handicap, setHandicap] = useState<number | null>(null);
  const [showHandicapInfo, setShowHandicapInfo] = useState(false);
  const [playerGender, setPlayerGender] = useState<"MALE" | "FEMALE" | "">("");
  const [genderSaving, setGenderSaving] = useState(false);

  const [clubLeaderboard, setClubLeaderboard] = useState<PlayerMini[]>([]);
  const [clubLbNote, setClubLbNote] = useState<string | null>(null);
  const [clubLbGender, setClubLbGender] = useState<GenderFilter>("ALL");
  const [upcoming, setUpcoming] = useState<TournamentMini[]>([]);
  const [upcomingNote, setUpcomingNote] = useState<string | null>(null);
  const [clubNameById, setClubNameById] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);

  async function loadClubLeaderboardPreview(clubIdIn: string, genderFilter: GenderFilter) {
    setClubLbNote(null);
    setClubLeaderboard([]);

    if (!clubIdIn) {
      setClubLbNote("No club linked to your profile yet.");
      return;
    }

    // 1) Find the club ladder (correct + exact)
    const ladderRes = await supabase
      .from("ladders")
      .select("id")
      .eq("scope", "CLUB")
      .eq("club_id", clubIdIn)
      .maybeSingle();

    const ladderId = ladderRes.data?.id ?? null;

    let playerIds: string[] = [];

    if (ladderId) {
      const le = await supabase
        .from("ladder_entries")
        .select("player_id, points, shot_diff, shots_for")
        .eq("ladder_id", ladderId)
        .order("points", { ascending: false })
        .order("shot_diff", { ascending: false })
        .order("shots_for", { ascending: false })
        .limit(50);

      if (!le.error) {
        const entries = (le.data ?? []) as LadderEntryRow[];
        playerIds = entries.map((e) => e.player_id);

        if (playerIds.length) {
          const pRes = await supabase
            .from("players")
            .select("id, user_id, display_name, handicap, gender")
            .in("id", playerIds);

          if (!pRes.error) {
            const players = (pRes.data ?? []) as { id: string; user_id: string | null; display_name?: string | null; gender?: string | null }[];
            const filteredPlayers = genderFilter === "ALL" ? players : players.filter((p) => (p.gender ?? "") === genderFilter);
            const userIds = Array.from(new Set(filteredPlayers.map((p) => p.user_id).filter(Boolean) as string[]));

            let nameByUserId = new Map<string, string>();
            if (userIds.length) {
              const prRes = await supabase.from("profiles").select("id, full_name").in("id", userIds);
              if (!prRes.error) {
                const profiles = (prRes.data ?? []) as { id: string; full_name: string | null }[];
                nameByUserId = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));
              }
            }

            const playerById = new Map(filteredPlayers.map((p) => [p.id, p]));
            const preview = (le.data ?? [])
              .map((e: any) => {
                const pl = playerById.get(e.player_id);
                if (!pl) return null;
                const dn = (pl.display_name ?? "").trim();
                return {
                  player_id: e.player_id,
                  name: dn || nameByUserId.get(pl.user_id ?? "") || "Unknown",
                  points: e.points ?? 0,
                  shot_diff: e.shot_diff ?? 0,
                  shots_for: e.shots_for ?? 0,
                } as PlayerMini;
              })
              .filter(Boolean) as PlayerMini[];

            if (preview.length) {
              setClubLeaderboard(preview.slice(0, 6));
              return;
            }
          }
        }
      }
    }

    // Fallback: alphabetical players by club
    const { data: clubProfiles, error: cpErr } = await supabase.from("profiles").select("id, full_name").eq("club_id", clubIdIn);
    if (cpErr) {
      setClubLbNote("Could not load club members.");
      return;
    }

    const userIds = (clubProfiles ?? []).map((p: any) => p.id);
    const { data: playersByUser, error: puErr } = userIds.length
      ? await supabase.from("players").select("id, user_id, display_name, gender").in("user_id", userIds)
      : { data: [], error: null };

    if (puErr) {
      setClubLbNote("Could not load club members.");
      return;
    }

    const { data: playersByClub, error: pcErr } = await supabase
      .from("players")
      .select("id, user_id, display_name, gender")
      .eq("club_id", clubIdIn);

    if (pcErr) {
      setClubLbNote("Could not load club members.");
      return;
    }

    const allPlayers = new Map<string, { id: string; user_id: string | null; display_name?: string | null; gender?: string | null }>();
    for (const p of (playersByUser ?? [])) allPlayers.set(String((p as any).id), p as any);
    for (const p of (playersByClub ?? [])) allPlayers.set(String((p as any).id), p as any);

    const profiles = (clubProfiles ?? []) as { id: string; full_name: string | null }[];
    const nameByUser = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

    const filtered = Array.from(allPlayers.values()).filter((p) =>
      genderFilter === "ALL" ? true : (p.gender ?? "") === genderFilter
    );

    const preview = filtered
      .map((p) => {
        const dn = (p.display_name ?? "").trim();
        const name = dn || nameByUser.get(p.user_id ?? "") || "Unknown";
        return { player_id: String(p.id), name, points: 0, shot_diff: 0, shots_for: 0 } as PlayerMini;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .slice(0, 6);

    if (!preview.length) {
      setClubLbNote("No ladder entries yet.");
      return;
    }

    setClubLeaderboard(preview);
  }

  async function saveGender(next: "MALE" | "FEMALE", playerId: string) {
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

  async function loadUpcoming(gender: "MALE" | "FEMALE" | "") {
    setUpcoming([]);
    setUpcomingNote(null);
    setClubNameById({});

    if (!gender) {
      setUpcomingNote("Select your gender to see upcoming events.");
      return;
    }

    const nowIso = new Date().toISOString();
    const tRes = await supabase
      .from("tournaments")
      .select("id, name, starts_at, ends_at, scope, format, gender, status, club_id, rule_type")
      .eq("status", "ANNOUNCED")
      .or(`starts_at.gte.${nowIso},starts_at.is.null`)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(5);

    if (tRes.error) {
      setUpcomingNote("Could not load upcoming events.");
      return;
    }

    const list = (tRes.data ?? []) as TournamentMini[];
    const filtered = gender ? list.filter((t) => !t.gender || t.gender === gender) : list;

    if (!filtered.length) {
      setUpcomingNote("No upcoming events yet.");
      return;
    }

    const limited = filtered.slice(0, 3);
    setUpcoming(limited);

    const clubIds = Array.from(
      new Set(
        limited
          .map((t) => (t.club_id ?? "").toString())
          .filter((id) => id)
      )
    );

    if (!clubIds.length) return;

    const clubRes = await supabase.from("clubs").select("id, name").in("id", clubIds);
    if (clubRes.error) return;

    const next: Record<string, string> = {};
    for (const c of clubRes.data ?? []) {
      next[String((c as any).id)] = String((c as any).name ?? "Club");
    }
    setClubNameById(next);
  }

  async function load() {
    setLoading(true);
    setError(null);

    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // ---- profile (defensive club columns) ----
    let prof: any = null;

    const profRes = await supabase
      .from("profiles")
      .select("id, full_name, club, club_name, club_id")
      .eq("id", user.id)
      .single();

    if (profRes.error) {
      const fallback = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      prof = fallback.data ?? null;
    } else {
      prof = profRes.data ?? null;
    }

    setFullName((prof as ProfileRow | null)?.full_name ?? "");

    // ---- player (defensive handicap + club_id columns) ----
    let mePlayer: any = null;

    const pRes = await supabase
      .from("players")
      .select("id, user_id, handicap, club_id, gender")
      .eq("user_id", user.id)
      .single();

    if (pRes.error) {
      const fallback = await supabase
        .from("players")
        .select("id, user_id")
        .eq("user_id", user.id)
        .single();

      mePlayer = fallback.data ?? null;
      setHandicap(null);
    } else {
      mePlayer = pRes.data ?? null;
      setHandicap(typeof (mePlayer as PlayerRow | null)?.handicap === "number" ? mePlayer.handicap : null);
    }

    if (!mePlayer) {
      setLoading(false);
      return;
    }

    setPlayerId(String((mePlayer as PlayerRow).id));

    // Resolve club name (prefer DB via players.club_id; only display fallbacks if name can't be resolved)
    let resolvedClub = (prof as ProfileRow | null)?.club ?? "";
    if (!resolvedClub) resolvedClub = (prof as ProfileRow | null)?.club_name ?? "";

    const cid = (mePlayer as PlayerRow | null)?.club_id ?? "";
    const g = ((mePlayer as PlayerRow | null)?.gender ?? "") as "MALE" | "FEMALE" | "";
    setPlayerGender(g);

    setClubId(cid);

    if (cid) {
      const clubRes = await supabase.from("clubs").select("name").eq("id", cid).single();
      if (!clubRes.error && clubRes.data?.name) {
        resolvedClub = String(clubRes.data.name);
      }
    }

    setClubName(resolvedClub);

    await loadUpcoming(g);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clubId) return;
    loadClubLeaderboardPreview(clubId, clubLbGender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, clubLbGender]);

  const showRidgeparkBg = clubName?.toLowerCase().includes("ridgepark");

  return (
    <div
      style={{
        background: theme.background,
        minHeight: "100vh",
        color: theme.text,
        paddingBottom: 92,
        ...(showRidgeparkBg
          ? {
              backgroundImage: "url('/ridgepark-logo.png')",
              backgroundSize: "380px auto",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center 80px",
              backgroundAttachment: "fixed",
            }
          : {}),
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>HandiBowls SA</div>

            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4, lineHeight: 1.25 }}>
              {loading ? (
                "Loading..."
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, color: theme.text }}>
                    {fullName ? `Welcome back, ${fullName}` : "Welcome back"}
                  </span>

                  {clubName ? (
                    <span
                      style={{
                        border: `1px solid ${theme.border}`,
                        background: "#fff",
                        color: theme.text,
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {clubName}
                    </span>
                  ) : null}

                  {handicap !== null ? (
                    <button
                      type="button"
                      onClick={() => setShowHandicapInfo((v) => !v)}
                      style={{
                        border: `1px solid ${theme.border}`,
                        background: handicap <= 5 ? "#E7F6EA" : handicap <= 12 ? "#FFF7E6" : "#FDECEC",
                        color: handicap <= 5 ? theme.maroon : handicap <= 12 ? "#9A6B00" : theme.danger,
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontWeight: 900,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      aria-label="Handicap info"
                      title="Tap for handicap info"
                    >
                      Handicap: {handicap} <span style={{ marginLeft: 6, fontWeight: 900 }}>(i)</span>
                    </button>
                  ) : null}
                </div>
              )}
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

        {showHandicapInfo && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>How handicaps work (Lawn Bowls)</div>
            <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
              A handicap helps make games fair between players of different ability. In many club formats, the player (or
              team) with the lower handicap receives a head start " either by adding handicap shots to their score, or
              by applying the handicap difference at the start/end of the match (format depends on the competition
              rules).
              <br />
              <br />
              Higher handicap generally means a stronger player; lower handicap means the system gives you a bigger
              allowance. This app will display your recorded handicap and use it wherever the tournament or match format
              requires it.
            </div>

            <button
              type="button"
              onClick={() => setShowHandicapInfo(false)}
              style={{
                marginTop: 10,
                width: "100%",
                border: "none",
                background: theme.maroon,
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        )}

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

        {!loading && !playerGender ? (
          <div
            style={{
              marginTop: 14,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Select your gender</div>
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
              We use this to show the correct tournaments for you.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button
                type="button"
                disabled={genderSaving}
                onClick={() => saveGender("MALE", playerId)}
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
                onClick={() => saveGender("FEMALE", playerId)}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
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

        {/* Quick Actions */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Quick Actions</div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <a
              href="/club-ladder"
              style={{
                display: "block",
                textDecoration: "none",
                background: "#fff",
                color: theme.text,
                padding: "12px 14px",
                borderRadius: 14,
                fontWeight: 900,
                textAlign: "center",
                border: `1px solid ${theme.border}`,
              }}
            >
              View Leaderboard
            </a>

            <a
              href="/my-challenges"
              style={{
                display: "block",
                textDecoration: "none",
                background: "#fff",
                color: theme.text,
                padding: "12px 14px",
                borderRadius: 14,
                fontWeight: 900,
                textAlign: "center",
                border: `1px solid ${theme.border}`,
              }}
            >
              My Challenges
            </a>

            <a
              href="/tournaments"
              style={{
                display: "block",
                textDecoration: "none",
                background: "#fff",
                color: theme.text,
                padding: "12px 14px",
                borderRadius: 14,
                fontWeight: 900,
                textAlign: "center",
                border: `1px solid ${theme.border}`,
              }}
            >
              Tournaments
            </a>
          </div>
        </div>

        {/* Upcoming Events */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Upcoming Events</div>
            <a href="/tournaments" style={{ textDecoration: "none", color: theme.maroon, fontWeight: 900, fontSize: 13 }}>
              View all
            </a>
          </div>

          <div style={{ marginTop: 10 }}>
            {upcomingNote ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>{upcomingNote}</div>
            ) : upcoming.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>Loading events...</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {upcoming.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: 14,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{cleanTournamentName(t.name)}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.muted }}>
                      {t.starts_at ? new Date(t.starts_at).toLocaleString() : "Start time TBC"}
                    </div>
                    {t.ends_at ? (
                      <div style={{ marginTop: 4, fontSize: 12, color: theme.muted }}>
                        Ends: {new Date(t.ends_at).toLocaleString()}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
                      {scopeLabel(t.scope)} * {genderLabel(t.gender ?? null)} * {formatLabel(t.format)} knockout
                    </div>
                    {t.scope === "CLUB" && t.club_id && clubNameById[t.club_id] ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
                        Host: {clubNameById[t.club_id]}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
                      Rule: {ruleLabel(t.rule_type ?? "HANDICAP_START")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Club Leaderboard Preview */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Your Club Leaderboard</div>
              <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
                {clubName ? clubName : "Club not set"}
              </div>
            </div>

            <a
              href="/club-ladder"
              style={{ textDecoration: "none", color: theme.maroon, fontWeight: 900, fontSize: 13 }}
            >
              View full
            </a>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setClubLbGender("ALL")}
              style={{
                border: `1px solid ${theme.border}`,
                background: clubLbGender === "ALL" ? theme.maroon : "#fff",
                color: clubLbGender === "ALL" ? "#fff" : theme.text,
                padding: "8px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setClubLbGender("MALE")}
              style={{
                border: `1px solid ${theme.border}`,
                background: clubLbGender === "MALE" ? theme.maroon : "#fff",
                color: clubLbGender === "MALE" ? "#fff" : theme.text,
                padding: "8px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Men
            </button>

            <button
              type="button"
              onClick={() => setClubLbGender("FEMALE")}
              style={{
                border: `1px solid ${theme.border}`,
                background: clubLbGender === "FEMALE" ? theme.maroon : "#fff",
                color: clubLbGender === "FEMALE" ? "#fff" : theme.text,
                padding: "8px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Ladies
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            {clubLbNote ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>{clubLbNote}</div>
            ) : !clubId ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>Your club isn't linked yet.</div>
            ) : clubLeaderboard.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>Loading club leaderboard...</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {clubLeaderboard.map((r, idx) => (
                  <div
                    key={r.player_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr auto",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 10px",
                      borderRadius: 14,
                      border: `1px solid ${theme.border}`,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: theme.muted, textAlign: "center" }}>{idx + 1}</div>
                    <div style={{ fontWeight: 900 }}>{r.name}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>{r.points} pts</div>
                      <div style={{ fontSize: 12, color: theme.muted }}>
                        SD {r.shot_diff} {"\u2022"} SF {r.shots_for}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Club News */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Club News</div>
            <span style={{ fontSize: 12, color: theme.muted }}>Read-only</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
            No news posted yet. This section will show announcements like tournament dates, practice sessions, and club
            updates.
          </div>
        </div>

        {/* How it works */}
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>How it works</div>

          <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.4 }}>
            Use the leaderboard to see current rankings, challenge players within the allowed range for ranked matches,
            or play friendly games that don't affect ladder position. Track all your challenges and matches in one place.
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
