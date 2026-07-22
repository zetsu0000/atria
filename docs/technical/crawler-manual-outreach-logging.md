# Manual outreach logging

The write-side counterpart to the Manual Outreach Pack
(`docs/technical/crawler-manual-outreach-pack.md`): a safe, append-only
way for a human operator to record what happened *after* they manually
contacted a clinic outside this system. Closes the operational loop
without ever introducing a send capability.

## Purpose

The Manual Outreach Pack tells an operator what to send and to whom. It
has no way to record that the operator actually did it, got a reply, or
needs to follow up. This foundation adds that missing half: an
append-only `manual_outreach_logs` table plus a small, safety-gated
repository/CLI layer for recording those events.

## Difference between logging and sending

**Logging a manual outreach result is not the same as sending.** No API
sending, no WhatsApp API, no email sending, no automatic follow-up, and
no automatic status transition exists anywhere in this module except one
narrow, explicitly modeled and tested exception (`do_not_contact_logged`
→ `clinicRepo.setDoNotContact`, see below). Recording an event is a
human, after-the-fact statement of what they did outside this codebase —
this codebase never initiates or confirms a real send itself.

## Table shape (`manual_outreach_logs`)

Additive migration:
`supabase/migrations/20260722190000_manual_outreach_logs.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `clinic_id` | uuid not null | FK → `clinics(id)` on delete cascade |
| `outreach_message_id` | uuid not null | FK → `outreach_messages(id)` on delete cascade |
| `human_review_decision_id` | uuid null | FK → `human_review_decisions(id)` on delete set null; populated only for `manual_send_logged`, from the decision the approval gate actually used |
| `channel` | text not null | check: `whatsapp`, `email`, `phone`, `other` |
| `event_type` | text not null | check: `manual_send_logged`, `response_logged`, `follow_up_logged`, `no_response_logged`, `do_not_contact_logged`, `rehearsal_logged` |
| `operator_name` | text not null | 1–160 chars |
| `occurred_at` | timestamptz not null | when the event actually happened (operator-supplied) |
| `notes` | text null | ≤4000 chars |
| `response_received` | boolean null | |
| `follow_up_needed` | boolean null | |
| `follow_up_at` | timestamptz null | |
| `metadata` | jsonb not null default `{}` | |
| `created_at` | timestamptz not null default now() | when the row was inserted |

RLS enabled; `anon`/`authenticated` revoked; `service_role` granted all —
identical pattern to `human_review_decisions` and `outreach_messages`.
Indexes on `clinic_id`, `outreach_message_id`, `occurred_at desc`. No
uniqueness constraint — repeated logs for the same message (e.g. a
follow-up months later) are legitimate and must not be blocked.

## Event types

- **`manual_send_logged`** — an operator manually sent the approved copy
  outside this system. The only event type that re-checks the outreach
  approval gate at write time (see below).
- **`response_logged`** — the clinic responded. Requires a prior
  `manual_send_logged` for the same `outreach_message_id`.
- **`follow_up_logged`** — a follow-up is needed or was done. Same prior-send requirement.
- **`no_response_logged`** — no response after a send. Same prior-send requirement.
- **`do_not_contact_logged`** — the clinic asked not to be contacted
  again. See "The one mutation exception" below.
- **`rehearsal_logged`** — proves the logging pipeline works without
  asserting a real send happened. No approval-gate check, no prior-send
  requirement. This is what staging validation uses instead of a fake
  `manual_send_logged`.

## Approval gate dependency

`manual_send_logged` reuses the existing, already-tested outreach
approval gate (`canPrepareOutreachForSend`,
`lib/operations/outreach/approval-gate.ts`) — the same gate the Manual
Outreach Pack depends on. It is not re-implemented. If the gate blocks
(missing/`needs_changes`/`rejected` decision, `do_not_contact`, a
non-sendable message status, or a message that doesn't belong to the
clinic), `recordManualOutreachLog` refuses before ever calling
`manualOutreachLogRepo.recordLog` — no row is written for a blocked
`manual_send_logged` attempt.

`response_logged`/`follow_up_logged`/`no_response_logged` deliberately do
**not** re-check the gate: by the time a response comes in, the message
may legitimately be in a different status than "draft"/"approved", and
re-running the gate on it would incorrectly block a legitimate log entry.
Their only precondition is a prior `manual_send_logged` row for the same
message.

## Append-only behavior

`ManualOutreachLogRepository` has exactly three methods:
`recordLog`, `listForClinic`, `listForOutreachMessage`. There is no
update or delete method anywhere in the interface, the fake, or the
Supabase adapter — a clinic's manual-outreach history can only grow,
never be rewritten. Verified by test #17
(`lib/operations/manual-outreach-logging.test.ts`): recording a second
event never mutates the first row.

## The one mutation exception (`do_not_contact_logged`)

Per the task's safety rule ("only mutate clinic/contact do_not_contact if
a clearly existing safe field already exists and tests prove it"): the
`clinics.doNotContact` flag and its `ClinicRepository.setDoNotContact`
method already existed before this task, and were already exercised by
`lib/operations/outreach-approval-gate.test.ts`. Reusing that exact,
already-tested method — rather than inventing new behavior — is the
narrow, explicitly modeled exception this task allows:

1. The append-only log row is always inserted first (`event_type:
   "do_not_contact_logged"`).
2. `clinicRepo.setDoNotContact(clinicId, true, notes)` is then called.
3. If step 2 fails, the log row still exists — nothing is lost — and the
   result reports `sideEffects.doNotContactUpdated: false` so the caller
   knows to follow up manually.

No other event type ever calls `setDoNotContact`, `markSent`, `approve`,
`createDraft`, or `recordDecision`. Tests #23–25 assert this directly by
monkey-patching those methods and asserting they're never invoked for
the other event types.

## CLI usage

Two commands, both read/write-gated the same way as every other CLI in
this codebase (`selectRepositories`/`assertSafeTarget` — production is
always refused):

```
npm run crawler:outreach-log:record -- --target staging --clinic-id <id> \
  --outreach-message-id <id> --event-type rehearsal_logged --channel whatsapp \
  --operator-name "Atria QA" --occurred-at 2026-07-22T19:15:00Z --notes "..."

npm run crawler:outreach-log:list -- --target staging --clinic-id <id>
```

**Safe by default:** `crawler:outreach-log:record` defaults to a dry run
— it validates every field and prints exactly what *would* be recorded,
without touching Supabase config at all, until `--dry-run false` is
explicitly passed. This is deliberate: `manual_send_logged` is a claim
that a human already sent something outside this system, and that claim
should never be written by accident. The dry-run preview works even with
no Supabase configuration present at all (it never calls
`selectRepositories`), so it's always available as a safe first step.

## Staging validation

Ran against real SkinLaser staging data (clinic
`bbfd72a3-a013-4a6c-bd82-4a70479d694a`, WhatsApp draft
`ca0c3fba-86ac-442c-afb5-276552287177`, approved decision
`bbf7e956-7564-479b-a892-00da2a06c2e4`) — staging ref reconfirmed as
`lfkyiztuwptmddsraucg` via `supabase/.temp/project-ref` before every
step; production ref `cskodsnvghavkcjwmafr` never targeted.

### Migration

The additive migration
(`supabase/migrations/20260722190000_manual_outreach_logs.sql`) was
applied to staging by the user directly, via the pooler-based `supabase
db push` process already established in
`docs/technical/crawler-supabase-staging-target.md` (direct `supabase db
push` hangs in this sandbox — a known, previously documented IPv6-only
host limitation; the password-free `--db-url` push and this task's own
independent re-verification never saw the DB password). Re-verified
independently via `supabase migration list`:
`{"local":"20260722190000","remote":"20260722190000", ...}` — applied.
`manual_outreach_logs` existence re-confirmed with a direct,
password-free REST probe (`GET .../rest/v1/manual_outreach_logs?select=id&limit=1`
→ HTTP 200, `[]`) before writing anything to it.

### Recording (Option A — `rehearsal_logged`, never a fake send)

Per the task's explicit rule, **no `manual_send_logged` was recorded for
SkinLaser** — the contact has not actually been sent yet. Instead:

```
npm run crawler:outreach-log:record -- --target staging \
  --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --outreach-message-id ca0c3fba-86ac-442c-afb5-276552287177 \
  --event-type rehearsal_logged --channel whatsapp \
  --operator-name "Atria QA" --occurred-at 2026-07-22T19:15:00Z \
  --notes "Ensaio de validação de staging — nenhum envio real ocorreu." \
  --dry-run false
```

Previewed with the default dry-run first (confirmed exact payload),
then recorded with `--dry-run false`. New row
`9feed1a6-ad9a-420e-82a8-eddbc0c72636`,
`event_type: rehearsal_logged`, `human_review_decision_id: null` (the
gate was never called for this event type, as designed).

### Verification after recording

- **`npm run crawler:outreach-log:list`** for the clinic: `count: 1`,
  the rehearsal row above.
- **`outreach_messages`** (direct REST, all 6 rows for this clinic):
  every row still `status: "draft"`.
- **`human_review_decisions`** (direct REST): still exactly 2 rows,
  latest `bbf7e956-7564-479b-a892-00da2a06c2e4` (`approved`), unchanged.
- **`manual_outreach_logs`** (direct REST, cross-checking the CLI's own
  output): exactly the one row above.
- No sending occurred — no provider integration exists anywhere in this
  codebase, and this task added none.

## Limitations

- `follow_up_at`/`response_received`/`follow_up_needed` are plain,
  operator-supplied fields — there is no scheduler or reminder system
  reading them yet (see Future work).
- `do_not_contact_logged`'s mutation is best-effort: if
  `setDoNotContact` fails after the log row is written, the log persists
  as the source of truth but the clinic flag itself may need a manual
  follow-up (`sideEffects.doNotContactUpdated: false` signals this).
- No UI exists for any of this — CLI only, consistent with the rest of
  this foundation's current MVP scope.

## Future work

- An operator UI surfacing the Manual Outreach Pack next to a "log what
  happened" form, instead of raw CLI flags.
- A follow-up scheduler that reads `follow_up_needed`/`follow_up_at` and
  surfaces due follow-ups to an operator (still never auto-sending
  anything).
- A real `outreach_messages.status` transition to `sent`/`replied`
  wired from `manual_send_logged`/`response_logged` (the
  `markSent`/`markReplied` repository methods already exist and are
  already tested — see `lib/operations/repositories/outreach-repository.ts`
  and `lib/operations/supabase/outreach-repository.supabase.ts` — but
  this task deliberately did not wire them, per the instruction that "no
  automatic status transition" should exist unless explicitly modeled
  and tested as a manual log side effect; wiring `outreach_messages`
  status changes was out of scope here beyond the one `do_not_contact`
  exception).
- Do-not-contact propagation beyond the clinic-level flag (e.g. per
  individual contact record) if a future task introduces per-contact
  do-not-contact tracking.

## Files changed

- `supabase/migrations/20260722190000_manual_outreach_logs.sql` (new)
- `lib/operations/repositories/types.ts` (+ `ManualOutreachLog*` types)
- `lib/operations/repositories/manual-outreach-log-repository.ts` (new)
- `lib/operations/repositories/fakes.ts` (+ `FakeManualOutreachLogRepository`)
- `lib/operations/supabase/manual-outreach-log-repository.supabase.ts` (new)
- `lib/operations/pipeline/select-repositories.ts` (+ `manualOutreachLogRepo` wiring)
- `lib/operations/manual-outreach-logging/types.ts` (new)
- `lib/operations/manual-outreach-logging/record-manual-outreach-log.ts` (new)
- `lib/operations/manual-outreach-logging/list-manual-outreach-logs.ts` (new)
- `lib/operations/manual-outreach-logging.test.ts` (new — 26 tests)
- `lib/operations/supabase-mapping.test.ts` (+ 1 test for the new row mapper, matching the existing shared-mapping-test convention)
- `scripts/crawler/record-manual-outreach-log.ts` (new)
- `scripts/crawler/list-manual-outreach-logs.ts` (new)
- `package.json` (+ `crawler:outreach-log:record`, `crawler:outreach-log:list`)
- `docs/technical/crawler-manual-outreach-logging.md` (this file)

## Verification

- `npm test` — 370/370 passing (27 new tests across the two test files, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed via `supabase/.temp/project-ref` before every command; the migration push itself was run by the user in their own terminal via the pooler, never through this session, and the DB password was never seen or handled here.
- No crawl was performed.
- No Google Places/SERP call was made.
- No outreach was sent — no provider integration exists anywhere in this codebase; all 6 SkinLaser outreach drafts remain `status: "draft"`.
- No secrets were stored in any file, log, or this document.
