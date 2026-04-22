// lib/tournaments/handicap.ts
// Pure-function handicap helpers. Take data via explicit params; no closures over state.

export function shortName(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return t;
  const first = t.split(" ")[0] ?? t;
  return first.length ? first : t;
}

export type HandicapInfoInput = {
  format: string | null | undefined;
  teamAId: string | null;
  teamBId: string | null;
  teamMembersByTeamId: Record<string, string[]>;
  handicapByPlayerId: Record<string, number | null>;
  nameByPlayerId: Record<string, string>;
};

export type HandicapInfo = {
  nameA: string;
  nameB: string;
  ha: number | null;
  hb: number | null;
  diff: number | null;
  plusTo: "A" | "B" | null;
};

export function singlesHandicapInfo(input: HandicapInfoInput): HandicapInfo | null {
  if (input.format !== "SINGLES") return null;
  if (!input.teamAId || !input.teamBId) return null;

  const pa = input.teamMembersByTeamId[input.teamAId]?.[0] ?? null;
  const pb = input.teamMembersByTeamId[input.teamBId]?.[0] ?? null;
  if (!pa || !pb) return null;

  const ha = input.handicapByPlayerId[pa] ?? null;
  const hb = input.handicapByPlayerId[pb] ?? null;
  const nameA = input.nameByPlayerId[pa] ?? "";
  const nameB = input.nameByPlayerId[pb] ?? "";

  if (ha == null || hb == null) {
    return { nameA, nameB, ha, hb, diff: null, plusTo: null };
  }

  const diff = Math.abs(ha - hb);
  const plusTo = diff === 0 ? null : ha < hb ? "A" : "B"; // lower handicap gets the plus
  return { nameA, nameB, ha, hb, diff, plusTo };
}

export function singlesHandicapLine(
  input: HandicapInfoInput,
  ruleType: string | null | undefined
): string | null {
  if (ruleType === "SCRATCH") return null;
  const hc = singlesHandicapInfo(input);
  if (!hc) return null;
  if (hc.diff == null) return "Handicap: -";
  if (hc.diff === 0) return "Handicap: level";
  const to = hc.plusTo === "A" ? shortName(hc.nameA) : shortName(hc.nameB);
  return `Handicap: +${hc.diff} to ${to}`;
}
