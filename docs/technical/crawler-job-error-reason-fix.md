# Crawl job error-reason fix

Fixes `crawl_jobs.error_code` for a job that fetches zero pages so it
preserves the real, most specific failure reason instead of always
collapsing to `"unexpected_error"`. This is the secondary bug found (but
deliberately not fixed) during
`docs/technical/crawler-http-origin-fetch-fix.md`'s investigation —
that task fixed the actual http→https *fetch* failure; this task fixes
the *reporting* of whatever failure remains after that (or any other)
fix.

## Root cause

`lib/operations/run-crawl-job.ts`'s final status computation
unconditionally hardcoded:

```ts
if (pagesFetched === 0) {
  finalStatus = "failed";
  errorCode = "unexpected_error";
}
```

...regardless of what real, specific failure reason had already been
recorded — per-page, on the `crawl_pages.error_code` column, and
per-finding, on `crawl_findings.code` — during the crawl attempt.
Confirmed directly against real, retained staging data: CEPELLE's
original (pre-canonicalization-fix) crawl job showed
`crawl_jobs.error_code: "unexpected_error"`, while its own
`crawl_findings` row, recorded moments earlier in the very same job,
showed the real reason: `code: "redirect_blocked"`,
`"A redirect target was blocked."` Every one of `processOne`'s failure
branches (robots-denied-for-a-discovered-path, fetch failure, HTML
parse failure, page-persistence failure) already correctly recorded a
real, specific error code at the page/finding level — that information
just never made it up to the job-level summary an operator or the
prioritization/commercial-template layers actually read.

Seed-level failures (a malformed/blocked seed URL, or the seed path
itself violating robots.txt) were **already unaffected** by this bug —
those paths return early, before the crawl loop (and this hardcoded
fallback) are ever reached, and already call `failCrawlJob` with the
real, specific code. This fix only concerns failures that happen
*during* the bounded crawl loop.

## New error selection logic

A new pure, exported function, `selectJobFailureErrorCode`
(`lib/operations/run-crawl-job.ts`), replaces the hardcoded fallback.
`runCrawlJob` now tracks every failure observed during the loop, in
chronological order, as an in-memory `CrawlFailureSignal[]` — alongside
(never instead of) the existing `crawl_pages`/`crawl_findings`
persistence, which is completely unchanged:

```ts
export type CrawlFailureSignal = {
  code: CrawlErrorCode;
  severity: "info" | "low" | "medium" | "high";
  isPageLevel: boolean; // has its own crawl_pages.error_code (fetch/robots/parse failure), vs. a job-level-only failure like persistence_failed
};
```

Priority, applied only when `pagesFetched === 0`:

1. **The first page-level failure**, in the order pages were actually
   attempted. The crawl loop always attempts the seed URL first
   (`queue.push(seedNormalized)` happens before any sitemap hint is
   queued), so when zero pages succeed, this is deterministically the
   seed URL's own failure reason — the most useful one, since it
   answers *why the job never got off the ground at all*.
2. **Otherwise, the most severe non-page-level finding** (e.g.
   `persistence_failed`, or a malformed discovered URL that never even
   produced a `crawl_pages` row) — ties broken by recording order
   (first-recorded wins), via a stable sort.
3. **Otherwise, `"unexpected_error"`** — only reachable when literally
   no failure was ever recorded (e.g. `maxPages: 0`, nothing ever
   attempted), kept as a safe, honest fallback rather than throwing.

`error_message` was already computed as
`errorCode ? safeErrorMessage(errorCode) : null` — an existing,
already-safe mapping from `lib/crawler/errors.ts`'s
`SAFE_ERROR_MESSAGES` table — so it automatically becomes a clear,
specific, non-secret summary for whichever code is now selected, with
no separate change needed.

### Known codes this now correctly surfaces

`robots_denied` (for a discovered path — the seed's own robots check was
already unaffected), `redirect_blocked`, `timeout`, `dns_failed`,
`blocked_host` (a private-IP/SSRF re-check failing *after* the seed-level
check already passed — e.g. DNS rebinding), `http_error`,
`unsupported_content_type`, `response_too_large`, `parse_failed`,
`persistence_failed`, and the new `invalid_url` finding added for a
malformed discovered URL (a previously-silent gap — that catch block
recorded no finding at all before this fix; it now does).

There is no `tls_error`, `fetch_failed`, `canonicalization_failed`, or
`private_ip_blocked` code in the existing `CrawlErrorCode` enum
(`lib/crawler/errors.ts`) — this task does not invent new codes, only
preserves whichever *existing* code was already the real reason.
`private_ip_blocked`-shaped failures already map to the existing
`blocked_host` code. A TLS-specific failure currently has no dedicated
code and surfaces as `unexpected_error` from `fetch-page.ts`'s generic
catch block — correctly preserved as `unexpected_error` by this fix
(no regression, and no new code invented, since the real underlying
distinction isn't captured anywhere yet). `canonicalization_failed` is
not applicable: `canonicalizeHttpToHttpsIfSafe`
(`docs/technical/crawler-http-origin-fetch-fix.md`) never fails a job —
on any canonicalization failure it always falls back to the original
URL and lets the normal crawl flow proceed, so there is never a
job-level failure attributable to canonicalization itself; its own
`http_to_https_canonicalized` finding remains a separate, always-present
audit record regardless of whether the crawl that follows succeeds or
fails (see Tests below).

## Safety guarantees

- **No security gate touched.** This fix is pure reporting/observability
  — it changes which `CrawlErrorCode` value is written to
  `crawl_jobs.error_code`; it does not change whether any request is
  made, allowed, blocked, or retried. `isSameOrigin`, the SSRF/private-IP
  guard, the approved-domain allowlist, TLS validation, and `maxPages`
  enforcement are all completely untouched.
- **No outreach sent.** A total-failure job (`pagesFetched === 0`) never
  reaches the outreach-draft code path at all (that code only runs when
  `pagesFetched > 0`) — structurally guaranteed, independent of this
  fix, and tested directly.
- **Partial and completed jobs are unaffected.** The
  `pagesFailed > 0 || hitPageLimit || queue.length > 0` (partial) and
  fully-successful (completed) branches were not touched at all — only
  the `pagesFetched === 0` branch's `errorCode` assignment changed.
- **Deterministic and auditable.** `selectJobFailureErrorCode` is a
  pure function: identical input always produces identical output, it
  never mutates its input array, and every signal it considers already
  has a corresponding, real `crawl_findings`/`crawl_pages` row — nothing
  is inferred or guessed that wasn't already being persisted.

## Tests added

- `lib/operations/run-crawl-job.test.ts`:
  - Updated the existing "marks the job failed when every page fails"
    test to also assert the new `errorCode`/`errorMessage` (was
    previously only asserting `finalStatus`/`pagesFetched`).
  - New scenario-driven suite: `redirect_blocked`, `timeout`,
    `blocked_host`, `dns_failed`, `unsupported_content_type`,
    `response_too_large` — each simulated as the seed URL's real fetch
    failure via the already-injectable `fetchHtmlPage` mock, asserting
    the job-level `error_code` matches exactly.
  - An unattributable total failure (`maxPages: 0`) still falls back to
    `unexpected_error`, never throws.
  - A partial job (some pages fetched, one fails) is confirmed
    unaffected — stays `partial`, `error_code` still governed by the
    pre-existing `page_limit_reached`/`null` logic.
  - A fully completed job is confirmed unaffected — stays `completed`,
    `error_code` stays `null`.
  - A total-failure job is confirmed to never touch `outreachRepo` at
    all (row count unchanged, `outreachDraft: null`).
  - Production is still refused (standard `selectRepositories`/
    `KNOWN_PROJECT_REFS` check).
  - New `describe("selectJobFailureErrorCode (pure priority logic)")`:
    each code wins when it's the first page-level signal; the *first*
    page-level signal always wins over a later page-level or
    finding-only signal regardless of severity; when no page-level
    signal exists, the most severe finding-only signal wins with
    recording-order as the tiebreaker; empty input falls back to
    `unexpected_error`; the result is fully deterministic and the input
    array is never mutated.
- `lib/operations/process-crawl-queue-https-canonicalization.test.ts`:
  one new combined-fix test — a clinic whose starting URL successfully
  canonicalizes (http→https) but whose actual crawl then still fails
  (a simulated `timeout`) confirms **both** fixes compose correctly:
  the job's `error_code` is the real reason (`"timeout"`, never
  `"unexpected_error"`), the URL was still canonicalized before the
  attempt, and the `http_to_https_canonicalized` finding is still
  present and auditable alongside the failure finding — proving the two
  recent fixes don't interfere with each other.
- All 460 tests (30 new/updated across the two files above) pass; the
  full pre-existing suite was re-run and shows zero regressions.

## Staging result

Staging ref `lfkyiztuwptmddsraucg` reconfirmed via
`supabase/.temp/project-ref` before this rehearsal.

**A live "before → after" demonstration of this specific fix was
attempted twice against real, retained staging data, and both attempts
instead re-confirmed the *other*, already-shipped fix — not this one:**

1. **Instituto Dermatológico de Curitiba** (`4ee0e80f-...`) — its most
   recent retained crawl job showed exactly the target symptom
   (`status: "failed"`, `error_code: "unexpected_error"`,
   `pages_fetched: 0`). Re-crawled it (one clinic only, `--max-pages 1`,
   `--approved-domains idc.med.br,www.idc.med.br`, no screenshots, no
   Google Places): it now **succeeds outright**
   (`finalStatus: "partial"`, `pagesFetched: 1`, `score: 74`) — the
   http→https canonicalization fix from
   `docs/technical/crawler-http-origin-fetch-fix.md` already resolved
   the underlying fetch failure, so there's no failure left for this
   task's fix to report on.
2. **Dermaclinic** (`9e76f7e5-...`) — same starting symptom
   (`unexpected_error`, 0 pages). Re-crawled it the same way
   (`--max-pages 1`, `--approved-domains dermaclinic.com.br,www.dermaclinic.com.br`):
   it also now **succeeds outright** (`finalStatus: "completed"`,
   `pagesFetched: 1`, `score: 51`).

Checked every other currently-retained "known blocked" staging case
before concluding no live demonstration is currently possible:

- **Dra Ana Paula Pedrino** (`9c107389-...`, `robots_denied`) — its
  `crawl_jobs.error_code` was already `"robots_denied"` *before* this
  fix, because a robots.txt denial on the seed path itself is an
  early-return path that was never affected by the hardcoded-fallback
  bug in the first place. Nothing to demonstrate here.
- **GRUPO CPD** (`8634b1cb-...`) — its retained failed crawl job
  (`87fe79eb-...`, `https://grupocpd.com.br/`, unrelated to the
  http-origin issue) has `error_code: "unexpected_error"` at **both**
  the job level and the page/finding level — i.e. the real reason
  genuinely *is* `unexpected_error` (no more specific code was ever
  captured for it), so this fix correctly makes **no change** for this
  case either — a valid confirmation that the fix never invents
  specificity that doesn't exist, but not a visible improvement to
  point to.

**Conclusion: no currently-retained staging clinic can currently
reproduce the "specific reason masked as unexpected_error" symptom this
task fixes**, precisely because the previous task's canonicalization fix
already resolved every case where that symptom was being observed. This
is documented here, per the task's own explicit allowance, instead of
manufacturing an artificial failure (e.g. deliberately crawling an
unapproved domain) purely to produce a live demonstration whose value is
already fully covered by the 30 new, deterministic, comprehensive tests
above — which exercise every relevant `CrawlErrorCode` directly and
reproducibly, unlike a live rehearsal that depends on a specific real
site's behavior on a specific day.

Outreach confirmed `status: "draft"` for both rehearsal clinics after
the run — nothing was sent.

## Limitations

- This fix reports whichever specific code was already being captured
  by the existing per-page/per-finding logic — it does not add new
  *detection* (e.g. it still cannot distinguish a TLS certificate error
  from any other low-level `fetch()` exception; both remain
  `unexpected_error`, since `lib/crawler/fetch-page.ts`'s catch block
  doesn't inspect the exception further). Adding TLS-specific error
  detection would be a separate, larger task.
- The new `invalid_url` finding for a malformed *discovered* URL is a
  very rare, defensive path (the seed URL is already validated before
  the loop starts, and discovered links are already filtered by
  `normalizeCrawlUrl`) — it was previously silent (no finding recorded
  at all); it now is, closing a small pre-existing observability gap
  as a side effect of this fix.
- `selectJobFailureErrorCode`'s "most severe finding" fallback tier is
  reachable only in the rare case where zero page-level failures exist
  despite `pagesFetched === 0` (currently only `persistence_failed`,
  a database-write failure after a successful fetch/parse) — this is
  intentionally a narrow, well-defined fallback, not a general-purpose
  finding-severity ranker.

## Verification

- `npm test` — 460/460 passing (30 new/updated tests, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed before the rehearsal; production explicitly re-tested as refused.
- No broad crawl — both rehearsal attempts targeted exactly one already-known clinic each, `--max-pages 1`, an explicit `--approved-domains` allowlist.
- No Google Places/SERP call was made — no discovery performed in this task.
- No outreach was sent — both rehearsal clinics' generated outreach drafts remain `status: "draft"`, re-confirmed directly via REST after the run.
- No secrets were stored in any file, log, or this document.
