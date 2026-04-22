-- Phase 2 / Migration 003 — seed 20 BSA districts
-- Canonical list per skill: bsa-terminology. Provinces mapped where each
-- district's geographic centre falls; districts are BSA administrative units
-- and may not align 1:1 with political province boundaries, but this mapping
-- reflects current BSA district registrations.

insert into public.districts (name, province) values
  ('Boland',                  'Western Cape'),
  ('Border',                  'Eastern Cape'),
  ('Bowls Gauteng North',     'Gauteng'),
  ('Eden',                    'Western Cape'),
  ('Ekurhuleni',              'Gauteng'),
  ('Eastern Province',        'Eastern Cape'),
  ('Johannesburg',            'Gauteng'),
  ('Kingfisher',              'KwaZulu-Natal'),
  ('KwaZulu-Natal Country',   'KwaZulu-Natal'),
  ('Limpopo',                 'Limpopo'),
  ('Mpumalanga',              'Mpumalanga'),
  ('Natal Inland',            'KwaZulu-Natal'),
  ('North West',              'North West'),
  ('Northern Cape',           'Northern Cape'),
  ('Northern Free State',     'Free State'),
  ('Port Natal',              'KwaZulu-Natal'),
  ('Sables',                  'Mpumalanga'),
  ('Sedibeng',                'Gauteng'),
  ('Southern Free State',     'Free State'),
  ('Western Province',        'Western Cape')
on conflict (name) do nothing;
