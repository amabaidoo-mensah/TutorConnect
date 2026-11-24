alter table payments
  drop constraint if exists payments_purpose_check;

alter table payments
  add constraint payments_purpose_check
  check (purpose in ('contact', 'premium', 'resource'));

alter table payments
  add column resource_claimed_at timestamptz;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table tutor_resources
  alter column url drop not null,
  add column storage_path text,
  add column resource_payment_id uuid references payments(id) on delete restrict;

alter table tutor_resources
  add constraint tutor_resources_source_check
    check (
      (url is not null and storage_path is null)
      or (url is null and storage_path is not null)
    ),
  add constraint tutor_resources_storage_path_owner
    check (
      storage_path is null
      or (
        resource_payment_id is not null
        and storage_path like (tutor_id::text || '/' || resource_payment_id::text || '/resource.%')
      )
    ),
  add constraint tutor_resources_storage_path_unique unique (storage_path),
  add constraint tutor_resources_resource_payment_unique unique (resource_payment_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutor-resources',
  'tutor-resources',
  false,
  52428800,
  array[
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function can_upload_paid_tutor_resource(p_path text)
returns boolean
language sql stable security definer set search_path = public, storage, pg_temp as $$
  select exists (
    select 1
    from payments payment
    join tutor_profiles tutor on tutor.id = payment.user_id
    join profiles account on account.id = payment.user_id
    where payment.id::text = (storage.foldername(p_path))[2]
      and payment.user_id = auth.uid()
      and payment.purpose = 'resource'
      and payment.status = 'paid'
      and payment.resource_claimed_at is null
      and tutor.status = 'approved'
      and account.account_status = 'active'
      and (storage.foldername(p_path))[1] = auth.uid()::text
      and storage.filename(p_path) ~ '^resource[.][a-zA-Z0-9]{1,8}$'
      and not exists (
        select 1 from storage.objects storage_object
        where storage_object.bucket_id = 'tutor-resources'
          and storage_object.name = p_path
      )
  );
$$;

create or replace function can_read_tutor_resource_file(p_path text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from tutor_resources resource
    where resource.storage_path = p_path
      and (
        resource.tutor_id = auth.uid()
        or is_admin()
        or (resource.is_public and can_view_tutor_resources(resource.tutor_id))
      )
  );
$$;

revoke all on function can_upload_paid_tutor_resource(text) from public, anon;
revoke all on function can_read_tutor_resource_file(text) from public, anon;
grant execute on function can_upload_paid_tutor_resource(text) to authenticated;
grant execute on function can_read_tutor_resource_file(text) to authenticated;

create policy "tutor resources paid upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tutor-resources'
  and can_upload_paid_tutor_resource(name)
);

create policy "tutor resources file read"
on storage.objects for select to authenticated
using (
  bucket_id = 'tutor-resources'
  and can_read_tutor_resource_file(name)
);

create policy "tutor resources file delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tutor-resources'
  and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
);

drop policy if exists "tutor resources own insert" on tutor_resources;
create policy "tutor resources paid insert"
on tutor_resources for insert to authenticated
with check (
  tutor_id = auth.uid()
  and resource_payment_id is not null
  and exists (
    select 1 from profiles account
    where account.id = auth.uid()
      and account.role = 'tutor'
      and account.account_status = 'active'
  )
  and exists (
    select 1 from tutor_profiles tutor
    where tutor.id = auth.uid()
      and tutor.status = 'approved'
  )
  and exists (
    select 1 from tutor_courses tutor_course
    where tutor_course.tutor_id = auth.uid()
      and tutor_course.course_id = tutor_resources.course_id
      and tutor_course.status = 'approved'
  )
  and exists (
    select 1 from payments payment
    where payment.id = resource_payment_id
      and payment.user_id = auth.uid()
      and payment.purpose = 'resource'
      and payment.status = 'paid'
      and payment.resource_claimed_at is null
  )
);

create or replace function claim_tutor_resource_payment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.url is not null and new.url !~* '^https://' then
    raise exception 'tutor resource links must use HTTPS';
  end if;

  if tg_op = 'UPDATE' then
    if new.resource_payment_id is distinct from old.resource_payment_id then
      raise exception 'resource payment cannot be changed';
    end if;
    return new;
  end if;

  update payments
  set resource_claimed_at = now()
  where id = new.resource_payment_id
    and user_id = new.tutor_id
    and purpose = 'resource'
    and status = 'paid'
    and resource_claimed_at is null;

  if not found then
    raise exception 'a paid, unused resource credit is required';
  end if;
  return new;
end
$$;

create trigger claim_tutor_resource_payment
before insert or update of resource_payment_id, url, storage_path on tutor_resources
for each row execute function claim_tutor_resource_payment();

create or replace function finalize_tutorconnect_payment(
  p_provider_ref text,
  p_verified boolean
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  payment payments%rowtype;
begin
  select * into payment
  from payments
  where provider_ref = p_provider_ref
  for update;

  if not found then
    raise exception 'payment reference not found';
  end if;

  if payment.status = 'paid' then
    return jsonb_build_object(
      'status', 'paid',
      'purpose', payment.purpose,
      'tutor_id', case when payment.purpose = 'contact' then payment.tutor_id else null end
    );
  end if;

  if payment.status <> 'pending' then
    return jsonb_build_object('status', payment.status, 'purpose', payment.purpose, 'tutor_id', null);
  end if;

  if not p_verified then
    update payments set status = 'failed', verified_at = now() where id = payment.id;
    return jsonb_build_object('status', 'failed', 'purpose', payment.purpose, 'tutor_id', null);
  end if;

  update payments set status = 'paid', verified_at = now() where id = payment.id;

  if payment.purpose = 'contact' then
    insert into contact_unlocks (student_id, tutor_id, payment_id)
    values (payment.user_id, payment.tutor_id, payment.id)
    on conflict (student_id, tutor_id) do nothing;
  elsif payment.purpose = 'premium' then
    if payment.plan_days is null or payment.plan_days <= 0 then
      raise exception 'invalid tutor plan duration';
    end if;
    update tutor_profiles
    set premium_until = greatest(now(), coalesce(premium_until, now()))
      + make_interval(days => payment.plan_days)
    where id = payment.user_id;
    if not found then
      raise exception 'tutor profile not found';
    end if;
  end if;

  return jsonb_build_object(
    'status', 'paid',
    'purpose', payment.purpose,
    'tutor_id', case when payment.purpose = 'contact' then payment.tutor_id else null end
  );
end
$$;

revoke all on function finalize_tutorconnect_payment(text, boolean) from public, anon, authenticated;
grant execute on function finalize_tutorconnect_payment(text, boolean) to service_role;
