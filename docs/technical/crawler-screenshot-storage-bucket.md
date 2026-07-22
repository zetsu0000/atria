# Crawler screenshot storage bucket

Private Supabase Storage support for crawler screenshots — closes the
gap identified in `docs/technical/crawler-mvp-readiness-audit.md` §4:
every screenshot captured so far (including the real SkinLaser capture)
exists only as `pending_storage` metadata, with no image bytes retained
anywhere. **This task adds the upload wiring and the bucket-provisioning
migration; it does not apply that migration to staging** — that step is
explicitly left for a follow-up, per instruction to stop and ask first.

## Bucket name

`crawler-screenshots` — exported as `DEFAULT_SCREENSHOT_STORAGE_BUCKET`
in `lib/operations/pipeline/screenshot-assets.ts`.

## Privacy model

- **Private, never public.** The bucket-creation migration sets
  `public: false` explicitly. No code anywhere in this repository calls
  `getPublicUrl` or any equivalent — this is enforced as a literal,
  greppable guarantee, and directly tested (see "Tests" below): a test
  reads the actual `screenshot-assets.ts` source at test time and asserts
  neither `getPublicUrl` nor `public: true` ever appears in it.
- **`service_role`-only access**, same posture as every table in this
  schema: no `storage.objects` RLS policy grants `anon`/`authenticated`
  any access to this bucket, so only the service-role key (used
  exclusively by the server-side crawler CLIs, never exposed to the
  browser) can read or write objects in it.
- **Scoped to exactly what this pipeline produces:** `file_size_limit`
  5 MB, `allowed_mime_types: ['image/png']` — screenshots are always a
  single PNG per capture (`lib/crawler/screenshot-capture.ts` always
  returns `contentType: "image/png"`), so the bucket itself enforces that
  at the storage layer, not just by convention.
- **No patient data, no authenticated/private pages.** Screenshots are
  always the public homepage only (`pageKind: "homepage"`), captured by
  the same bounded, path-denylisted crawler documented in
  `docs/technical/crawler-approved-real-domain-crawl.md` — this task adds
  no new capture surface.

## Setup steps

### 1. Add the migration (done in this task)

`supabase/migrations/20260722100000_crawler_screenshots_bucket.sql` —
additive only (`insert ... on conflict (id) do nothing`), creates exactly
one bucket row, touches nothing else.

### 2. Apply it to staging — **not done in this task, stop-and-ask required**

Per instruction, this step was **not** performed. When explicitly
authorized, applying it follows the exact same, already-documented,
already-used procedure as every prior migration in this project
(`docs/technical/crawler-supabase-staging-target.md`,
`docs/technical/crawler-review-queue-staging-validation.md`): `supabase
db push` (direct connection) hangs in this sandbox, so the push must be
run by the user, in their own terminal, via the connection pooler with
the staging DB password (which this session has never had and must never
handle). After that, `supabase migration list` (read-only, no password
needed) confirms it — the same command already re-run for this audit
shows the migration correctly `pending` (`"remote":""`) as of this
writing.

**Manual/alternative step, if preferred over the migration:** the bucket
can also be created via the Supabase Dashboard (Storage → New bucket →
name `crawler-screenshots` → **toggle "Public bucket" OFF** → file size
limit 5 MB → allowed MIME type `image/png`) or the Management API. Either
path produces the same `storage.buckets` row the migration inserts — pick
one, not both, to avoid a conflicting manual bucket the migration's `on
conflict do nothing` would then silently skip. This document does not
perform this step; it only describes it precisely enough to execute
later.

### 3. Configure the environment

```
SCREENSHOT_STORAGE_BUCKET=crawler-screenshots
```

Added to `.env.example` as a name-only placeholder (bucket names are not
secrets). Read by `lib/security/env.ts`'s new `readScreenshotStorageEnv()`.

## Upload behavior

Already implemented (prior to this task) in
`lib/operations/pipeline/screenshot-assets.ts`'s
`captureAndPersistScreenshots` + `createSupabaseStorageUploader`. This
task's changes are additive on top of that existing, tested flow:

1. Screenshot captured (Playwright, real headless Chromium).
2. If storage is configured (bucket resolved — see below): upload the
   PNG bytes to `private/scan-assets/<crawlJobId>/<viewport>.png` in the
   private bucket via the service-role client.
3. On success: `scan_assets.storage_path` set to that path,
   `metadata.captureStatus: "captured"`, `metadata.bucketName` recorded.
4. `scan_assets` always stores **metadata only** — dimensions,
   `capturedAt`, `pageKind`, source `clinicId` — never binary image bytes
   in Postgres itself; the bytes live only in Storage.

**New in this task:** bucket resolution now falls back to the
`SCREENSHOT_STORAGE_BUCKET` env var when `--screenshot-storage-bucket`
isn't passed on the CLI (`scripts/crawler/process-crawl-queue.ts`,
`scripts/crawler/run-controlled-pipeline.ts`) — previously the flag was
the only way to configure it.

## Fallback behavior (unchanged, already correct — re-verified by tests)

- **No bucket configured at all** (`storage: { configured: false }` —
  the default, and always the case for `--dry-run`): screenshot metadata
  is still persisted with `captureStatus: "pending_storage"`,
  `storage_path: ""` (the physical `not null` column's empty-string
  sentinel for "no path yet"). **Never fails the pipeline.**
- **Bucket configured but the actual bucket doesn't exist, or the upload
  otherwise fails:** `captureStatus: "storage_failed"`,
  `metadata.storageError` records the reason. **Never fails the
  pipeline** — the crawl job still completes/partials normally; only
  that asset's own outcome reflects the failure.
- **Capture itself fails** (browser/navigation error, unrelated to
  storage): `captureStatus: "capture_failed"` — pre-existing, unchanged.

## Staging validation plan

Not executed in this task. Once the migration above is applied (with
explicit authorization) and `SCREENSHOT_STORAGE_BUCKET` is set in
`.env.local`, the plan is:

1. `supabase migration list` — confirm the bucket migration shows a
   matching `remote` timestamp.
2. Re-run screenshot capture for SkinLaser (`bbfd72a3-...`) with the
   bucket now configured — `npm run crawler:queue:process -- --target
   staging --clinic-ids bbfd72a3-a013-4a6c-bd82-4a70479d694a
   --allow-real-crawl --capture-screenshots --approved-domains
   skinlaser.com.br,www.skinlaser.com.br --max-pages 1` (homepage only
   needed to re-verify storage; no need to re-crawl all 3 pages).
3. Query `scan_assets` and confirm `capture_status: "captured"` with a
   real `storage_path` (not `pending_storage`).
4. Confirm no public URL is reachable for that path (a direct
   unauthenticated fetch to the Storage REST endpoint for that object
   should be denied).
5. Document results in a new, separate staging-validation doc (following
   the same pattern as `docs/technical/crawler-review-queue-staging-validation.md`), not this one.

## No public URLs

Structurally guaranteed and tested — see "Privacy model" above and test
#5 below. This document itself contains no bucket URL, no signed URL, and
no public link.

## Limitations

1. **Not yet applied to staging** — this task adds the mechanism and the
   migration file only. Until the migration is applied and the env var
   set, staging behavior is unchanged from before this task: every
   screenshot remains `pending_storage`.
2. **No cleanup/retention policy defined.** Once objects start
   accumulating in the bucket, there's no automatic expiry — worth
   revisiting before high-volume use, not urgent for the current MVP
   scale (2 clinics).
3. **No signed-URL-based temporary access** was added for a future
   preview UI to display a screenshot to a human reviewer — the bucket is
   fully private with no read path for anything other than the
   service-role key. If a reviewer-facing preview is built later, it will
   need its own deliberate, scoped signed-URL mechanism (out of scope
   here) rather than making the bucket public.
4. **Bucket must not be created twice via two different paths** (migration
   vs. Dashboard) without reconciling — see the note in "Setup steps" §2.

## Tests (9 new, in `lib/operations/screenshot-assets-pipeline.test.ts`)

Added to the existing screenshot-assets test file (not a new file) to
keep bucket-storage tests alongside the capture/gating tests they extend:

1. Bucket configured → upload is called (spy-verified) — **and** 2. `storage_path` is persisted, including `metadata.bucketName`.
3. Bucket missing (unconfigured) → `pending_storage`, pipeline does not fail.
4. Upload failure → `storage_failed`, pipeline continues (no throw), failure reason recorded in metadata.
5. No public URL is ever generated — source-level check on both `screenshot-assets.ts` and the bucket migration SQL (`public: false`, no `getPublicUrl`, no destructive statement).
6. No upload occurs when storage is unconfigured — the same shape every `--dry-run` invocation always produces.
7. Production is refused, independent of screenshot storage configuration.
8. Captured screenshot metadata shape is stable (fixed key set, JSON round-trip stable).
9. No outreach interaction exists — `captureAndPersistScreenshots`'s dependency type has no `outreachRepo` parameter at all, structurally incapable of sending anything.

Plus one additional test exercising `createSupabaseStorageUploader`
itself (previously untested — every existing test injected a fake
`upload` function directly): confirms it fails safely, never throwing,
when Supabase isn't configured.

## Verification

- `npm test` — 285/285 passing (276 prior + 9 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed for this task.
- No Google Places/SERP call was made.
- No outreach was sent.
- No bucket was made public, no public URL was created, no secret was written to any file — `SCREENSHOT_STORAGE_BUCKET` is a bucket name, not a credential.
- **The migration was added but deliberately not applied to staging** — confirmed via `supabase migration list` (read-only), which shows `20260722100000` still `pending` as of this writing.
