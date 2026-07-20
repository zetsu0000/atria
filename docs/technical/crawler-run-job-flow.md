# Crawler run-job flow

> **No real clinic website was crawled while building or testing this flow.**
> All `lib/operations/run-crawl-job.test.ts` scenarios use fixture HTML and
> mocked `fetchHtmlPage` / `loadRobotsPolicy` implementations — no network
> call, no live Supabase connection.

## Two crawl runners

This repository now has two crawl orchestrators. They are intentionally
separate; converging them is listed as a follow-up in
`docs/technical/crawler-next-steps.md`.

| | `lib/crawler/run-crawl.ts` (existing) | `lib/operations/run-crawl-job.ts` (new) |
| --- | --- | --- |
| Subject | Lead (`leadId` drives the flow, still required for this runner) | Clinic (`clinicId`; `leadId` optional — see "`crawl_jobs` now accepts lead-only or clinic-only" below) |
| Persistence | Calls `lib/crawler/persistence.ts` functions directly (bound to Supabase via `LeadCaptureEnv`) | Calls only injected `CrawlRepository` / `ClinicRepository` / `ExtractionRepository` / `ScoreRepository` / `OutreachRepository` |
| Lead status | Transitions `lib/leads/status.ts` states (`crawling` → `crawl_complete`, etc.) | Does not touch lead status |
| Extraction | Not wired | Wired — `extractPageCandidates` runs per page, merged and persisted via `ExtractionRepository` |
| Score | Not wired | Wired — `calculatePlaceholderScore` runs after crawl, persisted via `ScoreRepository` |
| Outreach draft | Not wired | Wired, **opt-in only** via `input.outreachDraft` |
| Testability | Fakes via `CrawlRunnerDeps` (already existed) | Fakes via `RunCrawlJobDeps` + in-memory repositories (`lib/operations/repositories/fakes.ts`) |

## Flow implemented by `runCrawlJob` (`lib/operations/run-crawl-job.ts`)

```
clinic/source URL
  → create or claim crawl job          (CrawlRepository.createCrawlJob + claimCrawlJob)
  → validate seed URL (SSRF policy)    (lib/crawler/url-policy.ts, unchanged)
  → load robots.txt policy             (lib/crawler/robots.ts, unchanged)
  → crawl bounded pages                (sequential BFS, same-origin only, job.maxPages cap)
      → persist page status per page   (CrawlRepository.recordPage / recordFinding)
      → collect extraction candidates  (lib/crawler/extract-candidates.ts, in-memory only)
  → persist extraction result          (ExtractionRepository.saveExtractedContent)
  → persist asset metadata             (CrawlRepository.saveAsset, only if screenshots were passed in)
  → calculate score                    (lib/score/calculate.ts calculatePlaceholderScore)
  → persist score                      (ScoreRepository.saveScore)
  → attach high-confidence contacts    (ClinicRepository.addContact, only if clinicId present)
  → optionally create outreach draft   (OutreachRepository.createDraft, ONLY when input.outreachDraft is set)
  → mark job completed / partial / failed (CrawlRepository.updateCrawlJobCounters)
```

If `pagesFetched === 0` (total failure — e.g. every page fetch fails), the
job is marked `failed` and extraction/score/outreach steps are skipped
entirely (there is nothing to score).

## Deliberate differences from `lib/crawler/run-crawl.ts`

- **Concurrency:** sequential (one page in flight) instead of
  `DEFAULT_CONCURRENCY = 2`. Simplification for this first pass; both
  respect `job.maxPages` and same-origin/robots rules identically (same
  underlying `lib/crawler/url-policy.ts`, `lib/crawler/robots.ts`,
  `lib/crawler/fetch-page.ts`, `lib/crawler/parse-page.ts`,
  `lib/crawler/discover-links.ts` — no crawler-safety code was duplicated or
  reimplemented, only rewired to a different persistence layer).
- **Raw HTML is used in-memory only for extraction.** `crawl_pages` never
  stores raw HTML (unchanged rule — see `docs/technical/crawler-security.md`).
  The orchestrator keeps the fetched HTML in a local variable just long
  enough to run `extractPageCandidates` (which needs anchor/`mailto:`/`tel:`
  parsing that normalized `crawl_pages` fields alone can't provide), then
  discards it. Nothing new is persisted from raw HTML.
- **Contacts:** phone/email/whatsapp/instagram candidates with confidence
  `medium` or `high` are persisted to `clinic_contacts` (always
  `review_status = 'pending_review'`) when a `clinicId` is present. Low
  confidence candidates and other kinds stay in `extracted_content` only —
  this avoids polluting the reviewable contact list with noisy guesses.
- **Outreach is always opt-in.** `runCrawlJob` never creates a draft unless
  the caller explicitly passes `input.outreachDraft`. Even then, a
  `do_not_contact` clinic short-circuits to `outreachDraft: null` before any
  write is attempted.

## `crawl_jobs` now accepts lead-only or clinic-only

Previously the physical `crawl_jobs` table had `lead_id uuid not null
references public.leads`, so `runCrawlJob` required a `leadId` even for a
clinic discovered without an inbound lead. This is resolved by migration
`supabase/migrations/20260720150000_crawl_jobs_lead_or_clinic.sql`
(additive, **not applied to any remote/staging project in this pass**):

- `lead_id` is now nullable (FK to `leads` preserved, `on delete restrict`
  unchanged).
- A new check constraint, `crawl_jobs_requires_lead_or_clinic`, enforces
  `lead_id is not null or clinic_id is not null` at the database level.
- `RunCrawlJobInput.leadId` is now `string | null | undefined`.
  `runCrawlJob` validates `input.leadId || input.clinicId` in application
  code *before* creating a new job (this check is skipped when resuming an
  existing job via `crawlJobId`, since that job already satisfies the
  constraint) — it never fabricates a placeholder `leadId` to satisfy the
  old schema.
- Both `FakeCrawlRepository.createCrawlJob` and
  `createSupabaseCrawlRepository(...).createCrawlJob` enforce the same
  "at least one of leadId/clinicId" rule independently, so the guard holds
  even if a future caller bypasses `runCrawlJob` and calls the repository
  directly. The Supabase adapter also maps Postgres `23514` (check
  violation) back to a `validation` result, in case the DB constraint is
  ever the first line of defense to fire.

A fully clinic-centric crawl (`clinicId` set, no `leadId` at all) is covered
by `lib/operations/run-crawl-job.test.ts` → "runs a clinic-centric crawl
with no leadId at all, without fabricating one".

## Testing without live network or live Supabase

`lib/operations/run-crawl-job.test.ts` builds `RunCrawlJobDeps` with:

- `fetchHtmlPage` replaced by a fixture lookup over an in-memory
  `Record<url, html>` map (or a rejection set, for failure-path tests) — the
  real `fetch` global is never called.
- `loadRobotsPolicy` replaced by a fixed policy (`isPathAllowed` always true
  or always false, depending on the scenario).
- All five repositories replaced by `lib/operations/repositories/fakes.ts`
  in-memory implementations — no `@supabase/supabase-js` client is ever
  constructed in these tests.

Covered scenarios: success end-to-end (pages + extraction + score
persisted, no outreach draft), contact attachment, partial failure (some
pages fail), total failure (every page fails → job `failed`, no
extraction/score written), robots-denied fast failure, opt-in outreach draft
creation and its `do_not_contact` block, screenshot-metadata persistence,
resuming an already-created pending job via `crawlJobId`, a fully
clinic-centric crawl with no `leadId`, and rejecting a new job created with
neither `leadId` nor `clinicId` before any repository is touched.
