# Crawler Candidate Review CLI

Status date: 2026-07-23

## Why this CLI exists

The operator handoff pack (`docs/operations/crawler-operator-handoff-pack.md`,
Step B "Review candidates") previously documented this step as **"not
available yet"** — after running Google Places discovery, there was no way
to inspect the resulting `prospect_candidates` rows except a direct database
query. The single-prospect operator run rehearsal
(`docs/operations/crawler-single-prospect-operator-run-v1.md`, Section 19)
confirmed this gap in practice.

`scripts/crawler/list-candidates.ts` (via `npm run crawler:candidates:list`)
closes it: a read-only CLI that lists already-persisted candidates, flags
obvious blockers (no website, directory listing, already-existing/duplicate),
and suggests exactly one next action per candidate — so an operator can
decide which single candidate is safe to promote without querying the
database directly.

## Exact commands

```bash
# List the most recent candidates across all discovery jobs
npx tsx scripts/crawler/list-candidates.ts --target staging --limit 20

# List candidates from one specific discovery job
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> --limit 20

# Only show candidates that are genuinely safe to promote right now
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> --only-promotable

# Also run the extra live dedupe-against-clinics check
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> --include-existing

# Search by name, filter by source/status, markdown output
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --query "dermatologia" --source google_places \
  --status new --output markdown
```

Or via the npm script alias:

```bash
npm run crawler:candidates:list -- \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> --limit 20
```

## Supported flags

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--target local\|staging` | Yes | — | Refused if it (or the resolved `SUPABASE_URL`) would touch production — same guard every other crawler CLI uses (`lib/operations/pipeline/target-guard.ts`). |
| `--discovery-job-id <id>` | No | all jobs | Restricts to candidates recorded by one discovery run. |
| `--status <status>` | No | `all` | One of `new`, `needs_review`, `duplicate`, `rejected`, `promoted_to_clinic`, `all`. |
| `--source <source>` | No | any | One of `manual`, `csv_import`, `google_places`, `web_search`, `directory`, `other`. |
| `--query <text>` | No | none | Case-insensitive substring match against the candidate's raw name. |
| `--include-existing` | No | off | Runs an extra read-only check per not-yet-dispositioned candidate for a clinic that already exists with the same identity: an exact dedupe-key match, or (new — see `docs/technical/crawler-website-dedupe-normalization.md`) a normalized-website-only match (http/https treated as the same site). |
| `--only-promotable` | No | off | Restricts output to candidates whose suggested action is `promote_candidate`. |
| `--limit <n>` | No | `20` | Max rows returned after filtering. |
| `--output table\|json\|markdown` | No | `table` | Rendering format. |

## Output fields

Each candidate row includes:

- `candidate_id`
- clinic/business name (`rawName`)
- `website_url`
- `source` (source type) and `source_place_id` (only for `google_places`, read from `sourceAttribution.providerPlaceId` — the raw `sourceAttribution` payload itself is never surfaced)
- `city`/`state`
- `status` (the candidate's own persisted status)
- `promoted_clinic_id` (set once a candidate has been promoted)
- `existing_clinic_id` (set only when `--include-existing` finds a different, already-existing clinic — either an exact dedupe-key match or a website-only match)
- `existing_clinic_match_reason` (`"dedupe_key"` or `"normalized_website"` — explains which kind of match was found; null when `existing_clinic_id` is null)
- `blockers` — human-readable reasons this candidate isn't a clean promote
- `suggested_action` — see below

No secret ever appears in output: no `SUPABASE_SERVICE_ROLE_KEY`, no
`GOOGLE_PLACES_API_KEY`, no DB connection string. The CLI only ever prints
fields already defined on `CandidateReviewItem`
(`lib/operations/discovery/types.ts`) — there is no path for arbitrary
environment or raw provider data to reach the output.

## Operator decision rules (suggested_action)

Exactly one action is chosen per candidate, first matching rule wins:

1. `status === "promoted_to_clinic"` → **`skip_duplicate`** — already exists as a clinic (`promoted_clinic_id` shown).
2. `status === "duplicate"` → **`skip_duplicate`** — already flagged as a duplicate at write time.
3. `status === "rejected"` → **`blocked_existing`** — already has a definitive prior disposition in the system.
4. No `websiteUrl` → **`blocked_no_website`**.
5. Website is a known third-party directory/aggregator (same allowlist prioritization uses — `isDirectoryListing` in `lib/operations/prioritization/prioritize-prospects.ts`) → **`blocked_directory`**.
6. `--include-existing` found a different, already-existing clinic — exact dedupe-key match, or a website-only match (http/https treated as the same site — see `docs/technical/crawler-website-dedupe-normalization.md`) → **`blocked_existing`**.
7. `status === "needs_review"` → **`manual_review`**.
8. Otherwise (status `new`, has its own website, not a directory, no existing conflict) → **`promote_candidate`**.

Only candidates ending in `promote_candidate` are safe to hand to
`npm run crawler:promote -- --target staging --candidate-id <id>`.

## Examples

Table (default):

```
status  action            name                  website                         source         id
------  ----------------  --------------------  ------------------------------  -------------  ------------------------------------
new     promote_candidate Clínica Dermic        https://www.dermic.com.br/      google_places  ea9e761f-8794-465e-8ce3-54bce1cac29c
```

Markdown (`--output markdown`) groups each candidate under its own heading
with ID, status, suggested action, website, source, location, and any
blockers — see `lib/operations/discovery/render-candidate-list-markdown.ts`.

JSON (`--output json`) returns the full `CandidateReviewResult` shape —
useful for piping into another script or an artifact file.

## Safety guarantees

- Read-only: never calls `recordCandidate`, `markCandidateDuplicate`, `markCandidateRejected`, `markCandidatePromoted`, or `createClinic` — verified by a dedicated test that spies on all five (`lib/operations/candidate-review.test.ts`, test 10).
- No candidate promotion, no crawl, no Google Places call, no SERP/scraping, no outreach — this command touches only already-persisted `prospect_candidates` and, when `--include-existing` is set, reads (never writes) `clinics`.
- Production is refused the same way every other crawler CLI refuses it (`lib/operations/pipeline/target-guard.ts` via `selectRepositories`).
- Deterministic, newest-first ordering (`created_at desc`), preserved through every filter.
- An empty result exits cleanly with a helpful JSON note rather than an error.

## Limitations

- Filters are applied client-side after one `listCandidates()` batch fetch (over-fetched generously — `Math.max(limit * 25, 200)` rows). In a staging database with a very large number of candidates, a narrow `--discovery-job-id` filter combined with a very small effective match count deep in an old job could theoretically fall outside this batch; raise `--limit` if a known-to-exist candidate doesn't appear.
- `--include-existing` adds one extra dedupe-key read per not-yet-dispositioned candidate, plus one single `listClinics(500)` read for the website-only check (fetched once per invocation, not per-candidate) — fine at today's staging scale, but not optimized for a large clinic or candidate table.
- The `directory` source type and the `isDirectoryListing` allowlist are both small, explicit, manually-curated lists — this is a heuristic, not an exhaustive detector (same caveat prioritization already documents).
- `--query` only matches the raw name, not website/city/specialty.

## No production, no crawl, no Google/SERP, no outreach

This CLI never touches production (refused structurally), never crawls a
website, never calls the Google Places API or any search engine, and never
creates, approves, or sends an outreach message. It is purely a read-only
lens onto data already written by earlier, separately-authorized steps.
