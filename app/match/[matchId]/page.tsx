"use client";


import { theme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "../../components/BottomNav";

type MatchRow = {
  id: string;
  ladder_id: string; // ✅ added (needed to recalc leaderboard)
  match_type?: string | null;

  status: string;

  challenger_player_id: string | null;
  challenged_player_id: string | null;

  challenger_score: number | null;
  challenged_score: number | null;

  submitted_by_player_id: string | null;
  submitted_at: string | null;
};

type PlayerRow = { id: string; user_id: string };
type ProfileRow = { id: string; full_name: string | null; is_admin?: boolean | null };const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export default function MatchPage() {
  const supabase = createClient();
  const params = useParams();

  const matchIdRaw = params?.matchId;
  const matchId =
    typeof matchIdRaw === "string"
      ? matchIdRaw
      : Array.isArray(matchIdRaw)
      ? matchIdRaw[0]
      : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [nameByPlayerId, setNameByPlayerId] = useState<Map<string, string>>(new Map());
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const [challengerScore, setChallengerScore] = useState<string>("");
  const [challengedScore, setChallengedScore] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminFinalising, setAdminFinalising] = useState(false);

  // ✅ Recalc leaderboard AFTER a match becomes FINAL
  async function recalcLadderForMatch(m: MatchRow | null) {
    if (!m) return;
    if (!isUuid(m.ladder_id)) return;

    // only ranked matches affect ladder stats
    if (m.match_type && m.match_type !== "RANKED") return;
    if (m.status !== "FINAL") return;

    // ignore errors (don't block UX)
    const r1 = await supabase.rpc("recalc_ladder", { ladder_uuid: m.ladder_id });
    if (r1.error) return;

    await supabase.rpc("recalc_ladder_positions", { ladder_uuid: m.ladder_id });
  }

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);

    if (!isUuid(matchId)) {
      setError(`Invalid match id in URL: ${String(matchId)}`);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    // admin flag (profiles.id == auth user id)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", userData.user.id)
      .single();

    if (!profErr && prof) {
      const role = String((prof as any).role ?? "").toUpperCase();
      setIsAdmin(Boolean((prof as any).is_admin) || role === "SUPER_ADMIN");
    } else {
      setIsAdmin(false);
    }

    // my player id
    const { data: mePlayer, error: meErr } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", userData.user.id)
      .single();

    if (meErr || !mePlayer) {
      const role = String((prof as any)?.role ?? "").toUpperCase();
      if (role !== "SUPER_ADMIN") {
        setError("Signed-in user not linked to a player record.");
        setLoading(false);
        return;
      }
      setMyPlayerId(null);
    } else {
      setMyPlayerId(mePlayer.id);
    }

    // match
    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, ladder_id, match_type, status, challenger_player_id, challenged_player_id, challenger_score, challenged_score, submitted_by_player_id, submitted_at"
      )
      .eq("id", matchId)
      .single();

    if (mErr || !m) {
      setError(mErr?.message ?? "Match not found");
      setLoading(false);
      return;
    }

    const mRow = m as MatchRow;
    setMatch(mRow);

    setChallengerScore(mRow.challenger_score?.toString() ?? "");
    setChallengedScore(mRow.challenged_score?.toString() ?? "");

    if (!isUuid(mRow.challenger_player_id) || !isUuid(mRow.challenged_player_id)) {
      setError(
        `Match record missing valid player ids.\n` +
          `challenger_player_id: ${String(mRow.challenger_player_id)}\n` +
          `challenged_player_id: ${String(mRow.challenged_player_id)}`
      );
      setLoading(false);
      return;
    }

    const playerIds = [mRow.challenger_player_id, mRow.challenged_player_id];

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, user_id")
      .in("id", playerIds);

    if (pErr) {
      setError(`players: ${pErr.message}`);
      setLoading(false);
      return;
    }

    const playerRows = (players ?? []) as PlayerRow[];
    const userIds = Array.from(new Set(playerRows.map((p) => p.user_id)));

    const { data: profiles, error: prErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (prErr) {
      setError(`profiles: ${prErr.message}`);
      setLoading(false);
      return;
    }

    const profileRows = (profiles ?? []) as ProfileRow[];
    const profileByUserId = new Map(profileRows.map((p) => [p.id, p.full_name ?? "Unknown"]));

    const map = new Map<string, string>();
    for (const pl of playerRows) {
      map.set(pl.id, profileByUserId.get(pl.user_id) ?? "Unknown");
    }

    setNameByPlayerId(map);

    // ✅ If this match is already FINAL, make sure ladder stats exist
    await recalcLadderForMatch(mRow);

    setLoading(false);
  }

  useEffect(() => {
    if (matchIdRaw !== undefined) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdRaw]);

  const challengerName = useMemo(() => {
    if (!match || !match.challenger_player_id) return "Challenger";
    return nameByPlayerId.get(match.challenger_player_id) ?? "Challenger";
  }, [match, nameByPlayerId]);

  const challengedName = useMemo(() => {
    if (!match || !match.challenged_player_id) return "Challenged";
    return nameByPlayerId.get(match.challenged_player_id) ?? "Challenged";
  }, [match, nameByPlayerId]);

  const canSubmit =
    !submitting &&
    !confirming &&
    !adminFinalising &&
    (match?.status === "OPEN" ||
      (match?.status === "RESULT_SUBMITTED" && match?.submitted_by_player_id === myPlayerId));

  const canConfirm =
    !submitting &&
    !confirming &&
    !adminFinalising &&
    match?.status === "RESULT_SUBMITTED" &&
    myPlayerId != null &&
    match?.submitted_by_player_id != null &&
    match.submitted_by_player_id !== myPlayerId;

  const statusHint = useMemo(() => {
    if (!match) return "";
    if (match.status === "FINAL") return "Finalised";
    if (match.status === "RESULT_SUBMITTED") {
      if (match.submitted_by_player_id === myPlayerId) return "Waiting for opponent to confirm";
      return "Opponent submitted - you can confirm";
    }
    if (match.status === "OPEN") return "Open - enter the score and submit";
    return match.status;
  }, [match, myPlayerId]);

  async function submitResult() {
    setNotice(null);
    setError(null);

    if (!isUuid(matchId)) {
      setError("Invalid match id.");
      return;
    }

    const a = Number(challengerScore);
    const b = Number(challengedScore);

    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      setError("Please enter valid non-negative whole-number scores for both players.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/matches/submit-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          challenger_score: a,
          challenged_score: b,
        }),
      });

      const text = await res.text();
      let json: any = null;
      if (text?.trim()) {
        try {
          json = JSON.parse(text);
        } catch {}
      }

      if (!res.ok) {
        setError(
          json?.error ??
            (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status})`)
        );
        return;
      }

      setNotice("Result submitted. Waiting for opponent confirmation.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmResult() {
    setNotice(null);
    setError(null);

    if (!isUuid(matchId)) {
      setError("Invalid match id.");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch("/api/matches/confirm-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });

      const text = await res.text();
      let json: any = null;
      if (text?.trim()) {
        try {
          json = JSON.parse(text);
        } catch {}
      }

      if (!res.ok) {
        setError(
          json?.error ??
            (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status})`)
        );
        return;
      }

      if (json?.reason === "already final") {
        setNotice("Already confirmed. Match is final.");
      } else if (json?.reason === "draw") {
        setNotice("Confirmed. Match finalised as a draw (no ladder move).");
      } else if (json?.ladder_moved === false) {
        setNotice("Confirmed. Match finalised (no ladder move).");
      } else {
        setNotice("Result confirmed. Match is now final and ladder updated.");
      }

      await load();
    } finally {
      setConfirming(false);
    }
  }

  async function adminFinalise() {
    setNotice(null);
    setError(null);

    if (!isUuid(matchId)) {
      setError("Invalid match id.");
      return;
    }

    const a = Number(challengerScore);
    const b = Number(challengedScore);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      setError("Admin finalise requires valid scores in both boxes.");
      return;
    }

    const ok = window.confirm(
      "ADMIN: Force finalise this match?\n\nThis will finalise the match and may move the ladder."
    );
    if (!ok) return;

    setAdminFinalising(true);
    try {
      const res = await fetch("/api/matches/admin-finalise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });

      const text = await res.text();
      let json: any = null;
      if (text?.trim()) {
        try {
          json = JSON.parse(text);
        } catch {}
      }

      if (!res.ok) {
        setError(
          json?.error ??
            (text?.trim() ? `API error (${res.status}): ${text}` : `API error (${res.status})`)
        );
        return;
      }

      if (json?.reason === "already final") {
        setNotice("Admin: match already final.");
      } else if (json?.reason === "draw") {
        setNotice("Admin: finalised as draw (no ladder move).");
      } else if (json?.ladder_moved) {
        setNotice("Admin: finalised and ladder updated.");
      } else {
        setNotice("Admin: finalised (no ladder move).");
      }

      await load();
    } finally {
      setAdminFinalising(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: theme.background, minHeight: "100vh", padding: 16, paddingBottom: 110 }}>
        <p style={{ color: theme.muted }}>Loading match...</p>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: theme.background, minHeight: "100vh", padding: 16, paddingBottom: 110 }}>
        <p style={{ color: theme.danger, whiteSpace: "pre-wrap" }}>Error: {error}</p>
        <a href="/my-challenges" style={{ color: theme.maroon, fontWeight: 900, textDecoration: "none" }}>
          Back to My Challenges
        </a>
        <BottomNav />
      </div>
    );
  }

  if (!match) return null;

  return (
    <div style={{ background: theme.background, minHeight: "100vh", color: theme.text }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>HandiBowls SA</div>
            <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              Match Result Capture * Status: {match.status} * {statusHint}
            </div>
          </div>
          <a
            href="/my-challenges"
            style={{ textDecoration: "none", color: theme.maroon, fontWeight: 900, fontSize: 13 }}
          >
            Back
          </a>
        </div>

        {notice && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.maroon,
              fontWeight: 800,
            }}
          >
            {notice}
          </div>
        )}

        {isAdmin && match.status !== "FINAL" && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 16,
              border: `1px solid ${theme.border}`,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, color: theme.danger }}>Admin Controls</div>
            <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
              Force-finalise a match if players don't confirm. Requires scores to be entered.
            </div>

            <button
              onClick={adminFinalise}
              disabled={adminFinalising || submitting || confirming}
              style={{
                marginTop: 10,
                width: "100%",
                border: "none",
                background: theme.danger,
                color: "#fff",
                padding: "11px 12px",
                borderRadius: 14,
                fontWeight: 900,
                cursor: adminFinalising ? "not-allowed" : "pointer",
                opacity: adminFinalising ? 0.7 : 1,
              }}
            >
              {adminFinalising ? "Admin Finalising..." : "ADMIN: Force Finalise Match"}
            </button>
          </div>
        )}

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

          {match.status === "FINAL" ? (
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
      </div>

      <BottomNav />
    </div>
  );
}
