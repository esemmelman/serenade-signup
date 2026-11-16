create table public.hanukkah_serenading_signups (
  id uuid primary key,
  full_name text not null check (
    char_length(full_name) between 1 and 150
    and full_name = btrim(full_name)
    and full_name ~ '[^[:space:]]'
  ),
  people_count integer not null check (people_count > 0),
  cell_phone text not null check (
    char_length(cell_phone) <= 30
    and cell_phone ~ '^[0-9[:space:]()+.\-]+$'
    and char_length(regexp_replace(cell_phone, '[^0-9]', '', 'g')) between 7 and 15
  ),
  email text not null check (
    char_length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  available_dates date[] not null default '{}'::date[] check (
    available_dates <@ array['2026-12-05', '2026-12-06', '2026-12-08']::date[]
    and cardinality(available_dates) <= 3
    and array_position(available_dates, null) is null
  ),
  created_at timestamptz not null default now()
);
comment on table public.hanukkah_serenading_signups is
  'Hanukkah serenading signup sheet for December 2026. Visitors can submit signups. Contact details are readable only through administrative database access.';
alter table public.hanukkah_serenading_signups enable row level security;
revoke all on public.hanukkah_serenading_signups from public, anon, authenticated;
grant insert (id, full_name, people_count, cell_phone, email, available_dates)
  on public.hanukkah_serenading_signups to anon, authenticated;
create policy hanukkah_signup_submit on public.hanukkah_serenading_signups
  for insert to anon, authenticated with check (true);
grant all on public.hanukkah_serenading_signups to service_role;
