// app/games/views/CreateInviteView.tsx
"use client";

import { theme } from "@/lib/theme";
import type { GameFormat } from "../utils/games";
import { formatFormat } from "../utils/games";

type Session = "AM" | "PM";

type PlayerMini = { id: string; display_name: string | null };
type ActiveGreen = { id: string; name: string; lane_count: number; is_active: boolean };

export type CreateInviteViewProps = {
  busy: boolean;
  myPlayerId: string;
  players: PlayerMini[];
  activeGreens: ActiveGreen[];
  laneCountForSelectedGreen: number;
  bookedLanesForSelected: Set<number>;
  inviteeId: string;
  setInviteeId: (v: string) => void;
  gameFormat: GameFormat;
  setGameFormat: (v: GameFormat) => void;
  date: string;
  setDate: (v: string) => void;
  session: Session;
  setSession: (v: Session) => void;
  greenId: string;
  setGreenId: (v: string) => void;
  laneNumber: string;
  setLaneNumber: (v: string) => void;
  createInvite: () => void | Promise<void>;
};

export function CreateInviteView(props: CreateInviteViewProps) {
  const {
    busy,
    myPlayerId,
    players,
    activeGreens,
    laneCountForSelectedGreen,
    bookedLanesForSelected,
    inviteeId,
    setInviteeId,
    gameFormat,
    setGameFormat,
    date,
    setDate,
    session,
    setSession,
    greenId,
    setGreenId,
    laneNumber,
    setLaneNumber,
    createInvite,
  } = props;

  const card: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 1px 8px rgba(0,0,0,.04)",
  };

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? theme.maroon : theme.border}`,
    background: active ? theme.maroon : "#fff",
    color: active ? "#fff" : theme.text,
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ marginTop: 14, ...card }}>
      <div style={{ fontWeight: 900 }}>Create invite</div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 160px", gap: 10, alignItems: "center" }}>
        <select
          value={inviteeId}
          onChange={(e) => setInviteeId(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
        >
          <option value="">Select opponent...</option>
          {players
            .filter((p) => String(p.id) !== myPlayerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.display_name ?? "").trim() || "Player"}
              </option>
            ))}
        </select>

        <select
          value={gameFormat}
          onChange={(e) => setGameFormat(e.target.value as GameFormat)}
          style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
          title="Game format"
        >
          <option value="SINGLES">Singles</option>
          <option value="DOUBLES">Doubles</option>
          <option value="TRIPLES">Triples</option>
          <option value="FOUR_BALL">4 Balls</option>
        </select>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 13,
            background: "#fff",
          }}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => setSession("AM")} style={pillBtn(session === "AM")}>
            AM
          </button>
          <button type="button" onClick={() => setSession("PM")} style={pillBtn(session === "PM")}>
            PM
          </button>
        </div>

        <select
          value={greenId}
          onChange={(e) => setGreenId(e.target.value)}
          style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
        >
          <option value="">Select green...</option>
          {activeGreens.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name || "Green"}
            </option>
          ))}
        </select>

        <select
          value={laneNumber}
          onChange={(e) => setLaneNumber(e.target.value)}
          style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
          title="Lane number"
        >
          {Array.from({ length: laneCountForSelectedGreen }, (_, i) => i + 1).map((n) => {
            const booked = bookedLanesForSelected.has(n);
            return (
              <option key={n} value={String(n)} disabled={booked}>
                Lane {n}
                {booked ? " (booked)" : ""}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          disabled={busy || !inviteeId || !greenId}
          onClick={() => {
            const gName = activeGreens.find((g) => g.id === greenId)?.name || "Green";
            const ok = window.confirm(
              `Send invite (${formatFormat(gameFormat)}) and reserve:\n\n${date} ${session}\n${gName} lane ${laneNumber}\n\nProceed?`
            );
            if (ok) createInvite();
          }}
          style={{
            marginLeft: "auto",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${theme.maroon}`,
            background: theme.maroon,
            color: "#fff",
            fontWeight: 900,
            cursor: busy || !inviteeId || !greenId ? "not-allowed" : "pointer",
            opacity: busy || !inviteeId || !greenId ? 0.65 : 1,
          }}
        >
          Send invite
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
        Tip: disabled lanes are already booked for this date/session.
      </div>
    </div>
  );
}
