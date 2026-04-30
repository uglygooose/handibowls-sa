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
        profileId={null}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    expect(
      container.querySelector("[data-slot='notifications-bell']"),
    ).toBeNull();
  });

  it("renders the bell button when profileId is non-null", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
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
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    expect(container.querySelector("[data-slot='bell-dropdown']")).toBeNull();
  });

  it("clicking the bell opens the dropdown", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='bell-dropdown']"),
    ).not.toBeNull();
  });

  it("renders the empty state when recent is empty + dropdown is open", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='bell-empty']")).not.toBeNull();
  });

  it("renders one row per recent notification with unread state attribute", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD, READ] });
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD, READ]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    const rows = container.querySelectorAll("[data-slot='bell-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-unread")).toBe("true");
    expect(rows[1].getAttribute("data-unread")).toBe("false");
  });

  it("View all link points at /me/inbox", () => {
    setRealtime({ unreadCount: 0, recent: [] });
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={0}
        initialRecent={[]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='bell-view-all']")?.getAttribute("href"),
    ).toBe("/me/inbox");
  });
});

describe("<NotificationsBell /> — row interactions", () => {
  it("tapping a row calls markAsRead with the row's id and navigates", () => {
    setRealtime({ unreadCount: 1, recent: [UNREAD] });
    const { container } = render(
      <NotificationsBell
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-row']") as HTMLButtonElement,
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
        profileId={PROFILE}
        initialUnreadCount={1}
        initialRecent={[UNREAD]}
      />,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-button']") as HTMLButtonElement,
    );
    fireEvent.click(
      container.querySelector("[data-slot='bell-row']") as HTMLButtonElement,
    );
    expect(container.querySelector("[data-slot='bell-dropdown']")).toBeNull();
  });
});
