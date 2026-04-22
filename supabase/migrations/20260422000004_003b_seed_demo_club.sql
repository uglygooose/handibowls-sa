-- Phase 2 / Migration 003b — seed the Demo Bowls Club (Q4)
-- Single demo club in Johannesburg district, Atomic Red preset. Used for
-- marketing demos and the Phase 4 wizard walkthrough. Idempotent via slug.

insert into public.clubs (name, short_name, slug, district_id, city, theme_preset)
select 'Demo Bowls Club', 'Demo', 'demo-bowls-club', d.id, 'Johannesburg', 'atomic-red'
from public.districts d
where d.name = 'Johannesburg'
on conflict (slug) do nothing;
