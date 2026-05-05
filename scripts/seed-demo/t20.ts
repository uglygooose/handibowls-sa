// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed Twenty 20.
//
// Seeds:
//   • v2-draft-2026 rubric (inactive) — pairs with the migration-013-
//     seeded v1-final-2026 (active) so /platform/rubrics renders both
//     active + draft state-machine cells.
//   • 7 t20_assessments at Demo Bowls Club covering grade × status:
//       gold + submitted (most recent for player@)
//       silver + submitted
//       bronze + submitted
//       fail + submitted (UI label "Reassess")
//       null + draft (in-flight on captain@; capture wizard demo)
//       gold + archived (older, archived state coverage)
//       silver + submitted at Pinelands (cross-club view)
//   • 16 t20_deliveries on the in-flight assessment so the capture
//     wizard renders a partially-filled state.
//
// Status enum coverage: draft (1) + submitted (5) + archived (1) =
// 3/3 reachable.
// Grade enum coverage: gold (2) + silver (2) + bronze (1) + fail (1) =
// 4/4 reachable.

import { logSection, type Admin } from "./_lib";
import type { ClubRow } from "./clubs";
import type { SeededFiller, SeededUser } from "./users";

export async function seedT20(
  client: Admin,
  clubs: { demo: ClubRow; pinelands: ClubRow },
  users: SeededUser[],
  fillers: SeededFiller[],
): Promise<void> {
  logSection("Demo seed — T20 rubric (v2-draft) + assessments + deliveries");

  const v2RubricId = await ensureV2DraftRubric(client);
  const v1Active = await getActiveRubricId(client);
  if (!v1Active) {
    throw new Error(
      "No active rubric found. Migration 013 should have seeded v1-final-2026.",
    );
  }

  const playerUser = req(users, "player@demo.local");
  const captainUser = req(users, "captain@demo.local");
  const coachUser = req(users, "coach@demo.local");
  const admin2User = req(users, "admin2@demo.local");
  const pin1Filler = reqF(fillers, "pinplay1@demo.local");

  // Pre-wipe demo t20_assessments (cascades deliveries). Defends
  // against --skip-reset re-runs.
  await client
    .from("t20_assessments")
    .delete()
    .in("club_id", [clubs.demo.id, clubs.pinelands.id]);

  // Notes shape per migration 041 — jsonb object with optional keys
  // {strengths, watch, focus, legacy}. Validated by t20_notes_keys_valid.
  type Notes = {
    strengths?: string;
    watch?: string;
    focus?: string;
    legacy?: string;
  } | null;

  type Assessment = {
    club_id: string;
    profile_id: string;
    assessor_id: string;
    rubric_version_id: string;
    assessed_on: string;
    total_score: number;
    percentage: number;
    grade: "gold" | "silver" | "bronze" | "fail" | null;
    status: "draft" | "submitted" | "archived";
    submitted_at: string | null;
    notes: Notes;
  };

  const today = new Date();
  const daysAgo = (d: number) =>
    new Date(today.getTime() - d * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  const isoAgo = (d: number) =>
    new Date(today.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const rows: Assessment[] = [
    // 1. gold + submitted — most recent for player@
    {
      club_id: clubs.demo.id,
      profile_id: playerUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(7),
      total_score: 92.5,
      percentage: 82.6,
      grade: "gold",
      status: "submitted",
      submitted_at: isoAgo(7),
      notes: { strengths: "Excellent control across all sections." },
    },
    // 2. silver + submitted (older, for player@)
    {
      club_id: clubs.demo.id,
      profile_id: playerUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(60),
      total_score: 81.0,
      percentage: 72.3,
      grade: "silver",
      status: "submitted",
      submitted_at: isoAgo(60),
      notes: { watch: "Strong line; weight needs work on speedhumps." },
    },
    // 3. bronze + submitted (older still, for player@)
    {
      club_id: clubs.demo.id,
      profile_id: playerUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(120),
      total_score: 65.5,
      percentage: 58.5,
      grade: "bronze",
      status: "submitted",
      submitted_at: isoAgo(120),
      notes: { strengths: "Foundations solid; building consistency." },
    },
    // 4. fail + submitted (oldest, for player@; UI label "Reassess")
    {
      club_id: clubs.demo.id,
      profile_id: playerUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(180),
      total_score: 50.0,
      percentage: 44.6,
      grade: "fail",
      status: "submitted",
      submitted_at: isoAgo(180),
      notes: { focus: "Reassessment recommended — focus on length + line fundamentals." },
    },
    // 5. null + draft (in-flight on captain@) — capture wizard demo
    {
      club_id: clubs.demo.id,
      profile_id: captainUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(0),
      total_score: 0,
      percentage: 0,
      grade: null,
      status: "draft",
      submitted_at: null,
      notes: null,
    },
    // 6. gold + archived (older than the submitted gold — coverage)
    {
      club_id: clubs.demo.id,
      profile_id: playerUser.id,
      assessor_id: coachUser.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(240),
      total_score: 91.0,
      percentage: 81.3,
      grade: "gold",
      status: "archived",
      submitted_at: isoAgo(240),
      notes: { legacy: "Archived prior assessment." },
    },
    // 7. silver + submitted at Pinelands (cross-club view)
    {
      club_id: clubs.pinelands.id,
      profile_id: pin1Filler.id,
      assessor_id: admin2User.id,
      rubric_version_id: v1Active,
      assessed_on: daysAgo(14),
      total_score: 78.0,
      percentage: 69.6,
      grade: "silver",
      status: "submitted",
      submitted_at: isoAgo(14),
      notes: { focus: "Pinelands club assessment — work on draw weight." },
    },
  ];

  const { data: inserted, error } = await client
    .from("t20_assessments")
    .insert(rows)
    .select("id, status, profile_id");
  if (error) throw error;

  console.log(
    `  t20_assessments — seeded ${inserted?.length ?? 0} (gold + silver ×2 + bronze + fail + draft + archived)`,
  );

  // Find the draft assessment (in-flight) and seed deliveries to
  // simulate ~40-60% capture progress so the wizard renders mid-state.
  const draft = inserted?.find((a) => a.status === "draft");
  if (draft) {
    await seedDraftDeliveries(client, draft.id);
  }

  // Hint at the v2 rubric for the report (not pinned by tests).
  void v2RubricId;
}

async function ensureV2DraftRubric(client: Admin): Promise<string> {
  // Read the active v1 rubric and clone its `rubric` jsonb into a
  // new v2-draft row. Same shape, version string differs, is_active
  // false. This keeps the schema CHECK satisfied without us having
  // to author a brand-new rubric jsonb spec.
  const { data: v1, error: v1Err } = await client
    .from("t20_rubric_versions")
    .select("rubric, version")
    .eq("is_active", true)
    .maybeSingle();
  if (v1Err) throw v1Err;
  if (!v1) throw new Error("No active rubric to clone for v2-draft");

  const v2Version = "v2-draft-2026";

  // Idempotent: delete any prior v2-draft (the migration 007 partial
  // unique index `t20_rubric_versions_one_active` only constrains
  // is_active=true, so multiple inactive rows are allowed but we
  // still want a single canonical demo draft).
  await client.from("t20_rubric_versions").delete().eq("version", v2Version);

  const { data, error } = await client
    .from("t20_rubric_versions")
    .insert({
      version: v2Version,
      rubric: v1.rubric,
      is_active: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  t20_rubric_versions — added ${v2Version} (inactive draft)`);
  return data.id;
}

async function getActiveRubricId(client: Admin): Promise<string | null> {
  const { data, error } = await client
    .from("t20_rubric_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function seedDraftDeliveries(client: Admin, assessmentId: string) {
  // 16 deliveries — Section 1 (jacks) round 1 + 2 at distance 23m.
  // 8 deliveries per round per distance per the rubric. Captures a
  // partial-progress state for the capture wizard demo.
  type Delivery = {
    assessment_id: string;
    section:
      | "jacks"
      | "targets"
      | "drive"
      | "control"
      | "trail"
      | "speedhumps_asc"
      | "speedhumps_desc";
    round: number;
    delivery_index: number;
    distance_m: number;
    hand: "fore" | "back" | null;
    outcome: { value: string };
    points: number;
  };

  const rows: Delivery[] = [];
  for (let round = 1; round <= 2; round++) {
    for (let i = 1; i <= 8; i++) {
      // Deterministic line-outcome rotation: on_line / narrow / wide.
      const outcomes = ["on_line", "narrow_left", "wide_right"] as const;
      const value = outcomes[(round * i) % outcomes.length];
      rows.push({
        assessment_id: assessmentId,
        section: "jacks",
        round,
        delivery_index: i,
        distance_m: 23,
        hand: i % 2 === 0 ? "back" : "fore",
        outcome: { value },
        points: value === "on_line" ? 1 : value === "narrow_left" ? 0.5 : 0,
      });
    }
  }

  const { error } = await client.from("t20_deliveries").insert(rows);
  if (error) throw error;
  console.log(
    `  t20_deliveries — seeded ${rows.length} deliveries on the in-flight assessment (Section 1, distance 23m, R1+R2)`,
  );
}

function req<T extends { email: string }>(arr: T[], email: string): T {
  const u = arr.find((x) => x.email === email);
  if (!u) throw new Error(`required user not found: ${email}`);
  return u;
}

function reqF(arr: SeededFiller[], email: string): SeededFiller {
  return req(arr, email);
}
