# Outreach approval gate

A reusable, read-only guard that any future outreach-send code path
**must** call and pass before it could ever send anything. **This task
does not send anything, does not implement provider sending
(email/WhatsApp), and does not add any new mutation anywhere.** It only
adds the precondition check a sender would need to consult.

## Purpose

Prior work built the pieces this gate connects:

- The review pack (`lib/operations/review/build-human-review-pack.ts`) —
  what a human reads.
- The review queue (`lib/operations/review-queue/`) — where a human
  records an explicit `approved`/`rejected`/`needs_changes` decision
  (`docs/technical/crawler-review-queue.md`).

Nothing in this codebase has ever sent outreach — `outreachRepo.markSent`
exists but is called from nowhere. This gate is the missing piece for
*whenever* a sender is eventually built: **"no outreach can move beyond
draft unless a human_review_decisions row exists with decision =
approved"** now has one canonical, tested place that enforces it.

## Files

- `lib/operations/outreach/approval-gate.ts` — `canPrepareOutreachForSend`
  (non-throwing check) and `assertOutreachApprovedForSend` (throwing
  variant for a future sender to call defensively).
- `lib/operations/outreach-approval-gate.test.ts` — 17 tests. (Placed one
  level shallower than the implementation file, matching the existing
  `lib/operations/review-queue.test.ts` / `lib/operations/human-review-pack.test.ts`
  convention — see "A note on the test file's location" below.)

No `package.json` changes were needed — this is a library-only guard,
with no CLI (none was in scope; nothing exists yet that would call it).

## Required approval state (all of these, together)

For `canPrepareOutreachForSend` to return `{ allowed: true }`:

1. The clinic exists (`clinicRepo.getClinic`).
2. The outreach message exists **and belongs to that clinic**
   (`outreachRepo.getMessage`, cross-checked against `clinicId`).
3. Neither the clinic nor the outreach message is `do_not_contact`
   blocked.
4. The outreach message's own `status` is still a sendable candidate
   state — `"draft"` or `"approved"` (the outreach-message-level status,
   a pre-existing column, distinct from the review decision below).
5. The clinic's **latest** `human_review_decisions` row (by
   `reviewedAt`) has `decision: "approved"`.

All five together — any single failure blocks, with a specific `code`.

## Blocked states

| Code | Trigger |
| --- | --- |
| `clinic_not_found` | Clinic doesn't exist |
| `outreach_message_not_found` | Outreach message doesn't exist |
| `outreach_message_wrong_clinic` | Outreach message exists but belongs to a different clinic |
| `do_not_contact` | `clinic.doNotContact` or `message.doNotContactBlocked` is true — checked **before**, and independently of, the review decision, so an old `approved` decision can never override a `do_not_contact` flag set afterward |
| `outreach_not_sendable_status` | Message status is `sent`, `rejected`, `ignored`, or `replied` — not a viable candidate |
| `missing_review_decision` | No `human_review_decisions` row exists yet for this clinic |
| `review_decision_rejected` | Latest decision is `rejected` |
| `review_decision_needs_changes` | Latest decision is `needs_changes` |
| `review_decision_not_approved` | Fallback for any other non-`approved` decision value |

**Latest decision always wins** — a clinic that was `approved` and later
got `needs_changes` is blocked; a clinic that was `needs_changes` and
later got `approved` is allowed. Verified directly by test #5.

## No-send policy

- `canPrepareOutreachForSend` never writes to any repository — verified
  by test #10, which snapshots repository sizes before/after both an
  allowed and a blocked call and asserts nothing changed.
- Neither function ever calls `outreachRepo.markSent`,
  `outreachRepo.approve`, `outreachRepo.createDraft`, or
  `humanReviewRepo.recordDecision` — verified by test #11, which spies on
  all four and confirms none are invoked, for both the checking and the
  throwing variant.
- Nothing in this module implements email or WhatsApp sending. There is
  still no send-capable code path anywhere in this codebase.
- Nothing here auto-approves — the only way `decision: "approved"` can
  exist is a prior, explicit `npm run crawler:review-decision -- ...
  --decision approved` call from a human (`docs/technical/
  crawler-review-queue.md`).

## How this connects to the review queue

1. A human reviews the package (`crawler:review-pack`) and records a
   decision (`crawler:review-decision`) — unchanged, from the prior task.
2. **New in this task:** before any future sender would ever call a
   provider API, it must call:
   ```ts
   await assertOutreachApprovedForSend({ clinicId, outreachMessageId }, deps);
   // only reachable past this line if the checks above all passed —
   // still doesn't send anything; that's the sender's own job.
   ```
   or, for a non-throwing check (e.g. to render a reason in a UI/CLI):
   ```ts
   const result = await canPrepareOutreachForSend({ clinicId, outreachMessageId }, deps);
   if (!result.allowed) { /* show result.code / result.reason */ }
   ```
3. If the human later records `needs_changes` or `rejected` for that
   same clinic (even after a prior `approved`), the gate immediately
   blocks again — no separate re-sync step needed, since it always reads
   the *latest* decision live.

## What a future sender must call before sending

Any outreach-send implementation added later — this task adds none —
**must** call `assertOutreachApprovedForSend` (or check
`canPrepareOutreachForSend(...).allowed`) as its very first step, before
touching any provider API, and must re-check on every send attempt rather
than caching an earlier "allowed" result (a decision can change between
when a job is queued and when it actually runs).

## A note on the test file's location

`lib/operations/outreach-approval-gate.test.ts` sits directly under
`lib/operations/`, not inside `lib/operations/outreach/` alongside
`approval-gate.ts`. This isn't arbitrary: `npm test` runs `tsx --test
lib/**/*.test.ts`, and that glob is expanded by the shell `npm` invokes
(POSIX `sh`, not an interactive shell with `globstar` enabled) — `**`
degrades to matching only one directory level, so a test file three
levels under `lib/` (e.g. `lib/operations/outreach/approval-gate.test.ts`)
is silently **not** discovered, while a directory two levels down is.
This was caught empirically: the test file initially placed inside
`lib/operations/outreach/` ran fine via `npx tsx --test <path>` directly
but silently didn't show up in `npm test`'s count. Moving it one level
shallower (matching the pre-existing `lib/operations/review-queue.test.ts`
/ `lib/operations/human-review-pack.test.ts` convention, both of which
also have their implementation in a same-named subdirectory) fixed it.
This is a real, latent limitation of the `test` script for any future
`lib/*/*/*.test.ts`-depth file — worth knowing if adding more nested
modules later, though fixing the script itself was out of scope here.

## Limitations

1. No sender exists yet, so this gate is currently unused by any runtime
   code path — it exists purely as the tested, ready-to-call precondition
   for whenever one is built.
2. The gate checks the outreach message's **own** `status` column and the
   **clinic's** latest review decision, but does not itself verify that
   the outreach message's content still matches what was reviewed (e.g.
   if the draft's evidence changed after `approved` was recorded). The
   review decision does capture a `metadata.scoreTotalAtReview` snapshot
   (`docs/technical/crawler-review-queue.md`) for audit purposes, but this
   gate does not diff against it — a future sender wanting that
   additional guarantee would need to add it separately.
3. `assertOutreachApprovedForSend`'s thrown error
   (`OutreachNotApprovedForSendError`) carries the same `code`/`reason`
   as the non-throwing result, but a caller must still catch it — there
   is no automatic retry, notification, or logging built in.

## Tests (17 total, `lib/operations/outreach-approval-gate.test.ts`)

Covers all 12 required cases from the task, plus 5 extra edge cases
(outreach-approved-status also allowed, clinic not found, wrong-clinic
mismatch, message-level `do_not_contact_blocked`, and the throwing
variant's error shape):

1. An `approved` latest decision, sendable status, no `do_not_contact` → allowed.
2. Missing decision blocks.
3. `rejected` blocks.
4. `needs_changes` blocks.
5. Latest decision wins (both directions: approved→needs_changes blocks; needs_changes→approved allows).
6. `do_not_contact` blocks, even with a prior `approved` decision already on record.
7. Missing outreach message blocks.
8. Already-`sent` outreach message blocks.
9. Production refused (shared `selectRepositories`/`assertSafeTarget` gate).
10. The guard is read-only — repository sizes unchanged before/after, for both allowed and blocked calls.
11. No send/mutation method is called — `markSent`/`approve`/`createDraft`/`recordDecision` all spied and confirmed never invoked, for both the checking and throwing variant.
12. The result shape is stable (`allowed`/`code`/`reason`/`decision` keys, fixed code enum) and round-trips through `JSON.stringify`/`JSON.parse`.

## Verification

- `npm test` — 276/276 passing (259 prior + 17 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed.
- No Google Places/SERP call was made.
- No outreach was sent — no send-capable code exists anywhere in this codebase, and this task added none.
- No secrets were stored in any file, log, or this document.
