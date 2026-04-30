import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { MessagesListClient } from "@/app/(club-admin)/manage/messages/_components/MessagesListClient";
import type { MessageListRow } from "@/app/(club-admin)/manage/messages/_data";

// Phase 11 / 11-3a — admin Messages list contract.
//
// Covers the Client-island bits:
//   • Status filter chips + search collaboration
//   • Empty-data state (no rows at all)
//   • Empty-filtered state (rows exist but filtered out)
//   • Status pill colour coding
//   • Audience scope label rendering for the three audience kinds
//   • Primary-date label tracks status (sent_at / scheduled_at /
//     created_at)
//
// The Server Component (page.tsx) is exercised end-to-end via the
// integration suite once compose actions land — this file is the
// jsdom contract test for the chip behaviour.

const BASE_ROW: MessageListRow = {
  id: "00000000-0000-0000-0000-000000000001",
  club_id: "11111111-1111-1111-1111-111111111111",
  subject: "Practice reminder",
  body_preview: "Practice tomorrow at 17:00. Bring extra ends.",
  audience_kind: "all_members",
  audience_tournament_id: null,
  audience_tournament_name: null,
  audience_custom_count: 0,
  status: "sent",
  scheduled_at: null,
  sent_at: "2026-04-29T15:00:00Z",
  created_at: "2026-04-29T14:50:00Z",
  recipient_count: 12,
  sender_id: null,
  sender_name: "Andrew Els",
};

function row(over: Partial<MessageListRow>): MessageListRow {
  return { ...BASE_ROW, ...over };
}

describe("<MessagesListClient /> — empty data", () => {
  it("renders the empty-data card and CTA on the Sent tab when no rows exist (12-3 / B1)", () => {
    // The Compose CTA only renders on the Sent tab — the Inbox tab's
    // empty state suggests no compose action since the inbox is for
    // messages received from players + other admins.
    const { container } = render(
      <MessagesListClient rows={[]} mode="sent" />,
    );
    expect(
      container.querySelector("[data-slot='messages-empty-data']"),
    ).not.toBeNull();
    const cta = container.querySelector("[data-slot='empty-cta']");
    expect(cta).not.toBeNull();
    expect(cta?.getAttribute("href")).toBe("/manage/messages/new");
  });

  it("renders the empty-data card WITHOUT CTA on the Inbox tab (12-3 / B1)", () => {
    const { container } = render(
      <MessagesListClient rows={[]} mode="inbox" />,
    );
    expect(
      container.querySelector("[data-slot='messages-empty-data']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-slot='empty-cta']")).toBeNull();
  });

  it("does NOT render filter chips or search when no data", () => {
    const { container } = render(<MessagesListClient rows={[]} />);
    expect(
      container.querySelector("[data-slot='messages-search']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='messages-status-chips']"),
    ).toBeNull();
  });
});

describe("<MessagesListClient /> — filter chips", () => {
  const SAMPLE: MessageListRow[] = [
    row({ id: "a", subject: "Draft A", status: "draft" }),
    row({ id: "b", subject: "Queued B", status: "queued" }),
    row({ id: "c", subject: "Sent C", status: "sent" }),
    row({ id: "d", subject: "Failed D", status: "failed" }),
    row({ id: "e", subject: "Sent E too", status: "sent" }),
  ];

  it("renders four status chips with 'all' active by default (12-3 / A4: 'queued' chip removed)", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    const chips = container.querySelectorAll("[data-slot='status-chip']");
    expect(chips).toHaveLength(4);
    const active = container.querySelector(
      "[data-slot='status-chip'][data-active='true']",
    );
    expect(active?.getAttribute("data-value")).toBe("all");
  });

  it("renders all rows when 'all' is active", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    const rows = container.querySelectorAll("[data-slot='message-row']");
    expect(rows).toHaveLength(5);
  });

  it("clicking the 'sent' chip narrows to status='sent' rows only", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='sent']",
      ) as HTMLButtonElement,
    );
    const rows = container.querySelectorAll("[data-slot='message-row']");
    expect(rows).toHaveLength(2);
    rows.forEach((r) => {
      expect(r.getAttribute("data-status")).toBe("sent");
    });
  });

  it("search narrows further within the active chip filter", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='sent']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='messages-search']",
      ) as HTMLInputElement,
      { target: { value: "too" } },
    );
    const rows = container.querySelectorAll("[data-slot='message-row']");
    expect(rows).toHaveLength(1);
    expect(
      rows[0].querySelector("[data-slot='message-subject']")?.textContent,
    ).toContain("Sent E too");
  });

  it("renders the empty-filtered state with Clear filters CTA when filters exclude everything", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    fireEvent.change(
      container.querySelector(
        "[data-slot='messages-search']",
      ) as HTMLInputElement,
      { target: { value: "no-such-subject-on-record" } },
    );
    expect(
      container.querySelector("[data-slot='messages-empty-filtered']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='clear-filters-cta']"),
    ).not.toBeNull();
  });

  it("Clear filters resets search and status chip to 'all'", () => {
    const { container } = render(<MessagesListClient rows={SAMPLE} />);
    fireEvent.click(
      container.querySelector(
        "[data-slot='status-chip'][data-value='draft']",
      ) as HTMLButtonElement,
    );
    fireEvent.change(
      container.querySelector(
        "[data-slot='messages-search']",
      ) as HTMLInputElement,
      { target: { value: "no-match-here" } },
    );
    fireEvent.click(
      container.querySelector(
        "[data-slot='clear-filters-cta']",
      ) as HTMLButtonElement,
    );
    expect(
      container.querySelector("[data-slot='status-chip'][data-active='true']")
        ?.getAttribute("data-value"),
    ).toBe("all");
    expect(
      (
        container.querySelector(
          "[data-slot='messages-search']",
        ) as HTMLInputElement
      ).value,
    ).toBe("");
  });
});

describe("<MessagesListClient /> — row chrome", () => {
  it("audience_kind=all_members shows 'All members' label", () => {
    const { container } = render(
      <MessagesListClient rows={[row({ audience_kind: "all_members" })]} />,
    );
    expect(
      container.querySelector("[data-slot='audience-label']")?.textContent,
    ).toContain("All members");
  });

  it("audience_kind=tournament_entrants shows tournament name", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            audience_kind: "tournament_entrants",
            audience_tournament_id: "t-1",
            audience_tournament_name: "Spring Singles",
          }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='audience-label']")?.textContent,
    ).toContain("Spring Singles");
  });

  it("audience_kind=custom shows the selected count", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            audience_kind: "custom",
            audience_custom_count: 7,
          }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='audience-label']")?.textContent,
    ).toContain("Custom · 7 selected");
  });

  it("status pill carries the data-status attribute matching the row status", () => {
    const { container } = render(
      <MessagesListClient rows={[row({ status: "queued" })]} />,
    );
    const pill = container.querySelector("[data-slot='status-pill']");
    expect(pill?.getAttribute("data-status")).toBe("queued");
  });

  it("status='sent' shows 'Sent <date>' label", () => {
    const { container } = render(
      <MessagesListClient
        rows={[row({ status: "sent", sent_at: "2026-04-29T15:00:00Z" })]}
      />,
    );
    expect(
      container.querySelector("[data-slot='message-date']")?.textContent,
    ).toMatch(/^Sent\s/);
  });

  it("status='queued' with scheduled_at shows 'Scheduled <date>' label", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            status: "queued",
            scheduled_at: "2026-05-01T18:00:00Z",
            sent_at: null,
          }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='message-date']")?.textContent,
    ).toMatch(/^Scheduled\s/);
  });

  it("status='failed' shows 'Failed <date>' label", () => {
    const { container } = render(
      <MessagesListClient rows={[row({ status: "failed", sent_at: null })]} />,
    );
    expect(
      container.querySelector("[data-slot='message-date']")?.textContent,
    ).toMatch(/^Failed\s/);
  });

  it("recipient count uses singular for 1, plural otherwise", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({ id: "one", subject: "Single", recipient_count: 1 }),
          row({ id: "many", subject: "Many", recipient_count: 12 }),
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("1 recipient");
    expect(text).toContain("12 recipients");
  });
});

describe("<MessagesListClient /> — Twenty 20 request detection (12-1 followup)", () => {
  it("renders the 'Schedule from this request' link on rows whose subject prefix matches", () => {
    const player_id = "22222222-2222-2222-2222-222222222222";
    const message_id = "33333333-3333-3333-3333-333333333333";
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            id: message_id,
            subject: "Twenty 20 assessment request — Andrew Els",
            sender_id: player_id,
            sender_name: "Andrew Els",
            audience_kind: "custom",
            audience_custom_count: 2,
          }),
        ]}
      />,
    );
    const cta = container.querySelector(
      "[data-slot='schedule-from-request']",
    );
    expect(cta).not.toBeNull();
    const href = cta?.getAttribute("href");
    expect(href).toContain("/manage/bookings/new");
    expect(href).toContain(`player_id=${player_id}`);
    expect(href).toContain(`request_message_id=${message_id}`);
    expect(
      container.querySelector("[data-slot='t20-request-pill']"),
    ).not.toBeNull();
  });

  it("does NOT render the CTA on regular admin broadcasts", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            id: "11111111-1111-1111-1111-111111111111",
            subject: "Practice reminder",
            sender_id: "44444444-4444-4444-4444-444444444444",
          }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='schedule-from-request']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='t20-request-pill']"),
    ).toBeNull();
  });

  it("does NOT render the CTA when sender_id is null even with the matching subject prefix", () => {
    const { container } = render(
      <MessagesListClient
        rows={[
          row({
            id: "55555555-5555-5555-5555-555555555555",
            subject: "Twenty 20 assessment request — Anonymous",
            sender_id: null,
          }),
        ]}
      />,
    );
    expect(
      container.querySelector("[data-slot='schedule-from-request']"),
    ).toBeNull();
  });
});
