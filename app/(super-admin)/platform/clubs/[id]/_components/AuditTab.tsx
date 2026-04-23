export function AuditTab() {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-sm">
      <p className="font-medium text-ink">Audit log</p>
      <p className="mt-1 text-ink-muted">
        Available in Phase 11 — audit events are wired when the comms + audit
        tables ship. Until then this tab is intentionally empty.
      </p>
    </div>
  );
}
