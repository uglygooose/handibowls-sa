import { Bowl } from "@/components/brand/Bowl";

// Audit empty state per the brief: render the speckled bowl illustration
// and the locked copy below — DO NOT show fake/mock events. The
// `audit_log` table itself is deferred to Phase 12 (cross-cutting); see
// the DRIFT_LOG entry for ownership.

export function AuditTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <Bowl preset="atomic-red" size={96} seed="audit-empty" emblem={false} />
      <div className="flex flex-col items-center gap-1">
        <h3 className="font-display text-2xl font-black tracking-tight">
          Audit
        </h3>
        <p className="max-w-md text-[13px] text-ink-muted">
          Audit log activates when actions begin generating events.
          Currently empty.
        </p>
      </div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        Backed by the audit_log table — landing in Phase 12
      </p>
    </div>
  );
}
