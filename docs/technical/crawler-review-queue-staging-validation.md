# Crawler review queue — staging validation

> **Status: migration applied, table verified, full smoke test passed.**
> This document records applying the `human_review_decisions` migration
> to staging and validating the review-queue CLI end-to-end against real
> staging data. **No passwords, tokens, API keys, or database URLs appear
> in this document.**

## Staging ref

`atria-staging`, project ref `lfkyiztuwptmddsraucg` — confirmed via
`cat supabase/.temp/project-ref` before any command below, and again
reconfirmed at the start of this validation round. Production (`Atria`,
ref `cskodsnvghavkcjwmafr`) was never linked, targeted, or touched.

## Migration applied

Migration: `supabase/migrations/20260721230000_human_review_decisions.sql`.

`supabase db push` (direct connection) hung indefinitely at
`Initialising login role...` in this sandbox — the same known,
previously-documented limitation described in
`docs/technical/crawler-supabase-staging-target.md` (the direct Postgres
host resolves to an IPv6-only address this environment can't complete a
full protocol/TLS session against). Per that same precedent, the staging
database password has never been available to this session and must
never be reconstructed by it — so the push was run by the user, in their
own terminal, via the connection **pooler** (`--db-url` pointed at
`aws-1-sa-east-1.pooler.supabase.com`, IPv4-capable), with the password
entered via a non-echoing prompt this session never saw.

This session's role was limited to read-only, no-password verification
before and after:

```
supabase migration list
```

Before: `20260721230000` showed `"remote":""` (pending). After the user's
push: `"remote":"20260721230000"`, matching `local` exactly — same as all
four prior migrations. Confirmed a second time in this round:

```json
{"local":"20260721230000","remote":"20260721230000","time":"2026-07-21 23:00:00"}
```

## Table verified

Direct REST query (service-role key used only as an unprinted request
header) confirmed `human_review_decisions` exists and is queryable:

```
GET /rest/v1/human_review_decisions?select=id&limit=1  →  []
```

An empty array with no error confirms the table exists with correct
RLS/grants for `service_role` (a missing table or a denied role would
both surface as an error, not an empty array).

## Queue result

```
npm run crawler:review-queue -- --target staging --status all --limit 20
```

Before recording any decision, both review-ready clinics from prior
rehearsals appeared, each `status: "pending"`, `latestDecision: null`:

- `bbfd72a3-a013-4a6c-bd82-4a70479d694a` — SkinLaser - Higienopolis (score 72)
- `8634b1cb-2d82-40d9-a257-1dca5e7c5b9c` — GRUPO CPD - Centro Paulista de Dermatologia e Estética (score 66)

## Decision result

```
npm run crawler:review-decision -- --target staging \
  --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --decision needs_changes --reviewer "Atria QA" \
  --notes "Revisar copy antes de qualquer contato. Ensaio staging."
```

Recorded: decision `a769b0ea-3739-4f4d-80ab-2c8000a7e596`, `decision:
"needs_changes"`, `reviewer: "Atria QA"`, auto-linked to the clinic's
existing `crawl_job_id` (`c915a569-bcba-4bf2-aa95-cd66446eeb24`),
`score_id` (`5cb1a23e-c945-41cc-9acd-26bb24ef1cea`, total 72), and
`outreach_message_id` (`4696afcb-a8e8-4d1a-8cf7-5874fec21159`) — all three
correctly resolved from real, already-persisted staging rows from the
prior rehearsal, with no manual lookup required.

Re-running the queue confirmed the status flip:

```
npm run crawler:review-queue -- --target staging --status all --limit 20
```

`bbfd72a3-...` now shows `status: "needs_changes"`,
`latestDecision.decision: "needs_changes"`, `latestDecision.reviewer:
"Atria QA"`. The other clinic (GRUPO CPD) is unaffected, still `pending`.

## Independent verification (direct REST query)

**`human_review_decisions` — exactly one append-only row for this
clinic:**

```json
{
  "id": "a769b0ea-3739-4f4d-80ab-2c8000a7e596",
  "clinic_id": "bbfd72a3-a013-4a6c-bd82-4a70479d694a",
  "crawl_job_id": "c915a569-bcba-4bf2-aa95-cd66446eeb24",
  "score_id": "5cb1a23e-c945-41cc-9acd-26bb24ef1cea",
  "outreach_message_id": "4696afcb-a8e8-4d1a-8cf7-5874fec21159",
  "decision": "needs_changes",
  "reviewer": "Atria QA",
  "reviewer_notes": "Revisar copy antes de qualquer contato. Ensaio staging.",
  "reviewed_at": "2026-07-22T13:16:49.280213+00:00",
  "metadata": { "scoreTotalAtReview": 72, "clinicStatusAtReview": "prospect" },
  "created_at": "2026-07-22T13:16:49.280213+00:00"
}
```

Matches the CLI's own output exactly — not just trusted from stdout.

## Outreach remained draft

**Linked `outreach_messages` row, re-fetched after the decision:**

```json
{
  "id": "4696afcb-a8e8-4d1a-8cf7-5874fec21159",
  "clinic_id": "bbfd72a3-a013-4a6c-bd82-4a70479d694a",
  "channel": "email",
  "status": "draft",
  "human_reviewed": false,
  "do_not_contact_blocked": false,
  "updated_at": "2026-07-21T22:27:56.072545+00:00"
}
```

`status: "draft"`, `human_reviewed: false`, and — critically —
`updated_at` is **unchanged** from before the decision was recorded
(timestamped the day before, from the original crawl rehearsal), proving
the decision-recording command never wrote to this row at all, not even
to flip a flag. This is exactly the "no automatic approval, outreach
never moves beyond draft" invariant the review queue exists to enforce,
confirmed against real staging data rather than only the in-memory fake
repositories used in `lib/operations/review-queue.test.ts`.

## No sending occurred

- No `markSent`/`approve` call was made — confirmed both by the outreach
  row's untouched `status`/`updated_at` above, and by the absence of any
  send-capable code path in `scripts/crawler/review-decision.ts` (it only
  ever calls `humanReviewRepo.recordDecision`, which inserts into
  `human_review_decisions` and nothing else).
- No email, WhatsApp message, or any other communication was dispatched
  to SkinLaser or any other clinic.

## Retained staging rows (no cleanup — retained for inspection)

Everything from every prior rehearsal remains untouched, plus:

| Table | New row(s) this round |
| --- | --- |
| `human_review_decisions` | `a769b0ea-3739-4f4d-80ab-2c8000a7e596` (`needs_changes`, clinic `bbfd72a3-...`) |

No other table gained or lost rows in this round — `outreach_messages`,
`scores`, `crawl_jobs`, `clinics`, `prospect_candidates`, `scan_assets`,
`extracted_content`, and `clinic_contacts` are exactly as documented in
prior rehearsal docs.

## Blockers

1. `supabase db push` (direct connection) hangs in this sandbox — a
   pre-existing, previously-documented, environment-level limitation (see
   `docs/technical/crawler-supabase-staging-target.md`), not new to this
   round and not specific to this migration. Resolved the same way as
   before: the user ran the pooler-based push themselves, in their own
   terminal, since this session must never handle the staging DB
   password.
2. None specific to the `human_review_decisions` table or the review
   queue CLI itself — migration applied cleanly, table verified, and the
   full list → decide → re-list → independently-verify cycle worked
   exactly as designed on the first attempt.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed — this round only ran the review-queue/review-decision CLIs against already-persisted data.
- No Google Places/SERP call was made.
- No outreach was sent — verified directly against the re-fetched `outreach_messages` row, not just inferred.
- No secrets (passwords, tokens, database URLs) appear anywhere in this document or were printed by any command this session ran; the staging DB password was never seen by this session at any point.
