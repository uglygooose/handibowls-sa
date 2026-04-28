"use client";

import dynamic from "next/dynamic";

// Lazy-mount the command palette so cmdk's bundle (~6kb gz) doesn't
// inflate the initial admin-shell payload. ssr:false because the
// palette uses document keydown listeners + Radix-dialog portals;
// nothing useful renders server-side.

const TournamentCommandPalette = dynamic(
  () => import("@/components/command/TournamentCommandPalette"),
  { ssr: false },
);

export function CommandPaletteMount() {
  return <TournamentCommandPalette />;
}
