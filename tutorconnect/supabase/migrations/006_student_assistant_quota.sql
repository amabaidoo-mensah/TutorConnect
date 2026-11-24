create table if not exists student_assistant_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_bucket timestamptz not null,
  minute_requests smallint not null,
  usage_date date not null,
  daily_requests int not null
);

alter table student_assistant_rate_limits enable row level security;

create or replace function consume_student_assistant_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed boolean;
  current_minute timestamptz := date_trunc('minute', now());
  current_date_utc date := (now() at time zone 'utc')::date;
begin
  insert into student_assistant_rate_limits (
    user_id, minute_bucket, minute_requests, usage_date, daily_requests
  ) values (p_user_id, current_minute, 1, current_date_utc, 1)
  on conflict (user_id) do update
  set minute_bucket = case
        when student_assistant_rate_limits.minute_bucket < current_minute then current_minute
        else student_assistant_rate_limits.minute_bucket
      end,
      minute_requests = case
        when student_assistant_rate_limits.minute_bucket < current_minute then 1
        else student_assistant_rate_limits.minute_requests + 1
      end,
      usage_date = case
        when student_assistant_rate_limits.usage_date < current_date_utc then current_date_utc
        else student_assistant_rate_limits.usage_date
      end,
      daily_requests = case
        when student_assistant_rate_limits.usage_date < current_date_utc then 1
        else student_assistant_rate_limits.daily_requests + 1
      end
  where (
      case
        when student_assistant_rate_limits.minute_bucket < current_minute then 1
        else student_assistant_rate_limits.minute_requests + 1
      end
    ) <= 10
    and (
      case
        when student_assistant_rate_limits.usage_date < current_date_utc then 1
        else student_assistant_rate_limits.daily_requests + 1
      end
    ) <= 60
  returning true into claimed;

  return coalesce(claimed, false);
end
$$;

revoke all on function consume_student_assistant_quota(uuid) from public, anon, authenticated;
grant execute on function consume_student_assistant_quota(uuid) to service_role;
