// app/club-ladder/views/LadderActivityView.tsx
"use client";

import { theme } from "@/lib/theme";
import type { MatchRow } from "../page";
import { safeDateLabel } from "../utils/ladder";

export type LadderActivityViewProps = {
  loading: boolean;
  pendingMatches: MatchRow[];
  recentMatches: MatchRow[];
  nameByPlayerId: Map<string, string>;
};

function MatchTypeBadge() {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        background: "rgba(46,125,50,.10)",
        color: theme.maroon,
        whiteSpace: "nowrap",
      }}
    >
      Ranked
    </span>
  );
}

export default function LadderActivityView(props: LadderActivityViewProps) {
  const { loading, pendingMatches, recentMatches, nameByPlayerId } = props;

  if (loading) return null;

  return (
    <>
      {/* Pending Matches */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Your Pending Matches</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MatchTypeBadge />
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

              const label =
                m.status === "OPEN" ? "Open (enter score)" : "Result submitted (confirm if you didn't submit)";
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
                      <MatchTypeBadge />
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

      {/* Recent Results */}
      <div
        style={{
          marginTop: 12,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Recent Results</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MatchTypeBadge />
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

              return (
                <div key={m.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ color: theme.muted, fontSize: 12 }}>{safeDateLabel(m.created_at)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <MatchTypeBadge />
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
    </>
  );
}
