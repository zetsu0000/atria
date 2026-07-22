# Crawler operator runbook

This is a **human-operated workflow, not automation.** Every step below
is a separate, explicit command an operator runs and reviews before
moving to the next one. Nothing in this pipeline sends outreach, touches
production, or crawls the broad internet on its own — every command that
could do something risky refuses by default and requires an explicit
flag or a prior human decision to proceed.

If you only remember one thing: **nothing sends until a human sends it
manually, outside this system.** No provider integration (WhatsApp API,
email sender) exists anywhere in this codebase.

## Prerequisites

- Node.js + this repo's dependencies installed (`npm install`).
- A `.env.local` file at the repo root (gitignored — never commit it).
  See "Required environment variables" below for names.
- The Supabase CLI linked to the **staging** project only. Confirm with:

  ```
  cat supabase/.temp/project-ref
  ```

  This must print `lfkyiztuwptmddsraucg`. If it prints anything else
  (especially `cskodsnvghavkcjwmafr`, the production ref), **stop** and
  re-link before running any `--target staging` command.

- Playwright browsers installed if you'll capture screenshots
  (`npx playwright install chromium`, one-time).

## Required environment variables (names only — never values)

| Variable | Required for |
| --- | --- |
| `SUPABASE_URL` | Every persistence-backed command (`--target local`/`staging`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Same — service-role, bypasses RLS. Never print, log, or paste this value anywhere, including to an AI assistant. |
| `LEAD_HASH_SECRET` | Same — required by `hasPersistenceConfig()` alongside the two above. |
| `GOOGLE_PLACES_API_KEY` | Only the discovery step (`crawler:discover:places`), and only without `--dry-run`. |
| `SCREENSHOT_STORAGE_BUCKET` | Optional. Without it, screenshots still capture but metadata is recorded as `pending_storage` and no upload is attempted — never fails the pipeline. |

Check presence (not values) with:

```
npm run crawler:operator-preflight -- --target staging
```

This is step 1 below — a small, read-only CLI added by this task
(`scripts/crawler/operator-preflight.ts`) specifically so an operator
never has to `echo` or inspect an env var's value to know whether it's
set. It never prints a secret, never makes a network call, and never
touches Supabase — it only checks presence and re-confirms the
production guard.

## Staging-only safety checks (read before running anything)

Every command below that isn't `--dry-run` requires `--target
local|staging`. The production guard
(`lib/operations/pipeline/target-guard.ts`, `assertSafeTarget`) is
independent of any single command — it inspects the *resolved*
`SUPABASE_URL` itself, so even a typo'd `--target staging` can never
silently hit production:

- If the resolved `SUPABASE_URL` project ref is `cskodsnvghavkcjwmafr`
  (production), **every command refuses immediately**, regardless of
  `--target`.
- `--target staging` additionally requires the ref to be exactly
  `lfkyiztuwptmddsraucg` (the known staging project) — anything else is
  refused.
- `--target local` requires `SUPABASE_URL` to be a loopback address
  (`127.0.0.1`/`localhost`) or unset.

**Before any `--target staging` command**, re-run:

```
cat supabase/.temp/project-ref
```

and confirm it says `lfkyiztuwptmddsraucg`. Do this every session, not
just once — a `supabase link` to a different project would silently
change what this file says.

## The safe sequence

Every command shown uses `--target staging`. Swap to `--dry-run` (no
`--target`, in-memory fakes only, no network, no Supabase) to rehearse
any step first, or `--target local` against a local `supabase start`
stack.

### 1. Check environment and staging target

```
cat supabase/.temp/project-ref
npm run crawler:operator-preflight -- --target staging
```

**Decision point:** if `overallStatus` is `"blocked"`, stop and fix
whichever check failed before doing anything else. `"warning"` entries
(e.g. missing `GOOGLE_PLACES_API_KEY`) are fine unless the next step you
intend to run needs that specific variable.

### 2. Run Google Places discovery with strict limits

```
npm run crawler:discover:places -- --dry-run --query "dermatologia" --location "São Paulo, SP"
```

Rehearse with `--dry-run` first — canned fixture data, no API key
needed, no network call, no Supabase write. Only once you've reviewed
the shape of the output, run for real with tight limits:

```
npm run crawler:discover:places -- --target staging \
  --query "dermatologia" --location "Curitiba, PR" \
  --max-results 5 --max-pages 1
```

- `--max-results` hard-bounds how many candidates are returned/persisted
  (default 10 — keep it low, e.g. 5, for a rehearsal).
- `--max-pages` hard-bounds how many Places API pages are requested
  (default 1 — do not raise this without a specific reason).
- **Do not pass `--promote`** on this first run. Without it, this
  command only ever writes `prospect_candidates` rows — no clinic, no
  crawl job, no outreach draft. Promotion is a separate, deliberate step
  (step 4) so you can inspect candidates first.
- This command never crawls a discovered clinic's website and never
  contacts anyone — it only calls the official Google Places API (New)
  to list candidates.

### 3. Inspect candidates

There is currently no dedicated "list candidates" CLI — inspect via a
direct, read-only REST query (service-role key used only as an unprinted
header, matching every other staging query in this repo's history):

```
set -a; source .env.local; set +a
curl -s "${SUPABASE_URL}/rest/v1/prospect_candidates?select=id,raw_name,website_url,city,state,status&order=created_at.desc&limit=10" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool
```

**What to inspect before promoting:**

- Does `website_url` look like the clinic's real, own domain (not a
  directory listing, social profile, or a different business)?
- Is `raw_name` a plausible match for what you searched?
- Is `city`/`state` correct? Google Places sometimes returns a nearby
  city.
- Is `status` still `new` or `needs_review`? Anything already
  `duplicate`/`rejected`/`promoted_to_clinic` should be skipped.

### 4. Promote exactly one candidate

Pick **one** `id` from the inspection above:

```
npm run crawler:promote -- --target staging --candidate-id <candidate-id>
```

Promoting one at a time, deliberately, is the point — this is not a
bulk operation. The command prints the new `clinicId`; keep it, you'll
need it for every remaining step.

### 5. Approve domain manually

The controlled crawler never fetches an arbitrary real domain by
default — only `example.com` (+ subdomains) is allowed unless you
explicitly extend the allowlist, per-invocation, for exactly the domain
you just promoted:

```
--approved-domains www.clinicaexample.com.br,clinicaexample.com.br
```

This flag (`lib/operations/pipeline/controlled-transport.ts`) is:

- **Never persisted** — it only applies to the one command it's passed
  to.
- **No wildcards accepted** (`isValidApprovedDomainEntry`).
- **Independent of** the SSRF/private-IP guard
  (`lib/crawler/url-policy.ts`, still blocks localhost/private ranges
  even for an approved domain) and the production target-guard (still
  refuses production regardless of approved domains).

**Decision point:** only add a domain here if you already confirmed in
step 3 that it's the clinic's real website — this flag is the actual
authorization to make a real HTTP request to that host.

### 6. Run controlled crawl/screenshot

```
npm run crawler:queue:process -- --target staging --allow-real-crawl \
  --capture-screenshots --approved-domains www.clinicaexample.com.br,clinicaexample.com.br \
  --clinic-ids <clinic-id>
```

- Without `--allow-real-crawl`, every fetch is served from an in-memory
  fixture — no network call at all. Always rehearse without it first if
  you're unsure.
- `--capture-screenshots` requires `--allow-real-crawl` (refused
  otherwise) and captures desktop+mobile homepage screenshots via
  Playwright, viewport-only (never `fullPage`), uploaded only to the
  **private** `crawler-screenshots` Supabase Storage bucket — no public
  URL is ever generated anywhere in this codebase.
- The crawl is bounded (`--max-pages`, default 5) and only ever touches
  hosts in the approved-domains list (plus `example.com`) — this is not
  a broad crawl and cannot become one without you explicitly widening
  `--approved-domains` yourself, per-invocation, each time.

### 7. Generate operational report

```
npm run crawler:report -- --target staging --clinic-id <clinic-id> --output markdown --write-artifact
```

Read-only, human-review material. `--write-artifact` writes to the
gitignored `artifacts/reports/` — never commit that directory (it's
already in `.gitignore`).

### 8. Generate human review pack

```
npm run crawler:review-pack -- --target staging --clinic-id <clinic-id> --output markdown --write-artifact
```

This is the package a human actually reads before deciding
approved/rejected/needs_changes. **What to inspect before approving:**

- Every claim in the pack must trace back to real, evidence-tied
  candidates — no invented claims, testimonials, awards, or medical
  quality judgments (the disclaimer — "Esta análise avalia apenas a
  apresentação digital e a facilidade de encontrar informações. Não
  avalia qualidade médica." — must be present verbatim).
- Screenshot status: `captured` is good; `pending_storage` means the
  bucket wasn't configured (harmless, but no visual to review yet);
  `capture_failed`/`storage_failed` means step 6 needs re-running (see
  "How to handle failed TLS/screenshots" below).
- Risk flags section — read every one. `do_not_contact` is a hard stop.
  `crawl_partial`/`low_score`/`missing_score` are informational, not
  blockers, but should shape your decision.
- The suggested WhatsApp/email drafts — read them as if you were the
  clinic receiving them. Short, human, non-spammy, no pressure language,
  no score numbers in first contact. If they don't meet that bar, that's
  what `needs_changes` is for.

### 9. Record review decision

```
npm run crawler:review-decision -- --target staging --clinic-id <clinic-id> \
  --decision approved --reviewer "<your name/initials>" \
  --notes "<why>"
```

- `--decision` is one of `approved` / `rejected` / `needs_changes`.
- This is **append-only** — every call inserts a new row into
  `human_review_decisions`; nothing is ever updated or deleted. A
  clinic's full review history is preserved. The *latest* row always
  wins for every downstream gate.
- Recording a decision never touches `outreach_messages` — it never
  sends anything and never auto-approves outreach.

### 10. Prepare manual outreach copy

Once `approved`, generate the final, gate-checked pack an operator
actually works from:

```
npm run crawler:manual-outreach-pack -- --target staging --clinic-id <clinic-id> \
  --output markdown --write-artifact
```

This **only generates** if the outreach approval gate
(`lib/operations/outreach/approval-gate.ts`) passes for the requested
channel(s) — clinic exists, message exists and belongs to the clinic,
neither is `do_not_contact`, the message is still in a sendable state
(`draft`/`approved`, never `sent`), and the *latest* review decision is
`approved`. If it's not generated, the gate blocked it — check
`--target staging` (production is always refused too) and re-run
`crawler:review-queue` to see the current decision.

The copy shown is always the **verbatim, already-persisted** draft body
— this command never invents new copy. If the persisted draft needs
polishing first, see `crawler:regenerate-outreach-draft` (regenerates a
draft from the template in `lib/outreach/draft.ts`, still never sends).

**This is where the system's involvement ends.** The operator manually
copies this text into WhatsApp/email themselves, outside this codebase.

### 11. Record manual outreach log

After actually sending manually (or to rehearse the logging pipeline
itself without pretending a send happened):

```
# Preview first (default — never inserts anything):
npm run crawler:outreach-log:record -- --target staging --clinic-id <clinic-id> \
  --outreach-message-id <outreach-message-id> --event-type manual_send_logged \
  --channel whatsapp --operator-name "<your name>" --occurred-at <ISO timestamp>

# Only once you've actually sent it manually, confirm the write:
npm run crawler:outreach-log:record -- --target staging --clinic-id <clinic-id> \
  --outreach-message-id <outreach-message-id> --event-type manual_send_logged \
  --channel whatsapp --operator-name "<your name>" --occurred-at <ISO timestamp> \
  --dry-run false
```

- **`--dry-run` defaults to `true`** — the command never touches
  Supabase at all until you explicitly pass `--dry-run false`. Always
  preview first.
- `manual_send_logged` re-checks the same approval gate as step 10, at
  the moment of logging — if the decision changed to `needs_changes` or
  the message is no longer sendable, logging a send is refused too.
- **Never record `manual_send_logged` unless a human actually sent the
  message manually, outside this system, first.** If you want to
  rehearse the CLI/repository path without claiming a send happened, use
  `--event-type rehearsal_logged` instead — see step 12.
- `response_logged` / `follow_up_logged` / `no_response_logged` all
  require a prior `manual_send_logged` row for the same
  `--outreach-message-id`; recording a response before any send was
  logged is refused.
- List what's recorded any time with:

  ```
  npm run crawler:outreach-log:list -- --target staging --clinic-id <clinic-id>
  ```

### 12. Confirm outreach remains draft unless a human actually sent it

After every step above — and especially after any rehearsal — verify
directly (never trust CLI stdout alone for a safety confirmation):

```
set -a; source .env.local; set +a
curl -s "${SUPABASE_URL}/rest/v1/outreach_messages?clinic_id=eq.<clinic-id>&select=id,channel,status" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool
```

Every row's `status` should be `draft` (or `approved`, meaning
human-reviewed-but-not-sent) unless you personally sent that exact
message manually and then logged it. There is no code path anywhere in
this repository that can flip a row to `sent` on its own — `markSent`
exists on the repository interface but is never called by any pipeline
step, only by a future, still-nonexistent, explicitly human-triggered
sender.

## How to avoid production

1. `cat supabase/.temp/project-ref` before every staging session —
   confirm `lfkyiztuwptmddsraucg`.
2. Never pass `--target` values other than `local`/`staging` — there is
   no `--target production`, on purpose.
3. Trust the guard, but verify it: every command that touches Supabase
   calls `assertSafeTarget`, which independently inspects the resolved
   `SUPABASE_URL` project ref and refuses `cskodsnvghavkcjwmafr`
   regardless of what `--target` claims.
4. If you ever see a project ref you don't recognize in any output,
   stop immediately and re-run step 1.

## How to avoid a broad crawl

1. Never raise `--max-pages` beyond what one clinic's rehearsal needs
   (default 5 is already generous for a homepage-focused review).
2. Never add more than the one domain you just promoted to
   `--approved-domains` in a single command.
3. Without `--allow-real-crawl`, nothing ever leaves the process — every
   fetch is an in-memory fixture. Always the safest way to rehearse a
   new flag combination.
4. `--approved-domains` is never persisted — every real-crawl command
   must re-specify it, so there's no way to accidentally "leave a domain
   open" for a future run.
5. The SSRF/private-IP guard (`lib/crawler/url-policy.ts`) blocks
   localhost/private-IP targets independently of the approved-domains
   list — it cannot be bypassed by adding a domain to the allowlist.

## How to handle failed TLS/screenshots

- **TLS/fetch failure during crawl** (`crawl_jobs.status: "failed"` or
  `error_code` set): the score calculator treats `pageCount === 0` as a
  uniform, explicit "unreachable" gate — every dimension scores 0 with a
  clear evidence entry, rather than silently defaulting to a misleading
  partial score. Re-run step 6 once the site is reachable, or record a
  `needs_changes`/`rejected` decision if it's a real, ongoing problem
  with the clinic's site.
- **Screenshot `capture_failed`**: Playwright couldn't render the page
  at all (timeout, crash). Re-run step 6 — a single bounded retry with a
  reduced viewport already happens automatically for oversized captures,
  but a hard failure needs a fresh attempt. Check
  `--screenshot-timeout-ms` (default 15000) if the site is just slow.
- **Screenshot `storage_failed`**: the capture succeeded but the upload
  to Supabase Storage failed (bucket misconfigured, over the 5 MB
  private-bucket limit even after the built-in compression fallback,
  etc.). The crawl/score pipeline never fails because of this — the
  human review pack will show `storage_failed` as a flag; re-run step 6
  with a valid `--screenshot-storage-bucket` (or fix
  `SCREENSHOT_STORAGE_BUCKET`) once resolved.
- **Screenshot `pending_storage`**: not a failure — no storage bucket
  was configured for that run, so only metadata was recorded. Re-run
  step 6 with the bucket configured if you need the actual image
  reviewed.
- None of these ever block or corrupt the review pack — every screenshot
  section reports its own status explicitly (see
  `lib/operations/report/types.ts`'s `ScreenshotSectionStatus`), and the
  pack is still generated with a warning, never silently.

## How to record manual actions

See step 11 above in full. Summary: `crawler:outreach-log:record`
(default dry-run, `--dry-run false` to actually write) is the only
sanctioned way to record that a human did something outside this
system. It never sends anything itself. `manual_send_logged` is gated by
the same approval gate as step 10; `response_logged`/`follow_up_logged`/
`no_response_logged` require a prior send to be on record;
`rehearsal_logged` exists specifically so you can exercise this whole
step without claiming a real send happened.

## No-send policy

There is no code path in this repository, anywhere, that sends a
WhatsApp message or an email to a clinic. `OutreachRepository.markSent`
exists as a state-transition method and is called from nowhere in the
pipeline. Every artifact this runbook produces — reports, review packs,
manual outreach packs, drafts — is explicitly `status: "draft"` /
`reviewRequired: true` and stays that way until a human operator, acting
entirely outside this codebase, sends something themselves and then
logs it via step 11. This is a deliberate, repeatedly-tested invariant
across this entire foundation, not an accident of missing features.

## Rollback / cleanup notes

- Every table in this pipeline is **append-only or additive** — there is
  no delete method on `human_review_decisions`, `manual_outreach_logs`,
  or (practically) `outreach_messages` (only status transitions).
  "Rollback" here means recording a new, corrective row, not deleting an
  old one:
  - Wrong review decision recorded → run
    `crawler:review-decision` again with the corrected `--decision`; the
    new row becomes the latest and wins.
  - Wrong manual outreach log recorded → there is no delete; record a
    follow-up log (e.g. `--notes "correction: previous log was
    inaccurate"`) rather than trying to remove the row. If a
    `rehearsal_logged` row needs to be visually distinguished from a
    real one later, its `notes` field is the place to say so (as done in
    every staging rehearsal in this repo's history).
- Migrations are additive-only — nothing in this pipeline's migration
  history alters or drops an existing table/column.
- If a staging rehearsal clinic is no longer needed, the safest cleanup
  is to mark it `do_not_contact` (via
  `ClinicRepository.setDoNotContact` — no CLI wrapper exists for this
  directly yet outside the `do_not_contact_logged` event type in step
  11) rather than deleting rows, preserving the audit trail.
- There is no `--target production` anywhere, so there is nothing to
  roll back in production by construction — this pipeline has never
  written to it.

## Current known staging fixtures / retained rows

As of this task, staging (`lfkyiztuwptmddsraucg`) retains, across every
prior rehearsal documented in `docs/technical/crawler-*.md`:

| Table | Count | Notes |
| --- | --- | --- |
| `clinics` | 2 | GRUPO CPD - Centro Paulista de Dermatologia e Estética (`8634b1cb-2d82-40d9-a257-1dca5e7c5b9c`, status `prospect`); SkinLaser - Higienopolis (`bbfd72a3-a013-4a6c-bd82-4a70479d694a`, status `prospect`) |
| `crawl_jobs` | 6 | Mix of fixture and one real-domain (SkinLaser) crawls across rehearsals |
| `scores` | 10 | Includes both `placeholder-v0` and `v1` scoring versions from the score-v1 calibration task |
| `outreach_messages` | 7 | 1 for GRUPO CPD (`email`, `draft`); 6 for SkinLaser (5 `email` + 1 `whatsapp_manual`, all `draft`) |
| `human_review_decisions` | 2 | Both for SkinLaser: `a769b0ea-...` (`needs_changes`), `bbf7e956-...` (`approved`, latest) |
| `manual_outreach_logs` | 1 | For SkinLaser: `9feed1a6-ad9a-420e-82a8-eddbc0c72636` (`rehearsal_logged`, WhatsApp) |

SkinLaser is the most fully-exercised fixture: real crawl (1 page,
`partial` status — intentionally bounded), real desktop+mobile
screenshots in the private `crawler-screenshots` bucket, score v1
80/100, `approved` review decision, an approval-gate-passing manual
outreach pack, and one `rehearsal_logged` manual outreach log. **No
`manual_send_logged` row exists for it** — no real contact has been sent
to SkinLaser through this pipeline as of this task.

None of these rows are test fixtures to be deleted casually — they are
the living audit trail of every rehearsal that validated this pipeline.
Treat them as read-only reference material unless a task explicitly asks
you to add to them.

## Command reference (quick index)

| Step | Command |
| --- | --- |
| 1 | `npm run crawler:operator-preflight -- --target staging` |
| 2 | `npm run crawler:discover:places -- --target staging --query ... --location ... --max-results 5` |
| 3 | direct REST query on `prospect_candidates` |
| 4 | `npm run crawler:promote -- --target staging --candidate-id <id>` |
| 5 | (`--approved-domains <domain>` flag on step 6) |
| 6 | `npm run crawler:queue:process -- --target staging --allow-real-crawl --capture-screenshots --approved-domains <domain> --clinic-ids <id>` |
| 7 | `npm run crawler:report -- --target staging --clinic-id <id>` |
| 8 | `npm run crawler:review-pack -- --target staging --clinic-id <id>` |
| 9 | `npm run crawler:review-decision -- --target staging --clinic-id <id> --decision <decision> --reviewer <name>` |
| 10 | `npm run crawler:manual-outreach-pack -- --target staging --clinic-id <id>` |
| 11 | `npm run crawler:outreach-log:record -- --target staging ... --dry-run false` |
| 12 | direct REST query on `outreach_messages` |

Supporting/repair commands, not part of the primary sequence:
`crawler:update-website` (correct a clinic's URL), `crawler:recalculate-score`
(re-score already-persisted data without re-crawling),
`crawler:regenerate-outreach-draft` (re-persist a polished draft),
`crawler:check-outreach-approval-gate` (inspect the gate result for one
message directly), `crawler:review-queue` (list every clinic's current
review status).
