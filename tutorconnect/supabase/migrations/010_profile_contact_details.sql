alter table public.profiles
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists whatsapp_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists x_url text,
  add column if not exists website_url text;

alter table public.tutor_contacts
  add column if not exists whatsapp_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists x_url text,
  add column if not exists website_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_contact_links_https'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_contact_links_https check (
        (whatsapp_url is null or (whatsapp_url ~* '^https://[^[:space:]]+$' and char_length(whatsapp_url) <= 2048))
        and (instagram_url is null or (instagram_url ~* '^https://[^[:space:]]+$' and char_length(instagram_url) <= 2048))
        and (facebook_url is null or (facebook_url ~* '^https://[^[:space:]]+$' and char_length(facebook_url) <= 2048))
        and (linkedin_url is null or (linkedin_url ~* '^https://[^[:space:]]+$' and char_length(linkedin_url) <= 2048))
        and (x_url is null or (x_url ~* '^https://[^[:space:]]+$' and char_length(x_url) <= 2048))
        and (website_url is null or (website_url ~* '^https://[^[:space:]]+$' and char_length(website_url) <= 2048))
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tutor_contacts_links_https'
      and conrelid = 'public.tutor_contacts'::regclass
  ) then
    alter table public.tutor_contacts
      add constraint tutor_contacts_links_https check (
        (whatsapp_url is null or (whatsapp_url ~* '^https://[^[:space:]]+$' and char_length(whatsapp_url) <= 2048))
        and (instagram_url is null or (instagram_url ~* '^https://[^[:space:]]+$' and char_length(instagram_url) <= 2048))
        and (facebook_url is null or (facebook_url ~* '^https://[^[:space:]]+$' and char_length(facebook_url) <= 2048))
        and (linkedin_url is null or (linkedin_url ~* '^https://[^[:space:]]+$' and char_length(linkedin_url) <= 2048))
        and (x_url is null or (x_url ~* '^https://[^[:space:]]+$' and char_length(x_url) <= 2048))
        and (website_url is null or (website_url ~* '^https://[^[:space:]]+$' and char_length(website_url) <= 2048))
      );
  end if;
end
$$;
