// lib/tournaments/labels.ts
// Pure-function label helpers. No DB access, no React state.

export type TournamentScope = "CLUB" | "DISTRICT" | "NATIONAL";
export type TournamentStatus = "ANNOUNCED" | "IN_PLAY" | "COMPLETED";
export type TournamentFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";
export type TournamentGender = "MALE" | "FEMALE";
export type TournamentRule = "SCRATCH" | "HANDICAP_START";

export function scopeLabel(scope: TournamentScope): string {
  if (scope === "CLUB") return "Club";
  if (scope === "DISTRICT") return "District";
  return "National";
}

export function statusLabel(status: TournamentStatus): string {
  if (status === "ANNOUNCED") return "Upcoming";
  if (status === "IN_PLAY") return "In-play";
  return "Past";
}

export function formatLabel(fmt: TournamentFormat): string {
  if (fmt === "FOUR_BALL") return "4 Balls";
  return fmt.charAt(0) + fmt.slice(1).toLowerCase();
}

export function genderLabel(g: TournamentGender | null | undefined): string {
  if (g === "MALE") return "Men";
  if (g === "FEMALE") return "Ladies";
  return "Open";
}

export function ruleLabel(rule: TournamentRule | null | undefined): string {
  if (rule === "SCRATCH") return "Scratch";
  return "Handicap start";
}

export function cleanTournamentName(name: string | null | undefined): string {
  const raw = (name ?? "").toString();
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function matchStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "");
  if (s === "SCHEDULED") return "Scheduled";
  if (s === "IN_PLAY") return "In play";
  if (s === "COMPLETED") return "Completed";
  if (s === "OPEN") return "Open";
  if (s === "FINAL") return "Final";
  if (s === "BYE") return "BYE";
  return s || "-";
}
