import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock harness — captures the chained call shape so tests can assert
// the predicate hits the right table + filters, then resolves the
// terminal promise with rigged `{ count, error }`.

type ChainResult = { count: number | null; error: { message: string } | null };

const chainCalls: {
  from: string | null;
  select: { columns: string; opts: unknown } | null;
  eq: Array<[string, unknown]>;
  or: string | null;
} = { from: null, select: null, eq: [], or: null };

let chainResult: ChainResult = { count: 0, error: null };

function makeChain() {
  const chain = {
    select(columns: string, opts: unknown) {
      chainCalls.select = { columns, opts };
      return chain;
    },
    eq(col: string, value: unknown) {
      chainCalls.eq.push([col, value]);
      return chain;
    },
    or(filter: string) {
      chainCalls.or = filter;
      // Terminal: returns a thenable resolving to the rigged result.
      return Promise.resolve(chainResult);
    },
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from(table: string) {
        chainCalls.from = table;
        return makeChain();
      },
    }),
}));

import { tournamentHasScores } from "@/lib/tournaments/queries";

beforeEach(() => {
  chainCalls.from = null;
  chainCalls.select = null;
  chainCalls.eq = [];
  chainCalls.or = null;
  chainResult = { count: 0, error: null };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Phase 12.5 / 12.5-5 — coverage for the format-locked predicate.
//
// Three states from the spec:
//   - no matches at all → false
//   - matches exist but match_ends shots are zero → false
//   - matches with at least one match_ends row at non-zero shots → true
//
// Plus a fail-open contract on query error.

describe("tournamentHasScores — predicate query shape", () => {
  it("queries match_ends inner-joined to matches with shots>0 .or() + tournament_id .eq() + count:exact head:true", async () => {
    chainResult = { count: 0, error: null };
    await tournamentHasScores("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(chainCalls.from).toBe("match_ends");
    expect(chainCalls.select?.columns).toContain("matches!inner");
    expect(chainCalls.select?.opts).toEqual({ count: "exact", head: true });
    expect(chainCalls.eq).toEqual([
      ["matches.tournament_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    ]);
    expect(chainCalls.or).toBe("home_shots.gt.0,away_shots.gt.0");
  });
});

describe("tournamentHasScores — predicate result", () => {
  it("returns false when no match_ends rows match (no matches in tournament)", async () => {
    chainResult = { count: 0, error: null };
    const result = await tournamentHasScores("t1");
    expect(result).toBe(false);
  });

  it("returns false when count comes back null (treat as zero matches)", async () => {
    chainResult = { count: null, error: null };
    const result = await tournamentHasScores("t1");
    expect(result).toBe(false);
  });

  it("returns true when at least one match_ends row has non-zero shots", async () => {
    chainResult = { count: 3, error: null };
    const result = await tournamentHasScores("t1");
    expect(result).toBe(true);
  });

  it("returns false (fail-open) when the query errors — log + don't lock the form", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    chainResult = { count: null, error: { message: "rls denied" } };
    const result = await tournamentHasScores("t1");
    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalled();
  });
});
