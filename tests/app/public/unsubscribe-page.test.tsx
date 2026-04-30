import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

// Mock the redirect — the page doesn't redirect on initial load,
// only inside the inline Server Action which we don't exercise
// from this RSC-render-only suite. Stub anyway so any accidental
// call is observable in test failures rather than thrown.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`unexpected redirect: ${url}`);
  },
}));

// Service-role client mock — controls what the page sees when it
// looks up the profile + club after verifying a token.
const mockProfileMaybe = vi.fn();
const mockClubMaybe = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle:
            table === "profiles" ? mockProfileMaybe : mockClubMaybe,
        }),
      }),
    }),
  }),
}));

// Action mock — the page imports unsubscribeFromEmails for its
// inline form action; mock it so accidental invocation in this RSC
// render-only test is detectable.
vi.mock("@/lib/email/actions", () => ({
  unsubscribeFromEmails: vi.fn(),
}));

import UnsubscribePage from "@/app/(public)/email/unsubscribe/page";
import { generateUnsubscribeToken } from "@/lib/email/unsubscribe";

const PROFILE_A = "00000000-0000-0000-0000-0000000000aa";
const CLUB_A = "00000000-0000-0000-0000-000000000c1c";

beforeAll(() => {
  process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

afterEach(() => {
  mockProfileMaybe.mockReset();
  mockClubMaybe.mockReset();
});

async function renderPage(searchParams: Record<string, string>) {
  // Server Components return JSX synchronously after awaiting their
  // async params. We render the resolved tree via testing-library.
  const tree = await UnsubscribePage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(tree as React.ReactElement);
}

describe("UnsubscribePage — initial load", () => {
  it("renders the consent form when token is valid + profile is opted-in", async () => {
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      clubId: CLUB_A,
    });
    mockProfileMaybe.mockResolvedValueOnce({
      data: { email: "james@example.com", email_opt_in: true },
      error: null,
    });
    mockClubMaybe.mockResolvedValueOnce({
      data: { name: "Demo Bowls Club" },
      error: null,
    });

    const { container } = await renderPage({ t: token });
    expect(container.textContent).toContain("Unsubscribe?");
    expect(container.textContent).toContain("james@example.com");
    expect(container.textContent).toContain("Demo Bowls Club");
    expect(
      container.querySelector("[data-slot='unsubscribe-submit']"),
    ).not.toBeNull();
  });

  it("shows the already-unsubscribed success state when profile is opted-out", async () => {
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      clubId: CLUB_A,
    });
    mockProfileMaybe.mockResolvedValueOnce({
      data: { email: "james@example.com", email_opt_in: false },
      error: null,
    });
    mockClubMaybe.mockResolvedValueOnce({
      data: { name: "Demo Bowls Club" },
      error: null,
    });

    const { container } = await renderPage({ t: token });
    expect(container.textContent).toContain("Already unsubscribed");
  });

  it("renders a generic invalid-link state for a malformed token", async () => {
    const { container } = await renderPage({ t: "not-a-real-token" });
    expect(container.textContent).toContain("Link expired or invalid");
    // Generic phrasing — must NOT leak which specific failure occurred.
    expect(container.textContent?.toLowerCase()).not.toContain("forged");
    expect(container.textContent?.toLowerCase()).not.toContain("tampered");
    expect(container.textContent?.toLowerCase()).not.toContain("expired token");
  });

  it("renders the invalid-link state when the profile no longer exists", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockProfileMaybe.mockResolvedValueOnce({ data: null, error: null });

    const { container } = await renderPage({ t: token });
    expect(container.textContent).toContain("Link expired or invalid");
  });
});

describe("UnsubscribePage — post-action status branches", () => {
  it("status=ok renders the unsubscribed success card", async () => {
    const { container } = await renderPage({ status: "ok" });
    expect(container.textContent).toContain("unsubscribed");
    expect(container.textContent).not.toContain("Already unsubscribed");
  });

  it("status=already renders the already-unsubscribed success card", async () => {
    const { container } = await renderPage({ status: "already" });
    expect(container.textContent).toContain("Already unsubscribed");
  });

  it("status=error renders the error state", async () => {
    const { container } = await renderPage({ status: "error" });
    expect(container.textContent).toContain("Something went wrong");
  });
});

// Vitest-style imports for beforeAll/afterEach — declared at file
// top in TS via a single import statement. (Vitest exposes them
// globally too, but explicit imports keep snapshot stability.)
import { afterEach, beforeAll } from "vitest";
import type React from "react";
