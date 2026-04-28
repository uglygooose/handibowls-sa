// Shared tab definitions for /manage/tournaments/[id]. Universal module
// (no "use client", no "server-only") so the Server Component page can
// import the URL parser and TabId type directly while the Client
// Component tab strip imports the same constants for its rendered
// buttons. Splitting this out is mandatory under Next 16: importing a
// runtime helper from a "use client" module into a Server Component
// produces a Client Reference, which throws "Attempted to call X() from
// the server but X is on the client" at render time.

export type TabId =
  | "entries"
  | "draw"
  | "scoring"
  | "rinks"
  | "comms"
  | "audit";

export type TabSpec = {
  id: TabId;
  /** Lucide icon component — typed loosely to avoid forcing this module
   *  to import lucide-react (keeps the parser tree-shake-friendly for
   *  any future server-only consumer that doesn't render the strip). */
  icon: unknown;
  label: string;
};

export const ALL_TAB_IDS: readonly TabId[] = [
  "entries",
  "draw",
  "scoring",
  "rinks",
  "comms",
  "audit",
] as const;

const TAB_IDS: ReadonlySet<TabId> = new Set(ALL_TAB_IDS);

// URL → TabId. Defaults to "entries" for missing / unknown values so the
// detail page renders a useful first-paint instead of a blank route.
export function parseTabFromUrl(value: string | undefined | null): TabId {
  if (!value) return "entries";
  const v = String(value).trim();
  return TAB_IDS.has(v as TabId) ? (v as TabId) : "entries";
}
