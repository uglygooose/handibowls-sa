// app/home/utils/news.ts
//
// Pure helpers used by the authenticated home/dashboard page. No React,
// no Supabase, no imports from ../../page — the structural `NewsLike`
// type below lets callers pass any row shape that carries the three
// activity fields (e.g. the page's ClubNewsRow).

export type NewsLike = {
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export function clubLogoFor(name: string): string {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("ridgepark")) return "/ridgepark-logo.png";
  return "";
}

export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isNewsActive(n: NewsLike | null, now: Date): boolean {
  if (!n || n.is_active === false) return false;
  const startOk = n.starts_at ? new Date(n.starts_at) <= now : true;
  const endOk = n.ends_at ? new Date(n.ends_at) >= now : true;
  return startOk && endOk;
}
