// app/admin/tournaments/views/TournamentsListView.tsx
"use client";

import { theme } from "@/lib/theme";
import {
  cleanTournamentName,
  formatLabel,
  genderLabel,
  scopeLabel,
  statusLabel,
} from "@/lib/tournaments/labels";
import type { AdminTab, TournamentRow } from "../page";

type TeamRow = { id: string; team_no: number; team_handicap: number | null };

export type TournamentsListViewProps = {
  tab: AdminTab;
  byScope: { club: TournamentRow[]; district: TournamentRow[]; national: TournamentRow[] };

  // per-tournament metadata
  entryCountByTournamentId: Record<string, number>;
  matchCountByTournamentId: Record<string, number>;
  teamsByTournamentId: Record<string, TeamRow[]>;
  teamMembersByTeamId: Record<string, string[]>;
  nameByPlayerId: Record<string, string>;

  // UI expansion state + setters
  teamsOpenByTournamentId: Record<string, boolean>;
  setTeamsOpenByTournamentId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  bucketOpenByTitle: Record<string, boolean>;
  setBucketOpenByTitle: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sectionOpenByKey: Record<string, boolean>;
  setSectionOpenByKey: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // busy flags
  busyByTournamentId: Record<string, boolean>;

  // admin scope
  isSuperAdmin: boolean;

  // actions
  cancelTournament: (t: TournamentRow) => Promise<void>;
};

export default function TournamentsListView(props: TournamentsListViewProps) {
  const {
    tab,
    byScope,
    entryCountByTournamentId,
    matchCountByTournamentId,
    teamsByTournamentId,
    teamMembersByTeamId,
    nameByPlayerId,
    teamsOpenByTournamentId,
    setTeamsOpenByTournamentId,
    bucketOpenByTitle,
    setBucketOpenByTitle,
    sectionOpenByKey,
    setSectionOpenByKey,
    busyByTournamentId,
    isSuperAdmin,
    cancelTournament,
  } = props;

  function renderTournamentCard(t: TournamentRow) {
    const count = entryCountByTournamentId[t.id] ?? 0;
    const matchCount = matchCountByTournamentId[t.id] ?? 0;
    const busy = !!busyByTournamentId[t.id];

    const entriesOpen = t.entries_open !== false; // treat null as open
    const lockedLabel = entriesOpen ? "Open" : "Locked";

    const hasTeams = (teamsByTournamentId[t.id]?.length ?? 0) > 0;

    const nextStep = t.status === "COMPLETED" ? "View" : "Manage";

    function goManage() {
      window.location.href = `/admin/tournaments/${t.id}`;
    }

    function openPlayerView() {
      window.location.href = `/tournaments/${t.id}`;
    }

    function runNextStep() {
      goManage();
    }

    const statusPillBg = t.status === "IN_PLAY" ? "#ECFDF5" : t.status === "COMPLETED" ? "#F3F4F6" : "#EFF6FF";
    const statusPillColor = t.status === "IN_PLAY" ? "#047857" : t.status === "COMPLETED" ? theme.muted : "#1D4ED8";

    const cancelDisabled = busy || t.status !== "ANNOUNCED";
    const cancelTitle =
      t.status !== "ANNOUNCED" ? "Cancel is only available while tournament is Upcoming" : "Cancel tournament";

    return (
      <div
        key={t.id}
        style={{
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 15, minWidth: 0 }}>
            <div
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={cleanTournamentName(t.name)}
            >
              {cleanTournamentName(t.name)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 900,
                color: theme.text,
                background: "#fff",
                whiteSpace: "nowrap",
              }}
              title="Tournament format"
            >
              {formatLabel(t.format)}
            </div>

            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 900,
                color: statusPillColor,
                background: statusPillBg,
                whiteSpace: "nowrap",
              }}
              title="Tournament status"
            >
              {statusLabel(t.status)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {scopeLabel(t.scope)}
          </span>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {genderLabel(t.gender ?? null)}
          </span>
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            {statusLabel(t.status)}
          </span>
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Entries
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {count} <span style={{ color: entriesOpen ? theme.maroon : theme.danger }}>• {lockedLabel}</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Teams / Matches
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {hasTeams ? teamsByTournamentId[t.id].length : 0} • {matchCount}
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Starts
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {t.starts_at ? new Date(t.starts_at).toLocaleString() : "TBC"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.muted, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Ends
            </div>
            <div style={{ fontWeight: 900, color: theme.text }}>
              {t.ends_at ? new Date(t.ends_at).toLocaleString() : "TBC"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={runNextStep}
            style={{
              width: "100%",
              border: "none",
              background: theme.maroon,
              color: "#fff",
              padding: "12px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            title="Open admin tournament page"
          >
            {busy ? "Working..." : nextStep}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={openPlayerView}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            title="Open player view"
          >
            Open player view →
          </button>

          {t.status === "ANNOUNCED" ? (
            <button
              type="button"
              disabled={cancelDisabled}
              onClick={() => cancelTournament(t)}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: cancelDisabled ? "#F3F4F6" : "#fff",
                color: cancelDisabled ? theme.muted : theme.danger,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: cancelDisabled ? "not-allowed" : "pointer",
              }}
              title={cancelTitle}
            >
              Cancel tournament
            </button>
          ) : null}

          {teamsByTournamentId[t.id]?.length ? (
            <div
              style={{
                marginTop: 10,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                background: "#fff",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setTeamsOpenByTournamentId((m) => ({ ...m, [t.id]: !m[t.id] }))}
                style={{
                  width: "100%",
                  border: "none",
                  background: "#F3F8F3",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                }}
                title="Toggle teams"
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>Teams</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
                  {teamsByTournamentId[t.id].length} {teamsByTournamentId[t.id].length === 1 ? "team" : "teams"}{" "}
                  <span style={{ marginLeft: 8 }}>{teamsOpenByTournamentId[t.id] ? "▾" : "▸"}</span>
                </div>
              </button>

              {teamsOpenByTournamentId[t.id] ? (
                <div style={{ padding: 10, display: "grid", gap: 8, borderTop: `1px solid ${theme.border}` }}>
                  {teamsByTournamentId[t.id].map((tm) => {
                    const memberIds = teamMembersByTeamId[tm.id] ?? [];
                    const memberNames = memberIds.map((pid) => nameByPlayerId[pid] ?? "Unknown");

                    return (
                      <div
                        key={tm.id}
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: 12,
                          padding: 10,
                          background: "#fff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>Team {tm.team_no}</div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                            HCP {tm.team_handicap == null ? "-" : tm.team_handicap}
                          </div>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 13, color: theme.text, fontWeight: 800, lineHeight: 1.35 }}>
                          {memberNames.length ? memberNames.join(" \u2022 ") : "Members not loaded"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBucket(title: string, items: TournamentRow[]) {
    const upcoming = items.filter((r) => r.status === "ANNOUNCED");
    const inplay = items.filter((r) => r.status === "IN_PLAY");
    const past = items.filter((r) => r.status === "COMPLETED");

    const bucketOpen = bucketOpenByTitle[title] !== false;

    function section(label: string, list: TournamentRow[]) {
      const key = `${title}__${label}`;
      const open = sectionOpenByKey[key] ?? (label === "In-play" ? true : false);

      return (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setSectionOpenByKey((m) => ({ ...m, [key]: !open }))}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#F3F8F3",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 10,
            }}
            title={`Toggle ${label}`}
          >
            <div>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
              {list.length} {list.length === 1 ? "tournament" : "tournaments"}{" "}
              <span style={{ marginLeft: 8 }}>{open ? "▾" : "▸"}</span>
            </div>
          </button>

          {open ? (
            !list.length ? (
              <div style={{ marginTop: 8, color: theme.muted, fontSize: 13 }}>None</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{list.map(renderTournamentCard)}</div>
            )
          ) : null}
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setBucketOpenByTitle((m) => ({ ...m, [title]: !(m[title] !== false) }))}
          style={{
            width: "100%",
            border: "none",
            background: "#fff",
            color: theme.text,
            padding: "12px 14px",
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
          title={`Toggle ${title}`}
        >
          <div style={{ fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
            {items.length} {items.length === 1 ? "tournament" : "tournaments"}{" "}
            <span style={{ marginLeft: 8 }}>{bucketOpen ? "▾" : "▸"}</span>
          </div>
        </button>

        {bucketOpen ? (
          <div style={{ padding: 14, borderTop: `1px solid ${theme.border}` }}>
            {section("Upcoming", upcoming)}
            {section("In-play", inplay)}
            {section("Past", past)}
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "ISSUES") {
    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Issues</div>
        <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
          Coming next: score disputes and admin review queues (Club / District / Tournament host).
        </div>
      </div>
    );
  }

  return (
    <>
      {renderBucket("Club Tournaments", byScope.club)}
      {isSuperAdmin ? renderBucket("District Tournaments", byScope.district) : null}
      {isSuperAdmin ? renderBucket("National Tournaments", byScope.national) : null}
    </>
  );
}
