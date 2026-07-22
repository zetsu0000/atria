# SkinLaser human approval — review decision recorded

Records a new human review decision for SkinLaser after the outreach
copy polish (`docs/technical/crawler-skinlaser-review-copy-polish.md`),
and verifies the outreach approval gate now passes for the polished
drafts. **This task approves the review pack for manual-outreach
readiness; it does not send anything.**

## Code changed (and why)

One small, read-only addition: `scripts/crawler/check-outreach-approval-gate.ts`
(+ `npm run crawler:check-outreach-approval-gate`). No existing CLI
exercised `lib/operations/outreach/approval-gate.ts`'s
`canPrepareOutreachForSend` — it was only covered by
`lib/operations/outreach-approval-gate.test.ts` unit tests. This task
needed to independently verify the gate's real result against the real
staging rows (not just trust the underlying logic's unit tests), so a
thin wrapper was added: it takes `--clinic-id` and
`--outreach-message-id`, calls `canPrepareOutreachForSend` with the real
repositories, and prints the structured result. It never mutates
anything — `canPrepareOutreachForSend` is documented as read-only and
this script adds no side effects of its own.

No test file was added, consistent with every other thin CLI wrapper in
`scripts/crawler/` (none have their own test file — the underlying
`canPrepareOutreachForSend` logic already has dedicated tests in
`lib/operations/outreach-approval-gate.test.ts`).

## Previous decision

`a769b0ea-3739-4f4d-80ab-2c8000a7e596` — `decision: "needs_changes"`,
reviewer "Atria QA", `reviewed_at: 2026-07-22T13:16:49Z`, notes "Revisar
copy antes de qualquer contato. Ensaio staging." Left in place
(append-only log — never updated or deleted).

## New decision

Recorded via:

```
npm run crawler:review-decision -- --target staging \
  --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 \
  --decision approved --reviewer "Atria QA" \
  --notes "Copy revisada e aprovada para contato manual. Ensaio staging; sem envio automático."
```

New row `bbf7e956-7564-479b-a892-00da2a06c2e4` — `decision: "approved"`,
reviewer "Atria QA", `reviewed_at: 2026-07-22T17:55:04Z`, `scoreId:
12fd6a90-2131-4707-8ef4-796c93867afd` (v1, 80/100), `crawlJobId:
81a7b754-e9d9-40d7-b89d-83f1ca2c53a4`. `recordReviewDecision` never
mutates `outreach_messages` — confirmed both by the command's own printed
note and by direct re-query below.

## Latest decision status

Re-queried via `npm run crawler:review-queue -- --target staging --status
all --limit 50`: SkinLaser's queue entry now shows `status: "approved"`,
`latestDecision.id: "bbf7e956-7564-479b-a892-00da2a06c2e4"`. Full decision
history for the clinic re-queried directly (REST) confirms exactly 2
rows, both present, latest (`approved`) after the earlier
(`needs_changes`) by `reviewed_at` — the append-only log and "latest
always wins" behavior both hold.

## Outreach drafts checked

Latest polished drafts, both re-confirmed `status: "draft"` before and
after recording the new decision:

- **WhatsApp:** `ca0c3fba-86ac-442c-afb5-276552287177` (`channel:
  whatsapp_manual`)
- **Email:** `ba53a89a-f73e-4eb9-86e6-ed05191b4378` (`channel: email`)

## Approval gate result

Ran `npm run crawler:check-outreach-approval-gate` against both polished
drafts:

| Outreach message | Channel | `allowed` | Reason |
| --- | --- | --- | --- |
| `ca0c3fba-86ac-442c-afb5-276552287177` | whatsapp_manual | **true** | Clinic is not do_not_contact, the outreach message is in a sendable state, and the latest human review decision is approved. |
| `ba53a89a-f73e-4eb9-86e6-ed05191b4378` | email | **true** | Same. |

Both report `latestDecision.id: "bbf7e956-7564-479b-a892-00da2a06c2e4"`
(the new `approved` row) — confirming the gate reads the review decision
live, not a cached/stale one. The gate is a read-only precondition check
for a future sender that does not exist anywhere in this codebase today;
passing it does not send, mark sent, or otherwise transition anything.

## No sending

Re-queried all 6 `outreach_messages` rows for this clinic directly after
every step above — distinct status set across all rows is exactly
`{"draft"}`. No row transitioned to `sent`, `approved` (message-level),
`replied`, `ignored`, or `rejected`. No outbound request to WhatsApp,
email, or any provider was made — `canPrepareOutreachForSend` performs
only repository reads.

## Retained staging rows (no cleanup — retained for inspection)

Everything from every prior rehearsal remains untouched, plus:

| Table | New row this round |
| --- | --- |
| `human_review_decisions` | `bbf7e956-7564-479b-a892-00da2a06c2e4` (`approved`) |

No other table gained or lost rows — `outreach_messages`, `scores`,
`crawl_jobs`, `scan_assets`, `extracted_content`, `clinics` are exactly
as documented in prior rehearsal docs
(`docs/technical/crawler-skinlaser-review-copy-polish.md` and earlier).

## Verification

- `npm test` — 317/317 passing (unchanged — no test file added, matching every other thin CLI wrapper's convention).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — confirmed via `supabase/.temp/project-ref` (`lfkyiztuwptmddsraucg`, staging) and `lib/operations/pipeline/target-guard.ts`'s `KNOWN_PROJECT_REFS` guard, which every command in this task went through.
- No crawl was performed — this task only recorded a review decision and read already-persisted rows; zero new network requests to any clinic website.
- No Google Places/SERP call was made.
- No outreach was sent — all 6 outreach drafts re-confirmed `status: "draft"` after this task's changes; the approval gate is read-only and no sender exists in this codebase.
- No secrets were stored in any file, log, or this document.
