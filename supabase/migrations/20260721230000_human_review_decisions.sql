-- Atria human_review_decisions: audit log of human review decisions on a
-- clinic's crawler/review-pack output. Additive only — a brand new table,
-- no existing table/column/constraint is altered or dropped.
--
-- Rationale: the review-pack generator (scripts/crawler/generate-human-review-pack.ts)
-- is read-only and never decides anything. This table is where a human's
-- explicit decision (approved / rejected / needs_changes) gets recorded,
-- so that "no outreach can move beyond draft unless a human review
-- decision exists" is auditable. It is intentionally append-only (one row
-- per decision event, never updated/deleted) so a clinic's review history
-- (e.g. needs_changes -> improvements -> approved) is preserved rather
-- than overwritten. This migration does not change outreach_messages.status
-- in any way — recording a decision here never sends anything and never
-- auto-transitions any outreach row; it is a separate, independent record.

create table if not exists public.human_review_decisions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  crawl_job_id uuid null references public.crawl_jobs (id) on delete set null,
  score_id uuid null references public.scores (id) on delete set null,
  outreach_message_id uuid null references public.outreach_messages (id) on delete set null,
  decision text not null
    check (decision in ('approved', 'rejected', 'needs_changes')),
  reviewer_notes text null,
  reviewer text null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint human_review_decisions_reviewer_notes_len check (
    reviewer_notes is null or char_length(reviewer_notes) <= 4000
  ),
  constraint human_review_decisions_reviewer_len check (
    reviewer is null or char_length(reviewer) <= 160
  )
);

comment on table public.human_review_decisions is
  'Append-only audit log of human review decisions (approved/rejected/needs_changes) on a clinic''s crawler output. Never sends anything. Service-role only.';

comment on column public.human_review_decisions.decision is
  'Explicit human decision. No automatic approval exists anywhere in this codebase — every row here was written by an explicit --decision CLI call.';

create index if not exists human_review_decisions_clinic_id_reviewed_at_idx
  on public.human_review_decisions (clinic_id, reviewed_at desc);

create index if not exists human_review_decisions_decision_idx
  on public.human_review_decisions (decision);

alter table public.human_review_decisions enable row level security;
revoke all on table public.human_review_decisions from anon, authenticated;
grant all on table public.human_review_decisions to service_role;
