import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthContext } from "@/lib/auth/role";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    setAll: () => {},
  }),
  headers: async () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

// Phase 12 / 12-4 hotfix close-out (C). Real-database integration
// test for finalizeAssessment — the live wizard → action → SQL
// path that all five gates passed for the 12-4 close at 1aad798
// while the action shipped with three latent bugs:
//
//   1. aggregateAssessment produced percentage > 100 when raw
//      earned exceeded grandMax (=320), tripping the
//      t20_assessments_percentage_range CHECK.
//   2. finalizeSchema.notes was z.string() (a pre-migration-041
//      leftover); any caller submitting notes-as-string would
//      have tripped the t20_assessments_notes_shape CHECK.
//   3. The UPDATE ran without `.select(...)` so a silent RLS
//      denial (UPDATE matched no rows but returned no error)
//      let the action return kind='ok' and the wizard navigated
//      to an unchanged results page.
//
// This test pins the post-hotfix behaviour against a realistic
// fixture (192 deliveries, ~1500pt raw earned that's ~470% of
// grandMax) running through the live Server Action with a
// cookie-bound supabase-js client.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Mutable holder so each test can swap auth context + supabase
// client without re-declaring the vi.mock factory.
const ctxHolder: {
  ctx: AuthContext | null;
  client: ReturnType<typeof createSbClient<Database>> | null;
} = { ctx: null, client: null };

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...actual,
    getAuthContext: async () => ctxHolder.ctx,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ctxHolder.client,
}));

import { admin, cleanup, createTestUser, seedClub, signIn } from "../../rls/helpers";

const { finalizeAssessment } = await import(
  "@/app/(club-admin)/manage/t20/_actions"
);

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("finalizeAssessment · live SQL path (12-4 hotfix regression)", () => {
  let clubA: string;
  let clubB: string;
  let rubricId: string;

  beforeAll(async () => {
    clubA = await seedClub("Finalize A");
    clubB = await seedClub("Finalize B");
    clubs.push(clubA, clubB);
    const { data, error } = await admin()
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true)
      .single();
    if (error || !data) throw new Error(`no active rubric: ${error?.message}`);
    rubricId = data.id;
  });

  async function seedAssessmentWith(opts: {
    assessorId: string;
    subjectId: string;
    clubId: string;
    overTarget?: boolean;
    minimal?: boolean;
  }): Promise<string> {
    const a = admin();
    const { data: ass, error: aErr } = await a
      .from("t20_assessments")
      .insert({
        club_id: opts.clubId,
        profile_id: opts.subjectId,
        assessor_id: opts.assessorId,
        rubric_version_id: rubricId,
      })
      .select("id")
      .single();
    if (aErr || !ass) throw new Error(`assessment insert: ${aErr?.message}`);
    const id = ass.id;

    // 192 zone-1 deliveries across drive + control + trail × 4 distances ×
    // 2 rounds × 8 indices = far above grandMax (320). Each zone-1 in a
    // zones_8 section earns 8pt → ~1500pt raw.
    const overTargetRows: Database["public"]["Tables"]["t20_deliveries"]["Insert"][] =
      [];
    for (const section of ["drive", "control", "trail"] as const) {
      for (const round of [1, 2] as const) {
        for (const distance of [23, 26, 29, 32]) {
          for (let idx = 1; idx <= 8; idx++) {
            overTargetRows.push({
              assessment_id: id,
              section,
              round,
              delivery_index: idx,
              distance_m: distance,
              hand: null,
              outcome: { zone: 1 },
              points: 8,
            });
          }
        }
      }
    }

    if (opts.overTarget) {
      const { error: dErr } = await a
        .from("t20_deliveries")
        .insert(overTargetRows);
      if (dErr) throw new Error(`deliveries insert: ${dErr.message}`);
    } else if (opts.minimal) {
      const { error: dErr } = await a.from("t20_deliveries").insert({
        assessment_id: id,
        section: "drive",
        round: 1,
        delivery_index: 1,
        distance_m: 23,
        hand: null,
        outcome: { zone: 1 },
        points: 8,
      });
      if (dErr) throw new Error(`delivery insert: ${dErr.message}`);
    }

    return id;
  }

  function bindClientFor(token: string) {
    return createSbClient<Database>(URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }

  it("clamps percentage at 100 when raw earned exceeds grandMax + writes notes as jsonb", async () => {
    const assessor = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(assessor.id, subject.id);

    const assessmentId = await seedAssessmentWith({
      assessorId: assessor.id,
      subjectId: subject.id,
      clubId: clubA,
      overTarget: true,
    });

    const session = await signIn(assessor);
    ctxHolder.ctx = {
      userId: assessor.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: assessor.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await finalizeAssessment({
      assessment_id: assessmentId,
      notes: { strengths: "Solid zone-1 control across all distances." },
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.percentage).toBe(100);
      expect(result.total_score).toBeGreaterThan(320);
      expect(result.grade).toBe("gold");
    }

    const { data: row } = await admin()
      .from("t20_assessments")
      .select("status, percentage, total_score, notes, submitted_at")
      .eq("id", assessmentId)
      .single();
    expect(row?.status).toBe("submitted");
    expect(Number(row?.percentage)).toBe(100);
    expect(Number(row?.total_score)).toBeGreaterThan(320);
    expect(row?.submitted_at).not.toBeNull();
    expect(row?.notes).toEqual({
      strengths: "Solid zone-1 control across all distances.",
    });
  });

  it("rejects notes-as-string at the schema layer (kind='validation')", async () => {
    const assessor = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(assessor.id, subject.id);

    const assessmentId = await seedAssessmentWith({
      assessorId: assessor.id,
      subjectId: subject.id,
      clubId: clubA,
      minimal: true,
    });

    const session = await signIn(assessor);
    ctxHolder.ctx = {
      userId: assessor.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: assessor.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await finalizeAssessment({
      assessment_id: assessmentId,
      // @ts-expect-error — exercising the schema rejection
      notes: "freeform string notes from a stale caller",
    });
    expect(result.kind).toBe("validation");
  });

  it("returns kind='error' when a cross-club admin attempts to finalize (RLS denial surfaces, not silent ok)", async () => {
    const assessorA = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    const adminB = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    users.push(assessorA.id, subject.id, adminB.id);

    const assessmentId = await seedAssessmentWith({
      assessorId: assessorA.id,
      subjectId: subject.id,
      clubId: clubA,
      minimal: true,
    });

    const session = await signIn(adminB);
    ctxHolder.ctx = {
      userId: adminB.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubB],
      email: adminB.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await finalizeAssessment({ assessment_id: assessmentId });
    expect(result.kind).not.toBe("ok");
    expect(result.kind).not.toBe("no_deliveries");

    const { data: row } = await admin()
      .from("t20_assessments")
      .select("status")
      .eq("id", assessmentId)
      .single();
    expect(row?.status).toBe("draft");
  });
});
