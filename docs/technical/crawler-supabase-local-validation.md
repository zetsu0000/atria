# Crawler / Supabase local validation

> **Status: PASSED.** Local Supabase (Docker-based) is running on this
> machine, all four migrations were replayed cleanly via `supabase db
> reset`, all 13 tables exist with RLS enabled, the `crawl_jobs`
> lead-or-clinic constraint was verified with real inserts against the
> local database, and RLS/grants were verified live for `anon` /
> `authenticated` / `service_role`.
>
> **No remote migration was applied. No real clinic website was crawled. No
> outreach was sent.** This document contains no Supabase key values —
> local credentials were read only from `supabase status` / environment
> variables at run time and are never written to any committed file.

## Branch

`feature/crawler-supabase-local-validation`, based on
`feature/crawler-persistence-adapters` @ `6a6c0ed`.

This replaces the earlier "BLOCKED" version of this document (Docker
Desktop previously failed with `VZErrorDomain Code=1 "Failed to install
Rosetta"` on this machine). That issue was resolved outside this session;
local Supabase is now confirmed running.

## Commands run

```
supabase status
supabase db reset
docker exec supabase_db_atria-crawler-foundation psql -U postgres -d postgres ...
npx tsx --test lib/operations/supabase-local-integration.test.ts   # with env vars, see below
npm test / npm run typecheck / npm run lint / npm run build
```

Table/constraint/RLS checks and the integration test connect to the local
Postgres via `docker exec` into `supabase_db_atria-crawler-foundation`
(no connection string needed — it runs as the container's own `postgres`
superuser) or via `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
`LEAD_HASH_SECRET` environment variables sourced from `supabase status -o
json` at invocation time. No key value is reproduced in this document, in
any test file, or in any other committed file.

## 1. `supabase status`

Core stack confirmed healthy: `supabase_db`, `supabase_auth`,
`supabase_rest`, `supabase_kong`, `supabase_studio`, `supabase_storage`,
`supabase_realtime`, `supabase_analytics`, `supabase_pg_meta`,
`supabase_edge_runtime`, `supabase_vector`, `supabase_inbucket` all reported
`Up ... (healthy)` via `docker ps`. (`supabase_pooler` and `supabase_imgproxy`
were stopped — optional services, not required for this validation.)

## 2. `supabase db reset`

Ran a full reset to validate a clean migration replay from an empty
database:

```
Resetting local database...
Recreating database...
Initialising schema...
Seeding globals from roles.sql...
Applying migration 20260718120000_create_leads.sql...
Applying migration 20260719180000_crawler_data_foundation.sql...
Applying migration 20260720120000_discovery_clinic_score_foundation.sql...
Applying migration 20260720150000_crawl_jobs_lead_or_clinic.sql...
Restarting containers...
Finished supabase db reset on branch main.
```

All 4 migrations applied without error. The only `NOTICE`s were benign
`if not exists` / `if exists` guards behaving as designed (e.g. migration 4
skipping the `clinic_id` column and its index because migration 3 already
created them — confirms the idempotency guards work as intended, not a
problem).

## 3. Tables verified

`\dt public.*` inside the freshly reset database returned all 13 expected
tables:

```
clinic_contacts | clinics | crawl_findings | crawl_jobs | crawl_pages |
discovery_jobs | extracted_content | lead_status_history | leads |
outreach_messages | prospect_candidates | scan_assets | scores
```

This matches the task's required list exactly (including `lead_status_history`,
which existed before this branch and was re-verified here).

## 4. `crawl_jobs` lead-or-clinic constraint — verified with real inserts

Ran inside a single transaction (disposable `leads`/`clinics` rows created
for FK satisfaction, `SAVEPOINT` around the expected failure, full
`ROLLBACK` at the end — **zero rows persisted**):

| Case | Result |
| --- | --- |
| `lead_id` set, `clinic_id` null | `INSERT 0 1` — accepted |
| `clinic_id` set, `lead_id` null | `INSERT 0 1` — accepted |
| neither set | `ERROR: new row for relation "crawl_jobs" violates check constraint "crawl_jobs_requires_lead_or_clinic"` — rejected, exactly as designed |

Row counts confirmed: `2` rows visible inside the transaction (the two
accepted inserts), `0` rows in `crawl_jobs` / `leads` / `clinics` after
`ROLLBACK` — the database was left exactly as found.

## 5. RLS / grants — verified live

- `relrowsecurity = true` on all 13 tables (`pg_class` query).
- `anon` and `authenticated` roles: `rolbypassrls = false`, and have **zero**
  entries in `information_schema.role_table_grants` for any table in
  `public` — no privilege was ever granted to them, matching every
  migration's `revoke all on table ... from anon, authenticated`.
- `service_role`: `rolbypassrls = true`, and holds
  `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on all 13
  tables, matching every migration's `grant all on table ... to service_role`.
- Live access checks (`SET ROLE ...; SELECT ...`):
  - `anon` → `SELECT * FROM public.leads` → `ERROR: permission denied for
    table leads`.
  - `authenticated` → `SELECT * FROM public.crawl_jobs` → `ERROR:
    permission denied for table crawl_jobs`.
  - `service_role` → `SELECT count(*) FROM public.leads` → succeeds (`0`,
    empty table at that point, but access allowed — the point being
    permission, not row count).

## 6. Local integration test added

`lib/operations/supabase-local-integration.test.ts` — a real integration
test against the live local Supabase instance (not fakes). It:

- Reads credentials **only** from `process.env.SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` / `LEAD_HASH_SECRET` (via the existing
  `readLeadCaptureEnv()` / `hasPersistenceConfig()` helpers) — no value is
  hardcoded in the file, and none is written to any committed file.
- Is skipped (not failed) when those variables are unset, so `npm test`
  stays green for anyone without local Supabase running — verified: without
  the env vars, `npm test` shows `﹣ Supabase local integration ... # local
  Supabase not configured ...` and still reports `133 pass / 0 fail`.
- When run **with** the env vars sourced from `supabase status -o json`,
  exercises the full requested flow against real Postgres in one pass:
  create discovery job → create candidate (source attribution + dedupe key
  preserved) → promote candidate to clinic
  (`lib/operations/promote-candidate.ts`) → create clinic contact (source
  URL + review status preserved) → create a **clinic-centric** crawl job
  (`clinic_id` only, `lead_id: null` — exercises the same constraint path as
  §4, through the repository layer this time) → claim it → persist a crawl
  page → persist `extracted_content` (asserted `pending_review` /
  `requiresHumanReview: true`) → persist `scan_assets` metadata (no bytes)
  → calculate + persist a score (asserted total = sum of the five
  dimensions) → create an outreach draft → **re-fetch it from the database
  and assert `status: "draft"`** (the "no send occurs" guarantee, verified
  against the persisted row, not just the in-process return value).
- Cleans up every row it created in an `after`/`finally` block, in FK-safe
  order. Verified post-run: `SELECT count(*)` on all 11 tables touched by
  the test returned `0` — nothing was left behind.
- Run command used for this validation (values sourced live from
  `supabase status -o json`, never written to a file):
  ```
  SUPABASE_URL=<from supabase status> \
  SUPABASE_SERVICE_ROLE_KEY=<from supabase status> \
  LEAD_HASH_SECRET=local-integration-test-only \
    npx tsx --test lib/operations/supabase-local-integration.test.ts
  ```
  Result: `1 pass / 0 fail`.

## Limitations

- This validates the **local** Supabase stack only, as instructed. No
  staging or production project was touched, and this document/test suite
  give no evidence either way about staging/production migration state.
- The integration test covers one representative path through each
  repository (create-then-verify), not every method on every repository —
  the broader method-by-method contract is already covered by the
  fake-adapter suite in `lib/operations/repositories-fakes.test.ts` and the
  row-mapping suite in `lib/operations/supabase-mapping.test.ts`
  (see `docs/technical/crawler-persistence-test-plan.md`).
- `scripts/crawler-local-persistence-smoke.ts` (mentioned in the original
  task as optional) was not added — the integration test above already
  covers the same "fixture-only, local-Supabase-only" smoke-test intent
  without a separate script to maintain.
- Storage buckets for real screenshot bytes were not created or tested — out
  of scope for this pass (see `docs/technical/crawler-next-steps.md`,
  "Authorized local Playwright/Puppeteer screenshot capture").
- CI does not currently run the local-Supabase integration test (it needs
  Docker + a running local Supabase, which CI in this repo does not
  provision). It is a developer-run, opt-in check via the env-var gate
  described above.
