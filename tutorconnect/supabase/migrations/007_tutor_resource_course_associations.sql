alter table tutor_resources
  add column if not exists course_id int references courses(id) on delete set null;

create index if not exists tutor_resources_course_idx
  on tutor_resources(tutor_id, course_id, is_public);
