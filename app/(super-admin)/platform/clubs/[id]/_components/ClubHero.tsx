import { Bowl } from "@/components/brand/Bowl";
import { SpeckleField } from "@/components/brand/SpeckleField";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { StatusPill } from "@/components/brand/StatusPill";
import type { ThemePreset } from "@/components/brand/theme-presets";

type Props = {
  themePreset: ThemePreset;
  name: string;
  district: string | null;
  city: string;
  active: boolean;
  membersCount: number;
  greensCount: number;
};

// Themed hero card per the Claude Design treatment:
//   - bone bg with the club's themed SpeckleField at low opacity
//   - SplatterAccent in the top-right corner (-22deg)
//   - 88px logo tile with Bowl SVG + 4px+4px ink box-shadow
//   - 48px italic Barlow Condensed club name
//   - mono uppercase district · city meta line
//   - right rail: StatusPill + members + greens stats
export function ClubHero({
  themePreset,
  name,
  district,
  city,
  active,
  membersCount,
  greensCount,
}: Props) {
  return (
    <div
      data-slot="club-hero"
      className="relative mb-6 overflow-hidden rounded-[20px] border-[1.5px] border-border bg-bone p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
      >
        <SpeckleField
          preset={themePreset}
          width="100%"
          height="100%"
          borderRadius={20}
          density={1.4}
          opacityScale={0.6}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 opacity-[0.85]"
      >
        <SplatterAccent
          preset={themePreset}
          variant={1}
          size={240}
          rotate={-22}
        />
      </div>

      <div className="relative flex flex-wrap items-center gap-6">
        <div className="flex size-[88px] shrink-0 items-center justify-center rounded-[18px] border-2 border-ink bg-bone shadow-[4px_4px_0_var(--color-ink)]">
          <Bowl
            preset={themePreset}
            size={64}
            idSuffix={`hero-${themePreset}`}
            emblem={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-display text-[48px] font-black italic uppercase leading-none tracking-[-0.02em]">
            {name}
          </h1>
          <div className="mt-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted">
            {district ?? "—"} · {city}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <StatusPill status={active ? "active" : "inactive"} />
          <div className="text-right">
            <strong className="block font-display text-[28px] font-black italic leading-none">
              {membersCount}
            </strong>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Members
            </span>
          </div>
          <div className="text-right">
            <strong className="block font-display text-[28px] font-black italic leading-none">
              {greensCount}
            </strong>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              Greens
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
