// app/club-ladder/utils/ladder.ts
//
// Pure helpers used by the club-ladder page.
// No React, no Supabase, no page imports.

export function safeDateLabel(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isMissingColumnError(errMsg: string | undefined, columnName: string): boolean {
  if (!errMsg) return false;
  const m = errMsg.toLowerCase();
  return m.includes(`column "${columnName.toLowerCase()}"`) && m.includes("does not exist");
}
