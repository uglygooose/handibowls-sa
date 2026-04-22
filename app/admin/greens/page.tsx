"use client";

import BottomNav from "../../components/BottomNav";
import { createClient } from "@/lib/supabase/client";
import { adminGate } from "@/lib/auth/adminGate";
import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";

type GreenRow = {
  id: string;
  club_id: string;
  name: string;
  lane_count: number;
  sort_order: number;
  is_active: boolean;
};

type ClubRow = { id: string; name: string | null };

function asInt(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

export default function AdminGreensPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminClubId, setAdminClubId] = useState<string>("");

  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");

  const [greens, setGreens] = useState<GreenRow[]>([]);

  const [newName, setNewName] = useState("");
  const [newLaneCount, setNewLaneCount] = useState("6");
  const [newSortOrder, setNewSortOrder] = useState("0");

  const selectedClubName = useMemo(() => clubs.find((c) => c.id === selectedClubId)?.name ?? "", [clubs, selectedClubId]);

  async function runAdminGate() {
    setLoading(true);
    setError(null);

    const gate = await adminGate(supabase);
    if (!gate.ok) {
      if (gate.reason === "NOT_AUTHENTICATED") {
        window.location.href = "/login";
        return;
      }
      if (gate.reason === "PROFILE_ERROR") {
        setError(gate.message ?? "Profile not found.");
      }
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminClubId("");
      setLoading(false);
      return;
    }

    // For super admins, also read the user's own club_id to pre-select it in the picker.
    let ownClubId = gate.adminClubId ?? "";
    if (gate.isSuperAdmin) {
      const userRes = await supabase.auth.getUser();
      const uid = userRes.data.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("club_id")
          .eq("id", uid)
          .maybeSingle();
        const profRow = (prof ?? null) as { club_id: string | null } | null;
        ownClubId = String(profRow?.club_id ?? "");
      }
    }

    setIsSuperAdmin(gate.isSuperAdmin);
    setIsAdmin(true);
    setAdminClubId(ownClubId);

    if (gate.isSuperAdmin) {
      const { data: clubsData } = await supabase.from("clubs").select("id, name").order("name", { ascending: true });
      const clubRows = (clubsData ?? []) as unknown as ClubRow[];
      setClubs(clubRows.map((c) => ({ id: String(c.id), name: String(c.name ?? "") })));
      const initial = selectedClubId || ownClubId || String((clubRows[0]?.id ?? ""));
      setSelectedClubId(initial);
    } else {
      setClubs([]);
      setSelectedClubId(ownClubId);
    }

    setLoading(false);
  }

  async function loadGreens() {
    if (!selectedClubId) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/greens/list?club_id=${encodeURIComponent(selectedClubId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not load greens"));
        setGreens([]);
        return;
      }

      setGreens(
        (json?.greens ?? []).map((g: unknown) => {
          const r = (g ?? null) as unknown as Partial<GreenRow> & Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            club_id: String(r.club_id ?? ""),
            name: String(r.name ?? ""),
            lane_count: Number(r.lane_count ?? 6),
            sort_order: Number(r.sort_order ?? 0),
            is_active: Boolean(r.is_active),
          };
        })
      );
    } finally {
      setBusy(false);
    }
  }

  async function createGreen() {
    setNotice(null);
    setError(null);
    const name = newName.trim();
    const lane_count = asInt(newLaneCount);
    const sort_order = asInt(newSortOrder) ?? 0;

    if (!selectedClubId) {
      setError("Select a club first.");
      return;
    }
    if (!name) {
      setError("Enter a green name (e.g. Green A).");
      return;
    }
    if (lane_count == null || lane_count < 1 || lane_count > 24) {
      setError("lane_count must be 1..24.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/greens/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ club_id: selectedClubId, name, lane_count, sort_order }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not create green"));
        return;
      }
      setNotice("Green created.");
      setNewName("");
      await loadGreens();
    } finally {
      setBusy(false);
    }
  }

  async function saveGreen(g: GreenRow) {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/greens/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: g.id,
          name: g.name,
          lane_count: g.lane_count,
          sort_order: g.sort_order,
          is_active: g.is_active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "Could not update green"));
        return;
      }
      setNotice("Saved.");
      await loadGreens();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    runAdminGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && isAdmin && selectedClubId) loadGreens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin, selectedClubId]);

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

  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <div className="mx-auto w-full max-w-[900px] px-[14px] pt-5">
          <div style={{ ...card, color: "#991B1B", background: "rgba(220,38,38,.06)" }}>Access denied.</div>
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
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.maroon }}>Admin: Greens</div>
            <div style={{ marginTop: 2, fontSize: 13, color: theme.muted }}>
              {isSuperAdmin ? "Super admin" : adminClubId ? "Club admin" : "Admin"}
            </div>
          </div>
          {busy ? <div style={{ fontSize: 12, color: theme.muted }}>Working…</div> : null}
        </div>

        <div style={{ marginTop: 14, ...card }}>
          {isSuperAdmin ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Club</label>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
              >
                <option value="">Select club…</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
              {selectedClubName ? <div style={{ fontSize: 12, color: theme.muted }}>Selected: {selectedClubName}</div> : null}
            </div>
          ) : null}

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

        <div style={{ marginTop: 12, ...card }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: theme.text }}>Add green</div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 130px 130px auto", gap: 10 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Green A"
              style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
            />
            <input
              value={newLaneCount}
              onChange={(e) => setNewLaneCount(e.target.value)}
              placeholder="Lanes"
              style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
            />
            <input
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(e.target.value)}
              placeholder="Order"
              style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={createGreen}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.maroon}`,
                background: theme.maroon,
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              Add
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>Typical bowls setup: 6 lanes per green.</div>
        </div>

        <div style={{ marginTop: 12, ...card }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: theme.text }}>Greens</div>

          {greens.length === 0 ? <div style={{ marginTop: 10, fontSize: 13, color: theme.muted }}>No greens yet.</div> : null}

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {greens.map((g) => (
              <div key={g.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 110px auto", gap: 10, alignItems: "center" }}>
                  <input
                    value={g.name}
                    onChange={(e) => setGreens((rows) => rows.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                    style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
                  />
                  <input
                    value={String(g.lane_count)}
                    onChange={(e) => {
                      const v = asInt(e.target.value);
                      setGreens((rows) => rows.map((x) => (x.id === g.id ? { ...x, lane_count: v ?? x.lane_count } : x)));
                    }}
                    style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
                  />
                  <input
                    value={String(g.sort_order)}
                    onChange={(e) => {
                      const v = asInt(e.target.value);
                      setGreens((rows) => rows.map((x) => (x.id === g.id ? { ...x, sort_order: v ?? x.sort_order } : x)));
                    }}
                    style={{ padding: "9px 10px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#fff" }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setGreens((rows) => rows.map((x) => (x.id === g.id ? { ...x, is_active: !x.is_active } : x)))}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 10,
                      border: `1px solid ${g.is_active ? "#059669" : "#B91C1C"}`,
                      background: "#fff",
                      color: g.is_active ? "#059669" : "#B91C1C",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {g.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveGreen(g)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: `1px solid ${theme.maroon}`,
                      background: theme.maroon,
                      color: "#fff",
                      fontWeight: 900,
                      cursor: "pointer",
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    Save
                  </button>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
                  Lane names are standard: 1, 2, 3… (this green currently has {g.lane_count}).
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
