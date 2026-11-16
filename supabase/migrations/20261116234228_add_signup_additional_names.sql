alter table public.hanukkah_serenading_signups
  add column additional_names text[] not null default '{}'::text[]
  constraint hanukkah_additional_names_valid check (
    cardinality(additional_names) <= 5
    and array_position(additional_names, null) is null
    and array_position(additional_names, '') is null
    and char_length(array_to_string(additional_names, '')) <= 750
  );
grant insert (additional_names), select (additional_names)
  on public.hanukkah_serenading_signups to anon, authenticated;
comment on column public.hanukkah_serenading_signups.additional_names is
  'Up to five additional attendees associated with the main entry and its selected nights. Existing signups default to no additional names.';
