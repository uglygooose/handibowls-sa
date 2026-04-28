"use client";

import { FileText, History } from "lucide-react";
import { useState } from "react";

import { Bowl } from "@/components/brand/Bowl";
import { cn } from "@/lib/utils";

// Audit empty state per the brief: speckled bowl + locked copy + the
// design's filter chips. The audit_log table itself is deferred to
// Phase 12 (cross-cutting); see DRIFT_LOG. We do NOT render fake / mock
// events — the empty state is the source of truth until that table
// lands.

type AuditFilter = "all" | "status" | "scores" | "entries" | "rounds";

const FILTERS: { id: AuditFilter; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "status", label: "Status" },
  { id: "scores", label: "Scores" },
  { id: "entries", label: "Entries" },
  { id: "rounds", label: "Rounds" },
];

export function AuditTab() {
  const [active, setActive] = useState<AuditFilter>("all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight">
            Audit log
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Every state change, score edit, round advance, withdrawal —
            recorded here.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Audit event-type filters"
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active === f.id}
              onClick={() => setActive(f.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors",
                active === f.id
                  ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
                  : "border-border bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-24 text-center">
        <Bowl preset="atomic-red" size={140} seed="audit-empty" emblem={false} />
        <div className="flex flex-col items-center gap-2">
          <h3 className="font-display text-2xl font-black tracking-tight">
            Audit log activates with the next event
          </h3>
          <p className="max-w-md text-[13px] text-ink-muted">
            The{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11.5px]">
              audit_log
            </code>{" "}
            table lands in Phase 12. Until then, this stream stays
            empty — events fired before the table exists are not
            back-filled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Spec doc lands when the audit_log migration ships"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink-muted opacity-60"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Read the spec
          </button>
          <button
            type="button"
            disabled
            title="Why-empty explainer lands alongside the spec"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted opacity-60"
          >
            <History className="size-3.5" aria-hidden="true" />
            Why empty?
          </button>
        </div>
      </div>
    </div>
  );
}
