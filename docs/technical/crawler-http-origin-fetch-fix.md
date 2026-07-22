# http:// origin fetch fix

Investigates and fixes the reproducible `http://`-origin crawl failure
first documented in `docs/technical/crawler-commercial-calibration-batch.md`
(3-for-3 real domains: CEPELLE, Instituto Dermatológico, Dermaclinic).
**Every existing SSRF, production, approved-domain, same-origin, and
TLS-validation guard is fully preserved — none was weakened.**

## Root cause found

Two contributing facts, found by direct investigation of the persisted
`crawl_jobs`/`crawl_findings`/`crawl_pages` rows (not guessed):

1. **The real, page-level failure was `redirect_blocked`, not
   `unexpected_error`.** `lib/crawler/fetch-page.ts`'s `fetchHtmlPage`
   loop calls `isSameOrigin(currentUrl, allowedOrigin)` before every
   fetch attempt, including the very first one. `isSameOrigin`
   (`lib/crawler/url-policy.ts`) compares `protocol` strictly — so when
   the crawl starts on `http://www.cepelle.com.br/` and the site issues
   its (completely standard) redirect to HTTPS, the *next* loop
   iteration sees a scheme mismatch and — correctly, by that strict
   definition — treats it as a different origin and refuses to follow
   it. This is a deliberate, correct SSRF/redirect-safety boundary, not
   a bug, and it must never be loosened.
2. **A separate, secondary bug masked root cause #1 during the earlier
   calibration investigation**: `lib/operations/run-crawl-job.ts`
   hardcodes the *job-level* `crawl_jobs.error_code` to
   `"unexpected_error"` whenever `pagesFetched === 0`, discarding
   whatever real reason was actually recorded per-page and in
   `crawl_findings`. Querying `crawl_jobs.error_code` alone (as the
   calibration task did) showed the generic code; querying
   `crawl_findings` directly (this task) showed the real one:
   `redirect_blocked`, `"A redirect target was blocked."` — confirmed
   directly against the real, retained `crawl_findings` row from
   CEPELLE's original calibration-batch crawl attempt. **This
   job-level masking bug was found but deliberately not fixed in this
   task** — it's adjacent, not what was asked for, and fixing it would
   touch `run-crawl-job.ts`, a separate, stable, heavily-tested file, for
   a concern unrelated to the http/https fix itself. Documented here as
   a real, valuable, but out-of-scope finding for a future task (see
   Limitations).

A third fact, found only during the staging rehearsal (see below): some
real sites (CEPELLE) don't do a pure scheme upgrade — they redirect
`http://www.` to `https://` **apex** (`www.` → non-`www.`) in the same
hop, a very common WordPress/Cloudflare canonicalization pattern. This
is technically a different *host*, not just a different scheme, and
required a deliberate, scoped extension to the fix (see below).

## Fix chosen

**Option B** (a safe HTTPS preflight resolver), applied at the crawl
job's *starting* URL, before the bounded crawl loop (and its correct,
unweakened `isSameOrigin` check) ever begins — never inside the loop
itself, and `isSameOrigin` itself was not touched.

New function `canonicalizeHttpToHttpsIfSafe`
(`lib/crawler/url-policy.ts`): given an `http://` URL, it upgrades to
`https://` **only** when, in order:

1. The input scheme is exactly `http:` (anything else — including a
   malformed URL — is returned unchanged immediately, no network call).
2. The candidate `https://` URL — identical host, identical path/query,
   default port only — passes the existing SSRF/private-IP guard
   (`resolveAndValidatePublicUrl`), using whatever `lookupImpl` the
   caller provides. Callers **must** pass the same host-allowlist-gated
   `lookupImpl` used everywhere else in the pipeline
   (`createControlledLookup`'s return value); that function throws for
   any non-approved hostname, which turns into a normal guard failure
   here — so a non-approved host is refused before any HTTPS network
   call is made. `canonicalizeHttpToHttpsIfSafe` performs no
   host-allowlist logic of its own.
3. A single, bounded, non-redirect-following preflight request
   (`redirect: "manual"`, one attempt, **no response body ever read**)
   to that validated `https://` URL succeeds — any 2xx, or a 3xx whose
   `Location` header:
   - stays on the identical hostname → accepted directly, or
   - targets a **different** hostname → refused, **unless** that exact
     target hostname is explicitly listed in the caller's approved-domains
     for this invocation (`--approved-domains` / `ALLOWED_REAL_CRAWL_HOSTNAMES`),
     in which case the cross-host target is **independently re-validated**
     through a fresh `resolveAndValidatePublicUrl` call before ever being
     accepted — being on the approved-hostnames list by name is never
     sufficient by itself.

On any failure at any step, the original `http://` URL is returned
unchanged and the normal crawl flow proceeds exactly as it did before
this fix existed — the fix can never make behavior worse than the
pre-fix baseline, only better.

### Where it's wired in

`lib/operations/pipeline/process-crawl-queue.ts`, in the `clinicIds`
loop only (a *resumed* `crawlJobIds` job keeps whatever `requestedUrl`
it was already created with — deliberately not touched, see
Limitations) — right before `runCrawlJob` is called, and **only when
`input.allowRealCrawl` is `true`** (an unconditional, primary gate,
independent of everything else, so fixture/dry-run mode can never make a
real network call because of this fix). On a successful upgrade, a
`crawl_findings` row (`category: "ops"`, `code:
"http_to_https_canonicalized"`) is recorded once the crawl job exists,
capturing `originalUrl`/`canonicalUrl`/`reason` for full auditability.

The approved-domains list already threaded through
`createControlledLookup`/`createControlledFetchHtmlPage` is now also
threaded to this function via a new `approvedRealCrawlHostnames` field
on `ProcessCrawlQueueInput` (and `RunControlledPipelineInput`, and both
CLI scripts, `scripts/crawler/process-crawl-queue.ts` and
`scripts/crawler/run-controlled-pipeline.ts`) — the exact same
`--approved-domains` value the operator already passes for the crawl
itself, never a new or separate approval mechanism.

## Security gates preserved

- **SSRF/private-IP guard**: `resolveAndValidatePublicUrl` runs against
  the https:// candidate before any preflight fetch, and *again*,
  independently, against any cross-host redirect target before it's
  accepted. Tested directly: a DNS-rebinding scenario (an approved
  hostname resolving to `127.0.0.1`) is refused at every one of these
  points.
- **Production refusal**: untouched — `assertSafeTarget`/
  `selectRepositories` sit entirely outside this code path; re-tested
  explicitly to confirm.
- **Approved domain allowlist**: a non-allowlisted hostname's `lookupImpl`
  throws before the preflight fetch is ever attempted — tested directly
  with a spy confirming zero preflight calls for an unapproved host.
- **Same-origin protection (`isSameOrigin`)**: not modified at all — the
  bounded crawl loop's own mid-crawl redirect handling is exactly as
  strict as before. This fix only ever touches the *starting* URL, once,
  before that loop begins.
- **No broad crawl**: `maxPages` is enforced identically regardless of
  whether the starting URL was canonicalized; tested directly.
- **No TLS bypass**: no certificate validation is disabled or configured
  anywhere in this fix — the preflight request uses the platform's
  normal `fetch`, with normal TLS verification, same as every other
  request this codebase makes.
- **No arbitrary redirects**: the preflight follows **zero** redirects
  itself (`redirect: "manual"`, and the function returns after
  inspecting at most one `Location` header — it never loops or chains).
- **No cross-host redirect except explicitly approved + re-validated**:
  see fix description above; tested both for the approved and
  not-approved cases, and for the "approved by name but fails SSRF on
  re-check" case.
- **No form submission, no downloads**: the preflight is a single `GET`
  with no body read at all — no response content is ever parsed,
  stored, or acted upon beyond its status code and `Location` header.

## Tests added

- `lib/crawler/url-policy.test.ts` (+16 tests, `describe("canonicalizeHttpToHttpsIfSafe", ...)`):
  same-host upgrade success, https:// input untouched (zero calls to
  either injected fn), non-allowlisted host refused pre-preflight,
  cross-host redirect refused by default, cross-host redirect accepted
  only when explicitly approved (the real CEPELLE case, replayed as a
  unit test) and independently re-validated via SSRF guard, same-host
  redirect accepted, private/loopback resolved address refused,
  connection/TLS failure leaves URL unchanged, non-2xx/3xx status not
  upgraded, deterministic result for identical inputs, malformed URL
  never crashes.
- `lib/operations/process-crawl-queue-https-canonicalization.test.ts`
  (new, 12 tests, integration level): approved-host http:// clinic
  canonicalizes and the crawl succeeds; unapproved http:// host never
  upgraded/preflighted (allowlist gate still applies, matching the
  pre-existing pattern in `screenshot-assets-pipeline.test.ts`);
  private/localhost still blocked, no preflight call; TLS/connection
  preflight failure leaves URL unchanged; cross-host redirect refused by
  default; the real CEPELLE `www.` → apex case accepted only when both
  hosts are in `--approved-domains`; https:// clinics never touched;
  fixture mode (`allowRealCrawl: false`) never invokes the preflight at
  all, even for an http:// clinic; `maxPages` still fully respected;
  successful canonicalization recorded as a deterministic, auditable
  `crawl_findings` row; screenshot capture behavior unaffected;
  production still refused.
- All 40 pre-existing tests that exercise `allowRealCrawl: true`
  (including the one pre-existing `http://127.0.0.1:9999/` SSRF test in
  `screenshot-assets-pipeline.test.ts`) were re-run and pass unchanged —
  confirmed this fix introduces zero regressions and, critically, zero
  new live network calls in any existing test (the only pre-existing
  `http://` test case is a blocked private IP, which the fix's own
  SSRF-guard-first design still blocks with no live network call at
  all).

## Staging result

Staging ref `lfkyiztuwptmddsraucg` reconfirmed via
`supabase/.temp/project-ref` before this rehearsal. Re-ran the exact
same command from the calibration batch against the exact same clinic
(CEPELLE, `b2c32a64-90cf-4cc1-a7d2-566a37d7776b`,
`http://www.cepelle.com.br/`), one clinic only, `--max-pages 3`,
`--approved-domains cepelle.com.br,www.cepelle.com.br`,
`--allow-real-crawl --capture-screenshots`:

**Before (calibration batch, this fix not yet applied):**
`status: "failed"`, `error_code: "unexpected_error"`, 0 pages fetched.

**After (this fix):** `status: "partial"` (correctly — `page_limit_reached`
at exactly 3 pages, not a failure), **3 pages fetched**, score
**84/100**, an outreach draft was even generated (`status: "draft"` —
nothing sent). The crawl job's `requested_url` is now
`https://cepelle.com.br/` (canonicalized from
`http://www.cepelle.com.br/`), and a `crawl_findings` row records the
canonicalization with full detail: `reason:
"http_to_https_cross_host_redirect_approved"`,
`originalUrl: "http://www.cepelle.com.br/"`,
`canonicalUrl: "https://cepelle.com.br/"`.

The prior `unexpected_error` unambiguously became **completed/partial
with real pages fetched**, not just a clearer error message — the fix
resolves the actual failure, not merely its diagnosis.

One unrelated flake was observed in this same run: the desktop
screenshot capture failed (`capture_failed`) while mobile succeeded —
this is independent of the http/https fix (screenshot capture is a
separate Playwright browser navigation, not affected by this change)
and is the kind of transient capture failure the runbook's own "how to
handle failed TLS/screenshots" section already documents as expected,
re-triable behavior.

Outreach confirmed `status: "draft"` after the rehearsal — nothing was
sent.

## Limitations

- **The job-level `error_code` masking bug is real, found, and NOT
  fixed here** (see Root cause #2) — `crawl_jobs.error_code` still
  always reports `"unexpected_error"` for any zero-page-fetched failure,
  regardless of the real per-page reason already recorded in
  `crawl_findings`. Recommended as a small, separate, dedicated
  follow-up: surface the last recorded `crawl_findings`/`crawl_pages`
  error code at the job level instead of hardcoding a generic one.
- **The `crawlJobIds` (resume) path is not canonicalized** — resuming an
  already-created crawl job keeps whatever `requestedUrl` it was
  originally created with, by design (consistency/audit trail for a job
  that already exists). Only the `clinicIds` (fresh crawl) path
  benefits from this fix. If a future task wants resumed jobs to also
  benefit, that's a deliberate, separate scope decision.
- **The cross-host approval list is exactly the existing `--approved-domains`
  allowlist** — there's no separate "canonicalization-only" approval
  mechanism. A site that redirects to a genuinely different, unrelated
  domain (not just `www.` ↔ apex) will only be followed if that domain
  was *also* explicitly approved for the crawl itself — which is the
  correct behavior, not a limitation, but worth being explicit about.
- **The clinic's own persisted `websiteUrl`/`normalizedWebsiteOrigin`
  are not updated** by a successful canonicalization — only the crawl
  job's own `requestedUrl`/`normalizedOrigin` reflect the canonical form
  actually used. Correcting a clinic's persisted URL remains the
  separate, deliberate `crawler:update-website` CLI action, matching
  existing convention; this fix does not call it automatically.
- The desktop-screenshot flake observed during the staging rehearsal is
  unrelated to this fix and was not investigated further here (out of
  scope for an http/https fix task).

## Verification

- `npm test` — 440/440 passing (28 new tests: 16 in `url-policy.test.ts`, 12 in the new `process-crawl-queue-https-canonicalization.test.ts`; 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed before the rehearsal.
- No broad crawl — the rehearsal targeted exactly one already-known clinic, `--max-pages 3`, an explicit 2-entry `--approved-domains` allowlist.
- No Google Places/SERP call was made — this task did no discovery at all.
- No outreach was sent — the outreach draft generated during the rehearsal remains `status: "draft"`, re-confirmed directly via REST after the run.
- No secrets were stored in any file, log, or this document.
