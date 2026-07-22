-- Atria manual_outreach_logs: append-only audit log of what a human
-- operator did *outside* this system after manually contacting a clinic
-- (WhatsApp/email/phone), and what happened afterward. Additive only — a
-- brand new table, no existing table/column/constraint is altered or
-- dropped.
--
-- Rationale: docs/technical/crawler-manual-outreach-pack.md closed the
-- loop up to "here is the approved copy an operator should send manually."
-- This table closes the loop on the other side — a place for a human to
-- record that they sent it (or rehearsed sending it), got a response, or
-- need a follow-up — without this codebase ever sending anything itself.
-- No WhatsApp/email provider integration exists anywhere in this
-- codebase, and this table does not change that: it is a log, not a
-- trigger. Recording a row here never mutates outreach_messages.body/
-- subject, never mutates human_review_decisions, and never transitions
-- outreach_messages.status on its own (see
-- lib/operations/manual-outreach-logging/record-manual-outreach-log.ts).

create table if not exists public.manual_outreach_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  outreach_message_id uuid not null references public.outreach_messages (id) on delete cascade,
  human_review_decision_id uuid null references public.human_review_decisions (id) on delete set null,
  channel text not null
    check (channel in ('whatsapp', 'email', 'phone', 'other')),
  event_type text not null
    check (event_type in (
      'manual_send_logged',
      'response_logged',
      'follow_up_logged',
      'no_response_logged',
      'do_not_contact_logged',
      'rehearsal_logged'
    )),
  operator_name text not null,
  occurred_at timestamptz not null,
  notes text null,
  response_received boolean null,
  follow_up_needed boolean null,
  follow_up_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint manual_outreach_logs_operator_name_len check (
    char_length(operator_name) >= 1 and char_length(operator_name) <= 160
  ),
  constraint manual_outreach_logs_notes_len check (
    notes is null or char_length(notes) <= 4000
  )
);

comment on table public.manual_outreach_logs is
  'Append-only audit log of manual outreach operator actions (send/response/follow-up/rehearsal) recorded after the fact. Never sends anything itself — no provider integration exists in this codebase. Service-role only.';

comment on column public.manual_outreach_logs.event_type is
  'manual_send_logged records that an operator manually sent the approved copy outside this system. rehearsal_logged proves the logging pipeline works without asserting a real send happened — used for staging validation. No row here is ever written automatically.';

comment on column public.manual_outreach_logs.occurred_at is
  'When the logged event actually happened (operator-supplied), distinct from created_at (when the log row was inserted).';

create index if not exists manual_outreach_logs_clinic_id_idx
  on public.manual_outreach_logs (clinic_id);

create index if not exists manual_outreach_logs_outreach_message_id_idx
  on public.manual_outreach_logs (outreach_message_id);

create index if not exists manual_outreach_logs_occurred_at_idx
  on public.manual_outreach_logs (occurred_at desc);

alter table public.manual_outreach_logs enable row level security;
revoke all on table public.manual_outreach_logs from anon, authenticated;
grant all on table public.manual_outreach_logs to service_role;
