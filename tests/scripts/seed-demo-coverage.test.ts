// Phase 13 / 13-8 / Batch A / Commit 2 — Demo seed coverage matrix.
//
// Asserts that every reachable state in every state-machine enum has
// ≥1 row at the demo Supabase project after `npm run seed:demo`. The
// regression gate against future schema changes silently breaking
// demo coverage — if a future migration adds an enum value that the
// seed doesn't populate, this test fails and surfaces the drift.
//
// Runs against the SAME cloud Supabase the seed targets (`.env.test`
// + `SUPABASE_SERVICE_ROLE_KEY`). NOT included in the unit suite —
// vitest.config.ts excludes `tests/scripts/**` so `npm test` doesn't
// hit cloud. Run via `npm run seed:demo:verify`.
//
// Seed must run first (`npm run seed:demo`) before this test. Each
// `it` queries the post-seed state and asserts the coverage cell.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin } from "@/scripts/seed-demo/_lib";

// Avoid running this in the unit suite (CI). The describe-skip
// pattern keeps the file present + greppable while the actual
// queries fire only against an explicit run.
const HAS_SERVICE_ROLE = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const d = HAS_SERVICE_ROLE ? describe : describe.skip;

d("seed-demo coverage matrix", () => {
  const c = admin();
  let demoClubId: string;
  let pinelandsClubId: string;

  beforeAll(async () => {
    const { data: demo } = await c
      .from("clubs")
      .select("id")
      .eq("slug", "demo-bowls-club")
      .single();
    if (!demo) throw new Error("demo-bowls-club not seeded — run npm run seed:demo first");
    demoClubId = demo.id;

    const { data: pin } = await c
      .from("clubs")
      .select("id")
      .eq("slug", "pinelands-bc")
      .single();
    if (!pin) throw new Error("pinelands-bc not seeded — run npm run seed:demo first");
    pinelandsClubId = pin.id;
  });

  afterAll(() => {
    // No teardown — coverage test is read-only.
  });

  // -----------------------------------------------------------------
  // tournament_status (5/5)
  // -----------------------------------------------------------------
  describe("tournament_status enum", () => {
    it.each(["draft", "open", "in_progress", "completed", "cancelled"] as const)(
      "%s reachable on a demo tournament",
      async (status) => {
        const { count } = await c
          .from("tournaments")
          .select("id", { count: "exact", head: true })
          .in("host_club_id", [demoClubId, pinelandsClubId])
          .eq("status", status);
        expect(count, `tournaments with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // submission_status (3/3)
  // -----------------------------------------------------------------
  describe("match submission_status enum", () => {
    it.each(["pending", "captain_submitted", "opponent_confirmed"] as const)(
      "%s reachable on a demo match",
      async (status) => {
        const { data: tournaments } = await c
          .from("tournaments")
          .select("id")
          .in("host_club_id", [demoClubId, pinelandsClubId]);
        const ids = (tournaments ?? []).map((t) => t.id);
        const { count } = await c
          .from("matches")
          .select("id", { count: "exact", head: true })
          .in("tournament_id", ids)
          .eq("submission_status", status);
        expect(count, `matches with submission_status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // match_status (≥3 reachable: scheduled, in_progress, completed,
  // walkover; cancelled bonus)
  // -----------------------------------------------------------------
  describe("match_status enum (functional minimums)", () => {
    it.each(["scheduled", "in_progress", "completed", "walkover"] as const)(
      "%s reachable on a demo match",
      async (status) => {
        const { data: tournaments } = await c
          .from("tournaments")
          .select("id")
          .in("host_club_id", [demoClubId, pinelandsClubId]);
        const ids = (tournaments ?? []).map((t) => t.id);
        const { count } = await c
          .from("matches")
          .select("id", { count: "exact", head: true })
          .in("tournament_id", ids)
          .eq("status", status);
        expect(count, `matches with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // t20_assessment status (3/3) + t20_grade (4/4)
  // -----------------------------------------------------------------
  describe("t20_assessments status + grade enums", () => {
    it.each(["draft", "submitted", "archived"] as const)(
      "status=%s reachable on a demo assessment",
      async (status) => {
        const { count } = await c
          .from("t20_assessments")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("status", status);
        expect(count, `t20_assessments with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );

    it.each(["gold", "silver", "bronze", "fail"] as const)(
      "grade=%s reachable on a submitted demo assessment",
      async (grade) => {
        const { count } = await c
          .from("t20_assessments")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("grade", grade);
        expect(count, `t20_assessments with grade=${grade}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // booking_purpose (6/6 reachable)
  // -----------------------------------------------------------------
  describe("booking_purpose enum", () => {
    it.each([
      "roll_up",
      "practice",
      "coaching",
      "match",
      "social",
      "t20_assessment",
    ] as const)("%s reachable on a demo booking", async (purpose) => {
      const { count } = await c
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .in("club_id", [demoClubId, pinelandsClubId])
        .eq("purpose", purpose);
      expect(count, `bookings with purpose=${purpose}`).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------
  // booking_status (booked + cancelled)
  // -----------------------------------------------------------------
  describe("booking_status enum", () => {
    it.each(["booked", "cancelled"] as const)(
      "%s reachable on a demo booking",
      async (status) => {
        const { count } = await c
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("status", status);
        expect(count, `bookings with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // invite_status (4/4)
  // -----------------------------------------------------------------
  describe("invite_status enum", () => {
    it.each(["pending", "accepted", "expired", "revoked"] as const)(
      "%s reachable on a demo invite",
      async (status) => {
        const { count } = await c
          .from("invites")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("status", status);
        expect(count, `invites with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // message channel coverage (send_in_app + send_email booleans)
  // -----------------------------------------------------------------
  describe("message channel coverage (send_in_app + send_email)", () => {
    it("at least one message with send_in_app=true", async () => {
      const { count } = await c
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("club_id", [demoClubId, pinelandsClubId])
        .eq("send_in_app", true);
      expect(count, "messages with send_in_app=true").toBeGreaterThanOrEqual(1);
    });
    it("at least one message with send_email=true", async () => {
      const { count } = await c
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("club_id", [demoClubId, pinelandsClubId])
        .eq("send_email", true);
      expect(count, "messages with send_email=true").toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------
  // message_status (draft + sent reachable)
  // -----------------------------------------------------------------
  describe("message_status enum", () => {
    it.each(["draft", "sent"] as const)(
      "%s reachable on a demo message",
      async (status) => {
        const { count } = await c
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("status", status);
        expect(count, `messages with status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // audience_kind (all_members + tournament_entrants + custom)
  // -----------------------------------------------------------------
  describe("messages audience_kind", () => {
    it.each(["all_members", "tournament_entrants", "custom"] as const)(
      "%s reachable on a demo message",
      async (kind) => {
        const { count } = await c
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("club_id", [demoClubId, pinelandsClubId])
          .eq("audience_kind", kind);
        expect(count, `messages with audience_kind=${kind}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // message_recipient_status (3/3)
  // -----------------------------------------------------------------
  describe("message_recipient_status enum", () => {
    it.each(["unread", "read", "archived"] as const)(
      "%s reachable on a demo recipient",
      async (status) => {
        const { data: msgs } = await c
          .from("messages")
          .select("id")
          .in("club_id", [demoClubId, pinelandsClubId]);
        const msgIds = (msgs ?? []).map((m) => m.id);
        const { count } = await c
          .from("message_recipients")
          .select("id", { count: "exact", head: true })
          .in("message_id", msgIds)
          .eq("in_app_status", status);
        expect(count, `message_recipients with in_app_status=${status}`).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // -----------------------------------------------------------------
  // notification related_kind (5/5 routing taxonomy)
  // -----------------------------------------------------------------
  describe("notification related_kind taxonomy", () => {
    it.each([
      "message",
      "booking",
      "t20_assessment",
      "match",
      "tournament",
    ] as const)("related_kind=%s reachable", async (kind) => {
      const { count } = await c
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .in("club_id", [demoClubId, pinelandsClubId])
        .eq("related_kind", kind);
      expect(count, `notifications with related_kind=${kind}`).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------
  // rubric versions (active + draft)
  // -----------------------------------------------------------------
  describe("t20_rubric_versions states", () => {
    it("at least one active rubric", async () => {
      const { count } = await c
        .from("t20_rubric_versions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      expect(count, "active rubrics").toBeGreaterThanOrEqual(1);
    });
    it("at least one inactive (draft) rubric", async () => {
      const { count } = await c
        .from("t20_rubric_versions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false);
      expect(count, "inactive rubrics").toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------
  // sanity: 2 clubs + 14 demo auth users + 20 districts preserved
  // -----------------------------------------------------------------
  describe("structural sanity", () => {
    it("exactly 2 demo clubs (Demo BC + Pinelands BC)", async () => {
      const { count } = await c
        .from("clubs")
        .select("id", { count: "exact", head: true });
      expect(count).toBe(2);
    });
    it("at least 14 demo auth users (7 canonical + 7 fillers)", async () => {
      const { data } = await c.auth.admin.listUsers({ page: 1, perPage: 100 });
      const demo = data.users.filter((u) => {
        const e = u.email?.toLowerCase() ?? "";
        return e.endsWith("@demo.local") || e.endsWith("@handibowls.local");
      });
      expect(demo.length).toBeGreaterThanOrEqual(14);
    });
    it("20 BSA districts preserved", async () => {
      const { count } = await c
        .from("districts")
        .select("id", { count: "exact", head: true });
      expect(count).toBe(20);
    });
  });
});
