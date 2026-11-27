create or replace function public.admin_set_account_status(
  p_user uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_role role_t;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_status is null or p_status not in ('active', 'suspended', 'removed') then
    raise exception 'invalid account status';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) not between 4 and 1000 then
    raise exception 'reason must be between 4 and 1000 characters';
  end if;

  select role
  into target_role
  from public.profiles
  where id = p_user
  for update;

  if not found then
    raise exception 'account not found';
  end if;

  if target_role = 'admin' then
    raise exception 'administrator accounts cannot be moderated here';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_user;

  insert into public.admin_actions(admin_id, target_id, action, reason)
  values (
    auth.uid(),
    p_user,
    'Account status changed to ' || p_status,
    trim(p_reason)
  );
end
$$;

revoke all on function public.admin_set_account_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
