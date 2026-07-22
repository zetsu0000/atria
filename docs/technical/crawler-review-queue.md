# Human review queue

A queue layer on top of the human review package (`docs/technical/
crawler-human-review-report-pack.md`): lists review-ready clinics and
lets a human record an explicit decision — `approved`, `rejected`, or
`needs_changes` — before any outreach could ever move beyond `draft`.
Read-only listing, append-only decision recording. No code path anywhere
in this layer sends anything or auto-approves anything.

## Data model

New table, **additive only** — no existing table, column, or constraint
was altered or dropped:

```sql
create table public.human_review_decisions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  crawl_job_id uuid null references public.crawl_jobs (id) on delete set null,
  score_id uuid null references public.scores (id) on delete set null,
  outreach_message_id uuid null references public.outreach_messages (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  reviewer_notes text null,
  reviewer text null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Migration: `supabase/migrations/20260721230000_human_review_decisions.sql`.

**RLS/service-role pattern — identical to every other table in this
schema** (`scores`, `outreach_messages`, etc.):

```sql
alter table public.human_review_decisions enable row level security;
revoke all on table public.human_review_decisions from anon, authenticated;
grant all on table public.human_review_decisions to service_role;
```

No `create policy` statements — same as every other table here, RLS is
enabled with zero policies and access is granted only to `service_role`
(which the crawler CLIs use exclusively; `anon`/`authenticated` have zero
access, matching the existing `discovery_jobs`/`clinics`/`scores`/
`outreach_messages` pattern exactly).

**Append-only, not upsert:** `recordDecision` always `insert`s a new row;
there is no update/delete method anywhere in the repository interface.
A clinic's full review history (e.g. `needs_changes` → improvements →
`approved`) is preserved rather than overwritten. "Current status" for a
clinic is always the **most recent** row (`reviewed_at desc`).

**One small addition beyond the suggested schema:** a `reviewer text null`
column, not listed in the task's example schema but required by the CLI's
`--reviewer` flag — needed to record *who* made the decision, not just
that one was made. Length-capped at 160 chars, same pattern as
`outreach_messages.reviewed_by`.

**`metadata` shape** is fixed, not free-form: always exactly
`{ scoreTotalAtReview: number | null, clinicStatusAtReview: string }` —
a snapshot of the score total and clinic status *at the moment of review*,
for audit purposes. Not exposed as a raw CLI passthrough (deliberately —
keeps the shape stable and avoids arbitrary data injection via the CLI).

One additive change to an existing repository interface:
`ScoreRepository` gained `listRecent(limit)` (`lib/operations/
repositories/score-repository.ts`) — needed to discover "review-ready"
clinics (those with at least one score) for the queue listing. No existing
method was changed.

## Review states

| Status | Meaning |
| --- | --- |
| `pending` | No `human_review_decisions` row exists yet for this clinic. Never stored — inferred by the absence of a row. |
| `approved` | Most recent decision is `approved`. |
| `rejected` | Most recent decision is `rejected`. |
| `needs_changes` | Most recent decision is `needs_changes`. |

## CLI

### List the queue

```
npx tsx scripts/crawler/review-queue.ts --target local
npx tsx scripts/crawler/review-queue.ts --target staging --status pending --limit 20
```

`npm run crawler:review-queue -- <flags>`

Flags: `--target local|staging` (required), `--status
pending|approved|rejected|needs_changes|all` (default `all`), `--limit
<n>` (default 20).

Output: a review-ready clinic list (clinics with at least one score),
each item's `status`, and — when one exists — the latest decision's `id`,
`decision`, `reviewer`, and `reviewedAt`.

### Record a decision

```
npx tsx scripts/crawler/review-decision.ts --target local --clinic-id <id> \
  --decision approved --reviewer "AB" --notes "Looks good."

npx tsx scripts/crawler/review-decision.ts --target staging --clinic-id <id> \
  --crawl-job-id <id> --decision needs_changes --reviewer "AB" \
  --notes "Fix mobile screenshot before resubmitting."
```

`npm run crawler:review-decision -- <flags>`

Flags: `--target local|staging` (required), `--clinic-id` (required),
`--crawl-job-id` (optional — defaults to the clinic's most recent crawl
job), `--decision approved|rejected|needs_changes` (required — anything
else is refused, see "Safety gates" below), `--notes "<text>"` (optional,
≤4000 chars), `--reviewer "<name>"` (optional, ≤160 chars).

`score_id` and `outreach_message_id` are auto-linked to the clinic's
latest score / latest outreach draft (if any) — the caller never has to
look them up manually.

## Safety gates

| Gate | Enforced by |
| --- | --- |
| Production refused | Same `selectRepositories`/`assertSafeTarget` gate as every other CLI in this pipeline — independent of, and unaffected by, review decisions |
| Invalid `--decision` rejected | `isValidHumanReviewDecision` — only `approved`/`rejected`/`needs_changes` accepted; anything else fails with `reason: "invalid_decision"` before any repository write |
| Missing clinic rejected | `clinicRepo.getClinic` — fails with `reason: "not_found"` before any decision is recorded |
| No automatic approval | There is no code path anywhere (listing, building a review pack, or any other flow in this codebase) that infers or defaults to `approved` — a decision only exists because a human explicitly ran `--decision <value>` |

## No-send policy

Recording a decision — including `approved` — **never** calls
`outreachRepo.markSent`, `outreachRepo.approve`, or writes to
`outreach_messages` in any way. All outreach stays `status: "draft"`
regardless of the decision recorded. This is verified directly by test #8
(`lib/operations/review-queue.test.ts`), which spies on
`markSent`/`approve` and confirms neither is ever called, and re-fetches
the outreach message afterward to confirm its status is unchanged.

**What "no outreach can move beyond draft unless a human review decision
exists" means in practice today:** this codebase has no send-capable code
path at all (`markSent` is defined but called from nowhere — established
in `docs/technical/crawler-human-review-report-pack.md`). This layer adds
the auditable precondition — a decision row — that any *future*,
separately-built, human-triggered send mechanism would need to check
before ever calling `markSent`. This task does not add such a mechanism;
it only adds the record it would need to consult.

## How this connects to the review pack

The review pack (`lib/operations/review/build-human-review-pack.ts`) is
what a human reads before deciding. The review queue is where that
decision gets recorded. They share the same underlying data:

1. `npm run crawler:review-pack -- --target staging --clinic-id <id>` — a
   human reads the package (score, screenshots, suggested drafts, risk
   flags).
2. `npm run crawler:review-queue -- --target staging --status pending` —
   the human finds this clinic still pending.
3. `npm run crawler:review-decision -- --target staging --clinic-id <id>
   --decision approved --reviewer "AB" --notes "..."` — the human records
   their decision. `score_id`/`outreach_message_id` are auto-linked so the
   decision is traceable back to exactly what was reviewed.
4. `npm run crawler:review-queue -- --target staging --status approved` —
   the clinic now shows up here instead of under `pending`.

## How to inspect staging rows

Same pattern used throughout this project's rehearsal docs — direct REST
query using the service-role key only as an unprinted header, e.g.:

```bash
set -a; source .env.local; set +a
curl -s "${SUPABASE_URL}/rest/v1/human_review_decisions?clinic_id=eq.<id>&select=*&order=reviewed_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
```

## Limitations

1. **The migration was added but not applied to staging in this task.**
   Every test in this task runs against the in-memory fake repositories
   (`FakeHumanReviewRepository`), which needed no schema at all. Applying
   a schema migration to staging is a more consequential action than the
   read/write operations performed in prior rehearsals, and this task's
   instructions covered implementation and tests, not a live staging
   run — so it was deliberately left for an explicit follow-up request,
   consistent with how every previous staging-affecting action in this
   project was only ever taken after being explicitly instructed. Until
   applied (e.g. via `supabase db push` against the linked staging
   project), `--target staging` for `review-queue`/`review-decision` will
   fail once it reaches the real `human_review_decisions` table (the
   Supabase client will report a missing-table error surfaced as
   `reason: "unavailable"`) — but `--dry-run`-equivalent (fakes-backed)
   flows and all unit tests are unaffected.
2. `listReviewQueue` discovers candidates via `scoreRepo.listRecent`,
   fetching `limit × 5` scores before per-clinic dedupe/status filtering —
   a pragmatic bound, not a full table scan. A clinic with many scores far
   outside that window could theoretically be missed under an aggressive
   `--status` filter combined with a very small `--limit`; increasing
   `--limit` widens the search window proportionally.
3. No update/delete on a recorded decision — this is deliberate
   (append-only audit trail), but it means a data-entry mistake (wrong
   `--decision` typed correctly, but for the wrong intent) can only be
   corrected by recording a new, superseding decision, not by editing the
   old one.

## Tests (19 total, `lib/operations/review-queue.test.ts`)

Covers all 13 required cases from the task, plus 6 extra edge cases
(status filtering, limit, dry-run wiring, auto-linking, append-only
history, and a repo-wide destructive-migration guard):

1. Pending item appears in queue.
2. `approved` decision recorded.
3. `rejected` decision recorded.
4. `needs_changes` decision recorded.
5. Notes stored verbatim.
6. `reviewed_at` set to a real, current timestamp.
7. Production refused.
8. No outreach sent — `markSent`/`approve` spied and confirmed never called; the underlying message's status is re-fetched and confirmed unchanged.
9. No automatic approval — listing the queue never itself records a decision.
10. Invalid decision string rejected (`reason: "invalid_decision"`), not silently coerced.
11. Missing clinic rejected (`reason: "not_found"`).
12. Metadata shape is stable, with and without an existing score.
13. The migration is additive-only (asserted by reading and pattern-matching the actual migration SQL: it must `create table if not exists`, must never `drop table`/`drop column`/`truncate`/`delete from`/alter any pre-existing table, and must follow the same RLS/service-role grant pattern) — plus a repo-wide sweep confirming no migration file (old or new) contains a destructive statement.

## Verification

- `npm test` — 259/259 passing (240 prior + 19 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — this layer is entirely read/append against already-persisted data; it does not crawl anything itself.
- No Google Places/SERP call was made — no new discovery.
- No outreach was sent — recording a decision never calls `markSent`/`approve`, verified directly by test #8.
- No secrets were stored in any file, log, or this document.
