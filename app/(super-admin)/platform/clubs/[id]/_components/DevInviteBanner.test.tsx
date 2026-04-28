import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEV_INVITE_BANNER_KEY, DEV_INVITE_TTL_MS } from "@/lib/dev-banner";
import { DevInviteBanner } from "./DevInviteBanner";

const CLUB_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CLUB_ID = "33333333-3333-4333-8333-333333333333";

function writePayload(overrides: Partial<{
  clubId: string;
  inviteToken: string;
  expiresAt: number;
}> = {}) {
  const payload = {
    clubId: CLUB_ID,
    inviteToken: "tok-123",
    expiresAt: Date.now() + DEV_INVITE_TTL_MS,
    ...overrides,
  };
  window.sessionStorage.setItem(DEV_INVITE_BANNER_KEY, JSON.stringify(payload));
}

describe("DevInviteBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("renders nothing when no payload is stored", () => {
    render(<DevInviteBanner clubId={CLUB_ID} />);
    expect(screen.queryByTestId("dev-invite-banner")).toBeNull();
  });

  it("renders the banner with an invite URL when a matching payload is stored", () => {
    writePayload();
    render(<DevInviteBanner clubId={CLUB_ID} />);
    const banner = screen.getByTestId("dev-invite-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId("dev-invite-banner-url").textContent).toContain(
      "/invite/tok-123",
    );
  });

  it("does not render when the payload clubId does not match", () => {
    writePayload();
    render(<DevInviteBanner clubId={OTHER_CLUB_ID} />);
    expect(screen.queryByTestId("dev-invite-banner")).toBeNull();
  });

  it("does not render when the payload has expired, and clears storage", () => {
    writePayload({ expiresAt: Date.now() - 1000 });
    render(<DevInviteBanner clubId={CLUB_ID} />);
    expect(screen.queryByTestId("dev-invite-banner")).toBeNull();
    expect(window.sessionStorage.getItem(DEV_INVITE_BANNER_KEY)).toBeNull();
  });

  it("dismiss removes the banner and clears storage", () => {
    writePayload();
    render(<DevInviteBanner clubId={CLUB_ID} />);
    expect(screen.getByTestId("dev-invite-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dev-invite-banner-dismiss"));
    expect(screen.queryByTestId("dev-invite-banner")).toBeNull();
    expect(window.sessionStorage.getItem(DEV_INVITE_BANNER_KEY)).toBeNull();
  });
});
