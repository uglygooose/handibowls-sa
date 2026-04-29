// Phase 8d follow-up — rink display label composition. Single helper
// shared across the three `_data.ts` sites that embed match rinks
// (Phase 7 admin getMatchesForTournament, Phase 8a /play
// getNextMatchForCurrentPlayer, Phase 8c scorecard getScorecardMatch).
//
// Why a helper rather than three inline mappers: the rinks table has
// `green_id` + `number` (no flat `name` column — migration 005), so the
// player-facing label is `${green.name} ${rink.number}`. After three
// sites needed this composition the same way, consolidating up-front
// avoids the "drift between sites" failure mode that bit Phase 7 (the
// rink:rinks(name) embed survived Finding 4 because every consumer
// owned its own mapper).
//
// Convention: when green.name is missing (which happens if the greens
// row is RLS-hidden but the rinks row isn't) we fall back to the
// generic word "Green". The match still gets a recognisable label
// rather than a half-baked "undefined 3".

/** Embed shape produced by `rink:rinks(number, green:greens(name))`. */
export type RinkEmbed = {
  number?: number | null;
  green?: { name?: string | null } | null;
} | null;

/**
 * Compose a rink display label from the embed result.
 *   • populated rink + green name → `"<green name> <number>"` (e.g. "Main Green 3")
 *   • populated rink + missing green name → `"Green <number>"` (fallback)
 *   • null / missing rink → `null`
 */
export function formatRinkLabel(rink: RinkEmbed): string | null {
  if (!rink || rink.number == null) return null;
  const greenName = rink.green?.name ?? null;
  return greenName ? `${greenName} ${rink.number}` : `Green ${rink.number}`;
}
