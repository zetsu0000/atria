-- Atria crawl_jobs: support both lead-centric and clinic-centric crawls
-- Additive only. Preserves existing data, FK, RLS, and indexes.
--
-- Rationale: the discovery/outbound flow creates crawl jobs for clinics
-- that have no inbound lead yet (clinic_id present, lead_id null). The
-- legacy/inbound flow keeps lead_id present, with clinic_id optional or
-- derived later. crawl_jobs must accept either, but never neither.

-- ---------------------------------------------------------------------------
-- lead_id becomes optional (FK to leads is preserved; FK constraints do not
-- require NOT NULL to be enforced)
-- ---------------------------------------------------------------------------
alter table public.crawl_jobs
  alter column lead_id drop not null;

-- ---------------------------------------------------------------------------
-- clinic_id: ensure it exists (idempotent — already added by
-- 20260720120000_discovery_clinic_score_foundation.sql, kept here so this
-- migration is self-sufficient and safe to reason about in isolation)
-- ---------------------------------------------------------------------------
alter table public.crawl_jobs
  add column if not exists clinic_id uuid null;

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

-- ---------------------------------------------------------------------------
-- Require at least one of lead_id / clinic_id (never neither; both is fine)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crawl_jobs_requires_lead_or_clinic'
  ) then
    alter table public.crawl_jobs
      add constraint crawl_jobs_requires_lead_or_clinic
      check (lead_id is not null or clinic_id is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes (idempotent; lead_id index already exists from
-- 20260719180000, clinic_id index already exists from 20260720120000 —
-- kept here so this migration is self-sufficient)
-- ---------------------------------------------------------------------------
create index if not exists crawl_jobs_lead_id_created_at_idx
  on public.crawl_jobs (lead_id, created_at desc);

create index if not exists crawl_jobs_clinic_id_idx
  on public.crawl_jobs (clinic_id)
  where clinic_id is not null;

-- RLS is unchanged: still enabled, still service-role only.
