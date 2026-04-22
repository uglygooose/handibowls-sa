"use client";

import { useEffect, useState } from "react";

import {
  THEME_PRESETS,
  type ThemePreset,
} from "@/components/brand/ThemeApplier";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { HandiBowlsMark } from "@/components/brand/HandiBowlsMark";
import { BowlChip } from "@/components/brand/BowlChip";
import { Scoreboard } from "@/components/brand/Scoreboard";
import { RinkBadge } from "@/components/brand/RinkBadge";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { PageHeader } from "@/components/layout/PageHeader";

export function DesignShowcase() {
  const [preset, setPreset] = useState<ThemePreset>("atomic-red");

  useEffect(() => {
    document.documentElement.dataset.theme = preset;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [preset]);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <PageHeader
        eyebrow="Design system"
        title="HandiBowls /design"
        description="Dev-only primitive showcase. Cycle the theme picker below to preview the nine bowl presets live."
        seed={preset}
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <Section title="Theme presets">
          <div className="flex flex-wrap items-center gap-3">
            {THEME_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className="flex flex-col items-center gap-1 focus:outline-none"
                aria-pressed={preset === p}
              >
                <BowlChip preset={p} selected={preset === p} size={48} />
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                  {p}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-ink-muted">
            Active preset: <code className="font-mono text-ink">{preset}</code>
          </p>
        </Section>

        <Section title="Brand marks">
          <div className="flex flex-wrap items-center gap-6">
            <HandiBowlsWordmark height={40} />
            <HandiBowlsMark size={56} />
          </div>
        </Section>

        <Section title="Typography">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-5xl font-black italic tracking-tight">
              HANDIBOWLS
            </h1>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Barlow Condensed — display
            </h2>
            <p className="max-w-xl text-base">
              Inter is the body sans. Lowercase, mid-weight, comfortable reading
              size. Scores and tournament tables use JetBrains Mono with{" "}
              <span className="font-mono tabular-nums">tabular-nums</span>.
            </p>
            <p className="font-mono text-sm tabular-nums">
              21 — 18 — 4 — 0 — 9
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-end gap-3">
            <Button size="sm">Small 36</Button>
            <Button size="md">Medium 44</Button>
            <Button size="lg">Large 52</Button>
            <Button size="xl">Scorecard 56</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </div>
        </Section>

        <Section title="Badges + rink">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <RinkBadge rink={3} size="sm" />
            <RinkBadge rink={7} size="md" />
            <RinkBadge rink={12} size="lg" />
            <RinkBadge rink={5} variant="outline" />
          </div>
        </Section>

        <Section title="Scoreboard">
          <div className="grid gap-4 md:grid-cols-2">
            <Scoreboard
              home={14}
              away={11}
              homeLabel="Atlantic BC"
              awayLabel="Kelvin Grove"
              ends={12}
              totalEnds={21}
              highlight="home"
            />
            <Scoreboard
              home={6}
              away={18}
              homeLabel="Us"
              awayLabel="Them"
              highlight="away"
            />
          </div>
        </Section>

        <Section title="Input + card + speckle">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="relative overflow-hidden">
              <SpeckleLayer seed={`card-${preset}`} density="med" opacity={0.07} />
              <CardHeader className="relative z-10">
                <CardTitle>Tournament card</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 flex flex-col gap-3">
                <Input placeholder="Search tournaments…" />
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm">Action</Button>
                  <Button size="sm" variant="outline">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <SplatterAccent seed={`splat-${preset}`} corner="tr" blobs={2} />
              <CardHeader className="relative z-10">
                <CardTitle>Splatter accent</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-sm text-ink-muted">
                  Corner accent — 1-3 blobs with drip tails. Use on hero/header
                  surfaces only, never as a full background.
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Functional colours">
          <div className="flex flex-wrap gap-2">
            <Swatch label="primary-500" style={{ background: "var(--color-primary-500)", color: "var(--color-on-primary)" }} />
            <Swatch label="primary-100" style={{ background: "var(--color-primary-100)", color: "var(--color-primary-600)" }} />
            <Swatch label="success-500" style={{ background: "var(--color-success-500)", color: "#fff" }} />
            <Swatch label="warning-500" style={{ background: "var(--color-warning-500)", color: "#0a0a0a" }} />
            <Swatch label="danger-500" style={{ background: "var(--color-danger-500)", color: "#fff" }} />
            <Swatch label="info-500" style={{ background: "var(--color-info-500)", color: "#fff" }} />
            <Swatch label="speckle-a" style={{ background: "var(--color-speckle-a)", color: "var(--color-bone)" }} />
            <Swatch label="speckle-b" style={{ background: "var(--color-speckle-b)", color: "var(--color-ink)" }} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <div
      className="flex h-16 w-36 items-center justify-center rounded-md border border-border font-mono text-xs"
      style={style}
    >
      {label}
    </div>
  );
}
