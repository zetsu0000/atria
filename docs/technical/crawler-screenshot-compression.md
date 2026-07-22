# Crawler screenshot compression / size-aware upload

Closes the one concrete finding from
`docs/technical/crawler-screenshot-storage-staging-validation.md`: a real
SkinLaser desktop screenshot exceeded the private bucket's 5 MB
`file_size_limit` while the smaller mobile capture did not, and the
upload attempt surfaced only a generic, sanitized "Storage upload
failed." error.

## Strategy

Dependency-free (this repo's `AGENTS.md` says "do not add dependencies
unless explicitly asked" — no image-processing library was added). Two
layers, both in existing files:

### 1. Capture-time, bounded, one-shot optimization (`lib/crawler/screenshot-capture.ts`)

Every capture was already viewport-only (Playwright's `page.screenshot()`
never used `fullPage`, so the pixel area was already bounded by the fixed
1440×1200 / 390×844 viewports — confirmed by reading the actual code
before making any change, not assumed). What's new:

1. Take the normal, full-viewport-height screenshot (unchanged from before).
2. If its byte size is `≤ MAX_SCREENSHOT_UPLOAD_BYTES` (5,242,880 — the
   exact bucket limit), return it as-is. `optimizationStrategy:
   "viewport_only"`. This is the common case and needed no change in
   behavior at all.
3. If it's over the limit, take **exactly one** further screenshot: a
   `clip`'d region of the **same already-loaded page** (no re-navigation,
   no new network request), same width, **half the height**
   (1440×600 for desktop). `optimizationStrategy:
   "viewport_only_reduced_height"`.
4. Whichever buffer results (optimized or not) is returned along with
   `originalSizeBytes` and `optimizedSizeBytes` (`null` when no
   optimization was attempted).

No re-encoding, no PNG-level compression tuning, no dependency — the
reduction comes entirely from capturing fewer pixels when needed, which
Chromium's own PNG encoder then compresses as it always did.

### 2. Pre-upload size gate (`lib/operations/pipeline/screenshot-assets.ts`)

Regardless of what the capture layer produced, `captureAndPersistScreenshots`
now checks the final buffer size **before** ever calling
`storage.upload(...)`. If it's still over `MAX_SCREENSHOT_UPLOAD_BYTES`,
the upload is never attempted at all — no wasted network round trip, and
the failure reason is specific and honest ("Screenshot (N bytes) exceeds
the storage bucket's 5242880-byte limit even after optimization; upload
was not attempted.") rather than the generic provider-side message the
original staging finding surfaced.

## Limits (unchanged, as required)

- Bucket `file_size_limit` stays exactly **5 MB** (`MAX_SCREENSHOT_UPLOAD_BYTES
  = 5_242_880` in `screenshot-capture.ts`, asserted in a test to stay in
  lockstep with the migration's declared limit — see "Tests" below).
- Bucket stays **private** (`public: false`) — untouched by this task.
- `image/png` only — untouched; the optimization never changes format.
- **Desktop/mobile viewport dimensions are unchanged** (1440×1200 /
  390×844) for the common case — they only shrink (height only, width
  fixed) for the rare oversized-capture retry, which is exactly the
  "unless tests justify it" carve-out: the retry exists specifically
  *because* a real capture empirically exceeded the limit, and only ever
  activates in that exact circumstance.

## Metadata preserved (new fields, all three requested)

Recorded on every successful capture, regardless of final outcome
(`captured` / `pending_storage` / `storage_failed`):

- `originalSizeBytes` — the first, full-height capture's size.
- `optimizedSizeBytes` — the retry's size, or `null` if no retry happened.
- `optimizationStrategy` — `"viewport_only"` or `"viewport_only_reduced_height"`.

Plus the pre-existing `pageKind`, `clinicId`, `captureStatus`,
`capturedAt`, and (on real upload) `bucketName`.

## Behavior confirmed by tests

- Under-limit capture → normal upload, `optimizationStrategy: "viewport_only"`.
- Over-limit capture with no optimized result available → blocked
  **before** any upload call, `storage_failed`, specific reason.
- Over-limit capture where the retry got under the limit → `captured`,
  both sizes recorded, `"viewport_only_reduced_height"`.
- Over-limit capture where **even the retry is still over the limit** →
  still `storage_failed` (never a crash, never a partial/corrupt upload),
  both sizes recorded honestly.
- Mobile is structurally unaffected — small captures never trigger the
  retry path; verified explicitly, not just assumed.
- Storage unconfigured (the shape every `--dry-run` invocation produces)
  → `pending_storage` always wins over the size gate, even for an
  oversized capture — no upload is ever attempted either way.
- Production is refused, independent of screenshot size or optimization
  — same shared `selectRepositories`/`assertSafeTarget` gate as every
  other CLI in this pipeline.
- An oversized desktop screenshot never sends outreach — the crawl job
  still completes/partials normally and the outreach draft (when
  requested) stays `status: "draft"`.

## Staging result

Command run (same approved-domain rehearsal pattern as prior tasks):

```
npm run crawler:queue:process -- --target staging \
  --clinic-ids bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --allow-real-crawl --capture-screenshots \
  --approved-domains skinlaser.com.br,www.skinlaser.com.br \
  --max-pages 1 --screenshot-storage-bucket crawler-screenshots \
  --screenshot-timeout-ms 8000
```

**Both viewports succeeded** — `captureStatus: "captured"` for desktop
and mobile, both with real, non-empty `storage_path` values. Confirmed
independently (not just from CLI stdout) by re-querying `scan_assets`
and by a direct Storage API metadata lookup showing both objects
genuinely exist in the bucket:

| Viewport | `originalSizeBytes` | `optimizedSizeBytes` | Strategy | Real object size (confirmed) |
| --- | --- | --- | --- | --- |
| Desktop | 1,435,919 | `null` | `viewport_only` | 1,435,919 bytes |
| Mobile | 373,122 | `null` | `viewport_only` | 373,122 bytes |

**Honest note on what this run actually exercised:** this desktop
capture was ~1.4 MB — comfortably under the 5 MB limit — so the
reduced-height retry path was **not** triggered live in this rehearsal;
it succeeded via the same "no optimization needed" path mobile always
uses. This differs from the earlier staging finding (~6 MB desktop
capture, `storage_failed`) — real page content is not fully
deterministic across loads (lazy-loaded elements, ads, and similar
dynamic content can vary what's rendered by the time the `load` event
fires and the screenshot is taken). The retry path itself is exercised
thoroughly at the unit level (4 of the 10 new tests directly construct an
oversized-then-optimized scenario), but this particular live run did not
happen to need it. If a future run does produce another oversized
desktop capture, the mechanism is in place and tested to handle it
without failing the pipeline.

Outreach draft (`1c0a39ef-...`) re-fetched directly and confirmed
`status: "draft"`, `human_reviewed: false` — never sent.

## Bucket remains private

Unchanged by this task — `public: false`, confirmed again as part of
this rehearsal's object-existence checks (accessed only via the
authenticated `/storage/v1/object/info/...` path, never the public URL
scheme). No migration was needed for this task; the bucket already
existed from `docs/technical/crawler-screenshot-storage-bucket.md`.

## Tests (10 new, in `lib/operations/screenshot-assets-pipeline.test.ts`)

New `describe("screenshot compression / size-aware upload")` block (9
tests) plus one integration-level test in the existing `processCrawlQueue`
describe block:

1. Desktop screenshot under 5 MB uploads normally.
2. Oversized desktop is blocked before any upload is attempted (spy-verified).
3. Metadata records both original and optimized sizes.
4. Optimization strategy recorded correctly in both cases.
5. `storage_failed` when the optimized capture is still oversized.
6. Mobile behavior unchanged.
7. Storage never written when unconfigured, even for an oversized capture.
8. Production refused, independent of screenshot size/optimization.
9. The bucket's declared `file_size_limit` and `MAX_SCREENSHOT_UPLOAD_BYTES`
   stay in lockstep (cross-checked against the actual migration file
   text) — a regression guard if either is ever changed without the other.
10. An oversized desktop screenshot never sends outreach.

Five pre-existing tests (in `screenshot-capture.test.ts` and this file)
were updated to include the three new required `CaptureScreenshotResult`
fields in their fake capture literals — not new coverage, just keeping
existing fixtures valid against the extended type.

## Verification

- `npm test` — 295/295 passing (285 prior + 10 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — one clinic, one crawl job, bounded to `max-pages 1`, same approved-domain mechanism as every prior real-domain rehearsal, no allowlist broadening.
- No Google Places/SERP call was made.
- No outreach was sent — the draft created this round stays `status: "draft"`, re-fetched and confirmed.
- No TLS/security behavior was touched — this task is entirely about post-capture, pre-upload byte-size handling.
- No secrets were stored in any file, log, or this document.
