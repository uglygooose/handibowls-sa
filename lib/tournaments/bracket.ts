// lib/tournaments/bracket.ts
// Pure-function bracket math. No DB, no state.

export function largestPowerOfTwoLE(n: number): number {
  if (n < 1) return 0;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export type RoundLabelInput = {
  totalTeams: number;
  roundNo: number | null | undefined;
};

export function roundLabel(input: RoundLabelInput): string {
  const r = Number(input.roundNo ?? 0);
  if (!r) return "Round -";
  if (!input.totalTeams || input.totalTeams < 2) return `Round ${r}`;

  const base = largestPowerOfTwoLE(input.totalTeams);
  const hasPreRound = input.totalTeams > base;
  if (hasPreRound && r === 1) return "Pre-Rd";

  const mainRoundNo = hasPreRound ? r - 1 : r;
  const playersLeft = Math.floor(base / Math.pow(2, mainRoundNo - 1));

  if (playersLeft === 2) return "Final";
  if (playersLeft === 4) return "Semis";
  if (playersLeft === 8) return "Quarters";
  if (playersLeft >= 16) return `RD ${mainRoundNo}`;
  return `Round ${r}`;
}

export function finishPlacementLabel(input: RoundLabelInput): string | null {
  const r = Number(input.roundNo ?? 0);
  if (!r) return null;
  if (!input.totalTeams || input.totalTeams < 2) return null;

  const base = largestPowerOfTwoLE(input.totalTeams);
  const hasPreRound = input.totalTeams > base;
  const mainRoundNo = hasPreRound ? r - 1 : r;
  if (mainRoundNo <= 0) return null;

  const playersLeft = Math.floor(base / Math.pow(2, mainRoundNo - 1));
  if (!playersLeft) return null;

  if (playersLeft === 2) return "Runner-up";
  if (playersLeft === 4) return "Tied 3rd";

  const start = playersLeft / 2 + 1;
  const endPos = playersLeft;
  return `Tied ${start}-${endPos}`;
}
