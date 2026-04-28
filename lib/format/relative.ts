// Phase 8a — relative-time formatting for player surfaces (inbox,
// activity feed, recent results). Africa/Johannesburg-anchored to match
// lib/format/dates.ts. Output is short and en-ZA flavoured:
//
//   < 60s         "now"
//   < 60m         "5m"
//   < 24h         "2h"
//   < 7d          "3d"
//   < 4w          "2w"
//   else          "12 Apr"  (falls through to formatDateZA)
//
// Tiny + dependency-free. We don't reach for a humaniser library
// because the design only renders these in 4-character monospace pills
// — anything richer (sub-minute granularity, day-of-week labels) is
// handled by the regular formatDateZA helper instead.

import { formatDateZA } from "@/lib/format/dates";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelativeZA(
  input: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const delta = now.getTime() - d.getTime();
  if (delta < MINUTE) return "now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < WEEK) return `${Math.floor(delta / DAY)}d`;
  if (delta < 4 * WEEK) return `${Math.floor(delta / WEEK)}w`;
  return formatDateZA(d);
}
