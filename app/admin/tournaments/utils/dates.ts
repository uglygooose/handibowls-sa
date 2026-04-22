// app/admin/tournaments/utils/dates.ts
//
// Pure datetime helpers used by the admin tournaments list page.
// No React, no Supabase, no page imports.

export function toIsoOrNull(dtLocal: string): string | null {
  const v = (dtLocal ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
