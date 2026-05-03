export function AuditTab() {
  return (
    <div className="rounded-[14px] border border-dashed border-border p-6 text-sm">
      <p className="font-medium text-ink">Audit log</p>
      <p className="mt-1 text-ink-muted">
        No audit events recorded for this club yet. Status changes, score
        edits, force-cancels, and admin overrides will surface here as they
        happen.
      </p>
    </div>
  );
}
