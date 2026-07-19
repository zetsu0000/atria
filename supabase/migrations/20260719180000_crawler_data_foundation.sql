-- Atria crawler + operational status foundation
-- Forward-only. Service-role access only. No anon/authenticated policies.

-- ---------------------------------------------------------------------------
-- Expand leads.status (preserve legacy values already in production)
-- ---------------------------------------------------------------------------
alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (status in (
    -- operational model
    'new',
    'contacted',
    'qualified',
    'crawl_pending',
    'crawling',
    'crawl_complete',
    'preview_in_progress',
    'preview_ready',
    'approved',
    'published',
    'lost',
    'archived',
    -- legacy capture-era values (read/transition compatible)
    'replied',
    'meeting',
    'proposal',
    'won',
    'do_not_contact'
  ));

-- ---------------------------------------------------------------------------
-- lead_status_history
-- ---------------------------------------------------------------------------
create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status text null,
  to_status text not null,
  reason text null,
  actor_type text not null
    check (actor_type in ('system', 'operator', 'crawler', 'automation')),
  actor_identifier text not null,
  created_at timestamptz not null default now(),

  constraint lead_status_history_from_status_check check (
    from_status is null or from_status in (
      'new', 'contacted', 'qualified', 'crawl_pending', 'crawling',
      'crawl_complete', 'preview_in_progress', 'preview_ready', 'approved',
      'published', 'lost', 'archived', 'replied', 'meeting', 'proposal',
      'won', 'do_not_contact'
    )
  ),
  constraint lead_status_history_to_status_check check (
    to_status in (
      'new', 'contacted', 'qualified', 'crawl_pending', 'crawling',
      'crawl_complete', 'preview_in_progress', 'preview_ready', 'approved',
      'published', 'lost', 'archived', 'replied', 'meeting', 'proposal',
      'won', 'do_not_contact'
    )
  ),
  constraint lead_status_history_reason_len check (
    reason is null or char_length(reason) <= 500
  ),
  constraint lead_status_history_actor_identifier_len check (
    char_length(actor_identifier) <= 160
  )
);

comment on table public.lead_status_history is
  'Audit trail for lead status changes. Service-role only.';

create index if not exists lead_status_history_lead_id_created_at_idx
  on public.lead_status_history (lead_id, created_at desc);

alter table public.lead_status_history enable row level security;
revoke all on table public.lead_status_history from anon, authenticated;
grant all on table public.lead_status_history to service_role;

-- ---------------------------------------------------------------------------
-- crawl_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  requested_url text not null,
  normalized_origin text not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'running', 'completed', 'partial', 'failed', 'cancelled'
    )),
  max_pages integer not null default 10
    check (max_pages >= 1 and max_pages <= 20),
  pages_discovered integer not null default 0
    check (pages_discovered >= 0),
  pages_fetched integer not null default 0
    check (pages_fetched >= 0),
  pages_failed integer not null default 0
    check (pages_failed >= 0),
  started_at timestamptz null,
  completed_at timestamptz null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crawl_jobs_requested_url_len check (char_length(requested_url) <= 2048),
  constraint crawl_jobs_normalized_origin_len check (char_length(normalized_origin) <= 2048),
  constraint crawl_jobs_error_code_len check (
    error_code is null or char_length(error_code) <= 64
  ),
  constraint crawl_jobs_error_message_len check (
    error_message is null or char_length(error_message) <= 500
  )
);

comment on table public.crawl_jobs is
  'Internal crawl jobs for public clinic websites. Service-role only.';

create index if not exists crawl_jobs_lead_id_created_at_idx
  on public.crawl_jobs (lead_id, created_at desc);

create index if not exists crawl_jobs_status_created_at_idx
  on public.crawl_jobs (status, created_at desc);

create or replace function public.set_crawl_jobs_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crawl_jobs_set_updated_at on public.crawl_jobs;
create trigger crawl_jobs_set_updated_at
  before update on public.crawl_jobs
  for each row
  execute function public.set_crawl_jobs_updated_at();

alter table public.crawl_jobs enable row level security;
revoke all on table public.crawl_jobs from anon, authenticated;
grant all on table public.crawl_jobs to service_role;

-- ---------------------------------------------------------------------------
-- crawl_pages
-- ---------------------------------------------------------------------------
create table if not exists public.crawl_pages (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid not null references public.crawl_jobs (id) on delete cascade,
  url text not null,
  normalized_url text not null,
  path text not null,
  status_code integer null,
  content_type text null,
  title text null,
  meta_description text null,
  canonical_url text null,
  headings jsonb not null default '[]'::jsonb,
  main_text text null,
  links_internal jsonb not null default '[]'::jsonb,
  content_hash text null,
  fetch_duration_ms integer null,
  fetched_at timestamptz null,
  error_code text null,

  constraint crawl_pages_url_len check (char_length(url) <= 2048),
  constraint crawl_pages_normalized_url_len check (char_length(normalized_url) <= 2048),
  constraint crawl_pages_path_len check (char_length(path) <= 2048),
  constraint crawl_pages_content_type_len check (
    content_type is null or char_length(content_type) <= 160
  ),
  constraint crawl_pages_title_len check (
    title is null or char_length(title) <= 500
  ),
  constraint crawl_pages_meta_description_len check (
    meta_description is null or char_length(meta_description) <= 1000
  ),
  constraint crawl_pages_canonical_url_len check (
    canonical_url is null or char_length(canonical_url) <= 2048
  ),
  constraint crawl_pages_main_text_len check (
    main_text is null or char_length(main_text) <= 50000
  ),
  constraint crawl_pages_content_hash_len check (
    content_hash is null or char_length(content_hash) <= 128
  ),
  constraint crawl_pages_error_code_len check (
    error_code is null or char_length(error_code) <= 64
  ),
  constraint crawl_pages_job_normalized_url_unique unique (crawl_job_id, normalized_url)
);

comment on table public.crawl_pages is
  'Normalized HTML page extracts for crawl jobs. No raw HTML/cookies/headers. Service-role only.';

create index if not exists crawl_pages_crawl_job_id_fetched_at_idx
  on public.crawl_pages (crawl_job_id, fetched_at desc);

alter table public.crawl_pages enable row level security;
revoke all on table public.crawl_pages from anon, authenticated;
grant all on table public.crawl_pages to service_role;

-- ---------------------------------------------------------------------------
-- crawl_findings
-- ---------------------------------------------------------------------------
create table if not exists public.crawl_findings (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid not null references public.crawl_jobs (id) on delete cascade,
  category text not null
    check (category in (
      'security', 'robots', 'fetch', 'parse', 'content', 'ops'
    )),
  severity text not null
    check (severity in ('info', 'low', 'medium', 'high')),
  code text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  page_url text null,
  created_at timestamptz not null default now(),

  constraint crawl_findings_code_len check (char_length(code) <= 64),
  constraint crawl_findings_summary_len check (char_length(summary) <= 500),
  constraint crawl_findings_page_url_len check (
    page_url is null or char_length(page_url) <= 2048
  )
);

comment on table public.crawl_findings is
  'Operational crawl findings and safe error summaries. Service-role only.';

create index if not exists crawl_findings_crawl_job_id_created_at_idx
  on public.crawl_findings (crawl_job_id, created_at desc);

alter table public.crawl_findings enable row level security;
revoke all on table public.crawl_findings from anon, authenticated;
grant all on table public.crawl_findings to service_role;
