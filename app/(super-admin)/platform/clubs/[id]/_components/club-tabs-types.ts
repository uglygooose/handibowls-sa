export const CLUB_TABS = [
  "overview",
  "admins",
  "greens",
  "members",
  "tournaments",
  "theme",
  "audit",
] as const;

export type ClubTab = (typeof CLUB_TABS)[number];

export function isClubTab(v: string | null | undefined): v is ClubTab {
  return !!v && (CLUB_TABS as readonly string[]).includes(v);
}

export const CLUB_TAB_LABELS: Record<ClubTab, string> = {
  overview: "Overview",
  admins: "Admins",
  greens: "Greens",
  members: "Members",
  tournaments: "Tournaments",
  theme: "Theme",
  audit: "Audit",
};
