create table if not exists academic_units (
  id serial primary key,
  institution_id int not null references institutions on delete cascade,
  parent_id int references academic_units on delete set null,
  name text not null,
  unit_type text not null check (unit_type in ('college', 'school', 'faculty', 'department')),
  source_url text,
  active boolean not null default true,
  unique (institution_id, name)
);

alter table academic_units enable row level security;
create policy "academic units read" on academic_units for select using (active or is_admin());
create policy "academic units admin" on academic_units for all using (is_admin()) with check (is_admin());

alter table courses add column if not exists academic_unit_id int references academic_units on delete set null;
alter table courses add column if not exists source_url text;
create index if not exists courses_academic_unit_idx on courses(academic_unit_id, active);

insert into institutions(name) values ('University of Cape Coast')
on conflict (name) do nothing;

insert into academic_units(institution_id, name, unit_type, source_url)
select id, unit.name, 'college', 'https://academics.ucc.edu.gh/colleges'
from institutions
cross join (values
  ('College of Agriculture and Natural Sciences'),
  ('College of Distance Education'),
  ('College of Education Studies'),
  ('College of Health and Allied Sciences'),
  ('College of Humanities and Legal Studies')
) as unit(name)
where institutions.name = 'University of Cape Coast'
on conflict (institution_id, name) do update
set unit_type = excluded.unit_type, source_url = excluded.source_url, active = true;

insert into academic_units(institution_id, parent_id, name, unit_type, source_url)
select i.id, college.id, school.name, 'school', 'https://admissions.ucc.edu.gh/catalogue/departments'
from institutions i
join academic_units college on college.institution_id = i.id
cross join (values
  ('School of Agriculture'),
  ('School of Biological Sciences'),
  ('School of Physical Sciences')
) as school(name)
where i.name = 'University of Cape Coast'
  and college.name = 'College of Agriculture and Natural Sciences'
on conflict (institution_id, name) do update
set parent_id = excluded.parent_id, unit_type = excluded.unit_type,
    source_url = excluded.source_url, active = true;

insert into academic_units(institution_id, parent_id, name, unit_type, source_url)
select i.id, school.id, department.name, 'department', 'https://admissions.ucc.edu.gh/catalogue/departments'
from institutions i
join (values
  ('School of Agriculture', 'Agri-Food Systems and Technology'),
  ('School of Agriculture', 'Agricultural Economics and Extension'),
  ('School of Agriculture', 'Animal Science'),
  ('School of Agriculture', 'Crop Science'),
  ('School of Agriculture', 'Soil Science'),
  ('School of Biological Sciences', 'Biochemistry'),
  ('School of Biological Sciences', 'Conservation Biology and Entomology'),
  ('School of Biological Sciences', 'Environmental Science'),
  ('School of Biological Sciences', 'Fisheries and Aquatic Sciences'),
  ('School of Biological Sciences', 'Forensic Sciences'),
  ('School of Biological Sciences', 'Molecular Biology and Biotechnology'),
  ('School of Physical Sciences', 'Chemistry'),
  ('School of Physical Sciences', 'Computer Science and Information Technology'),
  ('School of Physical Sciences', 'Industrial Chemistry'),
  ('School of Physical Sciences', 'Laboratory Technology'),
  ('School of Physical Sciences', 'Mathematics'),
  ('School of Physical Sciences', 'Physics'),
  ('School of Physical Sciences', 'Statistics')
) as department(school_name, name) on true
join academic_units school on school.institution_id = i.id
  and school.name = department.school_name and school.unit_type = 'school'
where i.name = 'University of Cape Coast'
on conflict (institution_id, name) do update
set parent_id = excluded.parent_id, unit_type = excluded.unit_type,
    source_url = excluded.source_url, active = true;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  assigned_role role_t;
begin
  assigned_role := case
    when new.raw_user_meta_data->>'role' = 'tutor' then 'tutor'::role_t
    else 'student'::role_t
  end;
  insert into profiles(id, full_name, role)
  values(new.id, new.raw_user_meta_data->>'full_name', assigned_role);
  if assigned_role = 'tutor' then
    insert into tutor_profiles(id, status) values(new.id, 'pending')
    on conflict (id) do nothing;
  end if;
  return new;
end
$$;

create or replace function search_tutors_grouped(
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
  college text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, p.full_name, t.bio, t.rate, t.delivery, c.code,
    (select avg(r.rating) from reviews r where r.tutor_id = t.id and r.status = 'published'),
    (select count(*) from reviews r where r.tutor_id = t.id and r.status = 'published'),
    coalesce(t.premium_until > now(), false),
    department.id, department.name, school.name, college.name
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

create or replace function tutor_dashboard_stats()
returns table(profile_views int, contact_unlocks bigint, review_count bigint, average_rating numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'tutor' and account_status = 'active'
  ) then
    raise exception 'active tutor access required';
  end if;
  return query
  select coalesce(t.views, 0),
    (select count(*) from contact_unlocks u where u.tutor_id = t.id),
    (select count(*) from reviews r where r.tutor_id = t.id and r.status = 'published'),
    (select avg(r.rating) from reviews r where r.tutor_id = t.id and r.status = 'published')
  from tutor_profiles t where t.id = auth.uid();
end
$$;

create or replace function admin_moderate_review(p_review int, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'invalid review status'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  update reviews set status = p_status where id = p_review;
  if not found then raise exception 'review not found'; end if;
  insert into admin_actions(admin_id, target_id, action, reason)
  select auth.uid(), tutor_id, 'Review ' || p_status, p_reason from reviews where id = p_review;
end
$$;

create or replace function admin_resolve_report(
  p_report int,
  p_status text,
  p_resolution text,
  p_reason text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('open', 'in review', 'resolved') then raise exception 'invalid report status'; end if;
  if coalesce(trim(p_resolution), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'resolution and reason required';
  end if;
  update reports set status = p_status, resolution = p_resolution where id = p_report;
  if not found then raise exception 'report not found'; end if;
  insert into admin_actions(admin_id, target_id, action, reason)
  select auth.uid(), tutor_id, 'Report ' || p_status || ': ' || p_resolution, p_reason
  from reports where id = p_report;
end
$$;

grant execute on function search_tutors_grouped(int, text, int) to anon, authenticated;
grant execute on function tutor_dashboard_stats() to authenticated;
grant execute on function admin_moderate_review(int, text, text) to authenticated;
grant execute on function admin_resolve_report(int, text, text, text) to authenticated;

create or replace function admin_moderate_tutor_course(
  p_tutor_course int,
  p_status text,
  p_reason text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid course request status'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  update tutor_courses set status = p_status where id = p_tutor_course;
  if not found then raise exception 'course request not found'; end if;
  insert into admin_actions(admin_id, target_id, action, reason)
  select auth.uid(), tutor_id, 'Course request ' || p_status || ' #' || id, p_reason
  from tutor_courses where id = p_tutor_course;
end
$$;

grant execute on function admin_moderate_tutor_course(int, text, text) to authenticated;
