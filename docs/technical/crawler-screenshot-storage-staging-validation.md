# Crawler screenshot storage bucket — staging validation

> **Status: migration applied, bucket verified, real upload confirmed
> end-to-end, private-by-default posture confirmed, pre-existing fallback
> behavior confirmed unaffected.** One partial finding: a desktop
> screenshot exceeded the bucket's 5 MB size limit and correctly fell
> back to `storage_failed` rather than corrupting or silently dropping
> data — documented as a real, current limitation below, not a defect.
> **No passwords, tokens, API keys, database URLs, or object contents
> appear in this document.**

## Staging ref

`atria-staging`, project ref `lfkyiztuwptmddsraucg` — reconfirmed via
`cat supabase/.temp/project-ref` before any command below. Production
(`Atria`, ref `cskodsnvghavkcjwmafr`) was never linked, targeted, or
touched.

## Migration applied

Migration: `supabase/migrations/20260722100000_crawler_screenshots_bucket.sql`.

Same known, previously-documented limitation as every prior migration in
this project: `supabase db push` (direct connection) hangs at
`Initialising login role...` in this sandbox. Per the same precedent used
for every earlier migration (`docs/technical/crawler-supabase-staging-target.md`,
`docs/technical/crawler-review-queue-staging-validation.md`), the push
was run by the user, in their own terminal, via the connection pooler
with the staging DB password — a value this session has never seen and
must never handle.

Independently re-verified (read-only, no password needed):

```
supabase migration list
```

Before: `20260722100000` showed `"remote":""` (pending). After the user's
push, reconfirmed at the start of this round: `"remote":"20260722100000"`,
matching `local` exactly — same as all five prior migrations.

## Bucket verified

Direct Storage API query (service-role key used only as an unprinted
request header):

```
GET /storage/v1/bucket/crawler-screenshots
```

```json
{
  "id": "crawler-screenshots",
  "name": "crawler-screenshots",
  "public": false,
  "file_size_limit": 5242880,
  "allowed_mime_types": ["image/png"]
}
```

All four values match the migration exactly: `public: false`,
`file_size_limit: 5242880` (5 MB), `allowed_mime_types: ["image/png"]`.

## Privacy status

Three independent confirmations, not just reading the config value:

1. **Config-level:** `public: false`, as above.
2. **Anonymous request denied outright:** a request to list bucket
   objects with no `Authorization` header returned `400` — `"headers must
   have required property 'authorization'"` — before even reaching any
   permission check.
3. **Real-object public-URL denial:** Supabase's own public-access URL
   pattern (`/storage/v1/object/public/<bucket>/<path>`), tried against
   the real, successfully-uploaded mobile screenshot from this round,
   returned `400` — not `200`. This is the strongest possible proof: the
   exact URL scheme a public bucket *would* serve from was tried against
   this bucket and refused.

No signed URL was generated or is included anywhere in this document.

## Upload validation — command run

```
npm run crawler:queue:process -- --target staging \
  --clinic-ids bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --allow-real-crawl --capture-screenshots \
  --approved-domains skinlaser.com.br,www.skinlaser.com.br \
  --max-pages 1 --screenshot-storage-bucket crawler-screenshots \
  --screenshot-timeout-ms 8000
```

`--screenshot-storage-bucket crawler-screenshots` was passed explicitly
(`SCREENSHOT_STORAGE_BUCKET` was not set in `.env.local` for this
session — the CLI does not silently assume a default bucket name when
neither the flag nor the env var is set, by design, so it must be one or
the other).

**Crawl job:** `1e5c2efa-9dbe-4031-ae42-4d4d1a5d6ea8`, `status: partial`
(1-page bound, as requested), same real SkinLaser homepage content
already documented in prior rehearsals.

## Result: mobile succeeded, desktop hit the size limit

| Viewport | Result | Detail |
| --- | --- | --- |
| Mobile (390×844) | **`captured`** — real upload succeeded | `storage_path: private/scan-assets/1e5c2efa-.../mobile.png` |
| Desktop (1440×1200) | `storage_failed` | `metadata.storageError: "Storage upload failed."` (sanitized by design — see `lib/operations/pipeline/screenshot-assets.ts`) |

**Root cause, isolated separately** (a diagnostic-only upload to a
throwaway path — `crawler-screenshots/diagnostic/`, deleted immediately
after, never part of the real pipeline data): a small PNG uploaded
cleanly (`200`); a 6 MB dummy file failed to complete the upload request
at all. This is consistent with the bucket's `file_size_limit: 5242880`
(5 MB) — a full-page desktop screenshot (1440×1200, uncompressed
lossless PNG, likely image-heavy real commercial content) is plausibly
several MB, while the much smaller mobile canvas (390×844) compressed to
a real, confirmed **373,122 bytes** — comfortably under the limit. The
exact byte size of the failed desktop capture is not knowable after the
fact: **by design, a screenshot that fails to upload is never persisted
anywhere** (not in Postgres, not in Storage) — only its metadata and a
sanitized failure reason are recorded, which is exactly what happened
here. No workaround (loosening the limit, retrying, compressing) was
attempted — this is a real, current, documented limitation, not
something to route around silently.

**The failure was handled exactly as designed:** the crawl job still
completed (`status: partial`, not `failed`), the score was still
computed (68/100), an outreach draft was still built (`status: "draft"`)
— a single asset's storage failure never fails the whole pipeline.

## `scan_assets` result

Independently re-verified by direct query — matches the CLI's own output
exactly:

- `b5e40012-9d87-4276-a4f3-ff8e6fe3b812` (desktop) — `storage_path: ""`, `metadata.captureStatus: "storage_failed"`, `metadata.storageError: "Storage upload failed."`
- `ae00cab7-1b23-47f2-b638-9ced258ec71c` (mobile) — `storage_path: "private/scan-assets/1e5c2efa-.../mobile.png"`, `metadata.captureStatus: "captured"`, `metadata.bucketName: "crawler-screenshots"`

**Confirmed the object genuinely exists in the bucket** (not just a
database claim): a direct Storage API metadata lookup
(`/storage/v1/object/info/...`) for that exact path returned the real
object — `size: 373122`, `content_type: "image/png"`, a real `etag` and
`created_at`. No object bytes, signed URLs, or the etag/version UUID are
reproduced here beyond what's already shown above (none of which are
secrets, but kept minimal per instruction).

## Pre-existing `pending_storage` fallback — confirmed still correct

A second run, identical except omitting `--screenshot-storage-bucket`
(crawl job `2668f0ac-f400-4326-a5ef-a19a96347a41`), confirmed the
bucket's mere *existence* in staging does not change default behavior —
both screenshots correctly fell back to `pending_storage` when the CLI
wasn't told to use the bucket:

```json
[
  { "viewport": "desktop", "captureStatus": "pending_storage", "storagePath": null },
  { "viewport": "mobile", "captureStatus": "pending_storage", "storagePath": null }
]
```

This is the same behavior documented before this task's migration
existed — genuinely unaffected, not just assumed unaffected.

## No production touched, no broad crawl, no Google/SERP, no outreach sent

- Production (`Atria`, ref `cskodsnvghavkcjwmafr`) was never linked, targeted, or touched.
- Exactly one clinic, two crawl jobs, both bounded to `max-pages 1`.
- No Google Places/SERP call was made — no new discovery.
- Two new `outreach_messages` rows this round (`23345f34-...`,
  `f88c6cf6-...`), both `status: "draft"`, `human_reviewed: false` —
  re-fetched and confirmed, not just inferred from CLI output.

## Retained staging rows (no cleanup — retained for inspection)

Everything from every prior rehearsal remains untouched, plus:

| Table | New row(s) this round |
| --- | --- |
| `crawl_jobs` | `1e5c2efa-...` (with bucket, partial), `2668f0ac-...` (without bucket flag, pending_storage confirm, partial) |
| `scan_assets` | 4 rows: 1 `captured` (real upload), 1 `storage_failed`, 2 `pending_storage` |
| `scores` | 2 new rows (68 each — 1-page-bound crawls, lower than the earlier 3-page 72) |
| `outreach_messages` | 2 new `draft` rows |
| Storage bucket `crawler-screenshots` | 1 real object: `private/scan-assets/1e5c2efa-.../mobile.png` (373,122 bytes) |

The one diagnostic-only object (`crawler-screenshots/diagnostic/tiny.png`)
created purely to isolate the size-limit root cause was deleted
immediately after — it was never part of the real pipeline data model
and would only have been debug noise for a future reviewer.

## Limitations / blockers

1. **The bucket's 5 MB `file_size_limit` is smaller than at least one
   real desktop screenshot produced by this pipeline.** This is the one
   real, concrete finding of this validation round. It was not worked
   around. Two legitimate follow-up options exist for a future task (not
   decided or acted on here): raise the bucket's `file_size_limit` via a
   new additive migration, or compress/resize desktop captures before
   upload — either is a deliberate, separate decision.
2. Mobile screenshots — the smaller, arguably more commercially relevant
   viewport for a "first impression" review — upload successfully today.
3. No cleanup/retention policy exists for the bucket's contents, same
   note as the original implementation doc.

## Verification

- `npm test` — 285/285 passing (unchanged — no code was modified this round).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — two clinic-centric crawl jobs, both bounded to `max-pages 1`, same approved-domain mechanism as prior rehearsals, no allowlist broadening.
- No Google Places/SERP call was made.
- No outreach was sent — both new drafts remain `status: "draft"`, re-fetched and confirmed.
- No secrets were stored in any file, log, or this document — `.env.local` remained git-ignored throughout; the staging DB password was never seen by this session; every direct staging query used the service-role key solely as an in-memory HTTP header, never echoed to output.
