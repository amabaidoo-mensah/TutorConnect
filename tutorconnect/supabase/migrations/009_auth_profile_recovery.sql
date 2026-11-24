create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_role role_t;
begin
  assigned_role := case
    when new.raw_user_meta_data->>'role' = 'tutor' then 'tutor'::role_t
    else 'student'::role_t
  end;

  insert into public.profiles(id, full_name, role)
  values(new.id, nullif(trim(new.raw_user_meta_data->>'full_name'), ''), assigned_role)
  on conflict (id) do nothing;

  if assigned_role = 'tutor' then
    insert into public.tutor_profiles(id, status)
    values(new.id, 'pending')
    on conflict (id) do nothing;
  end if;

  return new;
end
$$;

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  account auth.users%rowtype;
  assigned_role role_t;
begin
  if auth.uid() is null then
    raise exception 'sign in is required';
  end if;

  select * into account from auth.users where id = auth.uid();
  if not found then
    raise exception 'authenticated account was not found';
  end if;

  assigned_role := case
    when account.raw_user_meta_data->>'role' = 'tutor' then 'tutor'::role_t
    else 'student'::role_t
  end;

  insert into public.profiles as existing_profile(id, full_name, role)
  values(account.id, nullif(trim(account.raw_user_meta_data->>'full_name'), ''), assigned_role)
  on conflict (id) do update
  set full_name = coalesce(nullif(existing_profile.full_name, ''), excluded.full_name);

  if exists (
    select 1 from public.profiles
    where id = account.id and role = 'tutor'
  ) then
    insert into public.tutor_profiles(id, status)
    values(account.id, 'pending')
    on conflict (id) do nothing;
  end if;
end
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
