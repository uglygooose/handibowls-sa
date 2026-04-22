"use client";

import { useEffect } from "react";

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

type Props = {
  theme: ThemePreset;
};

export function ThemeApplier({ theme }: Props) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
