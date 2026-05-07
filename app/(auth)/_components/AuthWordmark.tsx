import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { HenseliteLogo } from "@/components/brand/HenseliteLogo";

// Top of every auth card. Phase 15 — header lockup unification:
// HenseliteLogo (colour, links externally to henselite.co.za) +
// vertical divider + Bowl glyph (theme-tinted via active CSS theme;
// the auth pages set `data-theme="ocean-green"` on their root wrapper
// since 13-9, so the bowl reads green by default). The HandiBowls
// wordmark text is dropped — every TopBar across landing / auth /
// player / club-admin now uses the same Henselite + Bowl glyph
// lockup. The Bowl IS the HandiBowls mark in the co-brand era.
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
          <Bowl size={28} />
        </Link>
      </div>
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-subtle">
        <span className="h-[5px] w-[5px] rounded-full bg-primary-500" />
        {tag}
      </span>
    </div>
  );
}
