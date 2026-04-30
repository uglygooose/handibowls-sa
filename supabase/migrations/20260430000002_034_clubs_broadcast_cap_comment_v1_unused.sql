-- Phase 11 / Migration 034 — clubs.daily_broadcast_cap v1 status note
--
-- Comment-only migration. Rewrites the doc comment on
-- public.clubs.daily_broadcast_cap to reflect the revised Phase 11
-- scope: in-app messaging is the v1 primary channel; admin broadcast
-- emails are out of scope; the only outbound email path in v1 is
-- system-triggered InviteEmail.
--
-- Why keep the column instead of dropping it
--
--   The cap is still policy-correct — a per-club rate limit on
--   admin broadcasts. It just isn't enforced by any code in v1
--   because the admin compose UI hard-codes `send_email = false`
--   and the in-app fan-out doesn't share quota with the email
--   path. When a future phase re-introduces an admin email
--   channel, the SECURITY DEFINER `send_message(message_id)` RPC
--   will read this column at that time. Dropping and re-adding
--   would be wasted churn against a column that already exists,
--   has a default, and is backfilled across all 45 cloud rows.
--
-- Why update the comment instead of editing migration 033 in place
--
--   handibowls-standards: never edit a prod-applied migration —
--   write a new one. Migration 033 already shipped at 8541718;
--   the doc comment in that file remains historical truth at the
--   time of authorship.
--
-- Two-commit rule
--
--   No dependent app code reads `daily_broadcast_cap` in v1, so
--   this migration is informational-only. The two-commit guard
--   (migration → push → verify → application code) doesn't apply
--   here because there is no application code that depends on
--   the comment text.

comment on column public.clubs.daily_broadcast_cap is
  'Reserved per-club rate limit on admin broadcast messages. '
  'UNUSED IN v1 — Phase 11 ships in-app-only admin messaging '
  '(messages.send_email forced false at the compose-action layer); '
  'the only outbound email is system-triggered InviteEmail, which '
  'is exempt from the broadcast cap. When a future phase re-adds '
  'an admin email channel, the SECURITY DEFINER send_message RPC '
  'will read this column. Default 2; zero disables broadcasts.';
