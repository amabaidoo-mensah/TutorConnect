create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

create or replace function public.can_view_user_presence(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles account
      join public.tutor_profiles tutor on tutor.id = account.id
      where account.id = p_user_id
        and account.role = 'tutor'
        and account.account_status = 'active'
        and tutor.status = 'approved'
    );
$$;

create policy "user presence visible to signed-in users"
  on public.user_presence
  for select to authenticated
  using (public.can_view_user_presence(user_id));

revoke all on public.user_presence from public, anon, authenticated;
grant select on public.user_presence to authenticated;
revoke all on function public.can_view_user_presence(uuid) from public, anon;
grant execute on function public.can_view_user_presence(uuid) to authenticated;

create or replace function public.heartbeat_user_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seen_at timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in is required'; end if;
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid() and account_status = 'active'
  ) then
    raise exception 'an active account is required to update presence';
  end if;

  insert into public.user_presence(user_id, last_seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
  set last_seen_at = excluded.last_seen_at
  returning last_seen_at into seen_at;

  return seen_at;
end
$$;

revoke all on function public.heartbeat_user_presence() from public, anon;
grant execute on function public.heartbeat_user_presence() to authenticated;
