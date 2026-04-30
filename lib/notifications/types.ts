// Phase 11 / 11-5 — shared notification types.
//
// Lives outside the "use server" / server-only modules so both the
// realtime hook (Client) and the data fetcher / actions (Server)
// can import without bundler-boundary issues. Same pattern as
// app/(club-admin)/manage/messages/_form-state.ts.

export type RecentNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  related_kind: string | null;
  related_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
};

export type InitialNotifications = {
  /** Unread count for the bell badge. */
  unreadCount: number;
  /** Most-recent N notifications for the dropdown preview, ordered
   *  by created_at DESC. Includes both read and unread. */
  recent: RecentNotification[];
};
