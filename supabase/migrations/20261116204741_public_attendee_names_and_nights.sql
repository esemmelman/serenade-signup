grant select (full_name, available_dates)
  on public.hanukkah_serenading_signups to anon, authenticated;
create policy hanukkah_attendee_list on public.hanukkah_serenading_signups
  for select to anon, authenticated using (true);
comment on table public.hanukkah_serenading_signups is
  'December 2026 Hanukkah serenading signups. Public readers can access names and selected dates. Phone numbers, email addresses, group sizes, IDs, and timestamps are restricted to administrative access.';
