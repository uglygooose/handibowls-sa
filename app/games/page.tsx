"use client";

import BottomNav from "../components/BottomNav";
import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { formatFormat, type GameFormat } from "./utils/games";
import { CreateInviteView } from "./views/CreateInviteView";

type Session = "AM" | "PM";

type GreenRow = {
  id: string;
  name: string;
  lane_count: number;
  is_active: boolean;
};

type PlayerMini = { id: string; display_name: string | null };

type InviteRow = {
  id: string;
  inviter_player_id: string;
  invitee_player_id: string;
  booking_id: string | null;
  game_format: GameFormat;
  status: "PROPOSED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  match_id: string | null;
  created_at: string;
  responded_at: string | null;
};

type BookingMini = {
  id: string;
  green_id: string;
  booking_date: string;
  session: Session;
  lane_number: number;
  created_by: string;
  created_at: string;
};

type MatchMini = {
  id: string;
  status: string;
  match_type?: string | null;
  challenger_player_id: string | null;
  challenged_player_id: string | null;
  challenger_score: number | null;
  challenged_score: number | null;
  submitted_by_player_id: string | null;
  submitted_at: string | null;
  created_at: string;
};

function todayLocalDateOnly() {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return {};
}

function asString(v: unknown) {
  return typeof v === "string" ? v : String(v ?? "");
}

function asBool(v: unknown) {
  return v === true;
}

export default function GamesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [myPlayerId, setMyPlayerId] = useState<string>("");

  const [greens, setGreens] = useState<GreenRow[]>([]);
  const [players, setPlayers] = useState<PlayerMini[]>([]);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [bookingById, setBookingById] = useState<Record<string, BookingMini>>({});
  const [greenById, setGreenById] = useState<Record<string, { id: string; name: string; lane_count: number }>>({});
  const [matches, setMatches] = useState<MatchMini[]>([]);

  const [slotBookings, setSlotBookings] = useState<BookingMini[]>([]);

  // Create form
  const [inviteeId, setInviteeId] = useState("");
  const [gameFormat, setGameFormat] = useState<GameFormat>("SINGLES");
  const [date, setDate] = useState<string>(todayLocalDateOnly());
  const [session, setSession] = useState<Session>("AM");
  const [greenId, setGreenId] = useState<string>("");
  const [laneNumber, setLaneNumber] = useState<string>("1");

  const nameByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) map[String(p.id)] = String(p.display_name ?? "").trim() || "Player";
    return map;
  }, [players]);

  const matchById = useMemo(() => {
    const map: Record<string, MatchMini> = {};
    for (const m of matches) map[String(m.id)] = m;
    return map;
  }, [matches]);

  const activeGreens = useMemo(() => greens.filter((g) => g.is_active !== false), [greens]);

  const laneCountForSelectedGreen = useMemo(() => {
    const g = activeGreens.find((x) => x.id === greenId);
    const n = Number(g?.lane_count ?? 6);
    return Number.isFinite(n) ? Math.max(1, Math.min(24, n)) : 6;
  }, [activeGreens, greenId]);

  const bookedLanesForSelected = useMemo(() => {
    const set = new Set<number>();
    for (const b of slotBookings) {
      if (String(b.green_id) !== String(greenId)) continue;
      set.add(Number(b.lane_number));
    }
    return set;
  }, [greenId, slotBookings]);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/games/list");
      const json = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) {
        setError(asString(json.error ?? "Could not load games"));
        return;
      }

      const me = asRecord(json.me);
      setMyPlayerId(asString(me.player_id ?? ""));

      const greensRaw = Array.isArray(json.greens) ? json.greens : [];
      setGreens(
        greensRaw.map((g) => {
          const r = asRecord(g);
          return {
            id: asString(r.id ?? ""),
            name: asString(r.name ?? ""),
            lane_count: Number(r.lane_count ?? 6),
            is_active: r.is_active == null ? true : asBool(r.is_active),
          } as GreenRow;
        })
      );

      const playersRaw = Array.isArray(json.players) ? json.players : [];
      setPlayers(
        playersRaw.map((p) => {
          const r = asRecord(p);
          const dn = r.display_name;
          return { id: asString(r.id ?? ""), display_name: typeof dn === "string" ? dn : null } as PlayerMini;
        })
      );

      setInvites((Array.isArray(json.invites) ? json.invites : []) as unknown as InviteRow[]);
      setBookingById(asRecord(json.bookingById) as unknown as Record<string, BookingMini>);
      setGreenById(asRecord(json.greenById) as unknown as Record<string, { id: string; name: string; lane_count: number }>);
      setMatches((Array.isArray(json.matches) ? json.matches : []) as unknown as MatchMini[]);

      // sensible defaults
      if (!greenId) {
        const firstActive = greensRaw.find((x) => {
          const r = asRecord(x);
          return r.is_active !== false;
        });
        const r = asRecord(firstActive);
        const firstId = asString(r.id ?? "");
        if (firstId) setGreenId(firstId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSlotBookings() {
    if (!date || !session) return;
    setError(null);
    try {
      const res = await fetch(`/api/bookings/list?date=${encodeURIComponent(date)}&session=${encodeURIComponent(session)}`);
      const json = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) {
        // keep previous bookings; just show error
        setError(asString(json.error ?? "Could not load bookings"));
        return;
      }
      const rows = Array.isArray(json.bookings) ? json.bookings : [];
      setSlotBookings(
        rows.map((b) => {
          const r = asRecord(b);
          return {
            id: asString(r.id ?? ""),
            green_id: asString(r.green_id ?? ""),
            booking_date: asString(r.booking_date ?? ""),
            session: asString(r.session ?? "AM").toUpperCase() === "PM" ? "PM" : "AM",
            lane_number: Number(r.lane_number ?? 0),
            created_by: asString(r.created_by ?? ""),
            created_at: asString(r.created_at ?? ""),
          } as BookingMini;
        })
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/games/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitee_player_id: inviteeId,
          game_format: gameFormat,
          date,
          session,
          green_id: greenId,
          lane_number: Number(laneNumber),
        }),
      });
      const json = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) {
        setError(asString(json.error ?? "Could not create invite"));
        return;
      }
      setNotice("Invite sent.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function respond(inviteId: string, action: "ACCEPT" | "DECLINE") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/games/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId, action }),
      });
      const json = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) {
        setError(asString(json.error ?? "Could not respond"));
        return;
      }
      setNotice(action === "ACCEPT" ? "Invite accepted." : "Invite declined.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/games/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const json = asRecord(await res.json().catch(() => ({})));
      if (!res.ok) {
        setError(asString(json.error ?? "Could not cancel invite"));
        return;
      }
      setNotice("Invite cancelled.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSlotBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, session]);

  useEffect(() => {
    // keep lane number in range when green changes
    const n = Number(laneNumber);
    if (!Number.isFinite(n) || n < 1) {
      setLaneNumber("1");
      return;
    }
    if (n > laneCountForSelectedGreen) setLaneNumber(String(laneCountForSelectedGreen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneCountForSelectedGreen, greenId]);

  const incoming = invites.filter((i) => i.status === "PROPOSED" && i.invitee_player_id === myPlayerId);
  const outgoing = invites.filter((i) => i.status === "PROPOSED" && i.inviter_player_id === myPlayerId);
  const accepted = invites.filter((i) => i.status === "ACCEPTED" && i.match_id);

  function slotLabel(inv: InviteRow) {
    const bid = inv.booking_id ? String(inv.booking_id) : "";
    const b = bid ? bookingById[bid] : undefined;
    if (!b) return "Booking";
    const g = greenById[String(b.green_id)];
    const gName = g?.name ? g.name : "Green";
    return `${b.booking_date} ${b.session} — ${gName} lane ${b.lane_number}`;
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: theme.background,
    color: theme.text,
    paddingBottom: 140,
  };

  const card: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 1px 8px rgba(0,0,0,.04)",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div className="mx-auto w-full max-w-[900px] px-[14px] pt-5" style={{ color: theme.muted }}>
          Loading…
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full max-w-[900px] px-[14px] pt-5">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.maroon }}>Games</div>
            <div style={{ marginTop: 2, fontSize: 13, color: theme.muted }}>Invite a member and reserve a lane.</div>
          </div>
          {busy ? <div style={{ fontSize: 12, color: theme.muted }}>Working…</div> : null}
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(220,38,38,.08)", color: "#991B1B" }}>
            {error}
          </div>
        ) : null}
        {notice ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(16,185,129,.10)", color: "#065F46" }}>
            {notice}
          </div>
        ) : null}

        <CreateInviteView
          busy={busy}
          myPlayerId={myPlayerId}
          players={players}
          activeGreens={activeGreens}
          laneCountForSelectedGreen={laneCountForSelectedGreen}
          bookedLanesForSelected={bookedLanesForSelected}
          inviteeId={inviteeId}
          setInviteeId={setInviteeId}
          gameFormat={gameFormat}
          setGameFormat={setGameFormat}
          date={date}
          setDate={setDate}
          session={session}
          setSession={setSession}
          greenId={greenId}
          setGreenId={setGreenId}
          laneNumber={laneNumber}
          setLaneNumber={setLaneNumber}
          createInvite={createInvite}
        />

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Incoming invites</div>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{incoming.length}</div>
            </div>
            {incoming.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>No incoming invites.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {incoming.map((i) => (
                  <div key={i.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>
                        {nameByPlayerId[String(i.inviter_player_id)] ?? "Player"} invited you ({formatFormat(i.game_format)})
                      </div>
                      <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{slotLabel(i)}</div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respond(i.id, "DECLINE")}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          border: `1px solid ${theme.border}`,
                          background: "#fff",
                          color: theme.text,
                          fontWeight: 900,
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respond(i.id, "ACCEPT")}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          border: `1px solid ${theme.maroon}`,
                          background: theme.maroon,
                          color: "#fff",
                          fontWeight: 900,
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Outgoing invites</div>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{outgoing.length}</div>
            </div>
            {outgoing.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>No outgoing invites.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {outgoing.map((i) => (
                  <div key={i.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>
                        Invite to {nameByPlayerId[String(i.invitee_player_id)] ?? "Player"} ({formatFormat(i.game_format)})
                      </div>
                      <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{slotLabel(i)}</div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const ok = window.confirm("Cancel this invite? This will free the reserved lane.");
                          if (ok) cancelInvite(i.id);
                        }}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          border: `1px solid ${theme.border}`,
                          background: "#fff",
                          color: theme.danger,
                          fontWeight: 900,
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        Cancel invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Your games</div>
              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>{accepted.length}</div>
            </div>
            {accepted.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>No accepted games yet.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {accepted.map((i) => {
                  const m = i.match_id ? matchById[String(i.match_id)] : null;
                  const status = String(m?.status ?? "OPEN");
                  const a = m?.challenger_score ?? 0;
                  const b = m?.challenged_score ?? 0;
                  return (
                    <a
                      key={i.id}
                      href={i.match_id ? `/match/${i.match_id}` : "#"}
                      style={{
                        textDecoration: "none",
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                        display: "block",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>{slotLabel(i)}</div>
                        <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>
                          {formatFormat(i.game_format)} · {status}
                        </div>
                      </div>
                      {m ? (
                        <div style={{ marginTop: 8, fontSize: 13, color: theme.text, fontWeight: 900 }}>
                          Score: {a} - {b} · Open match →
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>Match loading…</div>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
