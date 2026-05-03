// Single stat tile — display number / value over a small uppercase
// label. Used in the 3-cell stats grids on /me (matches / win rate /
// clubs) and /play (active matches / upcoming bookings / tournaments
// entered). Extracted from /me/page.tsx at Phase 13 / 13-4.5 so both
// pages consume the same chassis.

export function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5 rounded-[14px] border border-border bg-surface px-3 py-3">
      <span className="font-display text-[28px] font-black italic leading-none tabular-nums">
        {value}
      </span>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
    </div>
  );
}
