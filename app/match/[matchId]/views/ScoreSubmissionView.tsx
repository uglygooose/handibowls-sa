// app/match/[matchId]/views/ScoreSubmissionView.tsx
"use client";

import { theme } from "@/lib/theme";

export type ScoreSubmissionViewProps = {
  matchStatus: string;
  challengerName: string;
  challengedName: string;
  challengerScore: string;
  setChallengerScore: (v: string) => void;
  challengedScore: string;
  setChallengedScore: (v: string) => void;
  canSubmit: boolean;
  canConfirm: boolean;
  submitting: boolean;
  confirming: boolean;
  submitResult: () => void | Promise<void>;
  confirmResult: () => void | Promise<void>;
};

export function ScoreSubmissionView(props: ScoreSubmissionViewProps) {
  const {
    matchStatus,
    challengerName,
    challengedName,
    challengerScore,
    setChallengerScore,
    challengedScore,
    setChallengedScore,
    canSubmit,
    canConfirm,
    submitting,
    confirming,
    submitResult,
    confirmResult,
  } = props;

  return (
    <div
      style={{
        marginTop: 12,
        background: "#fff",
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Score</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 110px",
          gap: 10,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>{challengerName}</div>
        <input
          value={challengerScore}
          onChange={(e) => setChallengerScore(e.target.value)}
          inputMode="numeric"
          disabled={!canSubmit}
          style={{
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            width: "100%",
            opacity: canSubmit ? 1 : 0.7,
          }}
          placeholder="0"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>{challengedName}</div>
        <input
          value={challengedScore}
          onChange={(e) => setChallengedScore(e.target.value)}
          inputMode="numeric"
          disabled={!canSubmit}
          style={{
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            width: "100%",
            opacity: canSubmit ? 1 : 0.7,
          }}
          placeholder="0"
        />
      </div>

      {matchStatus === "FINAL" ? (
        <div style={{ marginTop: 12, color: theme.maroon, fontWeight: 900 }}>Match finalised.</div>
      ) : (
        <>
          <button
            onClick={submitResult}
            disabled={!canSubmit}
            style={{
              marginTop: 12,
              width: "100%",
              border: "none",
              background: theme.maroon,
              color: "#fff",
              padding: "11px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitting ? "Submitting..." : "Submit Result"}
          </button>

          <button
            onClick={confirmResult}
            disabled={!canConfirm}
            style={{
              marginTop: 10,
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "11px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: canConfirm ? "pointer" : "not-allowed",
              opacity: canConfirm ? 1 : 0.6,
            }}
          >
            {confirming ? "Confirming..." : "Confirm Result"}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: theme.muted }}>
            Submitter enters the score. Opponent confirms to finalise. Club admin override available to admins.
          </div>
        </>
      )}
    </div>
  );
}
