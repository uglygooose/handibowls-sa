import { HenseliteLogo } from "@/components/brand/HenseliteLogo";
import { cn } from "@/lib/utils";

type Props = {
  /** Set on dark surfaces — applies CSS invert so the mono mark reads white. */
  onDark?: boolean;
  className?: string;
};

// Footer attribution band: "Proudly powered by [Henselite logo]". Phase
// 15 fix — SA brand standard: HenseliteLogo always renders the black
// wordmark; `onDark` adds `className="invert"` to flip black → white
// silhouette via CSS filter on the dark footer.
export function FooterAttribution({ onDark = false, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        onDark ? "text-white/65" : "text-ink-muted",
        className,
      )}
    >
      <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
        Proudly powered by
      </span>
      <HenseliteLogo
        size={20}
        className={cn(onDark && "invert")}
      />
    </span>
  );
}
