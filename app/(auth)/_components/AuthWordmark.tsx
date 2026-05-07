import { BrandLockup } from "@/components/branding/brand-lockup";

// Top of every auth card. Phase 13 / Henselite branding: replaced the
// standalone HandiBowls wordmark with the Henselite × HandiBowls mono
// lockup so the partnership reads on every auth surface.
export function AuthWordmark({ tag = "Platform · 0.1" }: { tag?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <BrandLockup variant="mono" size="md" />
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-subtle">
        <span className="h-[5px] w-[5px] rounded-full bg-primary-500" />
        {tag}
      </span>
    </div>
  );
}
