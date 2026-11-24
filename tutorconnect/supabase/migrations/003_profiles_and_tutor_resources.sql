alter table profiles
  add column if not exists bio text check (bio is null or char_length(bio) <= 500),
  add column if not exists avatar_path text;

alter table profiles
  add constraint profile_avatar_path_owner
  check (avatar_path is null or avatar_path like (id::text || '/%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function can_read_profile_photo(p_path text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from profiles p
    left join tutor_profiles t on t.id = p.id
    where p.avatar_path = p_path
      and (
        p.id = auth.uid()
        or is_admin()
        or (p.role = 'tutor' and p.account_status = 'active' and t.status = 'approved')
      )
  );
$$;

revoke all on function can_read_profile_photo(text) from public;
grant execute on function can_read_profile_photo(text) to authenticated;

create function can_view_tutor_resources(p_tutor uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from tutor_profiles t
    join profiles p on p.id = t.id
    where t.id = p_tutor
      and t.status = 'approved'
      and p.account_status = 'active'
  );
$$;

revoke all on function can_view_tutor_resources(uuid) from public;
grant execute on function can_view_tutor_resources(uuid) to authenticated;

create policy "profile photos read" on storage.objects
for select to authenticated
using (bucket_id = 'profile-photos' and can_read_profile_photo(name));

create policy "profile photos own insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos own update" on storage.objects
for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos own delete" on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table tutor_resources (
  id serial primary key,
  tutor_id uuid not null references tutor_profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('teaching_video', 'course_resource', 'past_questions')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  url text not null check (url ~ '^https://'),
  description text check (description is null or char_length(description) <= 300),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index tutor_resources_public_idx on tutor_resources(tutor_id, is_public, created_at desc);
alter table tutor_resources enable row level security;

create policy "tutor resources read" on tutor_resources
for select to authenticated
using (
  tutor_id = auth.uid()
  or is_admin()
  or (is_public and can_view_tutor_resources(tutor_resources.tutor_id))
);

create policy "tutor resources own insert" on tutor_resources
for insert to authenticated
with check (
  tutor_id = auth.uid()
  and exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'tutor' and p.account_status = 'active'
  )
);

create policy "tutor resources own update" on tutor_resources
for update to authenticated
using (tutor_id = auth.uid() or is_admin())
with check (tutor_id = auth.uid() or is_admin());

create policy "tutor resources own delete" on tutor_resources
for delete to authenticated
using (tutor_id = auth.uid() or is_admin());

drop function if exists search_tutors_grouped(int, text, int);

create function search_tutors_grouped(
  p_institution int,
  p_query text,
  p_academic_unit int default null
) returns table(
  id uuid,
  name text,
  bio text,
  rate numeric,
  delivery text,
  course_code text,
  avg_rating numeric,
  review_count bigint,
  featured boolean,
  department_id int,
  department text,
  school text,
  college text,
  avatar_path text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, p.full_name, t.bio, t.rate, t.delivery, c.code,
    (select avg(r.rating) from reviews r where r.tutor_id = t.id and r.status = 'published'),
    (select count(*) from reviews r where r.tutor_id = t.id and r.status = 'published'),
    coalesce(t.premium_until > now(), false),
    department.id, department.name, school.name, college.name, p.avatar_path
  from tutor_courses tc
  join courses c on c.id = tc.course_id and c.active and c.institution_id = p_institution
  join tutor_profiles t on t.id = tc.tutor_id and t.status = 'approved'
  join profiles p on p.id = t.id and p.account_status = 'active'
  left join academic_units department on department.id = c.academic_unit_id and department.active
  left join academic_units school on school.id = department.parent_id and school.active
  left join academic_units college on college.id = school.parent_id and college.active
  where tc.status = 'approved'
    and (p_query = '' or c.code ilike '%' || p_query || '%' or c.title ilike '%' || p_query || '%')
    and (p_academic_unit is null or department.id = p_academic_unit
      or school.id = p_academic_unit or college.id = p_academic_unit)
  order by coalesce(t.premium_until > now(), false) desc, 7 desc nulls last;
$$;

grant execute on function search_tutors_grouped(int, text, int) to anon, authenticated;
