import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const mockMarkAsRead = vi.fn();
const mockUseRealtime = vi.fn();
vi.mock("@/lib/notifications/use-realtime", () => ({
  useNotificationsRealtime: (args: unknown) => mockUseRealtime(args),
}));

const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

import { NotificationsBell } from "@/components/nav/NotificationsBell";
import type { RecentNotification } from "@/lib/notifications/types";

const PROFILE = "00000000-0000-4000-8000-000000000001";

const UNREAD: RecentNotification = {
  id: "00000000-0000-4000-8000-0000000000aa",
  kind: "broadcast",
  title: "Practice tomorrow",
  body: "17:00 sharp.",
  related_kind: "message",
  related_id: "00000000-0000-4000-8000-0000000000bb",
  read: false,
  read_at: null,
  created_at: new Date().toISOString(),
};

const READ: RecentNotification = {
  ...UNREAD,
  id: "00000000-0000-4000-8000-0000000000ab",
  title: "Booking confirmed",
  read: true,
  read_at: new Date().toISOString(),
};

afterEach(() => {
  mockMarkAsRead.mockReset();
  mockUseRealtime.mockReset();
  routerPushMock.mockReset();
});

function setRealtime(args: {
  unreadCount: number;
  recent: RecentNotification[];
}) {
  mockUseRealtime.mockReturnValue({
    unreadCount: args.unreadCount,
    recent: args.recent,
    markAsRead: mockMarkAsRead,
  });
}

describe("<NotificationsBell /> — render gating", () => {
  it("renders nothing when profileId is null", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={null}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    // Phase 13 / 13-1 / commit 8a: was asserting absence of the
    // `notifications-bell` wrapper div. The wrapper was dropped during the
    // shadcn-Popover refactor (Popover root has no DOM node). Equivalent
    // contract: when profileId is null the bell button does not render.
    expect(
      container.querySelector("[data-slot='bell-button']"),
    ).toBeNull();
  });

  it("renders the bell button when profileId is non-null", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    expect(
      container.querySelector("[data-slot='bell-button']"),
    ).not.toBeNull();
  });
});

describe("<NotificationsBell /> — unread badge", () => {
  it("does not render the badge when unread count is 0", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    expect(container.querySelector("[data-slot='bell-badge']")).toBeNull();
  });

  it("renders the numeric badge when unread > 0", () => {
    setRealtime({ unreadCount: 3, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={3}
        initialRecent={[UNREAD]}
      />,
    );
    const badge = container.querySelector("[data-slot='bell-badge']");
    expect(badge?.textContent).toBe("3");
    expect(badge?.getAttribute("data-count")).toBe("3");
  });

  it("caps the badge label at '99+' when unread > 99", () => {
    setRealtime({ unreadCount: 142, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={142}
        initialRecent={[UNREAD]}
      />,
    );
    expect(
      container.querySelector("[data-slot='bell-badge']")?.textContent,
    ).toBe("99+");
  });

  it("aria-label surfaces the unread count for screen readers", () => {
    setRealtime({ unreadCount: 5, recent: [UNREAD] });
    render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={5}
        initialRecent={[UNREAD]}
      />,
    );
    const button = screen.getByRole("button", { name: /5 unread/i });
    expect(button).not.toBeNull();
  });
});

describe("<NotificationsBell /> — dropdown", () => {
  it("dropdown is closed by default", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    expect(document.querySelector("[data-slot='bell-dropdown']")).toBeNull();
  });

  it("clicking the bell opens the dropdown", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='bell-dropdown']"),
    ).not.toBeNull();
  });

  it("renders the empty state when recent is empty + dropdown is open", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='bell-empty']")).not.toBeNull();
  });

  it("renders one row per recent notification with unread state attribute", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD, READ] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD, READ]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    const rows = document.querySelectorAll("[data-slot='bell-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-unread")).toBe("true");
    expect(rows[1].getAttribute("data-unread")).toBe("false");
  });

  it("View all link points at /me/inbox", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(
      document.querySelector("[data-slot='bell-view-all']")?.getAttribute("href"),
    ).toBe("/me/inbox");
  });
});

describe("<NotificationsBell /> — row interactions", () => {
  it("tapping a row calls markAsRead with the row's id and navigates", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='bell-row']") as HTMLButtonElement,
    );
    expect(mockMarkAsRead).toHaveBeenCalledWith(UNREAD.id);
    expect(routerPushMock).toHaveBeenCalled();
    // related_kind='message' routes to /me/inbox?tab=messages.
    expect(routerPushMock).toHaveBeenCalledWith("/me/inbox?tab=messages");
  });

  it("dropdown closes after a row tap", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        role="player"
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    fireEvent.click(
      document.querySelector("[data-slot='bell-row']") as HTMLButtonElement,
    );
    expect(document.querySelector("[data-slot='bell-dropdown']")).toBeNull();
  });
});

// Phase 12 / 12-3 / B2+B3+B4 — role-branched routing helpers.
//
// Pure logic: given a role + a notification's related_kind/_id, the
// helper returns the correct href. Mirrored from the in-file comment
// matrix; if the matrix changes the test stays in lockstep.

import {
  resolveRelatedHref,
  viewAllHref,
} from "@/components/nav/NotificationsBell";

function notif(over: Partial<RecentNotification>): RecentNotification {
  return {
    id: "n-1",
    kind: "trophy",
    title: "T",
    body: null,
    related_kind: null,
    related_id: null,
    read: false,
    read_at: null,
    created_at: "2026-04-30T10:00:00Z",
    ...over,
  };
}

describe("resolveRelatedHref — player role", () => {
  it("no related_kind → /me/inbox", () => {
    expect(resolveRelatedHref("player", notif({}))).toBe("/me/inbox");
  });
  it("related_kind='message' → /me/inbox?tab=messages", () => {
    expect(
      resolveRelatedHref("player", notif({ related_kind: "message", related_id: "m-1" })),
    ).toBe("/me/inbox?tab=messages");
  });
  it("related_kind='booking' → /book", () => {
    expect(
      resolveRelatedHref("player", notif({ related_kind: "booking", related_id: "b-1" })),
    ).toBe("/book");
  });
  it("related_kind='t20_assessment' → /t20 (12-3 / B4 — migration 040)", () => {
    expect(
      resolveRelatedHref(
        "player",
        notif({ related_kind: "t20_assessment", related_id: "b-1" }),
      ),
    ).toBe("/t20");
  });
  it("related_kind='match' → /tournaments", () => {
    expect(
      resolveRelatedHref("player", notif({ related_kind: "match", related_id: "m-1" })),
    ).toBe("/tournaments");
  });
  it("related_kind='tournament' with id → /tournaments/{id}", () => {
    expect(
      resolveRelatedHref(
        "player",
        notif({ related_kind: "tournament", related_id: "t-9" }),
      ),
    ).toBe("/tournaments/t-9");
  });
});

describe("resolveRelatedHref — club_admin role", () => {
  it("no related_kind → /manage/messages?tab=inbox", () => {
    expect(resolveRelatedHref("club_admin", notif({}))).toBe(
      "/manage/messages?tab=inbox",
    );
  });
  it("related_kind='message' with id → /manage/messages?tab=inbox#message-{id} (12-3 / B3)", () => {
    expect(
      resolveRelatedHref(
        "club_admin",
        notif({ related_kind: "message", related_id: "m-1" }),
      ),
    ).toBe("/manage/messages?tab=inbox#message-m-1");
  });
  it("related_kind='booking' → /manage/overview", () => {
    expect(
      resolveRelatedHref(
        "club_admin",
        notif({ related_kind: "booking", related_id: "b-1" }),
      ),
    ).toBe("/manage/overview");
  });
  it("related_kind='t20_assessment' → /manage/overview", () => {
    expect(
      resolveRelatedHref(
        "club_admin",
        notif({ related_kind: "t20_assessment", related_id: "b-1" }),
      ),
    ).toBe("/manage/overview");
  });
  it("related_kind='tournament' with id → /manage/tournaments/{id}", () => {
    expect(
      resolveRelatedHref(
        "club_admin",
        notif({ related_kind: "tournament", related_id: "t-9" }),
      ),
    ).toBe("/manage/tournaments/t-9");
  });
  it("related_kind='match' → /manage/tournaments", () => {
    expect(
      resolveRelatedHref(
        "club_admin",
        notif({ related_kind: "match", related_id: "m-1" }),
      ),
    ).toBe("/manage/tournaments");
  });
});

describe("viewAllHref", () => {
  it("player → /me/inbox", () => {
    expect(viewAllHref("player")).toBe("/me/inbox");
  });
  it("club_admin → /manage/messages?tab=inbox", () => {
    expect(viewAllHref("club_admin")).toBe("/manage/messages?tab=inbox");
  });
});
