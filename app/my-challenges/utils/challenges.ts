// app/my-challenges/utils/challenges.ts
//
// Pure helpers used by the my-challenges page.
// No React, no Supabase.

export function safeParseMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function formatTimeRemaining(expiresAtIso: string): string {
  const end = safeParseMs(expiresAtIso);
  if (end === null) return "-";

  const ms = end - Date.now();
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isMissingColumnError(msg: string | null | undefined, col: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes(`column "${col.toLowerCase()}"`) && m.includes("does not exist");
}

export function applyTypeFilter<T>(items: T[]): T[] {
  return items;
}
