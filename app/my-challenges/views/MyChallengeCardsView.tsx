// app/my-challenges/views/MyChallengeCardsView.tsx
"use client";

import { theme } from "@/lib/theme";
import type { ChallengeRow, LadderScope, MatchRow } from "../page";
import { formatTimeRemaining } from "../utils/challenges";

export type ChallengeCardMode = "incoming" | "outgoing";

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

export type ChallengeCardProps = {
  c: ChallengeRow;
  mode: ChallengeCardMode;
  scope: LadderScope | "UNKNOWN";
  opponentName: string;
  cancellingId: string | null;
  respond: (id: string, action: "ACCEPT" | "DECLINE") => void | Promise<void>;
  cancelChallenge: (id: string) => void | Promise<void>;
};

export function ChallengeCard(props: ChallengeCardProps) {
  const { c, mode, scope, opponentName, cancellingId, respond, cancelChallenge } = props;

  const canRespond = mode === "incoming";
  const canCancel = mode === "outgoing";
  const expiresIn = formatTimeRemaining(c.expires_at);
  const cancelDisabled = cancellingId === c.id;

  return (
    <div
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
              {opponentName}
            </div>
            {scopeBadge(scope)}
          </div>
          <div style={{ marginTop: 4, color: theme.muted, fontSize: 12 }}>Expires in: {expiresIn}</div>
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

export type MatchCardProps = {
  m: MatchRow;
  scope: LadderScope | "UNKNOWN";
  opponentName: string;
  challengerName: string;
  challengedName: string;
  label: string;
};

export function MatchCard(props: MatchCardProps) {
  const { m, scope, opponentName, challengerName, challengedName, label } = props;

  const aScore = m.challenger_score ?? 0;
  const bScore = m.challenged_score ?? 0;

  return (
    <a
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
          vs {opponentName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
          {challengerName}
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
          {challengedName}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: theme.maroon, fontWeight: 900 }}>{"Open match ->"}</div>
    </a>
  );
}
