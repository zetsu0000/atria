# Crawler persistence — test plan

> Confirms: no remote migration was applied, no real clinic site was
> crawled, no outreach was sent, while building or running this test suite.
> All tests below run via `npm test` (`tsx --test`), require no credentials,
> and never touch the public internet or a live Supabase project. Live
> Supabase staging validation remains a future step (not part of this
> branch).

## Test files added

| File | Covers |
| --- | --- |
| `lib/operations/repositories-fakes.test.ts` | Repository interfaces via fake adapters: discovery job creation, candidate recording/dedupe-key preservation, mark duplicate/rejected/promoted, clinic creation, contact attach (source URL + review status), `do_not_contact` block + flag, crawl job lifecycle (create → claim → counters → complete/fail), page recording with safe-only error codes, `scan_assets` metadata persistence, `extracted_content` payload (`schemaVersion`, `requiresHumanReview`), score persistence (five dimensions + total + evidence + disclaimer, rejects scores with neither `crawlJobId` nor `clinicId`), outreach draft lifecycle (create → approve → sent), `do_not_contact` block on draft creation, refusal to mark `sent` without human review. |
| `lib/operations/promote-candidate.test.ts` | Candidate → clinic promotion "transaction shape": creates clinic + marks candidate promoted; idempotent on repeated dedupe key (links to existing clinic, no duplicate); refuses `duplicate`/`rejected`/already-`promoted_to_clinic` candidates; `not_found` for unknown candidate id. |
| `lib/operations/run-crawl-job.test.ts` | `runCrawlJob` orchestrator against fixtures: success end-to-end (pages + extraction + score persisted, no outreach draft by default), contact attachment when `clinicId` present, partial failure (some pages fail, job → `partial`), total failure (every page fails, job → `failed`, no extraction/score written), robots-denied fast failure (no pages fetched), opt-in outreach draft creation (never created unless requested), `do_not_contact` block on outreach even when explicitly requested, screenshot-metadata persistence (`scan_assets`, no bytes), resuming an existing pending job via `crawlJobId`. |
| `lib/operations/supabase-mapping.test.ts` | Supabase row → domain mapping functions (`mapDiscoveryJobRow`, `mapCandidateRow`, `mapClinicRow`, `mapContactRow`, `mapCrawlJobRow`, `mapScanAssetRow`, `mapExtractedContentRow`, `mapScoreRow`, `mapOutreachMessageRow`) called directly with synthetic rows — no Supabase client constructed, no network. |
| `lib/operations/supabase-configuration-guard.test.ts` | Every Supabase adapter, given an env with no `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, returns a `configuration` error before attempting any request — proves the adapters fail safely with zero credentials, which is also the state CI/this test run is in. |

## Mapping to the task's required coverage

| Required | Where |
| --- | --- |
| Repository interfaces with fake adapters | `repositories-fakes.test.ts` |
| Supabase payload mapping without live Supabase | `supabase-mapping.test.ts`, `supabase-configuration-guard.test.ts` |
| Discovery candidate persistence mapping | `repositories-fakes.test.ts` (`DiscoveryRepository`), `supabase-mapping.test.ts` (`mapCandidateRow`) |
| Candidate → clinic promotion transaction shape | `promote-candidate.test.ts` |
| Contact provenance mapping | `repositories-fakes.test.ts` (`ClinicRepository.addContact`), `supabase-mapping.test.ts` (`mapContactRow`), `run-crawl-job.test.ts` (attaches high-confidence candidates) |
| Crawl job lifecycle | `repositories-fakes.test.ts` (`CrawlRepository`) |
| Page result persistence | `repositories-fakes.test.ts`, `run-crawl-job.test.ts` |
| `extracted_content` persistence payload | `repositories-fakes.test.ts` (`ExtractionRepository`), `supabase-mapping.test.ts` |
| `scan_assets` metadata persistence | `repositories-fakes.test.ts` (`CrawlRepository.saveAsset`), `run-crawl-job.test.ts`, `supabase-mapping.test.ts` |
| Score persistence | `repositories-fakes.test.ts` (`ScoreRepository`), `run-crawl-job.test.ts` |
| Outreach draft persistence | `repositories-fakes.test.ts` (`OutreachRepository`) |
| `do_not_contact` block | `repositories-fakes.test.ts` (`OutreachRepository.createDraft`, `ClinicRepository.setDoNotContact`), `run-crawl-job.test.ts` |
| `runCrawlJob` success with fixtures | `run-crawl-job.test.ts` |
| `runCrawlJob` partial page failure | `run-crawl-job.test.ts` |
| `runCrawlJob` total failure | `run-crawl-job.test.ts` |
| No sending occurs | `repositories-fakes.test.ts` (`markSent` transition-only, never calls an external API), `run-crawl-job.test.ts` (draft stays `status: "draft"`) |
| No live network dependency | All new tests use fixture HTML / mocked `fetchHtmlPage` / mocked `loadRobotsPolicy`; nothing calls the global `fetch` |
| No live Supabase dependency | All new tests use `lib/operations/repositories/fakes.ts` in-memory repositories, or (for the two `supabase-*.test.ts` files) either call pure mapping functions or run against an intentionally unconfigured env that short-circuits before any client call |

## Existing tests unaffected

`lib/crawler/*.test.ts`, `lib/discovery/*.test.ts`, `lib/leads/*.test.ts`,
`lib/outreach/draft.test.ts`, `lib/score/calculate.test.ts` are unchanged and
still pass (93 pre-existing tests → 125 total after this branch's additions,
0 failures).

## Verification commands run

```
npm test          # 125/125 passing
npm run typecheck # clean
npm run lint      # clean (0 errors, 0 warnings)
npm run build     # see docs/technical/crawler-persistence-adapters.md / final report for result
```

## Note on the test-runner glob

`package.json`'s `test` script is `tsx --test lib/**/*.test.ts`, executed by
a POSIX shell without `globstar` — `**` therefore matches exactly one
directory level under `lib/`, the same depth every pre-existing test file
already used (`lib/crawler/*.test.ts`, `lib/leads/*.test.ts`, etc.). New test
files for this branch were kept at `lib/operations/*.test.ts` (one level
deep) rather than nested under `lib/operations/repositories/` or
`lib/operations/supabase/`, specifically so they are picked up by the
existing script without changing it. The repositories/adapters they cover
still live in the nested directories requested by the task — only the test
*files* were kept flat.
