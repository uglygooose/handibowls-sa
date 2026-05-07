import { HenseliteLogo } from "@/components/brand/HenseliteLogo";
import { cn } from "@/lib/utils";

type Props = {
  /** Set on dark surfaces — applies CSS invert so the mono mark reads white. */
  onDark?: boolean;
  className?: string;
};

// Footer attribution band: "Proudly powered by [Henselite logo]". Phase
// 14 / surface-aware-henselite-logo: HenseliteLogo owns the external
// link to henselite.co.za, so the outer wrapper is now a plain inline
// container — no more whole-phrase anchor. The Henselite logo is the
// only clickable element.
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
        variant="mono"
        size={20}
        className={cn(onDark && "invert")}
      />
    </span>
  );
}
