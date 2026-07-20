# Discovery foundation

## Scope

Prepare structures and pure TypeScript helpers to find clinics **without** calling external APIs in this phase.

## Sources modeled

`manual` · `csv_import` · `google_places` · `web_search` · `directory` · `other`

## Modules

| Path | Responsibility |
| --- | --- |
| `lib/discovery/types.ts` | Source/status enums, Zod input, forbidden patient-data keys |
| `lib/discovery/normalize.ts` | Normalize, dedupe keys, CSV parse, promote → clinic shape |

## Flow

1. Create `discovery_jobs` row (DB; persistence helpers can follow).
2. Ingest candidates via manual object or CSV (`parseManualCsvRows`).
3. `normalizeProspectCandidate` → normalized fields + `dedupeKey`.
4. `classifyCandidateDuplicate` against in-memory or future DB index.
5. Human review (`needs_review` / `rejected` / `duplicate`).
6. `promoteCandidateToClinicShape` → insert `clinics` (status `prospect`).

## Explicit non-goals (this phase)

- No Google Places calls
- No Google Maps scraping
- No directory scraping
- No live SERP
- No automatic outreach from candidates

## Deduplication

Primary key material (hashed):

- normalized website origin (preferred)
- normalized name
- phone digits
- email
- city

Also treat identical `normalizedWebsiteOrigin` as duplicate within a batch.
