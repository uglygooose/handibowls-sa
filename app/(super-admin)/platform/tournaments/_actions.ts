"use server";

// Phase 6d — Tournament server-action super-admin mirror.
//
// Per §9 step 6: "most super-admin actions delegate to the club-admin
// action with super-admin auth gate." Each action in the canonical
// implementation
// (`app/(club-admin)/manage/tournaments/_actions.ts`) already accepts
// super_admin via the role check in `authForTournament` /
// `isPlayerOnMatchOrAdmin`. So the platform-route variants are literal
// re-exports — same auth gate, same primitives, same DB writes.
//
// Why not pure path-aliased imports at call sites? Server-action files
// must live within the route group that invokes them so Next can wire
// the closure boundary correctly. Re-exporting is the cheapest way to
// land both surfaces without duplicated logic.

export {
  createTournament,
  closeEntries,
  seedEntries,
  generateBracket,
  advanceRound,
  submitMatch,
  confirmMatch,
  verifyMatch,
  completeTournament,
  cancelTournament,
  bulkSaveMatchScores,
  finalizeMatchesBatch,
  type ActionResult,
} from "@/app/(club-admin)/manage/tournaments/_actions";
