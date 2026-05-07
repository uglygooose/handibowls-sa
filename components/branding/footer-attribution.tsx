import { cn } from "@/lib/utils";

import { HenseliteWordmark } from "./henselite-wordmark";

type Props = {
  /** Set on dark surfaces — applies CSS invert so the mono mark reads white. */
  onDark?: boolean;
  className?: string;
};

export function FooterAttribution({ onDark = false, className }: Props) {
  return (
    <a
      href="https://henselite.co.za/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by Henselite"
      className={cn(
        "inline-flex items-center gap-2.5 no-underline",
        onDark ? "text-white/65 hover:text-white" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
        Proudly powered by
      </span>
      <HenseliteWordmark
        variant="mono"
        size={20}
        className={cn(onDark && "invert")}
      />
    </a>
  );
}
