-- Atria discovery / clinic / score / outreach foundation
-- Additive only. Preserves leads + crawl_* tables. Service-role access only.

-- ---------------------------------------------------------------------------
-- Align crawl_jobs default page budget with PROJECT_CRAWLER.md (8 pages)
-- ---------------------------------------------------------------------------
alter table public.crawl_jobs
  alter column max_pages set default 8;

alter table public.crawl_jobs
  add column if not exists clinic_id uuid null;

alter table public.crawl_jobs
  add column if not exists requires_human_review boolean not null default true;

comment on column public.crawl_jobs.requires_human_review is
  'All crawl outputs require human review before commercial use.';

-- ---------------------------------------------------------------------------
-- discovery_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in (
      'manual',
      'csv_import',
      'google_places',
      'web_search',
      'directory',
      'other'
    )),
  status text not null default 'queued'
    check (status in (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled'
    )),
  query jsonb not null default '{}'::jsonb,
  notes text null,
  candidates_created integer not null default 0
    check (candidates_created >= 0),
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,

  constraint discovery_jobs_notes_len check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint discovery_jobs_error_code_len check (
    error_code is null or char_length(error_code) <= 64
  ),
  constraint discovery_jobs_error_message_len check (
    error_message is null or char_length(error_message) <= 500
  )
);

comment on table public.discovery_jobs is
  'Internal discovery/import jobs. No live external API calls required by schema. Service-role only.';

create index if not exists discovery_jobs_status_created_at_idx
  on public.discovery_jobs (status, created_at desc);

create or replace function public.set_discovery_jobs_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists discovery_jobs_set_updated_at on public.discovery_jobs;
create trigger discovery_jobs_set_updated_at
  before update on public.discovery_jobs
  for each row
  execute function public.set_discovery_jobs_updated_at();

alter table public.discovery_jobs enable row level security;
revoke all on table public.discovery_jobs from anon, authenticated;
grant all on table public.discovery_jobs to service_role;

-- ---------------------------------------------------------------------------
-- clinics (created before candidates FK for promotion target)
-- ---------------------------------------------------------------------------
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text not null,
  website_url text null,
  normalized_website_origin text null,
  city text null,
  state text null,
  specialty text null,
  status text not null default 'prospect'
    check (status in (
      'prospect',
      'qualified',
      'previewing',
      'client',
      'inactive',
      'archived'
    )),
  lead_id uuid null references public.leads (id) on delete set null,
  source_type text not null default 'manual'
    check (source_type in (
      'manual',
      'csv_import',
      'google_places',
      'web_search',
      'directory',
      'other',
      'inbound_lead'
    )),
  source_attribution jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clinics_display_name_len check (char_length(display_name) <= 200),
  constraint clinics_normalized_name_len check (char_length(normalized_name) <= 200),
  constraint clinics_website_url_len check (
    website_url is null or char_length(website_url) <= 2048
  ),
  constraint clinics_normalized_website_origin_len check (
    normalized_website_origin is null
    or char_length(normalized_website_origin) <= 2048
  ),
  constraint clinics_city_len check (city is null or char_length(city) <= 120),
  constraint clinics_state_len check (state is null or char_length(state) <= 80),
  constraint clinics_specialty_len check (
    specialty is null or char_length(specialty) <= 120
  ),
  constraint clinics_dedupe_key_len check (char_length(dedupe_key) <= 512),
  constraint clinics_notes_len check (notes is null or char_length(notes) <= 2000),
  constraint clinics_dedupe_key_unique unique (dedupe_key)
);

comment on table public.clinics is
  'Canonical clinic/prospect records for outbound discovery. Service-role only.';

create index if not exists clinics_status_created_at_idx
  on public.clinics (status, created_at desc);

create index if not exists clinics_lead_id_idx
  on public.clinics (lead_id)
  where lead_id is not null;

create index if not exists clinics_normalized_website_origin_idx
  on public.clinics (normalized_website_origin)
  where normalized_website_origin is not null;

create or replace function public.set_clinics_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinics_set_updated_at on public.clinics;
create trigger clinics_set_updated_at
  before update on public.clinics
  for each row
  execute function public.set_clinics_updated_at();

alter table public.clinics enable row level security;
revoke all on table public.clinics from anon, authenticated;
grant all on table public.clinics to service_role;

-- FK from crawl_jobs.clinic_id (deferred until clinics exists)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crawl_jobs_clinic_id_fkey'
  ) then
    alter table public.crawl_jobs
      add constraint crawl_jobs_clinic_id_fkey
      foreign key (clinic_id) references public.clinics (id) on delete set null;
  end if;
end $$;

create index if not exists crawl_jobs_clinic_id_idx
  on public.crawl_jobs (clinic_id)
  where clinic_id is not null;

-- ---------------------------------------------------------------------------
-- prospect_candidates
-- ---------------------------------------------------------------------------
create table if not exists public.prospect_candidates (
  id uuid primary key default gen_random_uuid(),
  discovery_job_id uuid null references public.discovery_jobs (id) on delete set null,
  source_type text not null
    check (source_type in (
      'manual',
      'csv_import',
      'google_places',
      'web_search',
      'directory',
      'other'
    )),
  status text not null default 'new'
    check (status in (
      'new',
      'needs_review',
      'duplicate',
      'rejected',
      'promoted_to_clinic'
    )),
  raw_name text not null,
  normalized_name text not null,
  website_url text null,
  normalized_website_origin text null,
  phone text null,
  email text null,
  city text null,
  state text null,
  specialty text null,
  source_attribution jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  promoted_clinic_id uuid null references public.clinics (id) on delete set null,
  review_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prospect_candidates_raw_name_len check (char_length(raw_name) <= 200),
  constraint prospect_candidates_normalized_name_len check (
    char_length(normalized_name) <= 200
  ),
  constraint prospect_candidates_website_url_len check (
    website_url is null or char_length(website_url) <= 2048
  ),
  constraint prospect_candidates_normalized_website_origin_len check (
    normalized_website_origin is null
    or char_length(normalized_website_origin) <= 2048
  ),
  constraint prospect_candidates_phone_len check (
    phone is null or char_length(phone) <= 32
  ),
  constraint prospect_candidates_email_len check (
    email is null or char_length(email) <= 254
  ),
  constraint prospect_candidates_city_len check (
    city is null or char_length(city) <= 120
  ),
  constraint prospect_candidates_state_len check (
    state is null or char_length(state) <= 80
  ),
  constraint prospect_candidates_specialty_len check (
    specialty is null or char_length(specialty) <= 120
  ),
  constraint prospect_candidates_dedupe_key_len check (
    char_length(dedupe_key) <= 512
  ),
  constraint prospect_candidates_review_notes_len check (
    review_notes is null or char_length(review_notes) <= 2000
  )
);

comment on table public.prospect_candidates is
  'Raw discovery candidates before promotion. Never used for automatic outreach. Service-role only.';

create index if not exists prospect_candidates_status_created_at_idx
  on public.prospect_candidates (status, created_at desc);

create index if not exists prospect_candidates_dedupe_key_idx
  on public.prospect_candidates (dedupe_key);

create index if not exists prospect_candidates_discovery_job_id_idx
  on public.prospect_candidates (discovery_job_id)
  where discovery_job_id is not null;

create or replace function public.set_prospect_candidates_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospect_candidates_set_updated_at on public.prospect_candidates;
create trigger prospect_candidates_set_updated_at
  before update on public.prospect_candidates
  for each row
  execute function public.set_prospect_candidates_updated_at();

alter table public.prospect_candidates enable row level security;
revoke all on table public.prospect_candidates from anon, authenticated;
grant all on table public.prospect_candidates to service_role;

-- ---------------------------------------------------------------------------
-- clinic_contacts
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  contact_type text not null
    check (contact_type in (
      'email',
      'phone',
      'whatsapp',
      'instagram',
      'form',
      'other'
    )),
  value text not null,
  normalized_value text not null,
  source_url text null,
  extraction_method text not null default 'manual'
    check (extraction_method in (
      'manual',
      'html_anchor',
      'html_text',
      'meta',
      'json_ld',
      'import',
      'other'
    )),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  review_status text not null default 'pending_review'
    check (review_status in (
      'pending_review',
      'approved',
      'rejected',
      'needs_review'
    )),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clinic_contacts_value_len check (char_length(value) <= 500),
  constraint clinic_contacts_normalized_value_len check (
    char_length(normalized_value) <= 500
  ),
  constraint clinic_contacts_source_url_len check (
    source_url is null or char_length(source_url) <= 2048
  )
);

comment on table public.clinic_contacts is
  'Clinic contact candidates with provenance. Not patient data. Service-role only.';

create index if not exists clinic_contacts_clinic_id_idx
  on public.clinic_contacts (clinic_id);

create index if not exists clinic_contacts_review_status_idx
  on public.clinic_contacts (review_status);

create or replace function public.set_clinic_contacts_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinic_contacts_set_updated_at on public.clinic_contacts;
create trigger clinic_contacts_set_updated_at
  before update on public.clinic_contacts
  for each row
  execute function public.set_clinic_contacts_updated_at();

alter table public.clinic_contacts enable row level security;
revoke all on table public.clinic_contacts from anon, authenticated;
grant all on table public.clinic_contacts to service_role;

-- ---------------------------------------------------------------------------
-- scan_assets (metadata only; private storage paths)
-- ---------------------------------------------------------------------------
create table if not exists public.scan_assets (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid not null references public.crawl_jobs (id) on delete cascade,
  asset_type text not null
    check (asset_type in (
      'screenshot_desktop',
      'screenshot_mobile',
      'other'
    )),
  storage_path text not null,
  content_type text null,
  width_px integer null,
  height_px integer null,
  page_url text null,
  review_status text not null default 'pending_review'
    check (review_status in (
      'pending_review',
      'approved',
      'rejected',
      'needs_review'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint scan_assets_storage_path_len check (char_length(storage_path) <= 1024),
  constraint scan_assets_content_type_len check (
    content_type is null or char_length(content_type) <= 160
  ),
  constraint scan_assets_page_url_len check (
    page_url is null or char_length(page_url) <= 2048
  ),
  constraint scan_assets_width_positive check (
    width_px is null or width_px > 0
  ),
  constraint scan_assets_height_positive check (
    height_px is null or height_px > 0
  )
);

comment on table public.scan_assets is
  'Screenshot/asset metadata. Bytes live in private storage, never public. Service-role only.';

create index if not exists scan_assets_crawl_job_id_idx
  on public.scan_assets (crawl_job_id);

alter table public.scan_assets enable row level security;
revoke all on table public.scan_assets from anon, authenticated;
grant all on table public.scan_assets to service_role;

-- ---------------------------------------------------------------------------
-- extracted_content (versioned candidates with provenance)
-- ---------------------------------------------------------------------------
create table if not exists public.extracted_content (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid not null references public.crawl_jobs (id) on delete cascade,
  clinic_id uuid null references public.clinics (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  payload jsonb not null default '{}'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending_review'
    check (review_status in (
      'pending_review',
      'approved',
      'rejected',
      'needs_review'
    )),
  created_at timestamptz not null default now(),

  constraint extracted_content_job_version_unique unique (crawl_job_id, version)
);

comment on table public.extracted_content is
  'Versioned extraction candidates with provenance. Candidates are not facts. Service-role only.';

create index if not exists extracted_content_crawl_job_id_idx
  on public.extracted_content (crawl_job_id);

alter table public.extracted_content enable row level security;
revoke all on table public.extracted_content from anon, authenticated;
grant all on table public.extracted_content to service_role;

-- ---------------------------------------------------------------------------
-- scores
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid null references public.crawl_jobs (id) on delete set null,
  clinic_id uuid null references public.clinics (id) on delete set null,
  credibility integer not null check (credibility between 0 and 20),
  clarity integer not null check (clarity between 0 and 20),
  mobile integer not null check (mobile between 0 and 20),
  actionability integer not null check (actionability between 0 and 20),
  freshness integer not null check (freshness between 0 and 20),
  total integer not null check (total between 0 and 100),
  evidence jsonb not null default '[]'::jsonb,
  disclaimer text not null
    default 'Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.',
  review_status text not null default 'pending_review'
    check (review_status in (
      'pending_review',
      'approved',
      'rejected',
      'needs_review',
      'adjusted'
    )),
  scoring_version text not null default 'placeholder-v0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scores_disclaimer_len check (char_length(disclaimer) <= 500),
  constraint scores_scoring_version_len check (char_length(scoring_version) <= 64),
  constraint scores_total_matches_parts check (
    total = credibility + clarity + mobile + actionability + freshness
  ),
  constraint scores_has_subject check (
    crawl_job_id is not null or clinic_id is not null
  )
);

comment on table public.scores is
  'Digital first-impression scores with evidence. Not medical quality. Service-role only.';

create index if not exists scores_clinic_id_idx
  on public.scores (clinic_id)
  where clinic_id is not null;

create index if not exists scores_crawl_job_id_idx
  on public.scores (crawl_job_id)
  where crawl_job_id is not null;

create or replace function public.set_scores_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scores_set_updated_at on public.scores;
create trigger scores_set_updated_at
  before update on public.scores
  for each row
  execute function public.set_scores_updated_at();

alter table public.scores enable row level security;
revoke all on table public.scores from anon, authenticated;
grant all on table public.scores to service_role;

-- ---------------------------------------------------------------------------
-- outreach_messages (draft foundation — no automatic sending)
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  lead_id uuid null references public.leads (id) on delete set null,
  channel text not null
    check (channel in ('email', 'whatsapp_manual', 'other')),
  status text not null default 'draft'
    check (status in (
      'draft',
      'approved',
      'sent',
      'replied',
      'ignored',
      'rejected'
    )),
  subject text null,
  body text not null,
  evidence jsonb not null default '[]'::jsonb,
  click_to_chat_url text null,
  human_reviewed boolean not null default false,
  reviewed_at timestamptz null,
  reviewed_by text null,
  do_not_contact_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outreach_messages_subject_len check (
    subject is null or char_length(subject) <= 200
  ),
  constraint outreach_messages_body_len check (char_length(body) <= 10000),
  constraint outreach_messages_click_to_chat_url_len check (
    click_to_chat_url is null or char_length(click_to_chat_url) <= 2048
  ),
  constraint outreach_messages_reviewed_by_len check (
    reviewed_by is null or char_length(reviewed_by) <= 160
  ),
  constraint outreach_messages_sent_requires_review check (
    status <> 'sent' or (human_reviewed = true and do_not_contact_blocked = false)
  )
);

comment on table public.outreach_messages is
  'Human-reviewed outreach drafts. No automatic mass send. Service-role only.';

create index if not exists outreach_messages_clinic_id_idx
  on public.outreach_messages (clinic_id);

create index if not exists outreach_messages_status_idx
  on public.outreach_messages (status);

create or replace function public.set_outreach_messages_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists outreach_messages_set_updated_at on public.outreach_messages;
create trigger outreach_messages_set_updated_at
  before update on public.outreach_messages
  for each row
  execute function public.set_outreach_messages_updated_at();

alter table public.outreach_messages enable row level security;
revoke all on table public.outreach_messages from anon, authenticated;
grant all on table public.outreach_messages to service_role;
