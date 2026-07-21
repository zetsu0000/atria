# Crawler screenshot + score/report asset integration

> Adds controlled homepage screenshot capture (desktop + mobile) to the
> controlled automation pipeline, persists metadata to `scan_assets`, and
> connects it to score/report/outreach-draft generation. Screenshots are
> **off by default**, require two explicit flags to enable, and a capture
> or storage failure never fails the whole crawl job.

## What's new

1. `lib/crawler/screenshot-capture.ts` — Playwright-based homepage
   screenshot capture (desktop 1440×1200, mobile 390×844), fully
   dependency-injected (`ScreenshotCaptureImpl`) so callers/tests never
   need a real browser.
2. `lib/operations/pipeline/screenshot-assets.ts` — captures both
   viewports and persists metadata to `scan_assets`, with a safe fallback
   for every failure mode (capture failure, missing storage bucket, upload
   failure).
3. `lib/operations/pipeline/process-crawl-queue.ts` / `run-controlled-pipeline.ts`
   — wire screenshot capture into the existing controlled pipeline, gated
   behind `--allow-real-crawl` + `--capture-screenshots`; recompute the
   score and (if requested) rebuild the outreach draft after screenshots
   land, so both can reference the captured assets.
4. `lib/score/calculate.ts` — small, additive, backward-compatible fields
   (`desktopScreenshotAssetId`, `mobileScreenshotAssetId`) so score evidence
   text can name the specific `scan_assets` row.
5. New CLI flags: `--capture-screenshots`, `--screenshot-timeout-ms`,
   `--screenshot-storage-bucket` on both
   `scripts/crawler/run-controlled-pipeline.ts` and
   `scripts/crawler/process-crawl-queue.ts`.
6. New dependency: `playwright` (used lazily, only inside
   `captureScreenshotWithPlaywright` — never imported by anything that
   doesn't explicitly call it).

## Default behavior (unchanged unless you opt in)

- Screenshots are **skipped** unless `--capture-screenshots` is passed.
- No browser is ever launched unless both `--capture-screenshots` **and**
  `--allow-real-crawl` are set.
- `--dry-run` never writes to a real database or a real storage bucket —
  everything lands in the in-memory fakes
  (`lib/operations/repositories/fakes.ts`), same as the rest of the
  controlled pipeline.

## Gating (in order)

1. **`--capture-screenshots` without `--allow-real-crawl` is refused** at
   the CLI with a clear message and a non-zero exit code (both
   `run-controlled-pipeline.ts` and `process-crawl-queue.ts`). At the
   library level (`processCrawlQueue`), the same combination is instead
   *skipped safely* — `screenshotsSkippedReason` explains why, and the
   `captureScreenshot` implementation is never invoked. This
   defense-in-depth means a caller that bypasses the CLI (e.g. a future
   caller of the library functions directly) still can't accidentally
   trigger a browser launch without real-crawl also being enabled.
2. **URL safety** — the homepage URL screenshotted is always the crawl
   job's own `requestedUrl`, which has already passed
   `lib/crawler/url-policy.ts` (blocks localhost/private IPs/metadata
   endpoints/embedded credentials/bad ports/bad schemes) via the crawl job
   itself. If the crawl job failed validation, `screenshots` stays empty —
   capture is never attempted for a job that never succeeded.
3. **Host allowlist** — real screenshot capture only proceeds for
   hostnames in `lib/operations/pipeline/controlled-transport.ts`'s
   `ALLOWED_REAL_CRAWL_HOSTNAMES` (`example.com` + subdomains, by default).
   Since the homepage URL is only reachable at all under
   `--allow-real-crawl` (fixture mode never produces a "successful" crawl
   job pointed at a real, non-allowlisted host), a non-allowlisted host is
   rejected *before any network call, including DNS* — the same guarantee
   already built for the rest of real-crawl mode.
4. **Production refusal** — unchanged; `lib/operations/pipeline/target-guard.ts`
   still refuses the production project ref regardless of any screenshot
   flag.

## Capture details

| Viewport | Dimensions | Asset type (adapted to existing schema) |
| --- | --- | --- |
| Desktop | 1440×1200 | `screenshot_desktop` |
| Mobile | 390×844 | `screenshot_mobile` |

Only the homepage is captured (the crawl job's seed URL) — no other page.
Capture never authenticates, never submits a form, never downloads a file
(`acceptDownloads: false` on the Playwright browser context) — it only
navigates once and takes one screenshot per viewport.

## Schema adaptation (no migration added)

Per instruction, this feature adapts to the *existing* `scan_assets` schema
(`supabase/migrations/20260720120000_discovery_clinic_score_foundation.sql`)
instead of adding a migration:

| Task's conceptual field | Physical column / representation |
| --- | --- |
| `asset_type: homepage_desktop_screenshot / homepage_mobile_screenshot` | Reuses the existing `screenshot_desktop` / `screenshot_mobile` enum values (the DB `CHECK` constraint doesn't allow new ones); `metadata.pageKind: "homepage"` records that these are specifically homepage captures. |
| `clinic_id` | `scan_assets` has no direct `clinic_id` column — it's already derivable via `crawl_job_id → crawl_jobs.clinic_id` (one hop). Also duplicated into `metadata.clinicId` for convenience. |
| `source_url` | Existing `page_url` column. |
| `storage_path` **or null** | `storage_path` is `not null` in the physical schema. Rather than a migration to relax it, "no path yet" is represented as an empty string (`""`) at the DB layer — conceptually null, physically `""` — with the real state carried in `metadata.captureStatus` and every TypeScript-level return type (`storagePath: string | null`). This mapping is intentional and documented here so a future reader doesn't mistake `""` for a real path. |
| `status` | No dedicated column; carried in `metadata.captureStatus`: `"captured"` \| `"pending_storage"` \| `"capture_failed"` \| `"storage_failed"`. `review_status` (existing column) is left at its normal `pending_review` default — that field is about human review, not capture/storage state. |
| `captured_at` | `metadata.capturedAt` (ISO timestamp), alongside the existing `created_at` column. |
| `width` / `height` | Existing `width_px` / `height_px` columns. |

## Storage behavior

| Scenario | `storage_path` (physical) | `metadata.captureStatus` | Notes |
| --- | --- | --- | --- |
| `--dry-run` | n/a (fake repo only) | n/a | No real DB write, no real storage call. |
| No `--screenshot-storage-bucket` given | `""` | `pending_storage` | Metadata-only; nothing uploaded anywhere. |
| Bucket given, upload succeeds | real path (`private/scan-assets/<crawlJobId>/<viewport>.png`) | `captured` | Uploaded via the existing service-role Supabase client (`lib/operations/supabase/server-client.ts`) — never a public bucket, never a public URL. |
| Bucket given, upload fails | `""` | `storage_failed` | Safe fallback — job continues. |
| Browser capture itself fails | `""` | `capture_failed` | Safe fallback — job continues. |

This pipeline **never creates a bucket** and **never makes anything
public** — `--screenshot-storage-bucket <name>` must already exist as a
private bucket; if it doesn't, or the upload otherwise fails, the outcome
is `storage_failed`, not a crash.

## How screenshots connect to score / report / outreach draft

1. After a crawl job completes/partials **and** screenshots were actually
   captured, the score is **recomputed** (a new `scores` row — this
   pipeline never mutates history, matching the existing append-only
   pattern) via `calculatePlaceholderScore`, now passing
   `hasDesktopScreenshotMeta` / `hasMobileScreenshotMeta` (true only for
   viewports that didn't `capture_failed`) and the corresponding
   `scan_assets` row id. The **required disclaimer stays exactly the
   same**:
   > "Esta análise avalia apenas a apresentação digital e a facilidade de
   > encontrar informações. Não avalia qualidade médica."
2. The mobile-dimension evidence text now names the asset when available:
   `"Metadado de screenshot mobile registrado (asset <id>; avaliação visual
   pendente)."` A 0-point desktop evidence entry is added the same way
   (desktop doesn't change the placeholder-v0 point total — only mobile
   does — but the reference is still recorded for report/audit purposes).
3. If an outreach draft was requested (`createOutreachDraft`), it is now
   **deferred** until after screenshots land, so its evidence
   (`buildOutreachDraft`'s `observations`) is built from the *updated*
   score's evidence — which can mention the screenshot assets. The
   original in-`runCrawlJob` draft creation is suppressed in this case
   (`outreachDraft: null` passed to `runCrawlJob`) specifically so there's
   only ever one draft per job, not a stale one plus a fresh one.
4. **The draft is always created with `status: "draft"`. Nothing sends
   it.** `OutreachRepository` has no method that calls an email/WhatsApp
   API — sending remains structurally impossible from this codebase.

## CLI usage

```
# Screenshots stay off unless both flags are passed:
npm run crawler:controlled:dry-run -- --allow-real-crawl --capture-screenshots

# Local/staging, with a private storage bucket already provisioned:
npm run crawler:controlled:local -- --allow-real-crawl --capture-screenshots --screenshot-storage-bucket scan-assets-private

# Standalone queue processing also accepts the same flags:
npm run crawler:queue:process -- --dry-run --allow-real-crawl --capture-screenshots --clinic-ids <id>
```

No new npm scripts were added — the existing `crawler:controlled:*` /
`crawler:queue:process` scripts already accept extra flags appended after
`--`.

## Tests

`lib/crawler/screenshot-capture.test.ts` (4 tests) — pure helpers
(`viewportDimensions`) and the `ScreenshotCaptureImpl` contract via hand-written
fakes. `captureScreenshotWithPlaywright` itself (the real browser-driving
function) is **not** exercised in the automated suite — launching a real
browser is slow and environment-dependent; it was verified once manually
via CLI smoke testing (`--dry-run --allow-real-crawl --capture-screenshots`,
which really did launch Chromium and capture `example.com` in this
environment) but every automated test drives the injectable contract
instead, per "mock browser behavior where possible."

`lib/operations/screenshot-assets-pipeline.test.ts` (18 tests) — no live
network, no live Supabase (every `allowRealCrawl: true` scenario still
uses fixture-mode fetch/robots and an injected fake DNS lookup, specifically
to avoid a real DNS resolution to `example.com` that the internal default
lookup would otherwise perform):

- screenshot metadata generated for both viewports on success
- `pending_storage` when no bucket is configured (`storagePath: null`,
  physical `""`)
- real `storage_path` persisted when a bucket + working upload are given
- `storage_failed` persisted (not thrown) when upload fails
- `capture_failed` persisted (not thrown) when the browser capture itself
  fails
- screenshots skipped by default (no flag)
- `--capture-screenshots` without `--allow-real-crawl` skipped safely,
  capture function never invoked
- dry-run writes land only in the fake repositories
- a private/localhost URL never reaches screenshot capture (crawl job
  itself fails first)
- a non-allowlisted real host is blocked before any DNS/network call, so
  capture is never invoked
- a screenshot capture failure never fails the whole crawl job
- score and outreach draft reference the captured screenshot asset id;
  disclaimer unchanged; outreach stays `draft`, nothing reaches `sent`
- production is refused even when screenshots are requested
- full `runControlledPipeline` end-to-end run with screenshots enabled

## Known limitations / next steps

- Only the homepage is ever captured — per spec. Capturing additional
  pages would need explicit, separate authorization (more real navigation
  surface to review for safety).
- The example fixture CSV's non-bare-`example.com` rows
  (`data/examples/prospect-candidates.example.csv`) are not guaranteed to
  resolve under `--allow-real-crawl` (see
  `docs/technical/crawler-controlled-automation.md`) — a full live
  screenshot smoke test currently only exercises the first row end-to-end.
- `playwright`'s browser binaries are not guaranteed to be installed in
  every environment; `captureScreenshotWithPlaywright` reports
  `browser_unavailable` safely if they're missing rather than crashing.
- Public/shareable screenshot URLs (e.g. for a future preview page) are
  explicitly out of scope here — nothing in this feature makes a bucket or
  object public.
