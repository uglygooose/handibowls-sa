"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Rubric, SECTION_KEYS, type SectionKey } from "@/lib/t20/rubric";
import { sectionMaxes } from "@/lib/t20/score";

// Phase 12.5 / 12.5-3 (audit id `rubrics-view-schema-modal`):
// view-schema modal for the /platform/rubrics versions table.
//
// Per audit spec:
//   shadcn `<Dialog>`, max-width 720, scrollable body. Header:
//   rubric `name + version` + close. Body: table with columns
//   `# / Section / Model / Max R1 / Max R2 / Total`. Footer row:
//   `Grand total / max`. Below table: a thin `JSON` details
//   reveal for super-admin power users.
//
// Reuses the canonical 7 section keys + their max-points calc
// (`sectionMaxes` from lib/t20/score) so the modal stays in
// lockstep with the live grading engine.

const SECTION_LABELS: Record<SectionKey, string> = {
  jacks: "Jacks",
  targets: "Targets",
  drive: "Drive",
  control: "Control",
  trail: "Trail",
  speedhumps_asc: "Speedhumps Ascending",
  speedhumps_desc: "Speedhumps Descending",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rubric: Rubric;
  /** Display label — typically "v1-final-2026" or similar. */
  versionLabel: string;
};

export function RubricSchemaDialog({
  open,
  onOpenChange,
  rubric,
  versionLabel,
}: Props) {
  const maxes = sectionMaxes(rubric);
  const sectionRows = SECTION_KEYS.map((key, idx) => {
    const sec = rubric.sections[key];
    const total = maxes[key];
    // Both rounds share the per-section max equally per the
    // existing engine convention (max/2 per round).
    const maxPerRound = total / 2;
    return {
      idx: idx + 1,
      key,
      label: SECTION_LABELS[key],
      model: sec.model,
      maxR1: maxPerRound,
      maxR2: maxPerRound,
      total,
    };
  });
  const grandTotal = sectionRows.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="rubric-schema-dialog"
        className="max-h-[80vh] overflow-y-auto sm:max-w-[720px]"
      >
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-[14px] font-bold tabular-nums">
              {versionLabel}
            </span>
          </DialogTitle>
          <DialogDescription>
            Section-by-section structure for this rubric version. Pinned to
            every assessment captured under {versionLabel} via
            <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              t20_assessments.rubric_version_id
            </code>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60">
                <Th align="right">#</Th>
                <Th>Section</Th>
                <Th>Model</Th>
                <Th align="right">Max R1</Th>
                <Th align="right">Max R2</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((row) => (
                <tr
                  key={row.key}
                  data-slot="schema-row"
                  data-section={row.key}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-ink-muted">
                    {row.idx}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {row.model}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.maxR1}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.maxR2}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                data-slot="schema-grand-total"
                className="border-t-2 border-ink/40 bg-surface-muted/30"
              >
                <td colSpan={5} className="px-3 py-2 text-right font-medium">
                  Grand total
                </td>
                <td className="px-3 py-2 text-right font-mono text-[14px] font-black tabular-nums">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <details
          data-slot="schema-json-details"
          className="rounded-md border border-border bg-surface-muted/30"
        >
          <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted hover:text-ink">
            JSON
          </summary>
          <pre className="overflow-x-auto px-3 pb-3 font-mono text-[11px] leading-[1.4] text-ink">
            {JSON.stringify(rubric, null, 2)}
          </pre>
        </details>
      </DialogContent>
    </Dialog>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}
