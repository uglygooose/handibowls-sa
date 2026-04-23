import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";

// Small stacked wordmark used at the top of every auth card.
export function AuthWordmark({ tag = "Platform · 0.1" }: { tag?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <HandiBowlsWordmark variant="light" height={32} />
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-subtle">
        <span className="h-[5px] w-[5px] rounded-full bg-primary-500" />
        {tag}
      </span>
    </div>
  );
}
