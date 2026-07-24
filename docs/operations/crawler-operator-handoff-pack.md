# Crawler Operator Handoff Pack

Status date: 2026-07-23
Base tag: `atria-crawler-mvp-readiness-checklist-v1`

This is the practical "how to operate this" document for a human running the
Atria crawler/commercial MVP manually, one prospect at a time. It does not
re-explain the architecture or safety rationale — for that, see:

- `docs/operations/crawler-mvp-readiness-checklist.md` — full readiness status
- `docs/operations/crawler-operator-runbook.md` — full step-by-step detail and rationale per step
- `docs/technical/crawler-score-prioritization-alignment.md` — how tier/score ranking works
- `docs/technical/crawler-approved-manual-outreach-rehearsal.md` — a worked, real end-to-end example
- `PROJECT_CRAWLER.md` — overall product pipeline and scope

All commands below are copied from the actual scripts in `scripts/crawler/`
and the `crawler:*` entries in `package.json` as of this handoff pack — no
flag or script name here is invented. If a step has no corresponding script,
it is marked "not available yet" instead of guessing a command.

## 1. Purpose

This handoff pack covers running one clinic through the full manual pipeline:

```
discovery -> promotion -> controlled crawl -> report -> review pack
  -> prioritization -> commercial template pack -> approval decision
  -> manual outreach packet -> manual log
```

Nothing past "approval decision" happens automatically. A human always
decides, and a human always sends, outside this system.

## 2. Hard Safety Rules

- **Staging only.** Every real (non-dry-run) command must use `--target staging` (or `--target local` for local Supabase). Never `--target production`.
- **Production ref `cskodsnvghavkcjwmafr` must not be used.** It is refused in code by the target guard (`lib/operations/pipeline/target-guard.ts`), but operators must never attempt to point `SUPABASE_URL` at it either.
- **No automatic sending.** No code path in this repository sends anything.
- **No WhatsApp API.** None is integrated.
- **No email provider send** for crawler outreach. (`RESEND_API_KEY` etc. exist only for the unrelated lead-capture form, not for crawler outreach.)
- **No mass outreach.** Every command here operates on one clinic/candidate (or a small explicit set) at a time.
- **No patient data.** This pipeline only ever touches public clinic website content and operational metadata.
- **No medical quality evaluation.** Score v1 evaluates digital presentation only — never clinical competence.
- **No broad crawl.** Real crawling is same-origin, bounded by `--max-pages`, and refused entirely without `--allow-real-crawl`.
- **Approved domains only.** Real crawling defaults to `example.com`; any other real domain must be passed explicitly via `--approved-domains` for that single invocation — it is never persisted.
- **Secrets stay only in `.env.local`.** Never paste a key into a command line, a doc, an artifact, or a chat. Never print an env var's value — only its presence should ever be logged (see `crawler:operator-preflight`).

## 3. Required Environment Variables (names only)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEAD_HASH_SECRET`
- `GOOGLE_PLACES_API_KEY` — only needed for non-dry-run discovery
- `SCREENSHOT_STORAGE_BUCKET` — optional; without it, screenshot metadata is persisted as `pending_storage` and no upload is attempted

No values are ever written to this doc, to any artifact, or to any commit.

## 4. Preflight

Run the existing operator preflight command first — it only checks
*presence* of env vars and confirms the target doesn't resolve to
production; it never prints a secret value and makes no network call:

```bash
npx tsx scripts/crawler/operator-preflight.ts --target staging
```

Manual checks alongside it:

```bash
git branch --show-current
git status --short
git tag --points-at HEAD
```

- [ ] Confirm you're on the expected branch/tag.
- [ ] `git status --short` is empty (no stray local edits).
- [ ] `.env.local` is present locally and ignored by git: `git check-ignore .env.local` should print `.env.local`.
- [ ] `crawler:operator-preflight` output shows `overallStatus` not `"blocked"`, and the resolved target is `staging` (or `local`), never production.
- [ ] Run the full verification suite clean before operating:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 5. End-to-End Command Flow (single prospect)

Placeholders: `<QUERY>`, `<LOCATION>`, `<CANDIDATE_ID>`, `<CLINIC_ID>`,
`<CRAWL_JOB_ID>`, `<APPROVED_DOMAIN>`, `<OUTREACH_MESSAGE_ID>`.

### A. Discover candidates with Google Places

```bash
# dry-run first — no API key needed, no network call, no Supabase write
npx tsx scripts/crawler/discover-google-places.ts \
  --dry-run --query "<QUERY>" --location "<LOCATION>"

# real discovery, staging only
npx tsx scripts/crawler/discover-google-places.ts \
  --target staging --query "<QUERY>" --location "<LOCATION>" \
  --max-results 5 --max-pages 1
```

Omit `--promote` here — promote deliberately, one candidate at a time, in step C.

### B. Review candidates, then get a ranked shortlist

```bash
# 1. list every candidate from this discovery job
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> --only-promotable

# 2. turn that same discovery job into a ranked, decision-ready shortlist
npx tsx scripts/crawler/operator-shortlist.ts \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> \
  --include-existing --output markdown
```

Both commands are read-only — never crawl, never call Google Places, never
promote. `list-candidates.ts` shows every candidate with its status,
obvious blockers (no website, directory listing, already-existing/
duplicate, a social-media/messaging profile like Instagram/WhatsApp used
as the primary website — see
`docs/technical/crawler-social-profile-website-classification.md`), an
ICP (Ideal Customer Profile) classification (hospital/franchise/chain/
wrong-audience businesses are never a clean `promote_candidate` — see
`docs/technical/crawler-icp-classification.md`), and a suggested action.

`operator-shortlist.ts` (see
`docs/technical/crawler-operator-shortlist-cli.md`) goes one step further:
it ranks the same candidates conservatively, prints a summary (total
reviewed, actionable/blocked/duplicate/no-own-website counts), names the
single recommended candidate if one is ready to promote (or a clear stop
reason if none is), and prints the exact next commands to run — using
real script names/flags only. Use its recommended `<CANDIDATE_ID>` in step
C below, or fall back to manually picking a `promote_candidate` candidate
from `list-candidates.ts` if the shortlist recommends `manual_review`
instead. Never promote a candidate the shortlist marks as blocked or
duplicate.

### C. Promote one candidate — only after human confirmation

```bash
# dry-run rehearsal (in-memory only)
npx tsx scripts/crawler/promote-candidate.ts --dry-run --candidate-id <CANDIDATE_ID>

# real promotion, staging only
npx tsx scripts/crawler/promote-candidate.ts --target staging --candidate-id <CANDIDATE_ID>
```

Note the `<CLINIC_ID>` returned — every following step uses it.

### D. Run controlled crawl for one clinic

```bash
# dry-run rehearsal first — fixture responses only, no network call
npx tsx scripts/crawler/process-crawl-queue.ts \
  --dry-run --clinic-ids <CLINIC_ID>

# real crawl, staging only, approved domain only, with screenshots
npx tsx scripts/crawler/process-crawl-queue.ts \
  --target staging --clinic-ids <CLINIC_ID> \
  --allow-real-crawl --approved-domains <APPROVED_DOMAIN> \
  --capture-screenshots
```

`--approved-domains` is required for any real domain beyond `example.com`,
is per-invocation only, and is never persisted.

### E. Generate operational report

```bash
npx tsx scripts/crawler/generate-operational-report.ts \
  --target staging --clinic-id <CLINIC_ID> --write-artifact
```

Add `--crawl-job-id <CRAWL_JOB_ID>` to target a specific crawl job instead of
the clinic's most recent one.

### F. Generate human review pack

```bash
npx tsx scripts/crawler/generate-human-review-pack.ts \
  --target staging --clinic-id <CLINIC_ID> --write-artifact
```

### G. Run prioritization

```bash
npx tsx scripts/crawler/prioritize-prospects.ts \
  --target staging --output table
```

Use `--tier high` (or `medium`/`low`/`blocked`) to filter, `--write-artifact`
to save to `artifacts/prioritization/`.

### H. Generate commercial template pack

```bash
npx tsx scripts/crawler/generate-commercial-template-pack.ts \
  --target staging --clinic-id <CLINIC_ID> --write-artifact
```

Copy is only produced for `high`/`medium` tier prospects — expect this to
report nothing to send for `low`/`blocked`/`needs_changes`.

### I. Record/confirm human review decision

```bash
npx tsx scripts/crawler/review-decision.ts \
  --target staging --clinic-id <CLINIC_ID> \
  --decision approved --reviewer "<YOUR NAME>" --notes "<why>"
```

`--decision` must be one of `approved`, `rejected`, `needs_changes`. This is
append-only — it never edits or deletes a prior decision. To confirm the
current state before deciding:

```bash
npx tsx scripts/crawler/review-queue.ts --target staging --status pending
```

### J. Prepare manual outreach packet

```bash
npx tsx scripts/crawler/generate-manual-outreach-pack.ts \
  --target staging --clinic-id <CLINIC_ID> --write-artifact
```

This is gate-checked: it refuses to produce copy unless the latest review
decision is `approved`. To check the gate directly first:

```bash
npx tsx scripts/crawler/check-outreach-approval-gate.ts \
  --target staging --clinic-id <CLINIC_ID> --outreach-message-id <OUTREACH_MESSAGE_ID>
```

### K. Record non-send rehearsal/preparation log

```bash
# always dry-run by default — this only previews what would be recorded
npx tsx scripts/crawler/record-manual-outreach-log.ts \
  --target staging --clinic-id <CLINIC_ID> \
  --outreach-message-id <OUTREACH_MESSAGE_ID> \
  --event-type rehearsal_logged --channel whatsapp \
  --operator-name "<YOUR NAME>" --occurred-at <ISO_TIMESTAMP>
```

Add `--dry-run false` only once you actually intend to insert the row.

### L. Record `manual_send_logged` only after a human actually sends outside the system

```bash
npx tsx scripts/crawler/record-manual-outreach-log.ts \
  --target staging --clinic-id <CLINIC_ID> \
  --outreach-message-id <OUTREACH_MESSAGE_ID> \
  --event-type manual_send_logged --channel whatsapp \
  --operator-name "<YOUR NAME>" --occurred-at <ISO_TIMESTAMP> \
  --dry-run false
```

Never run this step before the manual send has actually happened. Verify
afterward that the message row is still `status: draft`:

```bash
npx tsx scripts/crawler/list-manual-outreach-logs.ts \
  --target staging --clinic-id <CLINIC_ID>
```

## 6. Decision Rules

**Proceed only if all of these hold:**

- The clinic has its own real website (not a directory listing / aggregator page).
- Score evidence exists (a real, non-placeholder score row).
- Screenshots and/or the operational report have actually been reviewed by a human.
- Contact evidence (phone/WhatsApp/e-mail) is publicly visible on the site itself.
- The commercial template produced is high-confidence, specific copy — not generic filler.
- A recorded `human_review_decisions` row for this clinic is `approved`.
- You, the operator, have personally re-read and approved the exact copy before any manual send.

**Stop if any of these are true:**

- The crawled page is a directory listing or wrong-audience content.
- The latest decision is `rejected` or the clinic is flagged `do_not_contact`.
- The latest decision is `needs_changes` (fix and get a new `approved` decision first).
- `robots_denied` appears without independently gathered supporting evidence.
- A TLS/crawl failure occurred and hasn't been manually reviewed.
- No score exists for the clinic yet.
- Contact information looks stale, unverifiable, or uncertain.
- Any medical-quality claim appears anywhere in generated copy or scoring.
- Any secret (API key, service role key, DB URL) appears in any command output, log, or artifact.
- A production ref (`cskodsnvghavkcjwmafr`) is detected anywhere in a command, log, or config.

## 7. Manual Outreach Copy Policy

All generated WhatsApp/e-mail copy is **draft-only**. Before any manual use
outside the system, the operator must confirm the copy:

- [ ] Makes no medical-quality claim.
- [ ] Makes no fake audit claim (e.g. implying a formal certification that wasn't done).
- [ ] Invents no client, result, or testimonial.
- [ ] Contains no diagnosis or patient data of any kind.
- [ ] Uses no pressure tactics (urgency, fear, manufactured scarcity).
- [ ] Clearly asks permission or offers a preview/review — never presumes consent to proceed.

## 8. Logging Policy

Allowed `--event-type` values for `record-manual-outreach-log.ts`:
`manual_send_logged`, `response_logged`, `follow_up_logged`,
`no_response_logged`, `do_not_contact_logged`, `rehearsal_logged`.

- Use `rehearsal_logged` or the read-only preview (default `--dry-run`) to
  prepare or rehearse without claiming anything happened.
- Use `manual_send_logged` **only** after a human operator has actually sent
  the approved copy outside this system — never before, never speculatively.
- Never mark an `outreach_messages` row as sent automatically — no command
  in this repository does this, and none should be added to do so.
- The log is append-only; nothing here ever mutates `outreach_messages` status.

## 9. Troubleshooting

| Symptom | Remedy |
|---|---|
| Production ref detected | Stop immediately. Do not run the command. Re-check `SUPABASE_URL`/`--target` and confirm it resolves to `staging` or `local`, never `cskodsnvghavkcjwmafr`. |
| Missing env var | `crawler:operator-preflight` reports which one; add it to `.env.local` (never to a command line or doc). |
| Google Places unavailable | Use `--dry-run` to keep working with fixtures, or confirm `GOOGLE_PLACES_API_KEY` is set and valid. |
| Candidate duplicate | Discovery already dedupes; check `discovery.duplicates` in the JSON output — no action needed, it's expected behavior, not a bug. |
| Crawl blocked by robots | Expected safety behavior — score reflects `robots_denied`; do not attempt to bypass robots.txt. |
| TLS/cert failure | Treat as a stop condition (Section 6) until a human manually verifies the site outside this pipeline. |
| Redirect blocked | Same-origin/redirect-cap guard working as intended; confirm the target domain is correctly on the approved list. |
| Screenshot upload too large | Storage is capped at 5 MB; the pipeline already retries with a bounded height reduction — check for `storage_failed` vs a successful reduced-size capture in the output. |
| No score generated | Run `--allow-incomplete` on the report/review-pack commands to see an `incomplete_*` result, or re-run the crawl — a score requires a completed crawl job. |
| Template withheld | Expected for `low`/`blocked`/`needs_changes`/no-score prospects — check the prospect's tier via `prioritize-prospects.ts` first. |
| Review decision missing | Run `review-queue.ts --status pending` to confirm, then record one with `review-decision.ts`. |
| Outreach log refused | `record-manual-outreach-log.ts` requires all of `--clinic-id`, `--outreach-message-id`, `--event-type`, `--channel`, `--operator-name`, `--occurred-at` — check the error message for which is missing. |

## 10. Operator Daily Checklist (1–3 prospects)

- [ ] Run preflight (`crawler:operator-preflight`) and confirm no blockers.
- [ ] `git status --short` clean before starting.
- [ ] For each prospect: run steps A–L in order, never skipping the human review decision.
- [ ] Re-read every piece of generated copy personally before any manual send.
- [ ] Log every real manual send with `manual_send_logged` immediately after sending — not before, not from memory later.
- [ ] Confirm at the end of the session that no `outreach_messages` row moved out of `status: draft` inside the system.
- [ ] Confirm no secret values were printed, logged, or pasted anywhere during the session.

## 11. Handoff Summary

**Safe today:** discovery (dry-run or staging with a key), promotion, controlled
real-domain crawl (approved domains only), screenshot capture, score v1,
operational report, human review pack, prioritization, commercial template
packs, human review decisions, the outreach approval gate check, manual
outreach packet generation, and manual outreach logging (dry-run by default).
All of it is staging-only and one-clinic-at-a-time.

**Remains manual:** the actual send (WhatsApp/e-mail/any channel), candidate
review/selection (no list-candidates CLI yet), and every judgment call in
Sections 6–7 — a human always reads and approves before anything leaves the
system.

**Remains future automation:** an operator UI (`/operacao`), a durable/retrying
crawl worker, batch/multi-clinic runs, and any sender integration. None of
these exist today and none should be built without a separate, explicit
decision — this pack only covers operating what already exists, safely.
