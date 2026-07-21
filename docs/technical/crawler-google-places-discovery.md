# Crawler Google Places discovery

> First external discovery adapter for Atria. Calls only the official
> Google Places API (New) `places:searchText` JSON endpoint — never scrapes
> Google Maps, never drives a browser against any Google surface. This
> command discovers candidates and persists `prospect_candidates` only. It
> never crawls a discovered website, never sends outreach, and never
> promotes a candidate to a clinic unless `--promote` is passed explicitly.
>
> **This document describes a discovery adapter. It does not authorize live
> production use.** Every real (non-dry-run) invocation still requires an
> explicit `--target local|staging`, and production is refused
> unconditionally — see "Safety gates" below.

## What this is (and isn't)

```
Google Places API (searchText)
  → map each result to this codebase's candidate shape
  → normalize + dedupe (in-batch and against existing prospect_candidates)
  → persist as prospect_candidates only
  → (optional, explicit --promote) promote each new candidate to a clinic
```

This adapter does **not**:

- crawl the discovered clinic's own website (that's a separate, later,
  explicitly-invoked pipeline command — `crawler:controlled:*`)
- build or send any outreach (it has no `OutreachRepository` dependency at
  all — structurally impossible, not just policy)
- scrape Google Maps HTML or drive a browser against Google in any way —
  the only network call is one `fetch` to
  `https://places.googleapis.com/v1/places:searchText` per page
- promote candidates to clinics unless `--promote` is explicitly passed

## New files

```
lib/discovery/providers/
  types.ts           — provider-agnostic PlacesProvider contract
  google-places.ts   — real adapter (createGooglePlacesProvider), the
                       dry-run fixture adapter (createFixtureGooglePlacesProvider),
                       and the discovery orchestration function
                       (runGooglePlacesDiscovery)

lib/discovery/
  google-places.test.ts — tests for the above (see "Test file location" below)

scripts/crawler/
  discover-google-places.ts — CLI entrypoint (npm run crawler:discover:places)
```

Small additive changes to existing files:

- `lib/security/env.ts` — added `readGooglePlacesEnv()` reading
  `GOOGLE_PLACES_API_KEY` (server-only, optional, never required for
  `--dry-run`).
- `lib/operations/repositories/types.ts` — `RecordCandidateInput` gained an
  optional `status?: "new" | "needs_review"` field (defaults to `"new"`,
  unchanged for every existing caller) so a candidate with no discoverable
  website can be recorded as `needs_review` instead of `new`.
- `lib/operations/repositories/fakes.ts` and
  `lib/operations/supabase/discovery-repository.supabase.ts` — thread that
  same optional `status` through to the fake and real adapters.
- `.env.example` — documents `GOOGLE_PLACES_API_KEY` (name only, no value).
- `package.json` — adds the `crawler:discover:places` script.

No UI files were touched.

## CLI

```
npm run crawler:discover:places -- --dry-run --query "dermatologia" --location "São Paulo, SP"
npm run crawler:discover:places -- --target staging --query "dermatologia" --location "São Paulo, SP"
npm run crawler:discover:places -- --target staging --query "dermatologia" --location "Curitiba, PR" --max-results 5 --promote
```

| Flag | Meaning |
| --- | --- |
| `--dry-run` | In-memory fixture provider + in-memory fake repositories. No `GOOGLE_PLACES_API_KEY` needed, no network call, no Supabase write. |
| `--target local\|staging` | Required unless `--dry-run`. Refused if it (or the resolved `SUPABASE_URL`) would touch production. |
| `--query <text>` | **Required.** e.g. `"dermatologia"`. Refused (before any DB/API call) if blank. |
| `--location <text>` | **Required.** e.g. `"São Paulo, SP, Brazil"`. Refused (before any DB/API call) if blank. |
| `--max-results <n>` | Default `10`. Hard bound on total candidates returned/persisted, enforced both in the provider's pagination loop and again in the orchestration layer. |
| `--max-pages <n>` | Default `1`. Hard bound on Places API pages requested — the loop stops even if the API keeps advertising a `nextPageToken`. |
| `--promote` | Default off. Only when set, every newly-recorded candidate is immediately promoted to a clinic via the existing `lib/operations/promote-candidate.ts` (same code the CSV-driven controlled pipeline uses). Without it, this command only ever writes `prospect_candidates`. |

## Safety gates

| Requirement | How it's enforced |
| --- | --- |
| Production refused | Reuses `lib/operations/pipeline/select-repositories.ts` / `target-guard.ts` unchanged — the exact same hard block already protecting the CSV controlled pipeline. |
| Staging/local only | Same as above — `--target` must be `local` or `staging`; anything else is refused. |
| Explicit query/location required | Checked at CLI entry and again inside `runGooglePlacesDiscovery` before any discovery job is created. |
| Dry-run mode | `createFixtureGooglePlacesProvider()` — two canned places, no network capability at all (it doesn't even accept a `fetch` option). |
| max-results / max-pages enforced | Enforced inside `createGooglePlacesProvider`'s pagination loop (stops requesting pages once satisfied, even with a further `nextPageToken` available) and defensively re-sliced in `runGooglePlacesDiscovery`. |
| No automatic promotion | `promote` defaults to `false`, both in `runGooglePlacesDiscovery`'s input type and the CLI flag. |
| No crawl | `GooglePlacesDiscoveryDeps` has no `CrawlRepository` / `fetchHtmlPage` field — structurally unreachable from this code path. |
| No outreach send | `GooglePlacesDiscoveryDeps` has no `OutreachRepository` field — structurally unreachable. |
| No scraping / browser automation | The adapter only calls `fetch` against `GOOGLE_PLACES_SEARCH_URL`; it imports no HTML-parsing or browser-automation library. Enforced by a regression test that reads the source file and asserts it. |
| No secrets committed | `GOOGLE_PLACES_API_KEY` is read from the environment only (`readGooglePlacesEnv`); `.env.example` documents the name with a placeholder value, never a real key. |

## Data behavior

Each discovered place is persisted as one `prospect_candidates` row with:

| Field | Source |
| --- | --- |
| `source_type` | `"google_places"` |
| `raw_name` / `normalized_name` | Places `displayName.text`, normalized via the existing `lib/discovery/normalize.ts` |
| `website_url` | Places `websiteUri`, or `null` |
| `phone` | Places `nationalPhoneNumber`, or `null` |
| `city` / `state` | Extracted from Places `addressComponents` (`locality` / `administrative_area_level_1`) |
| `specialty` | First entry of Places `types`, if any |
| `source_attribution` | `{ provider: "google_places", providerPlaceId, address, categories, query, location, raw }` — `raw` is the provider's own place object, preserved for audit |
| `dedupe_key` | The existing `buildCandidateDedupeKey` (name + website origin + phone + city) — identical algorithm the CSV pipeline uses, so a place already known from another source is recognized as the same candidate |
| `status` | `"new"` when a website was found, `"needs_review"` when it wasn't (there is no dedicated `review_status` column on `prospect_candidates` — see `docs/technical/crawler-database-model.md` — so this reuses the existing `status` enum's `"needs_review"` value for that purpose) |

Deduplication happens at two levels, reusing the exact same functions the
CSV controlled pipeline uses (`lib/discovery/normalize.ts`):

1. **In-batch** — two Places results in the same search that normalize to
   the same identity (`classifyCandidateDuplicate` against an in-memory
   lookup built up as the batch is processed).
2. **Against existing data** — `DiscoveryRepository.findCandidateByDedupeKey`
   before every write, so re-running the same search (or a search that
   overlaps with CSV-imported or previously-discovered candidates) never
   creates a duplicate row.

## Provider errors, without partial corruption

- If the Places API call itself fails (HTTP error, rate limit, invalid
  JSON), the discovery job is marked `failed` with the provider's error
  code/message and **zero** candidates are recorded — nothing partial is
  ever left behind.
- If persisting one specific candidate fails (a repository-level error),
  that one candidate is captured in the `rejected` list with a clear
  message; every other candidate in the same batch is still processed
  normally, and the discovery job still completes.

## Test file location (a note on the `npm test` glob)

The suggested test path was `lib/discovery/providers/google-places.test.ts`,
colocated with the source. It was moved one level up to
`lib/discovery/google-places.test.ts` after confirming empirically that
this repo's `npm test` script —
`tsx --test lib/**/*.test.ts`, expanded by `/bin/sh` — only recurses **one**
directory level deep under `lib/`. A test file two levels deep (e.g. under
`lib/discovery/providers/`) is silently never executed by `npm test`; a
throwaway marker test confirmed this before any real test was written. Every
existing test file in this repo already sits exactly one level below `lib/`
for the same reason. `google-places.ts` and `types.ts` themselves stay at
the suggested `lib/discovery/providers/` path — only the test file moved.

## Verification

- `npm test` — 212/212 passing (22 new tests for this feature).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- Manually exercised via the CLI: `--dry-run` (with and without
  `--max-results` / `--promote`), missing `--query`/`--location`, missing
  `--target` outside dry-run, a production-ref `SUPABASE_URL` (refused),
  and a staging target with no `GOOGLE_PLACES_API_KEY` set (refused with a
  clear message) — all behaved as documented above.

## Scope confirmations

- No UI was modified.
- No production project was linked, targeted, or touched.
- No scraping of Google Maps or any HTML page — one JSON API call only.
- No crawl of any discovered clinic's website.
- No outreach was built or sent.
- No API key or other secret was committed — `GOOGLE_PLACES_API_KEY` is
  read from the environment only.
