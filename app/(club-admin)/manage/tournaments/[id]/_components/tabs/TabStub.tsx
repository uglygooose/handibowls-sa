import { Bowl } from "@/components/brand/Bowl";

// Shared "Coming in 7c-X" stub used by tabs that haven't landed yet.
// Replaced surface-by-surface as later sub-checkpoints fill them in.

type Props = {
  title: string;
  blurb: string;
  phase: string;
};

export function TabStub({ title, blurb, phase }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <Bowl preset="atomic-red" size={96} seed={title} emblem={false} />
      <div className="flex flex-col items-center gap-1">
        <h3 className="font-display text-2xl font-black tracking-tight">{title}</h3>
        <p className="max-w-md text-[13px] text-ink-muted">{blurb}</p>
      </div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        Coming in {phase}
      </p>
    </div>
  );
}
