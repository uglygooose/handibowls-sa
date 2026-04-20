"use client";

import BottomNav from "../components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";

type Session = "AM" | "PM";

type GreenRow = {
  id: string;
  name: string;
  lane_count: number;
};

type BookingRow = {
  id: string;
  green_id: string;
  booking_date: string;
  session: Session;
  lane_number: number;
  created_by: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  club_id: string | null;
  is_admin: boolean | null;
  role: string | null;
};

type ClubRow = { id: string; name: string | null };

function todayLocalDateOnly() {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookingsPage() {
  const supabase = createClient();

  const [authLoading, setAuthLoading] = useState(true);
  const [meUserId, setMeUserId] = useState<string>("");
  const [clubName, setClubName] = useState<string>("");
  const [clubId, setClubId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [date, setDate] = useState<string>(todayLocalDateOnly());
  const [session, setSession] = useState<Session>("AM");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [greens, setGreens] = useState<GreenRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});

  const bookingsByGreenLane = useMemo(() => {
    const map = new Map<string, BookingRow>();
    for (const b of bookings) map.set(`${b.green_id}:${b.lane_number}`, b);
    return map;
  }, [bookings]);

  async function loadMe() {
    setAuthLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setMeUserId(user.id);

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, club_id, is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const profRow = (prof ?? null) as unknown as ProfileRow | null;
    const cid = String(profRow?.club_id ?? "");
    setClubId(cid);

    const role = String(profRow?.role ?? "").toUpperCase();
    const superAdmin = role === "SUPER_ADMIN";
    setIsAdmin(Boolean(profRow?.is_admin) || superAdmin);

    if (cid) {
      const { data: club } = await supabase.from("clubs").select("name").eq("id", cid).maybeSingle();
      const clubRow = (club ?? null) as unknown as ClubRow | null;
      setClubName(String(clubRow?.name ?? ""));
    } else {
      setClubName("");
    }

    setAuthLoading(false);
  }

  async function loadBookings() {
    if (!clubId) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/bookings/list?date=${encodeURIComponent(date)}&session=${encodeURIComponent(session)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not load bookings"));
        setGreens([]);
        setBookings([]);
        setNameByUserId({});
        return;
      }

      setGreens(
        (json?.greens ?? []).map((g: unknown) => {
          const r = (g ?? null) as unknown as Partial<GreenRow> & Record<string, unknown>;
          return { id: String(r.id ?? ""), name: String(r.name ?? ""), lane_count: Number(r.lane_count ?? 6) };
        })
      );
      setBookings(
        (json?.bookings ?? []).map((b: unknown) => {
          const r = (b ?? null) as unknown as Partial<BookingRow> & Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            green_id: String(r.green_id ?? ""),
            booking_date: String(r.booking_date ?? ""),
            session: String(r.session ?? "AM").toUpperCase() === "PM" ? "PM" : "AM",
            lane_number: Number(r.lane_number ?? 0),
            created_by: String(r.created_by ?? ""),
            created_at: String(r.created_at ?? ""),
          };
        })
      );
      setNameByUserId(json?.nameByUserId ?? {});
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }

  async function createBooking(greenId: string, laneNumber: number) {
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ green_id: greenId, lane_number: laneNumber, date, session }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not create booking"));
        return;
      }

      setNotice("Booking created.");
      await loadBookings();
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not cancel booking"));
        return;
      }

      setNotice("Booking cancelled.");
      await loadBookings();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authLoading && clubId) loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, clubId, date, session]);

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: theme.bg,
    color: theme.text,
    paddingBottom: 140,
  };

  const card: React.CSSProperties = {
    background: theme.card,
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
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  });

  const laneRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "70px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid ${theme.border}`,
  };

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full max-w-[760px] px-[14px] pt-5">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.maroon }}>Lane Bookings</div>
            <div style={{ marginTop: 2, fontSize: 13, color: theme.muted }}>
              {clubName ? `${clubName}` : clubId ? "Your club" : "No club on profile"}
            </div>
          </div>
          {loading ? <div style={{ fontSize: 12, color: theme.muted }}>Loading…</div> : null}
        </div>

        <div style={{ marginTop: 14, ...card }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: theme.muted, fontWeight: 800 }}>Date</label>
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

            <div style={{ marginLeft: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => setSession("AM")} style={pillBtn(session === "AM")}>
                AM
              </button>
              <button type="button" onClick={() => setSession("PM")} style={pillBtn(session === "PM")}>
                PM
              </button>
            </div>

            <div style={{ marginLeft: "auto", fontSize: 12, color: theme.muted, fontWeight: 800 }}>
              {isAdmin ? "Admin" : "Member"}
            </div>
          </div>

          {error ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(220,38,38,.08)", color: "#991B1B" }}>
              {error}
            </div>
          ) : null}
          {notice ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(16,185,129,.10)", color: "#065F46" }}>
              {notice}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {greens.length === 0 && !error ? (
            <div style={{ ...card, color: theme.muted, fontSize: 13 }}>No greens configured for your club yet.</div>
          ) : null}

          {greens.map((g) => {
            const laneCount = Math.max(1, Math.min(24, Number(g.lane_count ?? 6)));
            const lanes = Array.from({ length: laneCount }, (_, i) => i + 1);
            return (
              <div key={g.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: theme.text }}>{g.name || "Green"}</div>
                  <div style={{ fontSize: 12, color: theme.muted }}>{laneCount} lanes</div>
                </div>

                <div style={{ marginTop: 8 }}>
                  {lanes.map((laneNo) => {
                    const booking = bookingsByGreenLane.get(`${g.id}:${laneNo}`) ?? null;
                    const bookedBy = booking ? String(nameByUserId[booking.created_by] ?? "") : "";
                    const isMine = booking ? booking.created_by === meUserId : false;
                    const canCancel = Boolean(booking) && (isMine || isAdmin);
                    return (
                      <div key={laneNo} style={laneRowStyle}>
                        <div style={{ fontWeight: 900, fontSize: 13, color: theme.text }}>Lane {laneNo}</div>
                        <div style={{ fontSize: 13, color: booking ? theme.text : theme.muted }}>
                          {booking ? `Booked${bookedBy ? ` by ${bookedBy}` : ""}${isMine ? " (you)" : ""}` : "Free"}
                        </div>
                        <div>
                          {!booking ? (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                const ok = window.confirm(`Book ${g.name || "this green"} lane ${laneNo} for ${date} (${session})?`);
                                if (ok) createBooking(g.id, laneNo);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: `1px solid ${theme.maroon}`,
                                background: theme.maroon,
                                color: "#fff",
                                fontWeight: 900,
                                cursor: "pointer",
                                opacity: loading ? 0.7 : 1,
                              }}
                            >
                              Book
                            </button>
                          ) : canCancel ? (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                const ok = window.confirm("Cancel this booking?");
                                if (ok) cancelBooking(booking.id);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: `1px solid #B91C1C`,
                                background: "#fff",
                                color: "#B91C1C",
                                fontWeight: 900,
                                cursor: "pointer",
                                opacity: loading ? 0.7 : 1,
                              }}
                            >
                              Cancel
                            </button>
                          ) : (
                            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 800 }}>—</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
