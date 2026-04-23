// Pure, non-"use client" module so that server code (Zod schemas, server
// actions, RSC data loaders) can import the preset list without being tainted
// by the ThemeApplier component's client boundary. Re-exported from
// ThemeApplier.tsx for existing client-side call sites.

export const THEME_PRESETS = [
  "atomic-red",
  "ocean-blue",
  "sunburst",
  "midnight",
  "ruby",
  "ocean-green",
  "grape",
  "white-speckle",
  "core-black",
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
