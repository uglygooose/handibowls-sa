-- Fix: keep game_invites history when freeing a booking.
-- Safe to run even if the table already matches the desired shape.

alter table public.game_invites
  alter column booking_id drop not null;

alter table public.game_invites
  drop constraint if exists game_invites_booking_id_fkey;

alter table public.game_invites
  add constraint game_invites_booking_id_fkey
  foreign key (booking_id)
  references public.lane_bookings(id)
  on delete set null;

