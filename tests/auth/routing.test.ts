import { describe, it, expect } from "vitest";

import {
  decideRedirect,
  homeFor,
  isPublicPath,
  pathKind,
  roleCanAccess,
  type UserRole,
} from "@/lib/auth/routing";

describe("homeFor", () => {
  it("super_admin → /platform/clubs", () => {
    expect(homeFor("super_admin")).toBe("/platform/clubs");
  });
  it("club_admin → /manage/overview", () => {
    expect(homeFor("club_admin")).toBe("/manage/overview");
  });
  it("player → /play", () => {
    expect(homeFor("player")).toBe("/play");
  });
});

describe("isPublicPath", () => {
  it.each([
    "/",
    "/login",
    "/login?next=%2Fplay",
    "/signup",
    "/invite/abc123",
    "/auth/callback",
    "/api/auth/callback",
    "/design",
    "/design/bowls",
    "/payments",
    "/payments/peach",
    // Phase 11 / 11-1c — POPIA unsubscribe (HMAC token IS the auth).
    "/email/unsubscribe",
    // Phase 13 / 13-6 — public legal/privacy + help surfaces. Regression
    // pinned 2026-05-04 after the operator's first preview deploy showed
    // /privacy redirecting to /login?next=%2Fprivacy.
    "/privacy",
    "/terms",
    "/help",
    "/help/creating-a-tournament",
    "/help/scoring-a-match",
    "/help/booking-a-rink",
    "/help/twenty-20-walkthrough",
  ])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/play", "/manage/overview", "/platform/clubs", "/me", "/book"])(
    "%s is not public",
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    },
  );
});

describe("pathKind", () => {
  it("classifies platform paths", () => {
    expect(pathKind("/platform")).toBe("platform");
    expect(pathKind("/platform/clubs")).toBe("platform");
    expect(pathKind("/platform/clubs/new")).toBe("platform");
  });
  it("classifies manage paths", () => {
    expect(pathKind("/manage/overview")).toBe("manage");
    expect(pathKind("/manage/members")).toBe("manage");
  });
  it("classifies player paths", () => {
    expect(pathKind("/play")).toBe("player");
    expect(pathKind("/book")).toBe("player");
    expect(pathKind("/tournaments")).toBe("player");
    expect(pathKind("/tournaments/abc-123")).toBe("player");
    expect(pathKind("/t20")).toBe("player");
    expect(pathKind("/me")).toBe("player");
    expect(pathKind("/me/setup")).toBe("player");
  });
  it("returns null for unknown paths", () => {
    expect(pathKind("/foo")).toBeNull();
    expect(pathKind("/admin")).toBeNull();
  });
});

describe("roleCanAccess", () => {
  const matrix: Array<[UserRole, "platform" | "manage" | "player", boolean]> = [
    ["super_admin", "platform", true],
    ["club_admin", "platform", false],
    ["player", "platform", false],
    ["super_admin", "manage", true],
    ["club_admin", "manage", true],
    ["player", "manage", false],
    ["super_admin", "player", true],
    ["club_admin", "player", true],
    ["player", "player", true],
  ];
  it.each(matrix)("%s → %s = %s", (role, kind, allowed) => {
    expect(roleCanAccess(role, kind)).toBe(allowed);
  });
});

describe("decideRedirect", () => {
  it("passes public paths through for anonymous users", () => {
    expect(decideRedirect("/", null)).toBeNull();
    expect(decideRedirect("/login", null)).toBeNull();
    expect(decideRedirect("/signup", null)).toBeNull();
    expect(decideRedirect("/invite/xyz", null)).toBeNull();
    expect(decideRedirect("/payments", null)).toBeNull();
  });

  it("passes /privacy + /terms + /help through for anonymous users (regression — Phase 13 / 13-6)", () => {
    // Pre-fix: these routes shipped at 13-6 Batch A (cc21ddf — privacy/terms)
    // and Batch B (59d1604 — help) under app/(public)/ but were never added
    // to isPublicPath, so the proxy bounced anonymous visitors to /login?next=
    // — broken since the day they shipped, surfaced when the operator first
    // browsed them on a preview deploy at 13-7.
    expect(decideRedirect("/privacy", null)).toBeNull();
    expect(decideRedirect("/terms", null)).toBeNull();
    expect(decideRedirect("/help", null)).toBeNull();
    expect(decideRedirect("/help/creating-a-tournament", null)).toBeNull();
  });

  it("passes /privacy + /terms + /help through for logged-in users", () => {
    // Authenticated users navigating from the footer or signup agree-link
    // also need these surfaces to land cleanly — the public-path branch in
    // decideRedirect short-circuits BEFORE the role-based gating logic, so
    // any role hitting these routes should pass through.
    for (const role of ["player", "club_admin", "super_admin"] as const) {
      expect(decideRedirect("/privacy", { role })).toBeNull();
      expect(decideRedirect("/terms", { role })).toBeNull();
      expect(decideRedirect("/help", { role })).toBeNull();
      expect(decideRedirect("/help/booking-a-rink", { role })).toBeNull();
    }
  });

  it("passes /payments through for logged-in users (regression — Finding 7)", () => {
    // Pre-fix: /payments matched no public rule, fell through to the
    // "unknown private path" branch and bounced to homeFor(role). Now
    // explicitly public, so admins clicking through from the new-tournament
    // entry-fee link don't get yanked back to /manage/overview.
    expect(decideRedirect("/payments", { role: "club_admin" })).toBeNull();
    expect(decideRedirect("/payments", { role: "super_admin" })).toBeNull();
    expect(decideRedirect("/payments", { role: "player" })).toBeNull();
  });

  it("bounces authenticated users away from /login + /signup", () => {
    expect(decideRedirect("/login", { role: "player" })).toBe("/play");
    expect(decideRedirect("/signup", { role: "club_admin" })).toBe(
      "/manage/overview",
    );
    expect(decideRedirect("/login", { role: "super_admin" })).toBe(
      "/platform/clubs",
    );
  });

  it("redirects anon users on private paths to /login", () => {
    expect(decideRedirect("/play", null)).toBe("/login");
    expect(decideRedirect("/manage/overview", null)).toBe("/login");
    expect(decideRedirect("/platform/clubs", null)).toBe("/login");
  });

  it("allows role-appropriate access", () => {
    expect(decideRedirect("/play", { role: "player" })).toBeNull();
    expect(decideRedirect("/manage/overview", { role: "club_admin" })).toBeNull();
    expect(decideRedirect("/manage/overview", { role: "super_admin" })).toBeNull();
    expect(decideRedirect("/platform/clubs", { role: "super_admin" })).toBeNull();
  });

  it("redirects wrong-prefix to role home", () => {
    // Player hitting manage → home
    expect(decideRedirect("/manage/overview", { role: "player" })).toBe("/play");
    // Player hitting platform → home
    expect(decideRedirect("/platform/clubs", { role: "player" })).toBe("/play");
    // Club admin hitting platform → home
    expect(decideRedirect("/platform/clubs", { role: "club_admin" })).toBe(
      "/manage/overview",
    );
  });

  it("redirects unknown private paths to role home", () => {
    expect(decideRedirect("/foo", { role: "player" })).toBe("/play");
    expect(decideRedirect("/admin", { role: "super_admin" })).toBe(
      "/platform/clubs",
    );
  });

  it("does not redirect known player paths for non-player roles", () => {
    // Admins are allowed to walk the player surface.
    expect(decideRedirect("/play", { role: "club_admin" })).toBeNull();
    expect(decideRedirect("/play", { role: "super_admin" })).toBeNull();
  });
});
