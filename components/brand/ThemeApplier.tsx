"use client";

import { useEffect } from "react";

import type { ThemePreset } from "./theme-presets";

export { THEME_PRESETS, type ThemePreset } from "./theme-presets";

type Props = {
  theme: ThemePreset;
};

export function ThemeApplier({ theme }: Props) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
