import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  cleanup,
  createTestUser,
  seedClub,
  signIn,
} from "../rls/helpers";

// Stable test data shared across cases — the RPC's COALESCE on
// novice_registered_at preserves the first-completion date, so this batch
// of tests reuses one user across cases that need to assert idempotency.
const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

const VALID_PAYLOAD = {
  p_first_name: "Lerato",
  p_last_name: "Ndlovu",
  p_display_name: "Lerato N",
  p_gender: "female" as const,
  p_date_of_birth: "1990-05-15",
  p_bsa_number: "BS-12345",
  p_dominant_hand: "right" as const,
  p_phone: "+27 82 123 4567",
  p_email_opt_in: true,
  p_club_grading: "lead" as const,
  p_terms_version: "1.0",
  p_privacy_version: "1.0",
  p_marketing_version: "1.0",
};

describe("RPC · complete_player_profile", () => {
  let clubId: string;

  beforeAll(async () => {
    clubId = await seedClub("complete-player-profile rpc test");
    clubs.push(clubId);
  });

  it("flips profile_completed, sets novice_registered_at, writes club_grading on the primary membership, and inserts terms+privacy+marketing consents", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(player.id);
    // createTestUser doesn't mark the membership primary; promote it so the
    // RPC's UPDATE matches a row.
    const a = admin();
    await a
      .from("club_memberships")
      .update({ is_primary: true })
      .eq("profile_id", player.id)
      .eq("club_id", clubId);
    const session = await signIn(player);

    const { error } = await session.client.rpc(
      "complete_player_profile",
      VALID_PAYLOAD,
    );
    expect(error).toBeNull();

    const { data: profile } = await a
      .from("profiles")
      .select(
        "first_name, last_name, display_name, gender, date_of_birth, bsa_number, dominant_hand, phone, email_opt_in, profile_completed, novice_registered_at",
      )
      .eq("id", player.id)
      .single();
    expect(profile?.profile_completed).toBe(true);
    expect(profile?.novice_registered_at).toBeTruthy();
    expect(profile?.first_name).toBe("Lerato");
    expect(profile?.last_name).toBe("Ndlovu");
    expect(profile?.display_name).toBe("Lerato N");
    expect(profile?.gender).toBe("female");
    expect(profile?.date_of_birth).toBe("1990-05-15");
    expect(profile?.bsa_number).toBe("BS-12345");
    expect(profile?.dominant_hand).toBe("right");
    expect(profile?.phone).toBe("+27 82 123 4567");
    expect(profile?.email_opt_in).toBe(true);

    const { data: membership } = await a
      .from("club_memberships")
      .select("club_grading, is_primary")
      .eq("profile_id", player.id)
      .eq("club_id", clubId)
      .single();
    expect(membership?.club_grading).toBe("lead");
    expect(membership?.is_primary).toBe(true);

    const { data: consents } = await a
      .from("consents")
      .select("kind, version, accepted")
      .eq("profile_id", player.id);
    expect(consents).toHaveLength(3);
    const byKind = Object.fromEntries((consents ?? []).map((c) => [c.kind, c]));
    expect(byKind.terms?.accepted).toBe(true);
    expect(byKind.privacy?.accepted).toBe(true);
    expect(byKind.marketing?.accepted).toBe(true);
    expect(byKind.terms?.version).toBe("1.0");
    expect(byKind.privacy?.version).toBe("1.0");
    expect(byKind.marketing?.version).toBe("1.0");
  });

  it("is idempotent — calling twice with the same versions doesn't error or duplicate consents, and preserves the original novice_registered_at", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(player.id);
    const a = admin();
    await a
      .from("club_memberships")
      .update({ is_primary: true })
      .eq("profile_id", player.id)
      .eq("club_id", clubId);
    const session = await signIn(player);

    const first = await session.client.rpc("complete_player_profile", VALID_PAYLOAD);
    expect(first.error).toBeNull();
    const { data: afterFirst } = await a
      .from("profiles")
      .select("novice_registered_at")
      .eq("id", player.id)
      .single();
    const initialNovice = afterFirst?.novice_registered_at;
    expect(initialNovice).toBeTruthy();

    const second = await session.client.rpc("complete_player_profile", VALID_PAYLOAD);
    expect(second.error).toBeNull();

    const { data: afterSecond } = await a
      .from("profiles")
      .select("novice_registered_at")
      .eq("id", player.id)
      .single();
    expect(afterSecond?.novice_registered_at).toBe(initialNovice);

    const { data: consents } = await a
      .from("consents")
      .select("kind, version")
      .eq("profile_id", player.id);
    expect(consents).toHaveLength(3);
  });

  it("records marketing_accepted=false when the player opts out", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(player.id);
    const a = admin();
    await a
      .from("club_memberships")
      .update({ is_primary: true })
      .eq("profile_id", player.id)
      .eq("club_id", clubId);
    const session = await signIn(player);

    const { error } = await session.client.rpc("complete_player_profile", {
      ...VALID_PAYLOAD,
      p_email_opt_in: false,
    });
    expect(error).toBeNull();

    const { data: profile } = await a
      .from("profiles")
      .select("email_opt_in")
      .eq("id", player.id)
      .single();
    expect(profile?.email_opt_in).toBe(false);

    const { data: marketing } = await a
      .from("consents")
      .select("accepted")
      .eq("profile_id", player.id)
      .eq("kind", "marketing")
      .single();
    expect(marketing?.accepted).toBe(false);
  });

  it("succeeds when the caller has no primary membership — the membership UPDATE is a harmless no-op", async () => {
    // No clubIds → no club_memberships row exists at all. The RPC's UPDATE
    // matches 0 rows but doesn't error. profile_completed still flips, and
    // consents still write — the only consequence is club_grading goes
    // unset (which is correct: there's no membership to grade).
    const player = await createTestUser({ role: "player" });
    users.push(player.id);
    const session = await signIn(player);

    const { error } = await session.client.rpc("complete_player_profile", VALID_PAYLOAD);
    expect(error).toBeNull();

    const a = admin();
    const { data: profile } = await a
      .from("profiles")
      .select("profile_completed, novice_registered_at")
      .eq("id", player.id)
      .single();
    expect(profile?.profile_completed).toBe(true);
    expect(profile?.novice_registered_at).toBeTruthy();

    const { data: memberships } = await a
      .from("club_memberships")
      .select("id")
      .eq("profile_id", player.id);
    expect(memberships).toEqual([]);
  });

  it("re-prompts on a new privacy version — new version writes a second consents row, idempotent on (profile, kind, version)", async () => {
    const player = await createTestUser({ role: "player", clubIds: [clubId] });
    users.push(player.id);
    const a = admin();
    await a
      .from("club_memberships")
      .update({ is_primary: true })
      .eq("profile_id", player.id)
      .eq("club_id", clubId);
    const session = await signIn(player);

    const v1 = await session.client.rpc("complete_player_profile", VALID_PAYLOAD);
    expect(v1.error).toBeNull();

    const v2 = await session.client.rpc("complete_player_profile", {
      ...VALID_PAYLOAD,
      p_privacy_version: "2.0",
    });
    expect(v2.error).toBeNull();

    const { data: privacyConsents } = await a
      .from("consents")
      .select("version")
      .eq("profile_id", player.id)
      .eq("kind", "privacy");
    const versions = (privacyConsents ?? []).map((c) => c.version).sort();
    expect(versions).toEqual(["1.0", "2.0"]);
  });
});
