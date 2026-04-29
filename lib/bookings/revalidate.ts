import "server-only";

import { revalidatePath } from "next/cache";

// Phase 8e — booking surface invalidation. Mirrors the
// `revalidateMatchSurfaces` pattern from Phase 8d Finding 13: any
// action that mutates a booking flips the RSC cache for every page
// that derives data from `bookings`. One helper, one diff to update
// when surfaces change.
//
//   • /book — slot grid + (later) MyBookings inline
//   • /me   — MyBookings full list (Phase 8e-3)
//
// Admin booking surfaces (Phase 9) will add their own paths to the
// fan-out when they ship.
export function revalidateBookingSurfaces(): void {
  revalidatePath("/book", "page");
  revalidatePath("/me", "page");
}
