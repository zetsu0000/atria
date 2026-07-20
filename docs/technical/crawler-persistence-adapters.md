# Crawler persistence adapters

> Branch: `feature/crawler-persistence-adapters`
> Baseline: tag `atria-crawler-data-foundation-v2` → commit `03daceb`
> ("Align crawler discovery and database foundation")
>
> **No remote Supabase migration was applied in this pass. No real clinic
> website was crawled. No outreach was sent.** All persistence claims in this
> document were verified through fake in-memory adapters and Supabase
> row-mapping unit tests — see
> `docs/technical/crawler-persistence-test-plan.md`. Live Supabase staging
> validation remains a future step.
>
> **Update (2026-07-20, same branch):** added
> `supabase/migrations/20260720150000_crawl_jobs_lead_or_clinic.sql`
> (additive, not applied remotely) so `crawl_jobs` accepts either
> `lead_id` or `clinic_id` — see "Crawl persistence" below.

## Purpose

Connect the existing crawler/discovery/score/outreach core (`lib/crawler`,
`lib/discovery`, `lib/score`, `lib/outreach`) to database-shaped repositories
through narrow, swappable adapters — without hard-wiring Supabase into the
crawler core itself. This lets `runCrawlJob` and related use cases run
against fakes in tests, with no live Supabase connection and no live network
access.

## Layout

```
lib/operations/
├── repositories/
│   ├── types.ts                      # domain record + input shapes, camelCase
│   ├── discovery-repository.ts       # DiscoveryRepository interface
│   ├── clinic-repository.ts          # ClinicRepository interface
│   ├── crawl-repository.ts           # CrawlRepository interface
│   ├── extraction-repository.ts      # ExtractionRepository interface
│   ├── score-repository.ts           # ScoreRepository interface
│   ├── outreach-repository.ts        # OutreachRepository interface
│   └── fakes.ts                      # in-memory implementations (test-only)
├── supabase/
│   ├── server-client.ts              # service-role client factory (server-only)
│   ├── discovery-repository.supabase.ts
│   ├── clinic-repository.supabase.ts
│   ├── crawl-repository.supabase.ts
│   ├── extraction-repository.supabase.ts
│   ├── score-repository.supabase.ts
│   └── outreach-repository.supabase.ts
├── promote-candidate.ts              # candidate -> clinic promotion use case
└── run-crawl-job.ts                  # clinic-centric orchestrator (DI)
```

Existing `lib/operations/crawl-operations.ts` and `lib/operations/lead-operations.ts`
(lead-centric facades over `lib/crawler/persistence.ts` and `lib/leads/*`) are
untouched. This is an additive, parallel layer.

## Physical table mapping

No new tables, no duplicated tables. Same naming map as
`docs/technical/crawler-database-model.md`:

| Repository | Physical table(s) |
| --- | --- |
| `DiscoveryRepository` | `discovery_jobs`, `prospect_candidates` |
| `ClinicRepository` | `clinics`, `clinic_contacts` |
| `CrawlRepository` | `crawl_jobs`, `crawl_pages`, `crawl_findings`, `scan_assets` |
| `ExtractionRepository` | `extracted_content` |
| `ScoreRepository` | `scores` |
| `OutreachRepository` | `outreach_messages` |

`crawl_jobs` / `crawl_pages` / `crawl_findings` remain the canonical physical
names for "scans" / "scan_pages" (see gap audit) — this layer does not rename
them.

## Design

- **Narrow interfaces, not a generic ORM.** Each repository exposes only the
  operations the crawler/discovery/score/outreach core actually needs (see
  "Required behavior" below), not full CRUD.
- **Dependency injection.** `runCrawlJob` and `promoteCandidateToClinic`
  accept repositories as parameters; nothing in `lib/operations/run-crawl-job.ts`
  or `lib/operations/promote-candidate.ts` imports a Supabase client
  directly.
- **Result envelope.** Every repository method returns
  `RepoResult<T> = { ok: true; value: T } | { ok: false; reason: RepoErrorReason; message: string }`,
  matching the `{ ok, reason, message }` convention already used in
  `lib/leads/status-operations.ts` and `lib/crawler/persistence.ts`.
- **Row mapping.** Each Supabase adapter maps `snake_case` DB rows to
  `camelCase` domain records, mirroring the existing `mapJob` pattern in
  `lib/crawler/persistence.ts`. Mapping functions are exported (e.g.
  `mapClinicRow`, `mapCrawlJobRow`) so they can be unit-tested with synthetic
  rows, with no live Supabase connection.
- **Server-only boundary.** `lib/operations/supabase/*` reads
  `SUPABASE_SERVICE_ROLE_KEY` (via `lib/supabase/service-client.ts`) and must
  never be imported from `app/` client components or any browser-bundled
  file. The repo does not depend on the `server-only` npm package (consistent
  with the existing `lib/supabase/service-client.ts`), so this boundary is
  enforced by convention and code review, not a build-time guard.
- **Safe error messages only.** No adapter ever returns a raw exception
  message or stack trace to a caller. Internal failures are logged with
  `console.warn("[atria:operations] <code>")` and mapped to a fixed safe
  string, matching `lib/crawler/errors.ts` `safeErrorMessage`.

## Required behavior — status

### Discovery persistence

- ✅ create discovery job (`DiscoveryRepository.createDiscoveryJob`)
- ✅ record raw candidates, preserving source attribution and dedupe key
  (`recordCandidate`)
- ✅ mark candidate duplicate / rejected (`markCandidateDuplicate`,
  `markCandidateRejected`)
- ✅ promote candidate to clinic (`markCandidatePromoted` +
  `lib/operations/promote-candidate.ts` coordinator — see below)

### Clinic persistence

- ✅ create clinic from candidate (`ClinicRepository.createClinic`, invoked by
  `promoteCandidateToClinic`)
- ✅ update normalized website host (`updateNormalizedWebsiteHost`)
- ✅ attach contacts, preserving source URL and review status (`addContact`,
  `listContacts`)
- ✅ block/flag `do_not_contact` (`setDoNotContact`) — **gap:** no dedicated
  column yet, tracked in `clinics.source_attribution`. See
  `docs/technical/crawler-next-steps.md`.

### Crawl persistence

- ✅ create crawl job (`CrawlRepository.createCrawlJob`)
- ✅ start/lock crawl job (`claimCrawlJob`, atomic `status = 'pending' →
  'running'` transition, mirrors `lib/crawler/persistence.ts` `claimCrawlJob`)
- ✅ record page statuses and failure codes (`recordPage`, `recordFinding`)
- ✅ never store raw stack traces as public error messages — `failCrawlJob`
  and `updateCrawlJobCounters` only ever persist `safeErrorMessage(code)`
  strings, never `error.message`
- ✅ **`crawl_jobs` now supports both lead-centric and clinic-centric
  execution.** `lead_id` was `not null` in
  `20260719180000_crawler_data_foundation.sql`; migration
  `20260720150000_crawl_jobs_lead_or_clinic.sql` (additive, **not applied
  remotely**) drops that constraint and adds
  `crawl_jobs_requires_lead_or_clinic check (lead_id is not null or
  clinic_id is not null)`. `CreateCrawlJobInput.leadId` is now `string |
  null | undefined`; both the fake and Supabase `CrawlRepository`
  implementations reject a call with neither `leadId` nor `clinicId` as a
  `validation` error in application code, before the DB constraint would
  ever need to fire. The FK to `leads` (`on delete restrict`) and the
  existing `crawl_jobs_lead_id_created_at_idx` / `crawl_jobs_clinic_id_idx`
  indexes are preserved; RLS is unchanged.

### Extraction persistence

- ✅ save normalized `extracted_content` (`ExtractionRepository.saveExtractedContent`)
- ✅ include schema version — stored as `payload.schemaVersion` (no dedicated
  column; see gap notes)
- ✅ include `requires_human_review` — derived from `review_status`, always
  `true` on create
- ✅ include provenance per candidate — `ExtractionCandidate[]` already
  carries `sourceUrl`, `sourcePage`, `extractionMethod`, `confidence`,
  `reviewStatus` per item (`lib/crawler/extraction-types.ts`)
- ✅ never mark public facts as approved — the adapter hard-codes
  `review_status: "pending_review"` on every insert, ignoring any caller
  input

### Asset persistence

- ✅ metadata only: asset type, storage path, mime type, dimensions, size
  (via `metadata` JSON), hash (via `metadata` JSON) — `CrawlRepository.saveAsset`
- ✅ no binary bytes in Postgres — `ScanAssetMetadata` / `CreateScanAssetInput`
  have no byte-carrying field, and nothing in this pass uploads to storage
- ✅ no real screenshots captured or uploaded in this task

### Score persistence

- ✅ five dimensions + total (`ScoreRepository.saveScore`, validated upstream
  by `digitalScoreSchema` in `lib/score/calculate.ts`)
- ✅ evidence JSON, required disclaimer
- ✅ `placeholder-v0` marking preserved from `calculatePlaceholderScore`
- ✅ never persisted as `approved` from the create path (downgraded to
  `pending_review` defensively even if a caller passed `approved`)

### Outreach persistence

- ✅ create e-mail draft / WhatsApp click-to-chat draft (`OutreachRepository.createDraft`,
  built via existing `lib/outreach/draft.ts` `buildOutreachDraft`)
- ✅ approve / reject (`approve`, `reject`)
- ✅ mark `sent` / `replied` / `ignored` as state transitions only — no
  Resend/WhatsApp API is ever called from this layer
- ✅ `do_not_contact` respected — enforced twice: in application code
  (`createDraft` refuses when `doNotContact` is true) and by the DB check
  constraint `outreach_messages_sent_requires_review`

## Candidate → clinic promotion ("transaction shape")

Supabase's JS client has no cross-table transaction primitive, so
`lib/operations/promote-candidate.ts` coordinates two writes explicitly:

1. Reject candidates that are `duplicate` / `rejected` / already
   `promoted_to_clinic`.
2. If a clinic with the same `dedupeKey` already exists, promotion is
   idempotent — link the candidate to the existing clinic instead of
   creating a duplicate.
3. Otherwise create the clinic (preserving `sourceAttribution` and
   `dedupeKey`), then mark the candidate promoted with the new clinic id.
4. If step 3's second write fails after the clinic was created, the function
   returns an explicit failure describing the inconsistency rather than
   silently dropping it — the clinic exists but the candidate row is stale
   and needs manual reconciliation. This asymmetry is a known, documented
   limitation of not having a real DB transaction here.

## Known limitations

See `docs/technical/crawler-next-steps.md` → "Gaps opened by the
persistence-adapter layer" for the full list (`do_not_contact` column,
`extracted_content` schema/review columns, two coexisting crawl runners, no
real screenshot capture, simplified sequential crawl loop). The `crawl_jobs.lead_id`
requirement that was previously listed there is resolved — see "Crawl
persistence" above.
