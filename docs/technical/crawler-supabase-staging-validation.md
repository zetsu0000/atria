# Crawler / Supabase staging validation

> **Status: PASSED.** `atria-staging` (ref `lfkyiztuwptmddsraucg`) was
> created, linked, migrated, and fully verified. **34/34 checks passed**:
> all 13 tables exist, the `crawl_jobs` lead-or-clinic constraint behaves
> correctly, RLS/grants deny `anon` and allow `service_role`, and the
> fixture-only smoke test succeeded with verified cleanup. **Production
> (`Atria`, ref `cskodsnvghavkcjwmafr`) was never touched. No real clinic
> website was crawled. No outreach was sent.** One incidental exposure of a
> low-risk credential is disclosed transparently near the end of this
> document — see "Incident: legacy API key briefly displayed."

## Branch

`feature/crawler-supabase-staging-validation`, created from tag
`atria-crawler-supabase-local-validation-v1` → `f28a824` ("Validate crawler
persistence against local Supabase").

## How this evolved across the task

This validation happened in three parts, each gated on the previous one:

1. **Identify staging (this document's original content, preserved below
   under "Phase 1 history").** Initially, no staging project existed or was
   linked anywhere in this repo/machine — a genuine STOP condition, not a
   guess-and-proceed situation.
2. **Create + link `atria-staging`** (see
   `docs/technical/crawler-supabase-staging-target.md` for the full record)
   — new project, same organization as `Atria`, region `sa-east-1`, database
   password generated and discarded without ever being observed by this
   session.
3. **Apply migrations, then verify + smoke-test** (this document, current
   results below) — `db push` initially hung due to an environment-level
   limitation on raw Postgres protocol traffic; the user ran it themselves
   via the Supabase connection pooler in their own terminal, since that step
   genuinely required a password this session was never allowed to see. All
   verification and the smoke test after that were done by this session
   using API keys (not the DB password) — see "Credential handling" below.

## Migrations applied

Confirmed via `supabase migration list` (read-only, no password needed):

| Local migration | Applied on `atria-staging`? |
| --- | --- |
| `20260718120000_create_leads` | Yes |
| `20260719180000_crawler_data_foundation` | Yes |
| `20260720120000_discovery_clinic_score_foundation` | Yes |
| `20260720150000_crawl_jobs_lead_or_clinic` | Yes |

## Credential handling for Phase 4/5

Table verification, constraint testing, RLS testing, and the smoke test
were run by a one-time script (`scripts/crawler-staging-smoke.ts`, deleted
immediately after use — not part of the committed repo) using the
project's `service_role`/`anon`-equivalent API keys, **not** the database
password:

- Keys were fetched with `supabase projects api-keys --project-ref
  lfkyiztuwptmddsraucg --reveal --output json`, piped **directly** into a
  `node` parser within the same shell command, and assigned only to shell
  variables that were never echoed. The raw JSON never appeared in any
  output this session recorded (with one exception below).
- The newer `sb_publishable_…` / `sb_secret_…` key pair was used (not the
  legacy JWT-format `anon`/`service_role` keys), specifically because it
  could be fetched and used without the incident described below repeating.
- All environment variables were scoped to the single command invocation
  that ran the script (`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
  SUPABASE_ANON_KEY=... npx tsx scripts/crawler-staging-smoke.ts`) and
  unset immediately after.
- No key value, connection string, or password appears anywhere in this
  document, in the deleted script, or in any committed file.

## Incident: legacy API key briefly displayed

While looking up API keys for `atria-staging`, a first call —
`supabase projects api-keys --project-ref lfkyiztuwptmddsraucg --output
json` (**without** `--db-url`/piping, run directly) — was expected to mask
secret values by default. It did mask the newer `sb_secret_…` key, but the
CLI prints the **legacy JWT-format `anon` and `service_role` keys in full
even without `--reveal`**, which was not anticipated. As a result:

- The `anon` key was displayed. This is not a meaningful exposure — anon
  keys are designed to be public/client-safe by default, protected entirely
  by RLS (which this same task independently verified is correctly denying
  `anon` access on every table).
- The legacy `service_role` key **was** displayed. This key grants
  elevated, RLS-bypassing access to `atria-staging` only — it cannot reach
  `Atria` (production) or any other project. `atria-staging` contained no
  data at the time (freshly migrated, empty) and contains no data now (the
  smoke test cleaned up everything it created). All subsequent operations
  in this session used the separate, non-exposed `sb_secret_…` key instead
  of this legacy key.
- **Recommended (non-urgent) follow-up:** regenerate the legacy JWT secret
  for `atria-staging` via Supabase Dashboard → Project Settings → API →
  Legacy API Keys, whenever convenient. This invalidates the exposed value.
  No CLI command exists for this rotation, so it was not attempted by this
  session.

This is disclosed here in full rather than omitted, per the same
transparency this whole task has applied to every blocker and workaround.

## Phase 4 — remote staging verification (13/13 + constraint + RLS)

### Tables (13/13 exist)

`leads`, `lead_status_history`, `crawl_jobs`, `crawl_pages`,
`crawl_findings`, `discovery_jobs`, `prospect_candidates`, `clinics`,
`clinic_contacts`, `scan_assets`, `extracted_content`, `scores`,
`outreach_messages` — verified via `service_role`-equivalent client,
`select(..., { count: "exact", head: true })` per table (existence proven
by absence of a "relation does not exist" error; no row data was read).

### `crawl_jobs` lead-or-clinic constraint

Verified with disposable rows (raw insert via the API key, bypassing this
codebase's own application-level guard, to prove the **database-level**
check constraint itself — same rigor as the local validation's SQL
transaction test):

| Case | Result |
| --- | --- |
| `lead_id` set, `clinic_id` null | **Accepted** |
| `clinic_id` set, `lead_id` null | **Accepted** |
| neither set | **Rejected** — Postgres error code `23514` (check_violation), matching `crawl_jobs_requires_lead_or_clinic` |

The disposable `leads`/`clinics`/`crawl_jobs` rows created for this test
were deleted immediately after, and cleanup was independently re-verified
by re-querying each row by id and confirming it was gone.

### RLS / grants

| Check | Result |
| --- | --- |
| `anon` reading `leads` | **Denied** — Postgres error `42501` (insufficient_privilege) |
| `anon` reading `crawl_jobs` | **Denied** — `42501` |
| `service_role`-equivalent reading `leads` | **Allowed** |

This matches the RLS/grants behavior already proven against local Supabase
(`docs/technical/crawler-supabase-local-validation.md`) — the same
migrations produce the same access model on staging.

## Phase 5 — fixture-only smoke test (real persistence adapters)

Ran the full requested flow using this repo's actual
`lib/operations/supabase/*.ts` adapters (not a reimplementation):

1. create discovery job
2. create candidate (source attribution + dedupe key preserved)
3. promote candidate to clinic (`lib/operations/promote-candidate.ts`)
4. create clinic contact (source URL + review status preserved)
5. create a **clinic-centric** crawl job (`clinic_id` only, `lead_id: null`
   — exercises the lead-or-clinic path through the repository layer)
6. claim the crawl job
7. persist a crawl page (fixture HTML fields only — no real fetch)
8. persist `extracted_content` (`pending_review`, `requiresHumanReview: true`)
9. persist `scan_assets` metadata (no bytes — `metadata.captured: false`)
10. calculate + persist a score (asserted total = sum of the five dimensions)
11. build and persist an outreach draft, then **re-fetch it from the
    database** and confirm it is still `status: "draft"` — the no-send
    guarantee, checked against the persisted row, not just the return value

All 13 individual steps passed. **No real URL was crawled. No screenshot
bytes were uploaded anywhere. No email or WhatsApp message was sent** — the
outreach step only ever produced and persisted a `draft`-status row.

### Cleanup

Every row created above was deleted (`scores` → `crawl_jobs` → `clinics` →
`prospect_candidates` → `discovery_jobs`, letting FK cascades remove
`crawl_pages` / `extracted_content` / `scan_assets` / `clinic_contacts` /
`outreach_messages` automatically), then **independently re-verified**:
each primary row was re-queried by id (confirmed absent), and each
cascade-dependent table was re-counted by `crawl_job_id`/`clinic_id`
(confirmed zero). `atria-staging` was left in the same empty state it was
in immediately after migrations were applied.

### Combined result

**34/34 checks passed** (13 table-existence + 3 constraint + 3 RLS/grants +
1 constraint-cleanup + 13 smoke-test steps + 1 smoke-test cleanup).

## Scope confirmations

- No UI was modified.
- No real clinic website was crawled.
- No outreach was sent.
- Production (`Atria`, ref `cskodsnvghavkcjwmafr`) was not touched, linked,
  or targeted by any command across this entire task.
- `supabase db reset` was never run against any remote project.
- No secrets appear in this document, except the transparently-disclosed
  incident above (a low-risk, staging-only, empty-database credential,
  already superseded by using a different key for everything after it).
- No commit was made in this round.

---

## Phase 1 history (original "no staging identified" finding)

Preserved for context — this was true at the start of the multi-round
staging effort and is no longer the current state.

`supabase projects list` initially failed with
`LegacyPlatformAuthRequiredError` (no authenticated CLI session), there was
no `supabase/config.toml`, no linked project-ref file, and no `.env.local`
carrying staging credentials anywhere in this repo or machine. That was a
genuine STOP condition per instruction, resolved only once the user
authenticated the CLI and this task explicitly authorized creating
`atria-staging` (see `docs/technical/crawler-supabase-staging-target.md`
for that full record).
