create table if not exists course_learning_resources (
  id bigserial primary key,
  course_id int not null references courses(id) on delete cascade,
  resource_type text not null check (
    resource_type in ('video', 'notes', 'open_textbook', 'practice', 'past_questions')
  ),
  title text not null check (char_length(trim(title)) between 1 and 160),
  url text not null check (url ~ '^https://'),
  source_name text not null check (char_length(trim(source_name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  license_name text,
  license_url text check (license_url is null or license_url ~ '^https://'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists course_learning_resources_active_idx
  on course_learning_resources(course_id, title)
  where active;

alter table course_learning_resources enable row level security;

drop policy if exists "course learning resources read" on course_learning_resources;
create policy "course learning resources read" on course_learning_resources
for select to anon, authenticated
using (
  active
  and exists (
    select 1
    from courses c
    where c.id = course_learning_resources.course_id
      and c.active
  )
);

drop policy if exists "course learning resources admin" on course_learning_resources;
create policy "course learning resources admin" on course_learning_resources
for all to authenticated
using (is_admin())
with check (is_admin());

grant select on course_learning_resources to anon, authenticated;
grant insert, update, delete on course_learning_resources to authenticated;
grant usage, select on sequence course_learning_resources_id_seq to authenticated;
