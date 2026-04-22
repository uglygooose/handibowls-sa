// app/admin/tournaments/views/CreateTournamentModal.tsx
"use client";

import { theme } from "@/lib/theme";
import {
  ruleLabel,
  type TournamentFormat,
  type TournamentGender,
  type TournamentRule,
  type TournamentScope,
} from "@/lib/tournaments/labels";

export type CreateTournamentModalProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;

  // form state
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  scope: TournamentScope;
  setScope: React.Dispatch<React.SetStateAction<TournamentScope>>;
  format: TournamentFormat;
  setFormat: React.Dispatch<React.SetStateAction<TournamentFormat>>;
  gender: TournamentGender;
  setGender: React.Dispatch<React.SetStateAction<TournamentGender>>;
  rule: TournamentRule;
  setRule: React.Dispatch<React.SetStateAction<TournamentRule>>;
  clubId: string;
  setClubId: React.Dispatch<React.SetStateAction<string>>;
  startsAt: string;
  setStartsAt: React.Dispatch<React.SetStateAction<string>>;
  endsAt: string;
  setEndsAt: React.Dispatch<React.SetStateAction<string>>;

  clubs: Array<{ id: string; name: string }>;
  isSuperAdmin: boolean;
};

export default function CreateTournamentModal(props: CreateTournamentModalProps) {
  const {
    open,
    busy,
    onClose,
    onSubmit,
    name,
    setName,
    scope,
    setScope,
    format,
    setFormat,
    gender,
    setGender,
    rule,
    setRule,
    clubId,
    setClubId,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    clubs,
    isSuperAdmin,
  } = props;

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 80,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 18,
          border: `1px solid ${theme.border}`,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${theme.border}`,
            background: "#F3F8F3",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15 }}>Create tournament</div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "6px 10px",
              borderRadius: 999,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Tournament name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Saturday Club Doubles"
            disabled={busy}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 800,
              outline: "none",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Scope</div>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as TournamentScope)}
                disabled={busy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="CLUB">Club</option>
                {isSuperAdmin ? <option value="DISTRICT">District</option> : null}
                {isSuperAdmin ? <option value="NATIONAL">National</option> : null}
              </select>
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Format</div>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                disabled={busy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="SINGLES">Singles</option>
                <option value="DOUBLES">Doubles</option>
                <option value="TRIPLES">Triples</option>
                <option value="FOUR_BALL">4 Balls</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Gender</div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as TournamentGender)}
                disabled={busy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                  background: "#fff",
                }}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Host club</div>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                disabled={busy || scope !== "CLUB"}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                  background: "#fff",
                }}
              >
                {clubs.length ? (
                  clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <option value="">No clubs found</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Rule</div>
            <select
              value={rule}
              onChange={(e) => setRule(e.target.value as TournamentRule)}
              disabled={busy}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                padding: "10px 12px",
                fontWeight: 800,
                outline: "none",
                background: "#fff",
              }}
            >
              <option value="HANDICAP_START">{ruleLabel("HANDICAP_START")}</option>
              <option value="SCRATCH">{ruleLabel("SCRATCH")}</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Starts at (optional)</div>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={busy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Ends at (optional)</div>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={busy}
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            style={{
              width: "100%",
              border: "none",
              background: theme.maroon,
              color: "#fff",
              padding: "12px 12px",
              borderRadius: 14,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
              marginTop: 2,
            }}
            title="Create tournament"
          >
            {busy ? "Creating..." : "Create tournament"}
          </button>

          <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
            After creating, you'll be taken to the admin tournament page to lock entries, generate teams, and create
            fixtures.
          </div>
        </div>
      </div>
    </div>
  );
}
