# Crawler: second real-domain staging rehearsal (successful end-to-end)

> **Status: SUCCESS — first fully successful real-domain crawl in this
> series.** Both remaining Google Places candidates were diagnosed
> read-only for TLS/reachability; both were healthy. SkinLaser -
> Higienopolis was selected (marginally simpler reachability — direct 200
> on both `www` and apex over HTTPS, vs. an extra internal redirect hop for
> Dermaclinic), promoted, approved for real crawl, and crawled for real: 3
> pages, real contacts (phone, email, WhatsApp, Instagram), a real score
> (72/100), two real screenshots (captured, metadata-only — no storage
> bucket configured), and a complete operational report with zero
> warnings. **Production was never touched. No broad crawl. No Google/SERP
> call. No outreach was sent.**

## Branch / tag baseline

`feature/crawler-second-real-domain-rehearsal`, created from tag
`atria-crawler-approved-real-domain-crawl-v1` (commit `22865f7`, "Add
approved real domain crawl gate").

## Preflight

| Check | Result |
| --- | --- |
| `.env.local` ignored | Yes |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GOOGLE_PLACES_API_KEY` present | Yes — presence-only checks, values never printed |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) |
| Production ref (`cskodsnvghavkcjwmafr`) targeted | Never |

## Code changed (and why)

`lib/operations/repositories/clinic-repository.ts` already declared `updateNormalizedWebsiteHost` ("Updates the normalized website host after a crawl confirms/changes it"), fully implemented in `lib/operations/supabase/clinic-repository.supabase.ts` and already exercised via the fake repository in `lib/operations/repositories-fakes.test.ts` — but it had **no CLI entry point**, the same kind of gap closed for candidate promotion in an earlier rehearsal.

This rehearsal needed it: both candidates' `website_url` was recorded by Google Places discovery with an `http://` scheme, but both sites force a same-host redirect to `https://`. This crawler's redirect handling (`isSameOrigin` in `lib/crawler/url-policy.ts`) requires the protocol to match on every redirect hop — a deliberate anti-redirect-hijack guard — so following `http://` → `https://` (a protocol change) on the *same host* is correctly treated as a blocked cross-origin redirect. Rather than loosen that guard, the fix is to record the clinic's canonical URL correctly in the first place.

Added:
- `scripts/crawler/update-clinic-website.ts` — thin CLI wrapper around `updateNormalizedWebsiteHost`. Flags: `--dry-run` / `--target local|staging`, `--clinic-id <id>`, `--website-url <url>`. Validates the URL is well-formed and `http`/`https` only; does **not** itself fetch, crawl, or validate reachability — that's a separate, explicit, read-only diagnostic step (see below). Same `selectRepositories`/target-guard safety gate as every other CLI in this pipeline.
- `package.json`: new `crawler:update-website` script entry.

No new test file was added — consistent with the precedent set by `promote-candidate.ts`: none of the CLI wrapper scripts have their own test files (`npm test` only runs `lib/**/*.test.ts`), and the wrapped logic (`updateNormalizedWebsiteHost`) already has coverage via the fake repository.

## Candidates inspected

Re-queried directly from staging (REST API, service-role key used only as an unprinted header) before touching either:

| ID | Name | Status | Website (as recorded) | Promoted? |
| --- | --- | --- | --- | --- |
| `5a2778ba-b814-48fb-8a9a-e97f4a20d9d2` | SkinLaser - Higienopolis | `new` | `http://www.skinlaser.com.br/` | No |
| `c51ddcdd-e5ee-4ed1-ac5c-650a7ccc4381` | Dermaclinic | `new` | `http://www.dermaclinic.com.br/` | No |

## Read-only TLS/HTTP diagnostics (not a crawl — no scraping, no browser)

A single diagnostic `curl -sv` per host (crawler user agent `AtriaPreviewBot/1.0`, `--max-time 12`, output body discarded), outside the pipeline entirely, purely to answer "is HTTPS valid and reachable":

| Host | HTTPS TLS | Response |
| --- | --- | --- |
| `www.skinlaser.com.br` | `SSL certificate verify ok` (TLS 1.3) | `HTTP/2 200` directly |
| `skinlaser.com.br` (apex) | `SSL certificate verify ok` | `HTTP/2 200` directly |
| `www.dermaclinic.com.br` | `SSL certificate verify ok` (TLS 1.3) | `HTTP/2 301` → `https://dermaclinic.com.br/` |
| `dermaclinic.com.br` (apex) | `SSL certificate verify ok` | `HTTP/2 200` |

Both domains have healthy, valid TLS certificates and are fully reachable over HTTPS — a very different outcome from the first real-domain rehearsal (`docs/technical/crawler-approved-real-domain-crawl.md`), where GRUPO CPD's certificate was expired.

Additionally checked the exact recorded `http://` URLs (as `prospect_candidates.website_url` stores them): both `http://www.skinlaser.com.br/` and `http://www.dermaclinic.com.br/` respond `301` to their own `https://` equivalent — a same-host, cross-protocol redirect that this crawler's `isSameOrigin` guard correctly refuses to follow (protocol is part of "origin" here, by design — see "Code changed" above).

## Selected candidate and why

**SkinLaser - Higienopolis** (`5a2778ba-b814-48fb-8a9a-e97f4a20d9d2`). Both candidates had equally healthy TLS, so the tiebreaker was reachability simplicity: SkinLaser's `www` host (the exact host Google Places recorded) serves `200` directly over HTTPS with zero internal redirects, while Dermaclinic's `www` host 301-redirects internally to its apex domain before serving `200` — one fewer moving part for a first successful real crawl in this series.

## Approved domains

Exactly two, explicitly listed, for this rehearsal only:

- `skinlaser.com.br`
- `www.skinlaser.com.br`

Nothing else was added — no wildcard, no other candidate's domain.

## Promotion and website URL correction

```
npm run crawler:promote -- --target staging --candidate-id 5a2778ba-b814-48fb-8a9a-e97f4a20d9d2
```
→ **Clinic ID:** `bbfd72a3-a013-4a6c-bd82-4a70479d694a`, `website_url: "http://www.skinlaser.com.br/"` (inherited from the candidate, as recorded by Google Places).

```
npm run crawler:update-website -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --website-url "https://www.skinlaser.com.br/"
```
→ Corrected to the site's own confirmed-working canonical scheme (`https://www.skinlaser.com.br/`) — not a security bypass, the opposite: using TLS correctly instead of triggering a same-host protocol-change redirect the crawler is designed to refuse.

## Command run

```
npm run crawler:queue:process -- \
  --target staging \
  --clinic-ids bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --allow-real-crawl \
  --capture-screenshots \
  --approved-domains skinlaser.com.br,www.skinlaser.com.br \
  --max-pages 3 \
  --screenshot-timeout-ms 8000
```

## Crawl result: success (partial — page-limit bound, not a failure)

- **Crawl job ID:** `c915a569-bcba-4bf2-aa95-cd66446eeb24`
- `requested_url`: `https://www.skinlaser.com.br/`
- `status`: `partial`
- **Pages:** 3 fetched / 19 discovered / 0 failed, all `status_code: 200`
- `crawl_findings`: 1 row, `category: ops`, `code: page_limit_reached`, `severity: info` — the site has far more than 3 internal pages (19 discovered within the crawl's own link-collection bound); `status: partial` correctly reflects "bounded, not exhaustive," not an error. This is the intended, working behavior of `--max-pages 3`.

Pages fetched: `/`, `/tratamentos/`, `/tratamentos/tecnologias-e-lasers/`.

## Screenshot result

- **Desktop:** captured successfully — asset `5da806ca-a7ac-4ce1-8ac3-6457a09c88a0`, `captureStatus: pending_storage` (real Playwright headless-Chromium capture; no storage bucket was configured, so the image lives only transiently in the capture process — metadata was persisted, no binary bytes, consistent with every prior rehearsal's storage-bucket-free default)
- **Mobile:** captured successfully — asset `7410520b-7cd4-48a4-830a-576175b003db`, same `pending_storage` status

Both real captures — the first successful (non-blocked, non-failed) real screenshot capture in this rehearsal series.

## `scan_assets` result

2 rows, both `capture_status: pending_storage` with a real `capturedAt` timestamp, `storage_path: ""` (empty — no bucket configured, so nothing was uploaded anywhere).

## Score result

Two `scores` rows for this crawl job (both real, both from actual site content — not fixture, not placeholder):
- `5dd313cd-48ad-445d-b3dd-948c77bc6107` — total 68 (computed immediately after the crawl, before screenshots)
- `5cb1a23e-c945-41cc-9acd-26bb24ef1cea` — total **72** (recomputed after screenshots landed, referencing both asset IDs — this is the one the report and the CLI output both surface as current)

Dimensions: credibilidade 12/20, clareza 18/20, mobile 12/20, conversão/contato 16/20, atualização 14/20.

`clinic_contacts`: 4 unique real contacts extracted (deduplicated across the 3 pages, though the repository stores one row per page occurrence — 13 rows total): phone `(11) 3155-5555`, email `contato@skinlaser.com.br`, a WhatsApp click-to-chat link, and an Instagram link — all high/medium confidence, all sourced from the real site.

## Report result

Generated both formats via:

```
npm run crawler:report -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --crawl-job-id c915a569-bcba-4bf2-aa95-cd66446eeb24 --output markdown --write-artifact
npm run crawler:report -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --crawl-job-id c915a569-bcba-4bf2-aa95-cd66446eeb24 --output json --write-artifact
```

`--allow-incomplete` was **not** needed this time — a real score existed. Written only to the gitignored `artifacts/reports/` (never committed): `artifacts/reports/bbfd72a3-a013-4a6c-bd82-4a70479d694a.md` / `.json`. Zero `warnings` in the report output — every section (identity, provenance, website, score, screenshots, extracted content, outreach draft) is populated from real data for the first time in this series.

## Retained staging rows (no cleanup — retained for inspection)

All rows from every prior rehearsal remain untouched, plus these new ones:

| Table | New row(s) this round |
| --- | --- |
| `prospect_candidates` | `5a2778ba-b814-48fb-8a9a-e97f4a20d9d2` (now `promoted_to_clinic`) |
| `clinics` | `bbfd72a3-a013-4a6c-bd82-4a70479d694a` (`website_url` corrected to `https://www.skinlaser.com.br/`) |
| `crawl_jobs` | `c915a569-bcba-4bf2-aa95-cd66446eeb24` (`partial`, page-limit bound) |
| `crawl_pages` | 3 rows, all `200` |
| `crawl_findings` | 1 row (`page_limit_reached`, info) |
| `extracted_content` | 1 row (version 1) |
| `clinic_contacts` | 13 rows (phone/email/whatsapp/instagram, across 3 source pages) |
| `scores` | 2 rows (68 then 72 after screenshot recompute) |
| `scan_assets` | 2 rows (`screenshot_desktop`, `screenshot_mobile`, both `pending_storage`) |
| `outreach_messages` | 1 row (`draft`, never sent) |

Nothing was deleted, reset, or retried.

## Blockers / limitations

1. Both candidates' recorded `website_url` used `http://`, which the site force-redirects to `https://` — a same-host, cross-protocol redirect this crawler correctly refuses to follow (by design). Resolved by correcting the clinic's recorded URL to the canonical `https://` scheme *before* crawling (see "Code changed"), not by loosening the redirect guard.
2. Because a 3-page bound found only 3 of 19 discovered pages, this rehearsal exercised real crawling but not the site's full content — expected and intended given the "max pages 3" limit; not treated as a defect.
3. No storage bucket was configured, so both screenshots exist only as `pending_storage` metadata — the same, already-documented, deliberate default from every prior rehearsal (no image bytes are stored anywhere by this pipeline unless a bucket is explicitly passed).
4. Dermaclinic was not exercised this round (SkinLaser alone was processed, per the "do not process more than one clinic" instruction) — its candidate row remains `status: "new"`, unpromoted, available for a future rehearsal.

## Tests

No test changes were made this round — the underlying `updateNormalizedWebsiteHost` logic already had coverage via the fake repository (`lib/operations/repositories-fakes.test.ts`), and the new CLI wrapper follows the same untested-thin-wrapper convention as every other script in `scripts/crawler/`. All 222 existing tests continue to pass unchanged.

## Verification

- `npm test` — 222/222 passing (unchanged from the prior rehearsal — no test added or removed).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — exactly one clinic, one crawl job, bounded to `max-pages 3` (3 of 19 discovered pages fetched, by design).
- No Google Places/SERP call was made this round — no new discovery; reused the two existing candidates from the original discovery rehearsal.
- No outreach was sent — exactly one new `draft`-status row created this round; no send-capable code path exists in this pipeline.
- No secrets were stored in any file, log, or this document — `.env.local` remained git-ignored throughout; all presence checks reported only whether a variable was set, never its value; every direct staging query used the service-role key solely as an in-memory HTTP header, never echoed to output.
