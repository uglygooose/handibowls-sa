// app/home/views/EventsAndLeaderboardView.tsx
"use client";

import { theme } from "@/lib/theme";
import {
  cleanTournamentName,
  formatLabel,
  genderLabel,
  ruleLabel,
  scopeLabel,
} from "@/lib/tournaments/labels";
import type { GenderFilter, PlayerMini, TournamentMini } from "../../page";

export type EventsAndLeaderboardViewProps = {
  upcoming: TournamentMini[];
  upcomingNote: string | null;
  clubNameById: Record<string, string>;

  clubId: string;
  clubName: string;
  clubLeaderboard: PlayerMini[];
  clubLbNote: string | null;
  clubLbGender: GenderFilter;
  setClubLbGender: (next: GenderFilter) => void;
};

export default function EventsAndLeaderboardView(props: EventsAndLeaderboardViewProps) {
  const {
    upcoming,
    upcomingNote,
    clubNameById,
    clubId,
    clubName,
    clubLeaderboard,
    clubLbNote,
    clubLbGender,
    setClubLbGender,
  } = props;

  return (
    <>
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
    </>
  );
}
