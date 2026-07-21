# Crawler: controlled manual approval for real-domain crawl (staging)

> **Status: MECHANISM SUCCESS, CRAWL BLOCKED BY THE TARGET SITE.**
> A new explicit approved-domain mechanism was added (default allowlist
> stays restrictive — `example.com` only — until a caller explicitly lists
> domains for one run). It was exercised against GRUPO CPD's real domain,
> `grupocpd.com.br`, exactly as approved. The crawl job was correctly
> created and attempted, but failed: **GRUPO CPD's own TLS certificate is
> currently expired**, so every fetch attempt is refused by standard TLS
> validation — not a bug in this pipeline, not a sandbox restriction, and
> not something worked around here. **Production was never touched. No
> broad crawl. No Google/SERP call. No outreach was sent.**

## Branch / tag baseline

`feature/crawler-approved-real-domain-crawl`, created from tag
`atria-crawler-places-single-clinic-pipeline-v1` (commit `50894eb`,
"Document single clinic crawler pipeline rehearsal").

## Preflight

| Check | Result |
| --- | --- |
| `.env.local` ignored | Yes |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GOOGLE_PLACES_API_KEY` present | Yes — presence-only checks, values never printed |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) |
| `SUPABASE_URL` resolves to staging ref | Confirmed via substring check, URL never echoed |
| Production ref (`cskodsnvghavkcjwmafr`) targeted | Never |

## Approved domains

Exactly two, explicitly listed, for this rehearsal only:

- `grupocpd.com.br`
- `www.grupocpd.com.br`

Nothing else was added. No wildcard, no subdomain pattern, no other clinic's domain.

## Approval mechanism (what was built)

`lib/operations/pipeline/controlled-transport.ts` previously hardcoded a single, non-extensible real-crawl hostname allowlist (`example.com`/`www.example.com`). Added:

- `ControlledTransportOptions.approvedRealCrawlHostnames?: readonly string[]` — an explicit, **per-invocation-only** addition to that default allowlist. Never persisted anywhere (no file, no env var, no DB row) — a caller must pass it fresh on every single command.
- `resolveAllowedRealCrawlHostnames(options)` — the merge function: `allowedRealCrawlHostnames` (full override, test-only) wins if set; otherwise `ALLOWED_REAL_CRAWL_HOSTNAMES` (`example.com`) is used, extended with `approvedRealCrawlHostnames` only if the caller supplied any. **With nothing passed, behavior is byte-for-byte identical to before this change** — the default stays restrictive.
- `isValidApprovedDomainEntry(entry)` — hygiene gate for CLI input: rejects wildcards (`*`), protocols/paths/ports/credentials/whitespace, malformed dotted-hostname shapes, and raw IP literals. Applied to every `--approved-domains` entry before anything else runs; the CLI refuses to start if any entry fails this check.
- `createControlledLookup` gained an injectable `realLookupImpl` (defaults to real `node:dns` lookup) — this exists purely to let tests exercise the full "approved and reaches the DNS gate" path without a real network call; production behavior is unchanged (still real DNS by default).
- New CLI flag `--approved-domains <d1,d2,...>` on both `scripts/crawler/process-crawl-queue.ts` and `scripts/crawler/run-controlled-pipeline.ts` (kept consistent across both, since they share the same transport wiring). Logs which domains are in effect for the run; refuses on any invalid entry.

**All required gates, and how each is enforced:**

| Gate | Enforced by | Independent of the others? |
| --- | --- | --- |
| `--target staging` | `selectRepositories` / `assertSafeTarget` (`target-guard.ts`) | Yes — has no awareness of hostnames at all |
| `--allow-real-crawl` | CLI refuses `--capture-screenshots` without it; `controlled-transport.ts` serves fixtures only when absent | Yes |
| `--capture-screenshots` | CLI-level refusal if set without `--allow-real-crawl`; `processCrawlQueue` only calls the real capture impl when both are true | Yes |
| Approved domain present | `resolveAllowedRealCrawlHostnames` — without an explicit `--approved-domains` entry matching the target host, the default allowlist (`example.com` only) still blocks it | Yes — approving a domain has zero effect on target/screenshot gates and vice versa |
| SSRF/private-IP guard passes | `lib/crawler/url-policy.ts`'s `resolveAndValidatePublicUrl` — blocks known-bad hostnames (e.g. `localhost`) *before* the hostname allowlist is even consulted, and blocks any *resolved* private/loopback/link-local/metadata IP *after* DNS resolution, regardless of hostname approval | Yes — proven by dedicated tests (see below); this is the one gate that cannot be satisfied by approving a domain |

Production refusal, in particular, was verified to hold **even when the target domain is explicitly approved** — the two mechanisms share no code path.

## Command run

```
npm run crawler:queue:process -- \
  --target staging \
  --clinic-ids 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c \
  --allow-real-crawl \
  --capture-screenshots \
  --approved-domains grupocpd.com.br,www.grupocpd.com.br \
  --max-pages 3 \
  --screenshot-timeout-ms 8000
```

Limits in effect: 1 clinic/job, `max-pages 3` (bound never reached — see below), homepage-only screenshot pair (desktop+mobile — this pipeline never captures more than the homepage), an 8s screenshot timeout (tightened from the 15s default — "aggressive"; the underlying page-fetch timeout, `DEFAULT_REQUEST_TIMEOUT_MS = 10_000` in `lib/crawler/types.ts`, was already the existing, reasonably aggressive default and needed no change). No form submission is possible (the crawler is GET-only by construction — `lib/crawler/fetch-page.ts` never issues anything but `method: "GET"`). No downloads: non-HTML content types are refused (`isHtmlContentType` in `fetch-page.ts`). No private/auth/admin/login/cart/portal paths: `shouldSkipPath` (`lib/crawler/url-policy.ts`) already excludes `/login`, `/admin`, `/cart`, `/checkout`, `/portal`, `/paciente`, `/account`, `/dashboard`, and more — unchanged, pre-existing behavior, just confirmed still in force.

## Crawl result: failed (site-side TLS certificate expiry)

- **Crawl job ID:** `87fe79eb-8201-44e9-bf66-d17c8625d7eb`
- `requested_url`: `https://grupocpd.com.br/`
- `status`: `failed`
- **Pages:** 0 fetched / 1 discovered / 1 failed
- Duration: ~2.7s (well under both the 10s page-fetch timeout and the 8s screenshot timeout — this was not a timeout)
- `crawl_findings`: one row, `category: fetch`, `code: unexpected_error`, `summary: "An unexpected crawl error occurred."` — deliberately sanitized by `safeErrorMessage` (`lib/crawler/errors.ts`), so the raw cause isn't visible from the DB row itself.

**Root cause, isolated separately and precisely:** a single, read-only diagnostic `curl` to `https://grupocpd.com.br/` (using the crawler's own user agent, `AtriaPreviewBot/1.0`, and **not** part of the pipeline itself — no page content was fetched into any pipeline table by this diagnostic) showed:

```
* SSL certificate problem: certificate has expired
* Closing connection
```

**GRUPO CPD's real website currently serves an expired TLS certificate.** Node's `fetch()` (used by `lib/crawler/fetch-page.ts`, wrapped by `realFetchHtmlPage`) performs standard certificate validation and refuses the connection; the resulting exception isn't `AbortError` (so it's not classified as `timeout`), so `fetch-page.ts`'s catch-all maps it to the generic `unexpected_error` code — this is exactly the sanitized error surfaced above. This is entirely a property of the target site, unrelated to the sandbox network, the SSRF guard, or the approved-domain mechanism (DNS resolution for `grupocpd.com.br` succeeded cleanly — the failure happens strictly at the TLS handshake, after the hostname/IP had already cleared every safety gate). **No workaround (e.g. disabling certificate validation) was attempted** — that would be an unrelated security downgrade, explicitly out of scope, and the instruction was to document blockers, not bypass them.

## Screenshot result: capture_failed (same underlying cause)

- **Desktop:** `capture_failed` — asset `6ad191e5-15a6-4e52-9bed-27764339125f`
- **Mobile:** `capture_failed` — asset `27fc442b-55b3-4476-96b4-6e6f9976a0cd`

Playwright's headless Chromium (`lib/crawler/screenshot-capture.ts`) also performs standard TLS validation on navigation and does not silently accept an expired certificate by default — consistent with the same root cause as the crawl failure, not a separate issue. Both outcomes were persisted honestly as `capture_failed`, never faked as a successful capture.

## `scan_assets` result

2 rows, both `capture_failed`, `storage_path: ""` (empty — no image was ever produced to upload), `review_status: pending_review`. Metadata explicitly records `captureStatus: "capture_failed"` and `captureFailureCode: "capture_failed"` for each — an honest record of the attempt, not a silent skip.

## Score result

**No new score was computed for this crawl job** — `calculatePlaceholderScore` in this pipeline only runs when `result.extraction` exists (see `processCrawlQueue`'s `afterCrawl`), and extraction never ran because zero pages were fetched. `extracted_content`: 0 rows for this crawl job (confirmed by direct query).

## Report result

Regenerated both formats via:

```
npm run crawler:report -- --target staging --clinic-id 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c \
  --crawl-job-id 87fe79eb-8201-44e9-bf66-d17c8625d7eb --output markdown --write-artifact --allow-incomplete
npm run crawler:report -- --target staging --clinic-id 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c \
  --crawl-job-id 87fe79eb-8201-44e9-bf66-d17c8625d7eb --output json --write-artifact --allow-incomplete
```

`--allow-incomplete` was required — this crawl job has no score of its own. Written only to the gitignored `artifacts/reports/` (never committed), overwriting the prior report for this same clinic ID (filenames are keyed by clinic, not crawl job).

**Important nuance, stated plainly so it's never misread later:** the regenerated report's "Website analisado" section correctly reflects *this* job (`87fe79eb...`, `status: failed`, 0 pages, both screenshots `capture_failed`, "Conteúdo extraído indisponível para este crawl job"). But `buildOperationalReport` resolves the score by **clinic**, not by this specific crawl job, so the "Resumo do score" section (66/100) is the clinic's **most recent available score — which is still the one from the earlier fixture-mode crawl job** (`abc8e0d3...`, documented in `docs/technical/crawler-places-single-clinic-pipeline.md`). **That score does not reflect GRUPO CPD's real website in any way** — it was computed from synthetic fixture content in the prior rehearsal, and this run added no new score to supersede it. Anyone reading this report should treat the score/dimensions/evidence sections as stale/fixture-derived, and only the "Website analisado" and "Screenshots" sections as accurately describing this real-domain attempt.

## Staging rows retained (no cleanup — retained for inspection)

All rows from the prior single-clinic-pipeline rehearsal remain untouched, plus these new ones:

| Table | New row(s) this round |
| --- | --- |
| `crawl_jobs` | `87fe79eb-8201-44e9-bf66-d17c8625d7eb` (`failed`) |
| `crawl_findings` | 1 row (`unexpected_error`, sanitized) |
| `crawl_pages` | 1 row (`grupocpd.com.br/`, `status_code: null`, `error_code: unexpected_error`) |
| `scan_assets` | 2 rows (`screenshot_desktop`, `screenshot_mobile`, both `capture_failed`) |
| `scores` | none added (0 new rows — the 66/100 score is the pre-existing one from the prior rehearsal) |
| `extracted_content` | none added |
| `outreach_messages` | none added (still just the single pre-existing `draft` row from the prior rehearsal) |

Nothing was deleted, reset, or retried.

## Blockers / limitations

1. **GRUPO CPD's real website (`grupocpd.com.br`) currently has an expired TLS certificate.** This blocks any standards-compliant HTTPS crawler or headless browser, not just this pipeline. Confirmed independently via a single diagnostic `curl`, outside the pipeline itself.
2. Per instruction, this was **not** retried, and no other domain or subdomain was added automatically to compensate. If GRUPO CPD's certificate is renewed in the future, re-running the exact same command above (same two approved domains, same clinic) should be sufficient to retry — no code change would be needed.
3. Because the crawl never produced content, this rehearsal could not validate the extraction/score pipeline against GRUPO CPD's *real* page content — that remains unverified. The approval *mechanism* itself, however, was fully exercised and behaves correctly (job created, real DNS resolution attempted, real TLS handshake attempted and correctly rejected by both the crawler and the browser, nothing faked).

## Tests added

`lib/operations/controlled-automation-pipeline.test.ts` — new `describe("controlled-transport: manual approved-domain mechanism")`, 8 tests:

1. An unapproved real domain stays blocked, even while a different domain is approved.
2. An approved real domain is allowed only once explicitly passed — not by default, and not for unlisted domains (exercised through the full `createControlledLookup` gate, via an injected fake "real" DNS lookup so no actual network call happens in the test).
3. Production is refused even when a real domain has been explicitly approved (the two gates are provably independent).
4. `localhost` is blocked before the hostname allowlist is even consulted, even if explicitly (mistakenly) approved (4a); an approved domain that resolves to a private IP is still blocked — the SSRF guard is independent of hostname approval (4b).
5. *(see screenshot-assets-pipeline.test.ts below)*
6. `isValidApprovedDomainEntry` rejects wildcards/protocols/paths/ports/whitespace/raw IPs (6a); a literal wildcard-looking approved entry never behaves as a real wildcard match — no glob semantics (6b).
7. `approvedRealCrawlHostnames` has no effect in fixture mode — still zero network calls.
8. *(see screenshot-assets-pipeline.test.ts below)*

`lib/operations/screenshot-assets-pipeline.test.ts` — new `describe("approved-domain single-clinic rehearsal: ...")`, 2 tests:

5. Screenshots still require `--capture-screenshots` even with `--allow-real-crawl` set, for a clinic on an approved real domain.
8. An approved-domain crawl with screenshots still never sends outreach — draft only.

## Verification

- `npm test` — 222/222 passing (212 prior + 10 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — exactly one clinic, one crawl job, bounded to `max-pages 3` (0 pages actually fetched due to the TLS blocker), homepage only.
- No Google Places/SERP call was made this round — no new discovery, reused the existing promoted clinic from the prior rehearsal.
- No outreach was sent — 0 new outreach rows created this round; the single pre-existing `draft` row is unchanged.
- No secrets were stored in any file, log, or this document — `.env.local` remained git-ignored throughout; all presence checks reported only whether a variable was set, never its value; every direct staging query used the service-role key solely as an in-memory HTTP header, never echoed to output.
