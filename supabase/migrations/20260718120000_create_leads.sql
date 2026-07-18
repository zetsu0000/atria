-- Atria lead capture foundation
-- Access model: service-role only. Do not grant anon/authenticated table privileges.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  clinic_name text not null,
  contact_role text not null,
  website_url text not null,
  email text not null,
  phone text not null,
  city text not null,
  website_problem text null,
  consent boolean not null default false,
  consent_at timestamptz not null,
  consent_text_version text not null,
  source text not null default 'landing-solicitar',
  status text not null default 'new'
    check (status in (
      'new',
      'qualified',
      'contacted',
      'replied',
      'meeting',
      'proposal',
      'won',
      'lost',
      'do_not_contact'
    )),
  dedup_hash text not null,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  notification_attempted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_contact_name_len check (char_length(contact_name) <= 120),
  constraint leads_clinic_name_len check (char_length(clinic_name) <= 160),
  constraint leads_contact_role_len check (char_length(contact_role) <= 40),
  constraint leads_website_url_len check (char_length(website_url) <= 2048),
  constraint leads_email_len check (char_length(email) <= 254),
  constraint leads_phone_len check (char_length(phone) <= 32),
  constraint leads_city_len check (char_length(city) <= 120),
  constraint leads_website_problem_len check (
    website_problem is null or char_length(website_problem) <= 1000
  ),
  constraint leads_source_len check (char_length(source) <= 64),
  constraint leads_consent_required check (consent = true)
);

comment on table public.leads is
  'Public lead capture for Atria preview requests. Service-role access only.';

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_email_created_at_idx
  on public.leads (email, created_at desc);

create index if not exists leads_dedup_hash_created_at_idx
  on public.leads (dedup_hash, created_at desc);

create index if not exists leads_status_created_at_idx
  on public.leads (status, created_at desc);

create or replace function public.set_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row
  execute function public.set_leads_updated_at();

alter table public.leads enable row level security;

-- No policies for anon/authenticated: browser clients must not read or write leads.
-- Server uses the service-role key, which bypasses RLS.

revoke all on table public.leads from anon, authenticated;
grant all on table public.leads to service_role;
