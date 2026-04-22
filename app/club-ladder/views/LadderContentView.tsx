// app/club-ladder/views/LadderContentView.tsx
"use client";

import { theme } from "@/lib/theme";
import { useEffect, useMemo, useRef } from "react";
import type { LadderRow } from "../page";

type PlayerGender = "MALE" | "FEMALE" | "";

export type LadderContentViewProps = {
  loading: boolean;
  error: string | null;
  rows: LadderRow[];
  myPlayerId: string | null;
  myGender: PlayerGender;
  genderByPlayerId: Record<string, PlayerGender>;
  scope: "CLUB" | "DISTRICT" | "NATIONAL";
  genderFilter: "ALL" | "MALE" | "FEMALE";
  createChallenge: (challenged_player_id: string) => void | Promise<void>;
};

export default function LadderContentView(props: LadderContentViewProps) {
  const { loading, error, rows, myPlayerId, myGender, genderByPlayerId, scope, genderFilter, createChallenge } = props;

  const headerStatsScrollRef = useRef<HTMLDivElement | null>(null);
  const rowStatsRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

  // Keep rows aligned to header scroll position on data change
  useEffect(() => {
    const left = headerStatsScrollRef.current?.scrollLeft ?? 0;
    syncStatsScroll(left);
  }, [rows]);

  // Scroll "me" into view when data or filters change
  useEffect(() => {
    if (!listScrollRef.current || !myPlayerId || !rows.length) return;
    const row = rowRefs.current[myPlayerId];
    if (!row) return;

    const container = listScrollRef.current;
    const targetTop = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [rows, myPlayerId, scope, genderFilter]);

  const posById = useMemo(() => new Map(rows.map((row, i) => [row.player_id, i + 1])), [rows]);

  function isEligible(targetPlayerId: string) {
    if (!myPlayerId) return false;
    if (targetPlayerId === myPlayerId) return false;

    const myPos = posById.get(myPlayerId);
    const targetPos = posById.get(targetPlayerId);
    if (!myPos || !targetPos) return false;

    return Math.abs(targetPos - myPos) <= 2;
  }

  function valOrDash(v: number | null | undefined, showDash: boolean) {
    if (showDash) return "-";
    if (v == null) return "0";
    return String(v);
  }

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

  if (loading) return <p style={{ color: theme.muted }}>Loading ladder...</p>;
  if (error) return <p style={{ color: theme.danger, whiteSpace: "pre-wrap" }}>Error: {error}</p>;
  if (!rows.length) return <p style={{ color: theme.muted }}>No ladder entries found.</p>;

  const showDash = false;

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
              WebkitOverflowScrolling: "touch",
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
          {rows.map((r) => {
            const eligible = isEligible(r.player_id);
            const isMe = myPlayerId === r.player_id;
            const targetGender = genderByPlayerId[r.player_id] ?? "";
            const canChallengeGender = !!myGender && !!targetGender && myGender === targetGender;
            const showPlay = !isMe && canChallengeGender && eligible;
            const pos = posById.get(r.player_id) ?? null;

            const buttonTitle = eligible
              ? "Create a ranked challenge (+/-2 positions)"
              : "Ranked challenges must be within +/-2 positions";
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
                  {pos ?? "-"}
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
                  {showPlay ? (
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
                  ) : (
                    <div style={{ width: 54 }} />
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
    </div>
  );
}
