import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const mockMarkNotificationRead = vi.fn();
const mockMarkMessageRecipientRead = vi.fn();
vi.mock("@/lib/notifications/actions", () => ({
  markNotificationRead: (id: string) => mockMarkNotificationRead(id),
  markMessageRecipientRead: (id: string) => mockMarkMessageRecipientRead(id),
}));

import {
  MessagesList,
  NotificationsList,
} from "@/app/(player)/(gated)/me/inbox/_components/InboxLists";
import type {
  InboxMessage,
  InboxNotification,
} from "@/app/(player)/(gated)/me/inbox/_data";

afterEach(() => {
  mockMarkNotificationRead.mockReset();
  mockMarkMessageRecipientRead.mockReset();
});

const UNREAD_NOTIF: InboxNotification = {
  id: "00000000-0000-4000-8000-0000000000aa",
  kind: "broadcast",
  title: "Practice tomorrow",
  body: "17:00 sharp.",
  read: false,
  created_at: new Date().toISOString(),
};

const READ_NOTIF: InboxNotification = {
  ...UNREAD_NOTIF,
  id: "00000000-0000-4000-8000-0000000000ab",
  title: "Already read",
  read: true,
};

const UNREAD_MSG: InboxMessage = {
  id: "00000000-0000-4000-8000-0000000000c1",
  subject: "Tournament announcement",
  preview: "First round draws posted.",
  from_club: "Demo Bowls Club",
  in_app_status: "unread",
  channel: "in_app",
  sent_at: new Date().toISOString(),
};

const READ_MSG: InboxMessage = {
  ...UNREAD_MSG,
  id: "00000000-0000-4000-8000-0000000000c2",
  subject: "Older note",
  in_app_status: "read",
};

describe("<NotificationsList /> tap-to-mark-read", () => {
  it("renders the empty state when rows is empty", () => {
    const { container } = render(<NotificationsList rows={[]} />);
    expect(
      container.querySelector("[data-slot='inbox-notifications-empty']"),
    ).not.toBeNull();
  });

  it("renders one row per notification with unread state attribute", () => {
    const { container } = render(
      <NotificationsList rows={[UNREAD_NOTIF, READ_NOTIF]} />,
    );
    const rows = container.querySelectorAll("[data-slot='inbox-notification-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-unread")).toBe("true");
    expect(rows[1].getAttribute("data-unread")).toBe("false");
  });

  it("tap on unread row calls markNotificationRead and flips local state immediately", async () => {
    mockMarkNotificationRead.mockResolvedValueOnce({ ok: true });
    const { container } = render(
      <NotificationsList rows={[UNREAD_NOTIF]} />,
    );
    const tap = container.querySelector(
      "[data-slot='inbox-notification-tap']",
    ) as HTMLButtonElement;
    fireEvent.click(tap);

    await waitFor(() => {
      expect(mockMarkNotificationRead).toHaveBeenCalledWith(UNREAD_NOTIF.id);
    });
    // Optimistic flip — row's data-unread becomes false.
    expect(
      container
        .querySelector("[data-slot='inbox-notification-row']")
        ?.getAttribute("data-unread"),
    ).toBe("false");
  });

  it("tap on read row is a no-op (button disabled)", () => {
    const { container } = render(<NotificationsList rows={[READ_NOTIF]} />);
    const tap = container.querySelector(
      "[data-slot='inbox-notification-tap']",
    ) as HTMLButtonElement;
    expect(tap.disabled).toBe(true);
    fireEvent.click(tap);
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic flip when the action fails", async () => {
    mockMarkNotificationRead.mockResolvedValueOnce({
      ok: false,
      kind: "error",
      error: "boom",
    });
    const { container } = render(
      <NotificationsList rows={[UNREAD_NOTIF]} />,
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='inbox-notification-tap']",
      ) as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockMarkNotificationRead).toHaveBeenCalled();
    });
    // After rollback, data-unread is true again.
    await waitFor(() => {
      expect(
        container
          .querySelector("[data-slot='inbox-notification-row']")
          ?.getAttribute("data-unread"),
      ).toBe("true");
    });
  });
});

describe("<MessagesList /> tap-to-mark-read", () => {
  it("renders the empty state when rows is empty", () => {
    const { container } = render(<MessagesList rows={[]} />);
    expect(
      container.querySelector("[data-slot='inbox-messages-empty']"),
    ).not.toBeNull();
  });

  it("renders one row per message with unread state attribute", () => {
    const { container } = render(
      <MessagesList rows={[UNREAD_MSG, READ_MSG]} />,
    );
    const rows = container.querySelectorAll("[data-slot='inbox-message-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-unread")).toBe("true");
    expect(rows[1].getAttribute("data-unread")).toBe("false");
  });

  it("tap on unread message calls markMessageRecipientRead + flips local state", async () => {
    mockMarkMessageRecipientRead.mockResolvedValueOnce({ ok: true });
    const { container } = render(<MessagesList rows={[UNREAD_MSG]} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='inbox-message-tap']",
      ) as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockMarkMessageRecipientRead).toHaveBeenCalledWith(UNREAD_MSG.id);
    });
    expect(
      container
        .querySelector("[data-slot='inbox-message-row']")
        ?.getAttribute("data-unread"),
    ).toBe("false");
  });

  it("tap on read message is a no-op (button disabled)", () => {
    const { container } = render(<MessagesList rows={[READ_MSG]} />);
    const tap = container.querySelector(
      "[data-slot='inbox-message-tap']",
    ) as HTMLButtonElement;
    expect(tap.disabled).toBe(true);
    fireEvent.click(tap);
    expect(mockMarkMessageRecipientRead).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic flip when the action fails", async () => {
    mockMarkMessageRecipientRead.mockResolvedValueOnce({
      ok: false,
      kind: "error",
      error: "boom",
    });
    const { container } = render(<MessagesList rows={[UNREAD_MSG]} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='inbox-message-tap']",
      ) as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockMarkMessageRecipientRead).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        container
          .querySelector("[data-slot='inbox-message-row']")
          ?.getAttribute("data-unread"),
      ).toBe("true");
    });
  });
});
