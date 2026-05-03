import { SplatterAccent } from "@/components/brand/SplatterAccent";

type Match = {
  a: string;
  b: string;
  sa: number | "";
  sb: number | "";
  final?: boolean;
};

const ROUND_1: Match[] = [
  { a: "Wanderers BC", b: "Pretoria East", sa: 21, sb: 14 },
  { a: "Rondebosch BC", b: "Durbanville", sa: 19, sb: 21 },
  { a: "Kempton Park", b: "Bryanston", sa: 21, sb: 17 },
  { a: "Edgemead", b: "Brackenfell", sa: 16, sb: 21 },
];

const ROUND_2: Match[] = [
  { a: "Wanderers BC", b: "Durbanville", sa: 21, sb: 19 },
  { a: "Kempton Park", b: "Brackenfell", sa: 21, sb: 18 },
];

const FINAL: Match[] = [
  { a: "Wanderers BC", b: "Kempton Park", sa: 21, sb: 16, final: true },
];

function won(m: Match, side: "a" | "b") {
  if (typeof m.sa !== "number" || typeof m.sb !== "number") return false;
  return side === "a" ? m.sa > m.sb : m.sb > m.sa;
}

function BracketRow({ name, score, win }: { name: string; score: number | ""; win: boolean }) {
  return (
    <div
      className={
        "flex justify-between px-3.5 py-2.5 text-[13px] font-medium " +
        (win ? "bg-primary-500 text-[color:var(--color-on-primary)] font-bold" : "")
      }
    >
      <span className="mr-2 flex-1 truncate">{name}</span>
      <span className="font-mono font-bold">{score}</span>
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  return (
    <div
      className={
        "overflow-hidden rounded-[10px] bg-surface " +
        (m.final ? "border-2 border-primary-500" : "border border-border")
      }
    >
      <BracketRow name={m.a} score={m.sa} win={won(m, "a")} />
      <div className="border-t border-border">
        <BracketRow name={m.b} score={m.sb} win={won(m, "b")} />
      </div>
    </div>
  );
}

function Bracket() {
  return (
    <div
      className="rounded-[20px] border-2 border-ink bg-bone p-6"
      style={{ boxShadow: "12px 14px 0 var(--color-primary-500)" }}
    >
      <header className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="font-display text-[20px] font-extrabold italic uppercase tracking-[-0.01em]">
            Northerns Open 2026
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-subtle">
            Pairs · Knockout · 16 pairs
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] uppercase text-primary-600">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Live
        </span>
      </header>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col justify-around gap-3.5">
          {ROUND_1.map((m) => (
            <MatchCard key={m.a} m={m} />
          ))}
        </div>
        <div className="flex flex-col justify-around gap-3.5">
          {ROUND_2.map((m) => (
            <MatchCard key={m.a} m={m} />
          ))}
        </div>
        <div className="flex flex-col justify-around gap-3.5">
          {FINAL.map((m) => (
            <MatchCard key={m.a} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShowcaseTournament() {
  return (
    <section
      id="tournaments"
      className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 md:grid-cols-2 md:gap-20 md:px-12 md:py-[100px]"
    >
      <div className="relative">
        <div className="pointer-events-none absolute -right-10 -top-10 -z-10 opacity-85">
          <SplatterAccent preset="atomic-red" variant={1} size={320} rotate={-8} />
        </div>
        <Bracket />
      </div>
      <div>
        <div className="mb-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Tournaments
        </div>
        <h2 className="m-0 mb-5 font-display text-[clamp(36px,4.5vw,60px)] font-black italic leading-[0.95] tracking-[-0.02em] uppercase">
          Brackets that{" "}
          <em className="not-italic text-primary-500 italic">stay live</em> all
          day.
        </h2>
        <p className="max-w-[480px] text-[17px] leading-[1.5] text-ink-muted">
          Draw your first round from the team sheet, feed in greenside scores,
          and watch the bracket rebuild itself after every end. Spectators see
          the same view — no phone-trees, no photo-of-a-whiteboard.
        </p>
        <ul className="mt-8 flex list-none flex-col gap-3 p-0">
          {[
            "Knockout, round robin, double-elim",
            "Auto-seeding from handicap or ladder",
            "Offline score capture, auto-sync",
            "Printable sheet for the secretary's desk",
          ].map((item) => (
            <li key={item} className="flex items-center gap-3 font-medium">
              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-500">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-1.5 -translate-y-[1px] translate-x-[1px] rotate-45 border-b-2 border-r-2 border-[color:var(--color-on-primary)]"
                />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
