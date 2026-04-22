// app/admin/tournaments/[id]/views/AuditView.tsx
"use client";

import ScoreInput from "../../../../components/ScoreInput";
import StatusPill from "../../../../components/StatusPill";
import { theme } from "@/lib/theme";
import { bool, isMatchBye, isMatchDone, winnerTeamIdFromMatch } from "@/lib/tournaments/match";
import type { Labelers, MatchRow, ScrollHelpers } from "../page";

export type AuditViewProps = {
  matches: MatchRow[];
  busy: boolean;
  auditOpenByRound: Record<number, boolean>;
  auditEditOpenByMatchId: Record<string, boolean>;
  scoreDraftByMatchId: Record<string, { a: string; b: string }>;
  setAuditOpenByRound: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setAuditEditOpenByMatchId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setScoreDraftByMatchId: React.Dispatch<React.SetStateAction<Record<string, { a: string; b: string }>>>;
  adminFinalScore: (matchId: string) => void;
  labelers: Labelers;
  scrollHelpers: ScrollHelpers;
};

export default function AuditView(props: AuditViewProps) {
  const {
    matches,
    busy,
    auditOpenByRound,
    auditEditOpenByMatchId,
    scoreDraftByMatchId,
    setAuditOpenByRound,
    setAuditEditOpenByMatchId,
    setScoreDraftByMatchId,
    adminFinalScore,
    labelers,
    scrollHelpers,
  } = props;

  const { teamDisplayName, roundLabel } = labelers;
  const { pinScrollForInput, restorePinnedScrollForInput } = scrollHelpers;

  if (!matches.length) {
    return (
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
        <div style={{ marginTop: 6, color: theme.muted, fontSize: 13, lineHeight: 1.35 }}>No matches yet.</div>
      </div>
    );
  }

  // Completed/finalised matches (include BYEs once processed/finalised)
  const done = matches
    .filter((m) => isMatchDone(m))
    .sort(
      (a, b) =>
        Number(a.round_no ?? 0) - Number(b.round_no ?? 0) ||
        Number(a.match_no ?? 0) - Number(b.match_no ?? 0) ||
        String(a.id).localeCompare(String(b.id))
    );

  if (!done.length) {
    return (
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
        <div style={{ marginTop: 6, color: theme.muted, fontSize: 13, lineHeight: 1.35 }}>
          No completed matches yet. Completed / admin-finalled matches will appear here automatically.
        </div>
      </div>
    );
  }

  const byRound: Record<number, MatchRow[]> = {};
  for (const m of done) {
    const rn = Number(m.round_no ?? 0);
    const key = rn || 0;
    byRound[key] = byRound[key] ?? [];
    byRound[key].push(m);
  }

  const rounds = Object.keys(byRound)
    .map((n) => Number(n))
    .sort((a, b) => a - b);

  // Try infer "current winner" if there's exactly one non-BYE winner in the latest round
  const latestRound = rounds[rounds.length - 1] ?? null;
  const latestDone = latestRound != null ? byRound[latestRound] ?? [] : [];
  const latestWinners = latestDone.map((m) => winnerTeamIdFromMatch(m)).filter((x) => x != null) as string[];

  const uniqLatestWinners = Array.from(new Set(latestWinners));
  const inferredWinnerTeamId = uniqLatestWinners.length === 1 ? uniqLatestWinners[0] : null;
  const inferredWinnerName = inferredWinnerTeamId ? teamDisplayName(inferredWinnerTeamId) : null;

  function auditLine(m: MatchRow) {
    const left = teamDisplayName(m.team_a_id);
    const right = teamDisplayName(m.team_b_id);

    const isBye = isMatchBye(m);
    const score = m.score_a == null || m.score_b == null ? "-" : `${m.score_a}-${m.score_b}`;

    const winnerId = winnerTeamIdFromMatch(m);
    const winA = winnerId && m.team_a_id && String(m.team_a_id) === winnerId;
    const winB = winnerId && m.team_b_id && String(m.team_b_id) === winnerId;

    const baseTitle = isBye ? `${left} — BYE` : `${left} vs ${right}`;

    const winnerName = winnerId ? teamDisplayName(winnerId) : null;

    const winnerTag = winnerName ? ` • Winner: ${winnerName}` : "";

    const adminFinalTag = bool(m.finalized_by_admin) ? " • Admin final" : "";

    const editOpen = auditEditOpenByMatchId[m.id] === true;

    return (
      <div key={`audit-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={baseTitle}>
              {isBye ? (
                baseTitle
              ) : (
                <>
                  <span style={{ color: winA ? "#16A34A" : theme.text }}>{left}</span>{" "}
                  <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                  <span style={{ color: winB ? "#16A34A" : theme.text }}>{right}</span>
                </>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
              {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)} • Score: {score}
              {winnerTag}
              {adminFinalTag}
            </div>

            {!isBye ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAuditEditOpenByMatchId((p) => ({ ...p, [m.id]: !p[m.id] }))}
                style={{
                  marginTop: 8,
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: busy ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {editOpen ? "Close edit" : "Edit score"}
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <StatusPill label={isBye ? "BYE" : "Completed"} tone={isBye ? "warn" : "good"} />
          </div>
        </div>

        {editOpen && !isBye ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
              Edit the final score. This will re-finalise the match and update any linked next-round slots.
            </div>

            <div style={{ marginTop: 8 }}>
              <ScoreInput
                valueA={(scoreDraftByMatchId[m.id]?.a ?? "").toString()}
                valueB={(scoreDraftByMatchId[m.id]?.b ?? "").toString()}
                onChangeA={(next) =>
                  setScoreDraftByMatchId((p) => ({
                    ...p,
                    [m.id]: { a: next, b: p[m.id]?.b ?? "" },
                  }))
                }
                onChangeB={(next) =>
                  setScoreDraftByMatchId((p) => ({
                    ...p,
                    [m.id]: { a: p[m.id]?.a ?? "", b: next },
                  }))
                }
                disabled={busy}
                onFocus={pinScrollForInput}
                onBlur={restorePinnedScrollForInput}
                separatorWidth={24}
                flexibleColumns
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => adminFinalScore(m.id)}
              style={{
                marginTop: 8,
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.danger,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Working..." : "Save edited score"}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Audit</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{done.length} completed</div>
        </div>

        {inferredWinnerName ? (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.text, fontWeight: 900 }}>
            Current leader (inferred): <span style={{ color: theme.maroon }}>{inferredWinnerName}</span>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
            Completed matches are listed below. Winner will show automatically once a single winner emerges in the latest round.
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rounds.map((r) => {
          const list = byRound[r] ?? [];
          const isOpen = auditOpenByRound[r] === true;
          return (
            <div key={`audit-round-${r}`} style={{ background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setAuditOpenByRound((p) => ({ ...p, [r]: !p[r] }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "none",
                  background: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 15 }}>{roundLabel(r)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{list.length}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{isOpen ? "▾" : "▸"}</div>
                </div>
              </button>
              {isOpen ? (
                <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14, display: "grid", gap: 10 }}>
                  {list.map((m) => auditLine(m))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
