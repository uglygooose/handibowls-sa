// app/games/utils/games.ts
//
// Pure helpers shared between the games page shell and its views.

export type GameFormat = "SINGLES" | "DOUBLES" | "TRIPLES" | "FOUR_BALL";

export function formatFormat(fmt: GameFormat): string {
  if (fmt === "FOUR_BALL") return "4 Balls";
  return fmt.charAt(0) + fmt.slice(1).toLowerCase();
}
