create type role_t as enum ('student','tutor','admin');
create table profiles(id uuid primary key references auth.users on delete cascade, full_name text, role role_t not null default 'student', account_status text not null default 'active', created_at timestamptz default now());
create table institutions(id serial primary key, name text unique not null, active boolean default true);
create table courses(id serial primary key, institution_id int references institutions not null, code text not null, title text not null, active boolean default true, unique(institution_id,code));
create table tutor_profiles(id uuid primary key references profiles on delete cascade, bio text, qualifications text, rate numeric, delivery text default 'Online', availability text, status text not null default 'pending' check(status in('pending','approved','rejected','suspended','removed')), premium_until timestamptz, views int default 0);
create table tutor_contacts(tutor_id uuid primary key references tutor_profiles on delete cascade, phone text, email text);
create table tutor_courses(id serial primary key, tutor_id uuid references tutor_profiles on delete cascade, course_id int references courses, status text not null default 'pending' check(status in('pending','approved','rejected')), unique(tutor_id,course_id));
create table payments(id uuid primary key default gen_random_uuid(), user_id uuid references profiles not null, purpose text check(purpose in('contact','premium')), tutor_id uuid references tutor_profiles, plan_days int, amount numeric not null, currency text default 'GHS', provider_ref text unique, status text not null default 'pending' check(status in('pending','paid','failed')), created_at timestamptz default now(), verified_at timestamptz);
create table contact_unlocks(id serial primary key, student_id uuid references profiles, tutor_id uuid references tutor_profiles, payment_id uuid references payments, unlocked_at timestamptz default now(), unique(student_id,tutor_id));
create table reviews(id serial primary key, student_id uuid references profiles, tutor_id uuid references tutor_profiles, rating int check(rating between 1 and 5), comment text, status text default 'published', created_at timestamptz default now(), unique(student_id,tutor_id));
create table reports(id serial primary key, reporter_id uuid references profiles, tutor_id uuid references tutor_profiles, category text, description text, status text default 'open', resolution text, created_at timestamptz default now());
create table admin_actions(id serial primary key, admin_id uuid, target_id uuid, action text, reason text not null, created_at timestamptz default now());
create index on courses(institution_id, code); create index on tutor_courses(course_id,status);

create function is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function handle_new_user() returns trigger language plpgsql security definer as $$ begin insert into profiles(id,full_name,role) values(new.id,new.raw_user_meta_data->>'full_name','student'); return new; end $$; -- role is never taken from client input
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security; alter table institutions enable row level security; alter table courses enable row level security; alter table tutor_profiles enable row level security; alter table tutor_contacts enable row level security; alter table tutor_courses enable row level security; alter table payments enable row level security; alter table contact_unlocks enable row level security; alter table reviews enable row level security; alter table reports enable row level security; alter table admin_actions enable row level security;
create policy "inst read" on institutions for select using(true); create policy "course read" on courses for select using(true);
create policy "inst admin" on institutions for all using(is_admin()); create policy "course admin" on courses for all using(is_admin());
create policy "own profile" on profiles for select using(id=auth.uid() or is_admin());
create policy "own profile edit" on profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=(select role from profiles where id=auth.uid()) and account_status=(select account_status from profiles where id=auth.uid()));
create policy "tutor read" on tutor_profiles for select using(status='approved' or id=auth.uid() or is_admin());
create policy "tutor insert" on tutor_profiles for insert with check(id=auth.uid() and status='pending' and premium_until is null);
create policy "tutor edit" on tutor_profiles for update using(id=auth.uid()) with check(id=auth.uid() and status=(select status from tutor_profiles where id=auth.uid()) and premium_until is not distinct from (select premium_until from tutor_profiles where id=auth.uid()));
create policy "tutor admin" on tutor_profiles for all using(is_admin());
-- AC-06: contact rows are readable only by the owner, an admin, or a student with a paid unlock
create policy "contact gated" on tutor_contacts for select using(tutor_id=auth.uid() or is_admin() or exists(select 1 from contact_unlocks u where u.tutor_id=tutor_contacts.tutor_id and u.student_id=auth.uid()));
create policy "contact own write" on tutor_contacts for all using(tutor_id=auth.uid()) with check(tutor_id=auth.uid());
create policy "tc read" on tutor_courses for select using(status='approved' or tutor_id=auth.uid() or is_admin());
create policy "tc request" on tutor_courses for insert with check(tutor_id=auth.uid() and status='pending');
create policy "tc admin" on tutor_courses for all using(is_admin());
create policy "pay own" on payments for select using(user_id=auth.uid() or is_admin()); -- writes only in the Edge Function (service role)
create policy "unlock own" on contact_unlocks for select using(student_id=auth.uid() or is_admin());
create policy "rev read" on reviews for select using(status='published' or student_id=auth.uid() or is_admin());
create policy "rev write" on reviews for insert with check(student_id=auth.uid() and exists(select 1 from contact_unlocks u where u.student_id=auth.uid() and u.tutor_id=reviews.tutor_id));
create policy "rev admin" on reviews for update using(is_admin());
create policy "rep own" on reports for select using(reporter_id=auth.uid() or is_admin());
create policy "rep insert" on reports for insert with check(reporter_id=auth.uid());
create policy "rep admin" on reports for update using(is_admin());
create policy "audit admin" on admin_actions for all using(is_admin());

-- Course-relevant search: approved + active tutors only; premium reorders only after relevance checks
create function search_tutors(p_institution int, p_query text) returns table(id uuid, name text, bio text, rate numeric, delivery text, course_code text, avg_rating numeric, review_count bigint, featured boolean)
language sql stable security definer as $$
 select t.id,p.full_name,t.bio,t.rate,t.delivery,c.code,(select avg(rating) from reviews r where r.tutor_id=t.id and r.status='published'),(select count(*) from reviews r where r.tutor_id=t.id and r.status='published'),coalesce(t.premium_until>now(),false)
 from tutor_courses tc join courses c on c.id=tc.course_id and c.active and c.institution_id=p_institution
 join tutor_profiles t on t.id=tc.tutor_id and t.status='approved' join profiles p on p.id=t.id and p.account_status='active'
 where tc.status='approved' and (c.code ilike '%'||p_query||'%' or c.title ilike '%'||p_query||'%')
 order by coalesce(t.premium_until>now(),false) desc, 7 desc nulls last $$;
create function admin_set_tutor_status(p_tutor uuid, p_status text, p_reason text) returns void language plpgsql security definer as $$
begin if not is_admin() then raise exception 'admin only'; end if; if coalesce(trim(p_reason),'')='' then raise exception 'reason required'; end if;
 update tutor_profiles set status=p_status where id=p_tutor; insert into admin_actions(admin_id,target_id,action,reason) values(auth.uid(),p_tutor,p_status,p_reason); end $$;
