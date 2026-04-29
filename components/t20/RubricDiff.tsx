import { cn } from "@/lib/utils";

// Phase 10 — Twenty 20 rubric diff for /platform/rubrics.
//
// Renders a unified-diff view of changes between two rubric
// versions: a header band naming the active vs incoming versions,
// then one row per change. Each change carries a sigil (+ added,
// − removed, ~ changed), a `path` label (jq-style dotted path into
// the rubric JSON), a human label, and from/to values when present.
//
// Three change kinds, each with a tinted background + sigil colour:
//   added    success-500 + +
//   removed  danger-500  + −
//   changed  amber 700   + ~
//
// The component is pure render — caller computes the diff
// server-side from the JSONB rubric blobs (typically before showing
// the activate confirmation modal).

export type RubricChangeKind = "added" | "removed" | "changed";

export type RubricChange = {
  kind: RubricChangeKind;
  /** jq-style path into the rubric JSON, e.g. `bands.gold` or `sections[3].distances`. */
  path: string;
  /** Human-friendly summary of the change. */
  label: string;
  /** Old value (display string). null when the change is `added`. */
  from: string | number | null;
  /** New value (display string). null when the change is `removed`. */
  to: string | number | null;
};

type Props = {
  changes: RubricChange[];
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
};

const SIGIL: Record<RubricChangeKind, string> = {
  added: "+",
  removed: "−",
  changed: "~",
};

export function RubricDiff({
  changes,
  leftLabel = "v1-final-2026 · ACTIVE",
  rightLabel = "v2-draft-2026 · INCOMING",
  className,
}: Props) {
  return (
    <div
      data-slot="rubric-diff"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-bone",
        className,
      )}
    >
      {/* Header band — current vs incoming */}
      <div className="grid grid-cols-2 border-b border-border">
        <div
          data-slot="diff-header-active"
          className="border-r border-border bg-surface-muted px-3.5 py-2.5"
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Currently active
          </div>
          <div className="font-mono text-[13px] font-bold">{leftLabel}</div>
        </div>
        <div
          data-slot="diff-header-incoming"
          className="bg-primary-500/8 px-3.5 py-2.5"
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary-600">
            Incoming
          </div>
          <div className="font-mono text-[13px] font-bold text-primary-600">
            {rightLabel}
          </div>
        </div>
      </div>

      {changes.length === 0 ? (
        <div
          data-slot="diff-empty"
          className="px-4 py-8 text-center text-[12.5px] text-ink-muted"
        >
          No changes between these versions.
        </div>
      ) : (
        <ul data-slot="diff-list" className="divide-y divide-border">
          {changes.map((c, i) => (
            <li
              key={`${c.path}-${i}`}
              data-slot="diff-row"
              data-kind={c.kind}
              className={cn(
                "px-4 py-3",
                c.kind === "added" && "bg-success-500/6",
                c.kind === "removed" && "bg-danger-500/6",
                c.kind === "changed" && "bg-warning-500/6",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  data-slot="diff-sigil"
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md font-mono text-[14px] font-black text-white",
                    c.kind === "added" && "bg-success-500",
                    c.kind === "removed" && "bg-danger-500",
                    c.kind === "changed" && "bg-warning-600",
                  )}
                >
                  {SIGIL[c.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    data-slot="diff-path"
                    className="mb-0.5 font-mono text-[11.5px] text-ink-subtle"
                  >
                    {c.path}
                  </div>
                  <div
                    data-slot="diff-label"
                    className="text-[13.5px] font-semibold"
                  >
                    {c.label}
                  </div>
                  <div
                    data-slot="diff-values"
                    className="mt-1 font-mono text-[12px] text-ink-muted"
                  >
                    {c.from !== null && (
                      <span data-slot="diff-from" className="text-danger-500">
                        − {String(c.from)}
                      </span>
                    )}
                    {c.from !== null && c.to !== null && (
                      <span aria-hidden="true" className="mx-2 text-ink-subtle">
                        →
                      </span>
                    )}
                    {c.to !== null && (
                      <span data-slot="diff-to" className="text-success-500">
                        + {String(c.to)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
