// app/admin/tournaments/[id]/views/ControlView.tsx
"use client";

import PrimaryButton from "../../../../components/PrimaryButton";
import StatusPill from "../../../../components/StatusPill";
import { theme } from "@/lib/theme";
import { isMatchBye } from "@/lib/tournaments/match";
import { matchStatusLabel, statusLabel } from "@/lib/tournaments/labels";
import type { Labelers, MatchRow, TeamRow, TournamentRow } from "../page";

export type ControlViewProps = {
  tournament: TournamentRow | null;
  tournamentId: string | null | undefined;
  entryCount: number;
  teams: TeamRow[];
  matches: MatchRow[];
  busy: boolean;
  entriesOpen: boolean;
  hasTeams: boolean;
  hasMatches: boolean;
  mustSetTargetBeforeLock: boolean;
  targetInput: string;
  targetValid: boolean;
  fixturesEditOpen: boolean;
  fixturesDraftByMatchId: Record<string, { a: string; b: string }>;
  setTargetInput: (v: string) => void;
  setFixturesEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFixturesDraftByMatchId: React.Dispatch<React.SetStateAction<Record<string, { a: string; b: string }>>>;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  reload: (opts?: { preserveScroll?: boolean }) => Promise<void>;
  lockEntries: () => Promise<void>;
  generateDoublesTeams: () => Promise<void>;
  generateMatches: () => Promise<void>;
  startTournament: () => Promise<void>;
  endTournament: () => Promise<void>;
  saveTarget: () => Promise<void>;
  suggestTargetFromEntries: () => Promise<void>;
  labelers: Labelers;
};

function TournamentControlBar(props: ControlViewProps) {
  const {
    tournament,
    entryCount,
    teams,
    matches,
    busy,
    entriesOpen,
    hasTeams,
    hasMatches,
    mustSetTargetBeforeLock,
    targetInput,
    targetValid,
    setTargetInput,
    lockEntries,
    generateDoublesTeams,
    generateMatches,
    startTournament,
    endTournament,
    saveTarget,
    suggestTargetFromEntries,
  } = props;

  const t = tournament;
  const fmt = t?.format ?? "SINGLES";

  const canLock = !!t && entriesOpen && !busy && !mustSetTargetBeforeLock;
  const canGenTeams = !!t && fmt === "DOUBLES" && !entriesOpen && !busy;
  const canGenMatches = !!t && !entriesOpen && !busy && !hasMatches && (t.format === "SINGLES" || hasTeams);
  const canStart = !!t && t.status === "ANNOUNCED" && !entriesOpen && (fmt !== "DOUBLES" || hasTeams) && !busy;
  const canEnd = !!t && t.status === "IN_PLAY" && !busy;

  const entriesTone = entriesOpen ? "good" : "danger";
  const tourTone = t?.status === "IN_PLAY" ? "warn" : t?.status === "COMPLETED" ? "neutral" : "good";

  const bracketLabel = hasMatches ? "Bracket generated ✓" : fmt === "SINGLES" ? "Generate round 1" : "Generate matches";
  const bracketTitle = entriesOpen
    ? "Lock entries first"
    : !hasTeams
    ? "Generate teams first"
    : hasMatches
    ? "Matches already exist for this tournament"
    : "Generate fixtures";

  return (
    <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Tournament control</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusPill label={t ? statusLabel(t.status) : "—"} tone={tourTone} />
          <StatusPill label={entriesOpen ? "Entries open" : "Entries locked"} tone={entriesTone} />
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Entrants</div>
            <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{entryCount}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Teams</div>
            <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{teams.length}</div>
          </div>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Matches</div>
            <div style={{ marginTop: 2, fontSize: 16, fontWeight: 900 }}>{matches.length}</div>
          </div>
        </div>

        {t?.format === "DOUBLES" ? (
          <div style={{ marginTop: 12, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Target team handicap</div>
            <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>Required before locking entries for Doubles.</div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                inputMode="decimal"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="e.g. 18"
                disabled={busy || !entriesOpen}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 900,
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={busy || !entriesOpen}
                onClick={suggestTargetFromEntries}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: busy || !entriesOpen ? "not-allowed" : "pointer",
                }}
                title={!entriesOpen ? "Entries are locked" : "Suggest from current entrants"}
              >
                Suggest
              </button>
            </div>

            <button
              type="button"
              disabled={busy || !entriesOpen || !targetValid}
              onClick={saveTarget}
              style={{
                marginTop: 8,
                width: "100%",
                border: "none",
                background: entriesOpen && targetValid ? theme.maroon : "#9CA3AF",
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy || !entriesOpen || !targetValid ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Working..." : "Save target"}
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <PrimaryButton
            busy={busy}
            label={!entriesOpen ? "Entries locked" : "Lock entries"}
            onClick={lockEntries}
            disabled={!canLock}
            variant="outline"
            title={!entriesOpen ? "Entries already locked" : mustSetTargetBeforeLock ? "Set target team handicap first" : "Lock entries"}
          />

          {t?.format === "DOUBLES" ? (
            <PrimaryButton
              busy={busy}
              label="Generate teams"
              onClick={generateDoublesTeams}
              disabled={!canGenTeams}
              variant="solid"
              title={entriesOpen ? "Lock entries first" : "Generate doubles teams"}
            />
          ) : null}

          <PrimaryButton busy={busy} label={bracketLabel} onClick={generateMatches} disabled={!canGenMatches} variant={hasMatches ? "outline" : "solid"} title={bracketTitle} />

          {t?.status === "ANNOUNCED" ? (
            <PrimaryButton busy={busy} label="Start tournament" onClick={startTournament} disabled={!canStart} variant="solid" title="Move tournament to In-play" />
          ) : null}

          {t?.status === "IN_PLAY" ? <PrimaryButton busy={busy} label="End tournament" onClick={endTournament} disabled={!canEnd} variant="outline" title="Mark tournament as Completed" /> : null}
        </div>
      </div>
    </div>
  );
}

function Round1PreviewCard(props: ControlViewProps) {
  const {
    tournament,
    tournamentId,
    matches,
    teams,
    busy,
    fixturesEditOpen,
    fixturesDraftByMatchId,
    setFixturesEditOpen,
    setFixturesDraftByMatchId,
    setBusy,
    setError,
    reload,
    labelers,
  } = props;

  const { teamDisplayName, teamLabel, roundLabel, singlesHandicapLine, singlesHandicapInfo, isHandicapTournament } = labelers;

  // Only show once fixtures exist
  if (!matches.length) return null;

  const roundNos = matches
    .map((m) => Number(m.round_no ?? 0))
    .filter((n) => n && !Number.isNaN(n))
    .sort((a, b) => a - b);

  const firstRound = roundNos[0] ?? null;
  if (!firstRound) return null;

  const round1 = matches
    .filter((m) => Number(m.round_no ?? 0) === firstRound)
    .sort((a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id)));

  if (!round1.length) return null;

  const playable = round1.filter((m) => !isMatchBye(m));
  const byes = round1.filter((m) => isMatchBye(m));

  const canEdit = tournament?.status === "ANNOUNCED" && !busy;

  async function saveFixtureEdits() {
    if (!tournamentId) return;
    if (!canEdit) return;

    // Local validation for friendlier error messages — the RPC also
    // re-validates server-side, but catching duplicates here lets us
    // surface the same copy the old loop used.
    const used = new Set<string>();
    for (const m of round1) {
      const d = fixturesDraftByMatchId[m.id] ?? { a: "", b: "" };
      const a = (d.a ?? "").trim();
      const b = (d.b ?? "").trim();

      if (!a) {
        setError("Each match must have Team A set.");
        return;
      }
      if (a && b && a === b) {
        setError("A team cannot play itself.");
        return;
      }
      if (used.has(a)) {
        setError("Each team can only appear once in the round.");
        return;
      }
      used.add(a);
      if (b) {
        if (used.has(b)) {
          setError("Each team can only appear once in the round.");
          return;
        }
        used.add(b);
      }
    }

    const fixtures = round1.map((m) => {
      const d = fixturesDraftByMatchId[m.id] ?? { a: "", b: "" };
      const a = (d.a ?? "").trim();
      const b = (d.b ?? "").trim();
      return { match_id: m.id, team_a_id: a, team_b_id: b ? b : null };
    });

    const roundNo = firstRound;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/tournaments/matches/save-fixtures/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId, round_no: roundNo, fixtures }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not save fixtures.");
        setBusy(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
      return;
    }

    setFixturesEditOpen(false);
    await reload({ preserveScroll: true });
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{roundLabel(firstRound)} fixtures</div>
        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
          {playable.length} matches{byes.length ? ` • ${byes.length} BYE` : ""}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
        <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
          Review fixtures before starting. You can switch to <span style={{ fontWeight: 900, color: theme.text }}>Rounds</span> to manage scoring and admin actions.
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setFixturesEditOpen((v) => !v)}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canEdit ? "pointer" : "not-allowed",
            }}
            title={canEdit ? "Edit fixtures before starting" : "Start tournament to edit fixtures"}
          >
            {fixturesEditOpen ? "Close fixture editor" : "Edit fixtures"}
          </button>

          {fixturesEditOpen ? (
            <button
              type="button"
              disabled={busy}
              onClick={saveFixtureEdits}
              style={{
                width: "100%",
                border: "none",
                background: theme.maroon,
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Working..." : "Save fixture edits"}
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {round1.map((m) => {
            const leftName = teamDisplayName(m.team_a_id);
            const rightName = teamDisplayName(m.team_b_id);
            const hc = singlesHandicapInfo(m);
            const leftHC =
              tournament?.format === "SINGLES" && hc && isHandicapTournament() ? (hc.ha == null ? "" : ` (HC ${hc.ha})`) : "";
            const rightHC =
              tournament?.format === "SINGLES" && hc && isHandicapTournament() ? (hc.hb == null ? "" : ` (HC ${hc.hb})`) : "";

            const isBye = isMatchBye(m);

            return (
              <div key={`r1-prev-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900, minWidth: 0 }}>
                    {fixturesEditOpen ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <select
                          value={fixturesDraftByMatchId[m.id]?.a ?? ""}
                          onChange={(e) =>
                            setFixturesDraftByMatchId((p) => ({
                              ...p,
                              [m.id]: { a: e.target.value, b: p[m.id]?.b ?? "" },
                            }))
                          }
                          style={{
                            width: "100%",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 10,
                            padding: "8px 8px",
                            fontWeight: 900,
                          }}
                        >
                          <option value="">Select Team A</option>
                          {teams.map((t) => (
                            <option key={`team-a-${m.id}-${t.id}`} value={t.id}>
                              {tournament?.format === "SINGLES"
                                ? teamDisplayName(t.id)
                                : `${teamDisplayName(t.id)} (${teamLabel(t.id)})`}
                            </option>
                          ))}
                        </select>
                        <select
                          value={fixturesDraftByMatchId[m.id]?.b ?? ""}
                          onChange={(e) =>
                            setFixturesDraftByMatchId((p) => ({
                              ...p,
                              [m.id]: { a: p[m.id]?.a ?? "", b: e.target.value },
                            }))
                          }
                          style={{
                            width: "100%",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 10,
                            padding: "8px 8px",
                            fontWeight: 900,
                          }}
                        >
                          <option value="">BYE / empty</option>
                          {teams.map((t) => (
                            <option key={`team-b-${m.id}-${t.id}`} value={t.id}>
                              {tournament?.format === "SINGLES"
                                ? teamDisplayName(t.id)
                                : `${teamDisplayName(t.id)} (${teamLabel(t.id)})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isBye ? `${leftName}${leftHC} — Auto-advance (BYE)` : `${leftName}${leftHC} vs ${rightName}${rightHC}`}
                      </div>
                    )}
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                      {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)}
                    </div>

                    {hc && !isBye && !fixturesEditOpen && isHandicapTournament() ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 800, lineHeight: 1.25 }}>
                        {singlesHandicapLine(m)}
                      </div>
                    ) : null}
                  </div>

                  <StatusPill label={isBye ? "BYE" : matchStatusLabel(String(m.status ?? ""))} tone={isBye ? "warn" : "neutral"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ControlView(props: ControlViewProps) {
  return (
    <>
      <TournamentControlBar {...props} />
      <Round1PreviewCard {...props} />
    </>
  );
}
