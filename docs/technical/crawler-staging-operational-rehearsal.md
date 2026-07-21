# Crawler staging operational rehearsal

> **Status: PASSED.** Ran the full controlled Atria crawler flow (CSV
> fixture → controlled pipeline → clinic/crawl job → score → screenshot
> metadata → operational report → cleanup) against `atria-staging` (ref
> `lfkyiztuwptmddsraucg`) using only fixture data and the `example.com`
> allowlisted host. Every row created was deleted and independently
> reconfirmed absent. **Production (`Atria`, ref `cskodsnvghavkcjwmafr`) was
> never linked or targeted. No broad crawl. No Google Places/SERP calls. No
> outreach sent. No UI changed.** One incidental exposure of a low-risk
> staging-only credential is disclosed transparently below.

## Branch

`feature/crawler-staging-operational-rehearsal`, created from tag
`atria-crawler-operational-report-v1` (commit `7ad50fc`, "Add crawler
operational report generator").

This was a verification/rehearsal task, not a new feature. No product code
was changed — only this doc was added.

## Phase 1 — Preflight

| Check | Result |
| --- | --- |
| `git status --short` | Clean working tree |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) |
| `supabase migration list` | All 4 local migrations applied remotely: `20260718120000`, `20260719180000`, `20260720120000`, `20260720150000` |
| Production ref (`cskodsnvghavkcjwmafr`) linked anywhere | No — only staging is linked in this checkout |

Baseline row counts (via `supabase db query --linked`) confirmed all 11
operational tables empty (`0` rows) before this rehearsal began.

## Phase 2 — Dry-run rehearsal

```
npx tsx scripts/crawler/run-controlled-pipeline.ts --dry-run --max-candidates 1 --max-pages 1
```

- Used in-memory fake repositories only (`selectRepositories({ dryRun: true, ... })`)
  — no Supabase client constructed, no network call possible.
- Imported 1 of 6 CSV rows (`truncatedByMaxCandidates: true`), promoted to a
  clinic, ran a fixture-served (non-network) "crawl", produced a score
  (`total: 66`), and built an outreach draft that stayed `status: "draft"`.
- No screenshots requested in this run (`--capture-screenshots` omitted).
- The standalone report generator (`generate-operational-report.ts`) always
  requires `--target local|staging` because it reads previously *persisted*
  crawl data — it has no dry-run mode of its own. Report generation against
  fully in-memory/fake data is instead covered by this repo's automated test
  suite (`lib/operations/operational-report.test.ts`, part of the 190 tests
  in Phase "Verification" below), which exercises `buildOperationalReport`
  directly against fake repositories. This is the documented, supported way
  the report is verified without persistence.

## Phase 3 — Staging rehearsal with fixture data

```
SUPABASE_URL=https://lfkyiztuwptmddsraucg.supabase.co \
LEAD_HASH_SECRET=<ephemeral, generated fresh, never reused> \
SUPABASE_SERVICE_ROLE_KEY=<fetched via `supabase projects api-keys`, scoped to this one command> \
npx tsx scripts/crawler/run-controlled-pipeline.ts \
  --target staging --allow-real-crawl --capture-screenshots \
  --max-candidates 1 --max-pages 1
```

- `--target staging` passed `assertSafeTarget` (resolved `SUPABASE_URL` ref
  matches the known staging ref; production ref is hard-blocked in code
  regardless of what's requested — see `lib/operations/pipeline/target-guard.ts`).
- `--max-candidates 1` → only the first CSV row (`Clínica Exemplo Um`,
  `https://example.com/`) was imported and promoted.
- `--allow-real-crawl` permitted one real HTTP fetch, restricted by
  `lib/operations/pipeline/controlled-transport.ts` to `example.com` (+
  subdomains) only — the only host in the fixture CSV that qualifies as
  "allowlisted." No other host was requested.
- Result: `finalStatus: "completed"`, 1 page fetched, score `total: 45`,
  outreach draft created (`status: "draft"`, never sent).
- Created rows: 1 `discovery_jobs`, 1 `prospect_candidates`, 1 `clinics`, 1
  `crawl_jobs`, 1 `scores`, 1 `outreach_messages`, 2 `scan_assets` (below).
  No `leads` row was created (this is a clinic-centric crawl job —
  `clinic_id` set, `lead_id` null — permitted by the
  `crawl_jobs_requires_lead_or_clinic` constraint).

## Phase 3b — Screenshot behavior

- `--capture-screenshots` requires `--allow-real-crawl` (enforced by the CLI
  before any repository is even selected) — both were passed together.
- Real Playwright/Chromium navigation to `https://example.com/` captured
  desktop (1440×1200) and mobile (390×844) screenshots.
- No `--screenshot-storage-bucket` flag was passed, so no Supabase Storage
  upload was attempted and no bucket (public or private) was touched. Both
  screenshot assets were persisted as **metadata only**, with
  `captureStatus: "pending_storage"` and `storagePath: null` — exactly the
  documented behavior when storage isn't configured.
- Asset ids: `58e4c89f-14f8-4bb0-b04e-1b21043408bf` (desktop),
  `cd5624fd-afea-4913-a53d-3111cd6e3982` (mobile). No image bytes were
  uploaded anywhere, public or private.

## Phase 4 — Operational report

```
npx tsx scripts/crawler/generate-operational-report.ts --target staging \
  --clinic-id fe6871a2-5078-4c41-a415-6cd5aa279adb --output markdown --write-artifact

npx tsx scripts/crawler/generate-operational-report.ts --target staging \
  --clinic-id fe6871a2-5078-4c41-a415-6cd5aa279adb --output json --write-artifact
```

Both formats were generated successfully and confirmed to include every
required section: clinic identity, score summary + all five dimensions,
evidence, screenshot references (both showing "capturado (upload
pendente)" with asset ids, matching the `pending_storage` status),
extracted contacts/content summary (schema `extraction-candidates-v1`,
`requiresHumanReview: true`), an outreach draft (`status: draft`), the
7-item human review checklist, and the mandatory disclaimer ("Esta análise
avalia apenas a apresentação digital... Não avalia qualidade médica.").

### Artifact paths (gitignored, local-only — not committed)

- `artifacts/reports/fe6871a2-5078-4c41-a415-6cd5aa279adb.md`
- `artifacts/reports/fe6871a2-5078-4c41-a415-6cd5aa279adb.json`

## Phase 5 — Cleanup

Deleted every row created in Phase 3, scoped by the exact ids returned from
that run (children before parents, explicit — not relying solely on
cascade):

```sql
DELETE FROM outreach_messages WHERE id = '80be53c1-...';
DELETE FROM scan_assets       WHERE crawl_job_id = 'f4950d52-...';
DELETE FROM extracted_content WHERE crawl_job_id = 'f4950d52-...';
DELETE FROM scores            WHERE crawl_job_id = 'f4950d52-...';
DELETE FROM crawl_findings    WHERE crawl_job_id = 'f4950d52-...';
DELETE FROM crawl_pages       WHERE crawl_job_id = 'f4950d52-...';
DELETE FROM crawl_jobs        WHERE id = 'f4950d52-...';
DELETE FROM clinic_contacts   WHERE clinic_id = 'fe6871a2-...';
DELETE FROM clinics           WHERE id = 'fe6871a2-...';
DELETE FROM prospect_candidates WHERE id = '8cac9aa6-...';
DELETE FROM discovery_jobs     WHERE id = '130d3655-...';
```

Run via `supabase db query --linked` (Management API, using the CLI's own
authenticated session — no service-role key needed for cleanup or
verification).

**Reconfirmed independently** with a fresh `count(*)` query across all 11
tables plus `leads` (12 total): every table returned `0`. `atria-staging`
was left in the same empty state it was in before this rehearsal.

## Limitations

- The operational-report CLI has no dry-run mode of its own (see Phase 2) —
  it always reads real (non-production) persisted data by design, since its
  job is to render what's actually in the database for human review.
- Screenshot capture was exercised only against `example.com`'s real
  homepage — no other real clinic site was ever fetched.
- `crawler:queue:process` (the separate async crawl-queue worker script)
  was not exercised in this rehearsal; the controlled pipeline used here
  runs the crawl synchronously in-process end-to-end.

## Incident: legacy API key briefly displayed

While fetching staging API keys (`supabase projects api-keys --project-ref
lfkyiztuwptmddsraucg --output json`, without `--reveal`), the CLI printed
the legacy JWT-format `anon` and `service_role` keys **in full**, even
though the newer `sb_secret_...` key was correctly masked. This is the same
CLI behavior already documented in
`docs/technical/crawler-supabase-staging-validation.md`. As before:

- The legacy `service_role` key grants elevated access to `atria-staging`
  only — it cannot reach `Atria` (production) or any other project.
- It was used only as an in-memory environment variable for the single
  pipeline/report command invocations above, was never written to any file
  (no `.env.local` was created), and `atria-staging` was left fully cleaned
  up (Phase 5) regardless.
- **Recommended (non-urgent) follow-up:** rotate the legacy JWT keys for
  `atria-staging` via Supabase Dashboard → Project Settings → API → Legacy
  API Keys, whenever convenient.

No secret value appears in this document.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked,
  targeted, or touched at any point.
- No broad internet crawl — the only real HTTP fetch was to
  `https://example.com/`, the one fixture host allowlisted by
  `lib/operations/pipeline/controlled-transport.ts`.
- No Google Places or SERP API was called (this pipeline has no such
  integration — CSV import only).
- No outreach was sent — the only outreach artifact created was a
  `status: "draft"` row, deleted in cleanup.
- No secrets were written to any file.
- No commit was made as part of this task.
