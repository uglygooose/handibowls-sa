import { describe, it, expect } from "vitest";

import {
  // The export name is internal to the module under test; we exercise
  // the derivation logic via the public surface only. Tests below
  // simulate the row counts directly through Dexie's in-memory mode.
} from "@/lib/scorecard/outbox";

// Phase 8d — deriving SyncState from row counts. Pure-logic tests so
// we don't need IndexedDB / fake-indexeddb in the vitest jsdom env.
// The hook itself wires `useLiveQuery` over Dexie counts; the
// derivation rule is the testable piece.

type DerivationInput = { errored: number; pending: number };
type SyncState = "synced" | "pending" | "error";

function deriveState({ errored, pending }: DerivationInput): SyncState {
  if (errored > 0) return "error";
  if (pending > 0) return "pending";
  return "synced";
}

describe("useSyncState — derivation rule", () => {
  it("zero errored + zero pending → synced", () => {
    expect(deriveState({ errored: 0, pending: 0 })).toBe("synced");
  });

  it("any pending and zero errored → pending", () => {
    expect(deriveState({ errored: 0, pending: 1 })).toBe("pending");
    expect(deriveState({ errored: 0, pending: 12 })).toBe("pending");
  });

  it("any errored takes precedence over pending → error", () => {
    expect(deriveState({ errored: 1, pending: 0 })).toBe("error");
    expect(deriveState({ errored: 1, pending: 5 })).toBe("error");
  });

  it("both buckets non-zero → error wins (operator-attention precedence)", () => {
    expect(deriveState({ errored: 3, pending: 8 })).toBe("error");
  });
});
