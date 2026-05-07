import Link from "next/link";

import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { HenseliteLogo } from "@/components/brand/HenseliteLogo";

// Top of every auth card. Phase 14 / surface-aware-henselite-logo:
// auth surfaces sit on bone (light), so HenseliteLogo renders the
// colour variant. Henselite links to henselite.co.za externally;
// HandiBowls wordmark links internally to home. Replaces the previous
// BrandLockup which bundled both into a single home link.
export function AuthWordmark({ tag = "Platform · 0.1" }: { tag?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center gap-2.5">
        <HenseliteLogo variant="colour" size={28} />
        <span
          aria-hidden="true"
          className="h-7 w-px shrink-0 self-stretch border-l border-foreground/20"
        />
        <Link href="/" aria-label="HandiBowls — home" className="inline-flex shrink-0">
          <HandiBowlsWordmark variant="light" height={24} />
        </Link>
      </div>
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-subtle">
        <span className="h-[5px] w-[5px] rounded-full bg-primary-500" />
        {tag}
      </span>
    </div>
  );
}
