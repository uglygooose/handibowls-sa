import Link from "next/link";

import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { Button } from "@/components/ui/button";

export function CTABand() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-surface px-5 py-16 text-center md:px-12 md:py-[100px]">
      <div className="pointer-events-none absolute -right-[60px] -top-[60px] opacity-90">
        <SplatterAccent preset="atomic-red" variant={0} size={420} rotate={-14} />
      </div>
      <div className="pointer-events-none absolute -bottom-[60px] -left-10 opacity-60">
        <SplatterAccent preset="midnight" variant={2} size={220} rotate={20} />
      </div>

      <div className="relative z-[2] mx-auto max-w-[760px]">
        <h2 className="m-0 mb-4 font-display text-[clamp(44px,6vw,84px)] font-black italic leading-[0.92] tracking-[-0.02em] uppercase text-balance">
          It&apos;s your shot.{" "}
          <em className="not-italic text-primary-500 italic">Take it.</em>
        </h2>
        <p className="m-0 mb-8 text-[18px] text-ink-muted">
          Stand up a club in under ten minutes. Invite your first rink by
          sundown. Score greenside tomorrow.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="xl">
            <Link href="/signup">Create your club</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="/login">I have an account</Link>
          </Button>
        </div>
        <p className="mt-5 text-[13px] text-ink-muted">
          Already invited?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-500 underline underline-offset-[3px]"
          >
            Use your invite link
          </Link>
        </p>
      </div>
    </section>
  );
}
