"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { BOWL_PRESETS, PRESET_BY_ID } from "@/lib/brand/presets";
import { Bowl } from "@/components/brand/Bowl";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { SpeckleField } from "@/components/brand/SpeckleField";
import { SpeckleRule } from "@/components/brand/SpeckleRule";

// HandiBowls Brand Book — /design showcase.
//
// Single-page layout cloned from the design handoff: hero, nine preset
// cards, typography specimens, a component row (buttons + cards +
// scorecard + bracket cell + rink pills), texture intensity demo,
// splatter corner accents, loud tagline section, footer.
//
// Most styling is inline (matching the reference prototype) because this
// page shows multiple presets simultaneously — CSS variables off the
// active html[data-theme] can't do that. Picking a preset in the grid
// also updates the document theme so the rest of the shadcn chrome
// (wherever you navigate next) follows along.

const DEFAULT_HERO_PRESET: ThemePreset = "ocean-green";
const DEFAULT_ACCENT_PRESET: ThemePreset = "sunburst";

export function DesignShowcase() {
  const [activePresetId, setActivePresetId] =
    useState<ThemePreset>(DEFAULT_HERO_PRESET);

  useEffect(() => {
    document.documentElement.dataset.theme = activePresetId;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [activePresetId]);

  return (
    <div
      className="min-h-dvh text-[color:var(--ink)]"
      style={{
        background:
          "radial-gradient(1200px 800px at 90% 0%, rgba(215,38,30,0.04), transparent 60%), radial-gradient(900px 600px at -10% 40%, rgba(30,77,216,0.04), transparent 60%), #FAFAF7",
      }}
    >
      <Hero activePresetId={activePresetId} />

      <Section
        kicker="01 / Core bowls"
        title="Nine presets — the brand is the finish."
        subtitle="Each swatch is a real bowl. Click one to set it as the hero preset."
      >
        <PresetGrid
          activeId={activePresetId}
          onPick={(id) => setActivePresetId(id)}
        />
      </Section>

      <Section
        kicker="02 / Typography"
        title="Condensed italics, clean UI, tabular scoring."
        subtitle="Barlow Condensed for display. Inter for UI. JetBrains Mono for anything that needs to line up on a scorecard."
      >
        <Typography />
      </Section>

      <Section
        kicker="03 / Components"
        title="Discipline in the chrome. Loud in the accents."
        subtitle="Light surfaces, neutral frames. Colour and texture enter through accent preset only."
      >
        <ComponentShowcase accentPreset={DEFAULT_ACCENT_PRESET} />
      </Section>

      <Section
        kicker="04 / Texture"
        title="Speckle and splatter — two jobs, never mixed."
        subtitle="Speckle backs surfaces at three intensities. Splatter is a corner accent, never full-bleed."
      >
        <TextureDemo accentPreset={DEFAULT_ACCENT_PRESET} />
      </Section>

      <TaglineSection activePresetId={activePresetId} />

      <Footer />
    </div>
  );
}

// -------------------- shared helpers --------------------

function Section({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        padding: "80px 56px 40px",
        maxWidth: 1320,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <MonoLabel>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#0A0A0A",
              display: "inline-block",
            }}
          />
          {kicker}
        </MonoLabel>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: "clamp(40px, 5vw, 72px)",
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            margin: "10px 0",
            maxWidth: 900,
            color: "#0A0A0A",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              fontWeight: 500,
              color: "#6B6B66",
              maxWidth: 620,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function MonoLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        color: "#0A0A0A",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// -------------------- hero --------------------

function Hero({ activePresetId }: { activePresetId: ThemePreset }) {
  const p = PRESET_BY_ID[activePresetId];
  return (
    <header
      style={{
        position: "relative",
        padding: "72px 56px 56px",
        borderBottom: "1px solid #E6E3DA",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          marginBottom: 72,
        }}
      >
        <MonoLabel>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0A0A0A" }} />
          HandiBowls / Brand Book
        </MonoLabel>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <MonoLabel style={{ opacity: 0.7 }}>v0.1 / 04.26</MonoLabel>
          <MonoLabel style={{ opacity: 0.7 }}>Visual direction</MonoLabel>
          <MonoLabel style={{ opacity: 0.7 }}>ZA</MonoLabel>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: "-120px",
          top: "40px",
          opacity: 0.92,
          pointerEvents: "none",
        }}
      >
        <Bowl preset={p} size={720} idSuffix="hero" />
      </div>

      <SplatterAccent
        preset={activePresetId}
        variant={1}
        size={280}
        rotate={-18}
        style={{ position: "absolute", left: -70, top: 220, opacity: 0.92 }}
      />
      <SplatterAccent
        preset="midnight"
        variant={2}
        size={170}
        rotate={32}
        style={{ position: "absolute", left: "42%", top: -30, opacity: 0.85 }}
      />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1320, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: "clamp(96px, 15vw, 260px)",
            lineHeight: 0.84,
            letterSpacing: "-0.04em",
            margin: 0,
            color: "#0A0A0A",
            textTransform: "uppercase",
          }}
        >
          <span>HANDI</span>
          <span style={{ color: p.base }}>BOWLS</span>
          <span style={{ color: p.base }}>.</span>
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 48,
            marginTop: 40,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontStyle: "italic",
              fontSize: "clamp(28px, 3.2vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              margin: 0,
              maxWidth: 720,
              color: "#0A0A0A",
            }}
          >
            Tournaments, scores, and skills in your pocket.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
            <MonoLabel>Tournament management / SaaS / ZA</MonoLabel>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: "10px 14px",
                background: "#FFFFFF",
                border: "1px solid #E6E3DA",
                borderRadius: 999,
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#0E7C7B",
                  boxShadow: "0 0 0 4px rgba(14,124,123,0.18)",
                }}
              />
              Design system showcase — in play
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 72,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            borderTop: "1px solid #E6E3DA",
            borderBottom: "1px solid #E6E3DA",
          }}
        >
          {[
            ["01", "Presets", "9 bowls"],
            ["02", "Type", "Barlow / Inter / Mono"],
            ["03", "Components", "Buttons, cards, scoring"],
            ["04", "Texture", "Speckle + splatter"],
          ].map((row, i) => (
            <div
              key={i}
              style={{
                padding: "18px 20px",
                borderLeft: i > 0 ? "1px solid #E6E3DA" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <MonoLabel style={{ opacity: 0.5 }}>{row[0]}</MonoLabel>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontWeight: 800,
                  fontSize: 28,
                  lineHeight: 1,
                  textTransform: "uppercase",
                }}
              >
                {row[1]}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  color: "#6B6B66",
                }}
              >
                {row[2]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

// -------------------- preset grid --------------------

function PresetGrid({
  activeId,
  onPick,
}: {
  activeId: ThemePreset;
  onPick: (id: ThemePreset) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
      {BOWL_PRESETS.map((p, i) => (
        <PresetCard
          key={p.id}
          presetId={p.id}
          idx={i}
          active={activeId === p.id}
          onClick={() => onPick(p.id)}
        />
      ))}
    </div>
  );
}

function PresetCard({
  presetId,
  idx,
  active,
  onClick,
}: {
  presetId: ThemePreset;
  idx: number;
  active: boolean;
  onClick: () => void;
}) {
  const preset = PRESET_BY_ID[presetId];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        position: "relative",
        background: "#FFFFFF",
        border: active ? "2px solid #0A0A0A" : "1px solid #E6E3DA",
        borderRadius: 24,
        padding: "28px 24px 22px",
        cursor: "pointer",
        overflow: "hidden",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 20,
        }}
      >
        <MonoLabel>{String(idx + 1).padStart(2, "0")} / Preset</MonoLabel>
        <div style={{ display: "flex", gap: 4 }}>
          {preset.speckle.map((c, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: c,
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "12px 0 20px",
        }}
      >
        <Bowl preset={preset} size={210} idSuffix="card" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 38,
            lineHeight: 0.95,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            color: "#0A0A0A",
          }}
        >
          {preset.label}
        </h3>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            color: "#6B6B66",
            whiteSpace: "nowrap",
          }}
        >
          {preset.base.toUpperCase()}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <SpeckleRule preset={preset} width={280} height={14} />
      </div>
    </button>
  );
}

// -------------------- typography --------------------

function Typography() {
  const items = [
    {
      family: "Barlow Condensed",
      role: "Display",
      stack: "var(--font-display)",
      weights: "900 italic / 700",
      tint: "#F2EEE4",
      samples: [
        { size: 128, weight: 900, style: "italic", text: "KNOCKOUT" },
        { size: 72, weight: 900, style: "italic", text: "ROUND 4 — SEMIS" },
        { size: 40, weight: 700, style: "italic", text: "Skip rotation locked" },
      ],
    },
    {
      family: "Inter",
      role: "UI text",
      stack: "var(--font-sans)",
      weights: "400 / 500 / 600 / 700",
      tint: "transparent",
      samples: [
        { size: 34, weight: 700, text: "Saturday 18 April — Rink 3" },
        { size: 18, weight: 500, text: "Durban North Bowling Club — afternoon session, four rinks in play." },
        {
          size: 13,
          weight: 400,
          text: "Draw published by the club admin. Players confirm their team within 24 hours or forfeit their rink.",
        },
      ],
    },
    {
      family: "JetBrains Mono",
      role: "Scorecards",
      stack: "var(--font-mono)",
      weights: "500",
      tint: "transparent",
      samples: [
        { size: 56, weight: 500, text: "21 — 14" },
        { size: 24, weight: 500, text: "SKIP  14 shots up" },
        { size: 13, weight: 500, text: "END 14  •  RINK 3  •  SHOTS +14" },
      ],
    },
  ] as const;

  return (
    <div
      style={{
        display: "grid",
        gap: 0,
        border: "1px solid #E6E3DA",
        borderRadius: 24,
        overflow: "hidden",
        background: "#FFFFFF",
      }}
    >
      {items.map((it, idx) => (
        <div
          key={it.family}
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            borderTop: idx > 0 ? "1px solid #E6E3DA" : "none",
          }}
        >
          <div
            style={{
              padding: "28px 24px",
              borderRight: "1px solid #E6E3DA",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: it.tint,
            }}
          >
            <MonoLabel>
              {String(idx + 1).padStart(2, "0")} / {it.role}
            </MonoLabel>
            <div
              style={{
                fontFamily: it.stack,
                fontWeight: idx === 0 ? 900 : idx === 2 ? 500 : 700,
                fontStyle: idx === 0 ? "italic" : "normal",
                fontSize: 28,
                lineHeight: 1,
                color: "#0A0A0A",
              }}
            >
              {it.family}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6B6B66" }}>{it.weights}</div>
          </div>
          <div
            style={{
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              justifyContent: "center",
            }}
          >
            {it.samples.map((s, i) => (
              <div
                key={i}
                style={{
                  fontFamily: it.stack,
                  fontWeight: s.weight,
                  fontStyle: "style" in s && s.style === "italic" ? "italic" : "normal",
                  fontSize: s.size,
                  lineHeight: 0.98,
                  letterSpacing: it.role === "Display" ? "-0.015em" : "normal",
                  color: "#0A0A0A",
                  textTransform: it.role === "Display" && s.size > 60 ? "uppercase" : "none",
                }}
              >
                {s.text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------- component showcase --------------------

function HBButton({
  size = "md",
  variant = "primary",
  preset = "ocean-green",
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "outline" | "ghost";
  preset?: ThemePreset;
  children: ReactNode;
}) {
  const p = PRESET_BY_ID[preset];
  // Mirrors components/ui/button.tsx size scale exactly (36/44/52/56).
  const sizes = {
    sm: { h: 36, px: 12, fs: 13, r: 10 },
    md: { h: 44, px: 16, fs: 14, r: 10 },
    lg: { h: 52, px: 20, fs: 16, r: 12 },
    xl: { h: 56, px: 24, fs: 17, r: 12 },
  } as const;
  const s = sizes[size];
  const common: CSSProperties = {
    height: s.h,
    padding: `0 ${s.px}px`,
    fontSize: s.fs,
    borderRadius: s.r,
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: "pointer",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textTransform: "uppercase",
  };
  if (variant === "primary") {
    return (
      <button
        type="button"
        style={{
          ...common,
          background: p.base,
          color: p.on,
          boxShadow: "0 2px 0 rgba(0,0,0,0.14), inset 0 -2px 0 rgba(0,0,0,0.14)",
        }}
      >
        {children}
      </button>
    );
  }
  if (variant === "outline") {
    return (
      <button
        type="button"
        style={{ ...common, background: "transparent", color: "#0A0A0A", border: "2px solid #0A0A0A" }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      style={{ ...common, background: "#FFFFFF", color: "#0A0A0A", border: "1px solid #E6E3DA" }}
    >
      {children}
    </button>
  );
}

function BrandBadge({
  tone = "ink",
  children,
}: {
  tone?: "ink" | "bone" | "good" | "warn" | "danger";
  children: ReactNode;
}) {
  const tones = {
    ink: { bg: "#0A0A0A", fg: "#FAFAF7", border: undefined },
    bone: { bg: "#FAFAF7", fg: "#0A0A0A", border: "1px solid #E6E3DA" },
    good: { bg: "#0E7C7B", fg: "#FFFFFF", border: undefined },
    warn: { bg: "#F5B700", fg: "#0A0A0A", border: undefined },
    danger: { bg: "#D7261E", fg: "#FFFFFF", border: undefined },
  } as const;
  const t = tones[tone];
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: t.border ?? "none",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ComponentShowcase({ accentPreset }: { accentPreset: ThemePreset }) {
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div
        style={{
          padding: 28,
          background: "#FFFFFF",
          border: "1px solid #E6E3DA",
          borderRadius: 24,
        }}
      >
        <MonoLabel style={{ marginBottom: 18 }}>01 / Buttons — 4 sizes</MonoLabel>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <HBButton size="sm" preset={accentPreset}>
            Confirm score · 36
          </HBButton>
          <HBButton size="md" preset={accentPreset}>
            Submit round · 44
          </HBButton>
          <HBButton size="lg" preset={accentPreset}>
            Start tournament · 52
          </HBButton>
          <HBButton size="xl" preset={accentPreset}>
            Scorecard · 56
          </HBButton>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <HBButton size="md" variant="outline">
            Cancel
          </HBButton>
          <HBButton size="md" variant="ghost">
            Secondary action
          </HBButton>
          <HBButton size="md" variant="primary" preset="core-black">
            Admin override
          </HBButton>
          <HBButton size="md" variant="primary" preset="sunburst">
            Handicap +3
          </HBButton>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28 }}>
        <SpeckleCard preset="ocean-blue" title="Provincial Shield 2026" chip="R4 / Semis" />
        <SpeckleCard preset="ruby" small title="Club Ladder" chip="Live" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 28 }}>
        <Scorecard />
        <div style={{ display: "grid", gap: 20 }}>
          <BracketCell />
          <RinkPills />
        </div>
      </div>
    </div>
  );
}

function SpeckleCard({
  preset,
  title,
  chip,
  small = false,
}: {
  preset: ThemePreset;
  title: string;
  chip: string;
  small?: boolean;
}) {
  const p = PRESET_BY_ID[preset];
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 24,
        overflow: "hidden",
        border: "1px solid #E6E3DA",
        background: "#FFFFFF",
      }}
    >
      <div style={{ position: "relative" }}>
        <SpeckleField
          preset={preset}
          width="100%"
          height={small ? 88 : 130}
          borderRadius={0}
          intensity="medium"
          seedKey={`design-showcase-${preset}-${small ? "sm" : "lg"}`}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: small ? 34 : 48,
              color: p.on,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              textShadow: "0 1px 0 rgba(0,0,0,0.25)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              background: p.on,
              color: p.base,
              padding: "6px 12px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {chip}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px 22px" }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "#0A0A0A",
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          {small
            ? "Monthly standings for singles and pairs. Updated automatically when scores are locked."
            : "Club admins publish the draw; skips confirm their rink within 24 hours. Scorers can lock a card end-by-end or confirm at full time."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <BrandBadge tone="good">Live</BrandBadge>
          <BrandBadge tone="bone">Rink 03</BrandBadge>
          <BrandBadge tone="ink">{small ? "42 players" : "24 teams"}</BrandBadge>
          <BrandBadge tone="warn">Handicap on</BrandBadge>
        </div>
      </div>
    </div>
  );
}

function Scorecard() {
  const rows = [
    { end: 12, us: 1, them: 2, shots: "+10" },
    { end: 13, us: 3, them: 0, shots: "+13" },
    { end: 14, us: 2, them: 0, shots: "+15" },
    { end: 15, us: 0, them: 1, shots: "+14", live: true },
  ];
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E3DA",
        borderRadius: 24,
        padding: 24,
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div>
          <MonoLabel>03 / Scorecard — tabular</MonoLabel>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: 34,
              textTransform: "uppercase",
              lineHeight: 1,
              marginTop: 6,
              color: "#0A0A0A",
            }}
          >
            ROUND 4 — SEMIS
          </div>
        </div>
        <BrandBadge tone="danger">● Live</BrandBadge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
          padding: "14px 0",
          borderTop: "1px solid #E6E3DA",
          borderBottom: "1px solid #E6E3DA",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 12,
              color: "#6B6B66",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Skip — Durban North
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: 28,
              lineHeight: 1,
              textTransform: "uppercase",
              color: "#0A0A0A",
            }}
          >
            T. Pillay
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 72,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: "#0A0A0A",
          }}
        >
          <span>21</span>
          <span style={{ fontSize: 28, color: "#6B6B66" }}>—</span>
          <span>14</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 12,
              color: "#6B6B66",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Skip — Pinetown
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: 28,
              lineHeight: 1,
              textTransform: "uppercase",
              color: "#0A0A0A",
            }}
          >
            M. Naidoo
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 60px 60px 90px",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6B6B66",
            paddingBottom: 8,
            borderBottom: "1px solid #E6E3DA",
          }}
        >
          <div>End</div>
          <div>Bowl-by-bowl</div>
          <div style={{ textAlign: "right" }}>Us</div>
          <div style={{ textAlign: "right" }}>Them</div>
          <div style={{ textAlign: "right" }}>Shots</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 60px 60px 90px",
              fontSize: 16,
              padding: "12px 0",
              borderBottom: "1px solid #E6E3DA",
              alignItems: "center",
            }}
          >
            <div style={{ color: "#6B6B66" }}>{String(r.end).padStart(2, "0")}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: 8 }).map((_, j) => (
                <span
                  key={j}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: j < 4 ? "#D7261E" : "#1E4DD8",
                    opacity: Math.abs(j - 3.5) < r.us + r.them ? 1 : 0.18,
                    display: "inline-block",
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                />
              ))}
            </div>
            <div style={{ textAlign: "right", fontWeight: 500 }}>{r.us}</div>
            <div style={{ textAlign: "right", fontWeight: 500 }}>{r.them}</div>
            <div
              style={{
                textAlign: "right",
                color: r.live ? "#D7261E" : "#0A0A0A",
              }}
            >
              {r.shots}
              {r.live ? " ●" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketCell() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E3DA",
        borderRadius: 20,
        padding: 20,
      }}
    >
      <MonoLabel style={{ marginBottom: 14 }}>04 / Bracket match</MonoLabel>
      <div style={{ border: "1px solid #E6E3DA", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr auto",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid #E6E3DA",
            background: "#FAFAF7",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#D7261E" }} />
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: 22,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              DURBAN NORTH
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#6B6B66", marginTop: 2 }}>
              Skip: T. Pillay · Rink 3
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 500 }}>21</div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr auto",
            alignItems: "center",
            padding: "14px 16px",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#6B6B66", opacity: 0.4 }} />
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: 22,
                textTransform: "uppercase",
                lineHeight: 1,
                color: "#6B6B66",
              }}
            >
              PINETOWN
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#6B6B66", marginTop: 2 }}>
              Skip: M. Naidoo · Rink 3
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 500, color: "#6B6B66" }}>14</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <BrandBadge tone="ink">Semi-final</BrandBadge>
        <BrandBadge tone="bone">16:00</BrandBadge>
        <BrandBadge tone="good">Confirmed</BrandBadge>
      </div>
    </div>
  );
}

function RinkPills() {
  const rinks = [
    { n: 1, state: "idle" },
    { n: 2, state: "warm" },
    { n: 3, state: "live" },
    { n: 4, state: "live" },
    { n: 5, state: "done" },
  ] as const;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E3DA",
        borderRadius: 20,
        padding: 20,
      }}
    >
      <MonoLabel style={{ marginBottom: 14 }}>05 / Rink badges</MonoLabel>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {rinks.map((r) => {
          const tone =
            r.state === "live"
              ? { bg: "#D7261E", fg: "#fff", dot: "#fff" }
              : r.state === "warm"
                ? { bg: "#F5B700", fg: "#0A0A0A", dot: "#0A0A0A" }
                : r.state === "done"
                  ? { bg: "#0E7C7B", fg: "#fff", dot: "#fff" }
                  : { bg: "#FAFAF7", fg: "#0A0A0A", dot: "#6B6B66" };
          return (
            <div
              key={r.n}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: tone.bg,
                color: tone.fg,
                border: r.state === "idle" ? "1px solid #E6E3DA" : "none",
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.7 }}>RINK</span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontWeight: 900,
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                {String(r.n).padStart(2, "0")}
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: tone.dot,
                  opacity: r.state === "live" ? 1 : 0.6,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------- texture demo --------------------

function TextureDemo({ accentPreset }: { accentPreset: ThemePreset }) {
  const p = PRESET_BY_ID[accentPreset];
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div>
        <MonoLabel style={{ marginBottom: 16 }}>Speckle layer — 3 opacities</MonoLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { label: "Subtle backing", opacity: 0.25, density: 0.6 },
            { label: "Medium hero", opacity: 0.7, density: 1.0 },
            { label: "Bold accent", opacity: 1.2, density: 1.6 },
          ].map((s, i) => (
            <div key={i} style={{ position: "relative" }}>
              <SpeckleField
                preset={accentPreset}
                width="100%"
                height={180}
                opacityScale={s.opacity}
                density={s.density}
                borderRadius={20}
                seedKey={`speckle-step-${s.label}-${i}`}
              />
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  top: 14,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 500,
                  background: "rgba(250,250,247,0.9)",
                  color: "#0A0A0A",
                  padding: "4px 8px",
                  borderRadius: 999,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 14,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontWeight: 900,
                  fontSize: 48,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  color: p.on,
                  textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                  opacity: 0.95,
                }}
              >
                0{i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <MonoLabel style={{ marginBottom: 16 }}>Splatter — corner accents only</MonoLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { preset: "atomic-red" as const, rotate: -10, variant: 0 as const, label: "Heritage" },
            { preset: "midnight" as const, rotate: 12, variant: 1 as const, label: "Knockout" },
            { preset: "sunburst" as const, rotate: -22, variant: 2 as const, label: "Sunburst" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                height: 220,
                borderRadius: 20,
                background: "#FFFFFF",
                border: "1px solid #E6E3DA",
                overflow: "hidden",
              }}
            >
              <SplatterAccent
                preset={s.preset}
                variant={s.variant}
                rotate={s.rotate}
                size={240}
                style={{ position: "absolute", left: -40, top: -40 }}
              />
              <div style={{ position: "absolute", right: 18, bottom: 18, textAlign: "right" }}>
                <MonoLabel>Corner / {s.preset}</MonoLabel>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontWeight: 900,
                    fontSize: 36,
                    lineHeight: 1,
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------- tagline + footer --------------------

function TaglineSection({ activePresetId }: { activePresetId: ThemePreset }) {
  const p = PRESET_BY_ID[activePresetId];
  return (
    <section
      style={{
        position: "relative",
        padding: "120px 56px",
        overflow: "hidden",
        borderTop: "1px solid #E6E3DA",
        borderBottom: "1px solid #E6E3DA",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.14,
          pointerEvents: "none",
        }}
      >
        <Bowl preset={activePresetId} size={820} idSuffix="tagline" />
      </div>

      <div style={{ maxWidth: 1320, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <MonoLabel style={{ marginBottom: 24 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: p.base, display: "inline-block" }} />
          Voice — loud, sporty, heritage
        </MonoLabel>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "clamp(64px, 9vw, 168px)",
            lineHeight: 0.88,
            letterSpacing: "-0.03em",
            margin: 0,
            textTransform: "uppercase",
            color: "#0A0A0A",
          }}
        >
          <em>Tournaments, scores,</em>
          <br />
          <em>and skills</em> <span style={{ color: p.base }}>in your pocket.</span>
        </h2>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 17,
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: 620,
            marginTop: 40,
            color: "#6B6B66",
          }}
        >
          Built for South African bowls clubs — from singles challenges to multi-day tournaments. The aesthetic is
          borrowed from the bowls themselves: loud, speckled, unmistakable.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "40px 56px 64px" }}>
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 28,
            textTransform: "uppercase",
          }}
        >
          HandiBowls — Brand Book v0.1
        </div>
        <MonoLabel style={{ opacity: 0.6 }}>04.2026 — Visual direction locked</MonoLabel>
      </div>
    </footer>
  );
}
