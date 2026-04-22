// app/home/views/ClubNewsView.tsx
"use client";

import { theme } from "@/lib/theme";
import type { ClubNewsRow, RecentWinnerItem } from "../../page";

export type ClubNewsViewProps = {
  // Card / display state
  isClubAdmin: boolean;
  clubName: string;
  clubNews: ClubNewsRow | null;
  clubNewsLoading: boolean;
  clubNewsError: string | null;
  newsHasContent: boolean;
  newsIsActiveNow: boolean;

  // Recent winners (rendered inside the card as a stopgap)
  recentWinners: RecentWinnerItem[];
  recentWinnersLoading: boolean;
  recentWinnersNote: string | null;

  // Modal toggles
  clubNewsOpen: boolean;
  setClubNewsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clubNewsEditOpen: boolean;
  setClubNewsEditOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Save state + actions
  clubNewsSaving: boolean;
  dismissNewsForNow: () => void;
  saveClubNews: () => void;

  // Edit form state
  newsTitle: string;
  setNewsTitle: React.Dispatch<React.SetStateAction<string>>;
  newsBody: string;
  setNewsBody: React.Dispatch<React.SetStateAction<string>>;
  newsImageUrl: string;
  setNewsImageUrl: React.Dispatch<React.SetStateAction<string>>;
  newsCtaText: string;
  setNewsCtaText: React.Dispatch<React.SetStateAction<string>>;
  newsCtaUrl: string;
  setNewsCtaUrl: React.Dispatch<React.SetStateAction<string>>;
  newsStartsAt: string;
  setNewsStartsAt: React.Dispatch<React.SetStateAction<string>>;
  newsEndsAt: string;
  setNewsEndsAt: React.Dispatch<React.SetStateAction<string>>;
  newsIsActive: boolean;
  setNewsIsActive: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ClubNewsView(props: ClubNewsViewProps) {
  const {
    isClubAdmin,
    clubName,
    clubNews,
    clubNewsLoading,
    clubNewsError,
    newsHasContent,
    newsIsActiveNow,
    recentWinners,
    recentWinnersLoading,
    recentWinnersNote,
    clubNewsOpen,
    setClubNewsOpen,
    clubNewsEditOpen,
    setClubNewsEditOpen,
    clubNewsSaving,
    dismissNewsForNow,
    saveClubNews,
    newsTitle,
    setNewsTitle,
    newsBody,
    setNewsBody,
    newsImageUrl,
    setNewsImageUrl,
    newsCtaText,
    setNewsCtaText,
    newsCtaUrl,
    setNewsCtaUrl,
    newsStartsAt,
    setNewsStartsAt,
    newsEndsAt,
    setNewsEndsAt,
    newsIsActive,
    setNewsIsActive,
  } = props;

  return (
    <>
      {/* Club News card */}
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Club News</div>
          {isClubAdmin ? (
            <button
              type="button"
              onClick={() => setClubNewsEditOpen(true)}
              style={{
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.text,
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {clubNews ? "Edit popup" : "Create popup"}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: theme.muted }}>Read-only</span>
          )}
        </div>

        {/* Recent Winners (stopgap for read-only news) */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>Recent tournament winners</div>
          {recentWinnersLoading ? (
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted }}>Loading results...</div>
          ) : recentWinnersNote ? (
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted }}>{recentWinnersNote}</div>
          ) : recentWinners.length ? (
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {recentWinners.map((w) => (
                <div
                  key={`winner-${w.tournament_id}`}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 14,
                    padding: 10,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.tournament_name}
                    </div>
                    <a
                      href={`/tournaments/${w.tournament_id}`}
                      style={{ textDecoration: "none", color: theme.maroon, fontWeight: 900, fontSize: 12, whiteSpace: "nowrap" }}
                    >
                      View
                    </a>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: theme.text, fontWeight: 900 }}>
                    Winner: {w.winner_name ?? "-"}
                  </div>
                  {w.ends_at ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.muted }}>
                      Ended: {new Date(w.ends_at).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 13, color: theme.muted }}>No recent results yet.</div>
          )}
        </div>

        <div style={{ marginTop: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }} />

        {clubNewsError ? (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.danger }}>News error: {clubNewsError}</div>
        ) : clubNewsLoading ? (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>Loading news...</div>
        ) : newsHasContent ? (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>Announcements</div>
            <div style={{ fontWeight: 900 }}>{clubNews?.title ?? "Club Update"}</div>
            {clubNews?.body ? (
              <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
                {clubNews.body.length > 160 ? `${clubNews.body.slice(0, 160)}...` : clubNews.body}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setClubNewsOpen(true)}
                style={{
                  border: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {newsIsActiveNow ? "Open popup" : "Preview"}
              </button>
              {isClubAdmin ? (
                <button
                  type="button"
                  onClick={() => setClubNewsEditOpen(true)}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.text,
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Edit details
                </button>
              ) : null}
              {clubNews?.starts_at || clubNews?.ends_at ? (
                <div style={{ fontSize: 12, color: theme.muted, alignSelf: "center" }}>
                  {clubNews.starts_at ? `Starts ${new Date(clubNews.starts_at).toLocaleString()}` : "Live now"}
                  {clubNews.ends_at ? ` · Ends ${new Date(clubNews.ends_at).toLocaleString()}` : ""}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
            No announcements posted yet.
          </div>
        )}
      </div>

      {/* Display modal */}
      {clubNewsOpen && clubNews ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{clubNews.title ?? "Club Update"}</div>
                <div style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                  {clubName || "Your club"} news bulletin
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClubNewsOpen(false)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            {clubNews.image_url ? (
              <div style={{ marginTop: 12 }}>
                <img
                  src={clubNews.image_url}
                  alt="Club news"
                  style={{ width: "100%", borderRadius: 14, border: `1px solid ${theme.border}` }}
                />
              </div>
            ) : null}

            {clubNews.body ? (
              <div style={{ marginTop: 12, fontSize: 14, color: theme.text, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {clubNews.body}
              </div>
            ) : null}

            {(clubNews.cta_text || clubNews.cta_url) && clubNews.cta_url ? (
              <a
                href={clubNews.cta_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 900,
                }}
              >
                {clubNews.cta_text || "Learn more"}
              </a>
            ) : null}

            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={dismissNewsForNow}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Don't show again
              </button>
              {isClubAdmin ? (
                <button
                  type="button"
                  onClick={() => setClubNewsEditOpen(true)}
                  style={{
                    border: "none",
                    background: theme.maroon,
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Edit popup
                </button>
              ) : null}
              {clubNews.starts_at || clubNews.ends_at ? (
                <span style={{ fontSize: 12, color: theme.muted }}>
                  {clubNews.starts_at ? `Starts ${new Date(clubNews.starts_at).toLocaleString()}` : "Live now"}
                  {clubNews.ends_at ? ` · Ends ${new Date(clubNews.ends_at).toLocaleString()}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {clubNewsEditOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#fff",
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Club news popup</div>
                <div style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                  Use this to share match dates, practice notes, and event reminders.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClubNewsEditOpen(false)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <input
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                placeholder="Headline (eg. Club Singles start Saturday)"
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontWeight: 800,
                }}
              />
              <textarea
                value={newsBody}
                onChange={(e) => setNewsBody(e.target.value)}
                placeholder="Details, timing, dress code, costs, who to contact..."
                rows={5}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <input
                value={newsImageUrl}
                onChange={(e) => setNewsImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  value={newsCtaText}
                  onChange={(e) => setNewsCtaText(e.target.value)}
                  placeholder="Button text (optional)"
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                />
                <input
                  value={newsCtaUrl}
                  onChange={(e) => setNewsCtaUrl(e.target.value)}
                  placeholder="Button link (optional)"
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Start time</label>
                  <input
                    type="datetime-local"
                    value={newsStartsAt}
                    onChange={(e) => setNewsStartsAt(e.target.value)}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>End time</label>
                  <input
                    type="datetime-local"
                    value={newsEndsAt}
                    onChange={(e) => setNewsEndsAt(e.target.value)}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                    }}
                  />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={newsIsActive}
                  onChange={(e) => setNewsIsActive(e.target.checked)}
                />
                Active (show popup to members)
              </label>
              {clubNewsError ? <div style={{ color: theme.danger, fontSize: 12 }}>{clubNewsError}</div> : null}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={saveClubNews}
                disabled={clubNewsSaving}
                style={{
                  border: "none",
                  background: theme.maroon,
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: clubNewsSaving ? "not-allowed" : "pointer",
                }}
              >
                {clubNewsSaving ? "Saving..." : "Save popup"}
              </button>
              <button
                type="button"
                onClick={() => setClubNewsEditOpen(false)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
