import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { Button } from "@/components/ui/button";

// Hero lane lines drawn behind the rolling bowls. Two convex curves with
// dash-arrays matching the design prototype.
function HeroLane() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 500"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d="M 50 450 Q 300 380 550 420"
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      <path
        d="M 80 470 Q 300 410 520 440"
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        opacity={0.5}
      />
    </svg>
  );
}

function Sticker({
  kind,
  className,
}: {
  kind: "end" | "jack";
  className?: string;
}) {
  return (
    <div
      className={
        "absolute z-[3] flex flex-col gap-0.5 rounded-[14px] border-2 border-ink bg-bone px-3.5 py-2.5 shadow-[4px_4px_0_var(--color-ink)] " +
        (kind === "end" ? "-rotate-3 " : "rotate-[5deg] ") +
        (className ?? "")
      }
    >
      {kind === "end" ? (
        <>
          <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-ink-muted">
            End ½
          </span>
          <span className="font-mono text-[22px] font-bold text-primary-500">
            21–14
          </span>
        </>
      ) : (
        <>
          <span className="font-display text-[11px] font-bold tracking-[0.12em] uppercase text-ink-muted">
            Jack
          </span>
          <span className="inline-flex self-start rounded-md bg-primary-500 px-2.5 py-0.5 font-mono text-[13px] font-bold text-[color:var(--color-on-primary)]">
            1.2m
          </span>
        </>
      )}
    </div>
  );
}

const MARQUEE_ITEMS = [
  "Knockouts",
  "Pairs",
  "Triples",
  "Fours",
  "Singles",
  "Mixed Pairs",
  "Greenside scoring",
  "Offline-first",
  "BSA-native",
];

function MarqueeStrip() {
  const row = (
    <div className="flex shrink-0 items-center gap-7 font-display text-xl font-bold italic tracking-[0.05em] uppercase">
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-7">
          {item}
          <em className="not-italic text-primary-500">✦</em>
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-t border-ink bg-ink py-3.5 text-ink-inverse">
      <div className="hb-marquee flex w-max gap-7 whitespace-nowrap">
        {row}
        {row}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="product" className="relative overflow-hidden border-b border-border">
      <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-12 md:grid-cols-[1.1fr_1fr] md:gap-10 md:px-12 md:pt-20 md:pb-14">
        {/* Copy column */}
        <div className="relative z-[2] max-w-[680px]">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-bone px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <span
              className="h-2 w-2 rounded-full bg-primary-500"
              style={{ boxShadow: "0 0 0 3px rgba(215,38,30,0.18)" }}
            />
            South African bowls — built for clubs
          </span>

          <h1 className="mt-7 mb-6 font-display text-[clamp(52px,8vw,112px)] leading-[0.88] font-black italic tracking-[-0.03em] uppercase text-balance">
            Tournaments, scores, and skills in your{" "}
            <span className="relative inline-block text-primary-500">
              <span
                aria-hidden="true"
                className="absolute inset-x-[-4%] bottom-[8%] -z-10 h-[18%] -skew-x-[8deg] bg-primary-500 opacity-[0.14]"
              />
              Pocket
              <span className="text-primary-500">.</span>
            </span>
          </h1>

          <p className="mb-9 max-w-[560px] text-[20px] leading-[1.45] text-ink-muted">
            Run a knockout, score a match, capture a Twenty 20, keep the club
            connected. HandiBowls is the bowls-first operating system for
            South African clubs — fluid, fast, and made for the green.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link href="/signup">Create your account</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <a href="#features">See it in action</a>
            </Button>
          </div>

          <div className="mt-12 flex gap-9 border-t border-border pt-7">
            <div className="flex flex-col gap-0.5">
              <strong className="font-display text-xl font-extrabold italic tracking-[-0.01em]">
                Built for BSA
              </strong>
              <span className="text-[11px] tracking-[0.12em] uppercase text-ink-subtle">
                20 districts, 5 disciplines
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <strong className="font-display text-xl font-extrabold italic tracking-[-0.01em]">
                Offline first
              </strong>
              <span className="text-[11px] tracking-[0.12em] uppercase text-ink-subtle">
                Greenside capture
              </span>
            </div>
          </div>
        </div>

        {/* Art column — mobile min-h matches visual content height (~260px); the 620px main bowl is clipped less aggressively on the right edge to fill the gap. */}
        <div className="relative z-[1] min-h-[260px] md:min-h-[540px]">
          <HeroLane />

          <div
            className="hb-roll absolute top-[-10px] right-[-30px] md:top-[-20px] md:right-[-80px]"
            style={{ filter: "drop-shadow(0 30px 50px rgba(10,10,10,0.18))" }}
          >
            <Bowl preset="atomic-red" size={620} seed="hero-main" idSuffix="hero-main" />
          </div>

          <div
            className="absolute left-[-30px] bottom-5 opacity-90"
            style={{ filter: "drop-shadow(0 20px 30px rgba(10,10,10,0.18))" }}
          >
            <Bowl preset="midnight" size={200} seed="hero-ghost" idSuffix="hero-ghost" />
          </div>

          <div
            className="hb-roll-rev absolute right-[70px] bottom-[-20px]"
            style={{ filter: "drop-shadow(0 30px 50px rgba(10,10,10,0.18))" }}
          >
            <Bowl preset="sunburst" size={110} seed="hero-tiny" idSuffix="hero-tiny" />
          </div>

          <Sticker kind="end" className="top-10 left-2.5" />
          <Sticker kind="jack" className="right-5 bottom-[140px]" />
        </div>
      </div>

      <MarqueeStrip />
    </section>
  );
}
