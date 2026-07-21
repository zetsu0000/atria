# Crawler controlled automation

> First automation-ready pipeline for Atria crawler/discovery. Strict gates
> throughout: controlled input only, bounded crawl, dry-run support,
> staging/local only, no outbound sending, human review still required
> before any commercial use.
>
> **This document describes automation. It does not authorize live
> production use.** Every real (non-dry-run) invocation still requires an
> explicit `--target local|staging`, and production is refused
> unconditionally — see "Safety gates" below.

## Pipeline

```
import candidates (CSV/fixture, bounded + deduplicated)
  → promote eligible candidates to clinics
  → create clinic-centric crawl jobs
  → run bounded crawler for each (max pages)
      → persist crawl_pages / crawl_findings
      → persist extracted_content
      → persist scan_assets metadata (if provided — none in this pipeline yet)
      → calculate + persist score
      → build + persist an outreach draft (never sent)
      → mark job completed / partial / failed
```

Every step above reuses existing, already-tested modules — this pipeline is
an orchestration layer, not a reimplementation:

| Step | Implementation |
| --- | --- |
| Import + dedupe | `lib/discovery/normalize.ts` (`parseManualCsvRows`, `classifyCandidateDuplicate`) + `DiscoveryRepository` |
| Promote to clinic | `lib/operations/promote-candidate.ts` |
| Crawl job + bounded crawl + extraction + score + draft | `lib/operations/run-crawl-job.ts` (`runCrawlJob`) |
| Never send | `lib/operations/repositories/outreach-repository.ts` has no "send" method — sending is structurally impossible from this codebase |

## New files

```
lib/operations/pipeline/
  target-guard.ts          — production refusal + local/staging validation
  controlled-transport.ts  — fixture-only fetch/robots/DNS by default; strict hostname allowlist when --allow-real-crawl
  select-repositories.ts    — wires fakes (dry-run) or real Supabase adapters (gated by target-guard)
  import-candidates.ts      — pipeline steps 1-2
  process-crawl-queue.ts    — pipeline steps 4-11
  run-controlled-pipeline.ts — top-level orchestrator (import → promote → crawl)
  load-dotenv-local.ts      — reads an existing .env.local if present; never writes one

scripts/crawler/
  run-controlled-pipeline.ts — full pipeline CLI
  import-candidates.ts       — standalone CLI for steps 1-2
  process-crawl-queue.ts     — standalone CLI for steps 4-11
  cli-args.ts                — shared minimal argv parser

data/examples/prospect-candidates.example.csv — 6 synthetic candidates, all on example.com (sub)domains

lib/operations/controlled-automation-pipeline.test.ts — 25 tests (see "Tests" below)
```

## npm scripts

```
npm run crawler:controlled:dry-run    # --dry-run — in-memory fakes only, no Supabase
npm run crawler:controlled:local      # --target local — real local Supabase (supabase start)
npm run crawler:controlled:staging    # --target staging — real atria-staging (gated, see below)
npm run crawler:queue:process         # tsx scripts/crawler/process-crawl-queue.ts (pass --clinic-ids/--crawl-job-ids)
```

Additional flags (any script above): `--csv <path>` (default: the bundled
example CSV), `--max-candidates <n>` (default 5), `--max-pages <n>` (default
5), `--allow-real-crawl`, `--no-outreach-draft`.

## Safety gates

### 1. Dry-run vs. real target

- `--dry-run`: uses `lib/operations/repositories/fakes.ts` exclusively —
  in-memory only, no Supabase client is ever constructed, no `--target`
  needed.
- Without `--dry-run`, `--target local` or `--target staging` is
  **required**. `lib/operations/pipeline/select-repositories.ts` refuses to
  build any real repository otherwise.

### 2. Production refusal (`lib/operations/pipeline/target-guard.ts`)

Two known, public **project refs** (not secrets — they're part of the
project's URL) gate this pipeline:

```ts
KNOWN_PROJECT_REFS.production = "cskodsnvghavkcjwmafr"; // Atria — never allowed
KNOWN_PROJECT_REFS.staging    = "lfkyiztuwptmddsraucg"; // atria-staging — the only real remote target
```

`assertSafeTarget(target, supabaseUrl)`:

- **Hard block, independent of `--target`:** if the resolved `SUPABASE_URL`
  matches the production ref, refuse — even if someone passes
  `--target staging` while `SUPABASE_URL` happens to be misconfigured to
  point at production.
- `--target local` requires `SUPABASE_URL` to be a loopback address
  (`127.0.0.1`/`localhost`) or unset.
- `--target staging` requires `SUPABASE_URL` to resolve to the known
  staging ref specifically — pointing at some other, unrecognized remote
  project is also refused, not just production.

### 3. Controlled transport (`lib/operations/pipeline/controlled-transport.ts`)

- **Default (no `--allow-real-crawl`):** every HTML fetch is served from an
  in-memory fixture, robots.txt is treated as fully permissive, and DNS
  resolution returns a fixed known-safe address — **no network call of any
  kind** is made, regardless of which URL is nominally being processed.
- **With `--allow-real-crawl`:** real fetch, real robots.txt fetch, and real
  DNS resolution are permitted, but **only** for an explicit hostname
  allowlist (default: `example.com`, `www.example.com`, and their
  subdomains). A non-allowlisted host is refused *before any network call
  at all, including DNS* — this was specifically tested (see "Tests") after
  an initial version let DNS lookups through for arbitrary hosts even in
  real-crawl mode, which has been fixed.
- This directly implements "Do not crawl broad internet" as a structural
  guarantee, not a soft default: there is no code path in this pipeline
  that can reach an arbitrary real hostname, even with every flag enabled.

### 4. SSRF / path guards (unchanged, reused)

`runCrawlJob` still goes through the existing, already-hardened
`lib/crawler/url-policy.ts` (blocks localhost/private IPs/metadata
endpoints/credentials-in-URL/non-HTTP schemes/bad ports) and
`shouldSkipPath` (blocks login/admin/cart/checkout/portal/patient paths).
Nothing in this pipeline weakens or bypasses either.

### 5. No outreach send

`OutreachRepository` (unchanged) has `createDraft`, `approve`, `reject`,
`markSent`, `markReplied`, `markIgnored` — all state transitions on an
existing row. **There is no method anywhere in this codebase that calls an
email or WhatsApp API.** The pipeline defaults to building a draft (human
review still required before any further step, which doesn't exist here);
`--no-outreach-draft` skips even that.

### 6. No Google Places / SERP

Not implemented anywhere in this codebase. The only "discovery" source
wired up is CSV/manual import (`lib/discovery/normalize.ts`), matching
`PROJECT_CRAWLER.md`'s MVP phase 1 priority. Nothing in this pipeline
introduces such a call.

## Example CSV fixture

`data/examples/prospect-candidates.example.csv` has 6 rows, deliberately
using distinct hostnames so the default multi-candidate demo doesn't
collide with the existing website-origin deduplication rule (two clinics
sharing one website origin are treated as the same clinic by design — see
`lib/discovery/normalize.ts` `classifyCandidateDuplicate`):

| Row | Host | Real-crawl behavior |
| --- | --- | --- |
| 1 | `example.com` (bare) | Guaranteed to resolve — safe to test with real `--allow-real-crawl` |
| 2-6 | `clinica-*.example.com` | Pass the allowlist (subdomain match), but are **not** guaranteed to resolve in real DNS — a live `--allow-real-crawl` run against these rows will safely fail closed (`dns_failed`) rather than reach anything. They exist to exercise import/dedupe/max-candidates bounding in the default fixture mode, not for live real-crawl testing. |

With the default `--max-candidates 5`, one row (the 6th) is intentionally
truncated on every default-config run — this is the bundled demonstration
of the bounding behavior, not a bug.

## Tests

`lib/operations/controlled-automation-pipeline.test.ts` (25 tests, no live
network, no live Supabase):

- **Production refusal** — `assertSafeTarget` blocks the production ref
  regardless of `--target`; accepts staging only against the known staging
  ref; accepts local only against a loopback URL; rejects unknown targets.
- **`selectRepositories`** — dry-run always returns fakes and never
  requires a target; non-dry-run without `--target` is refused; non-dry-run
  staging pointed at production is refused; non-dry-run local with a
  loopback URL builds real (untested-against-network) Supabase adapters.
- **Controlled transport** — fixture mode never touches the network for
  any URL; real-crawl mode blocks non-allowlisted hosts at the fetch layer
  *and* at the DNS-lookup layer; the allowlist is exactly
  `example.com`/`www.example.com` (+ subdomains).
- **Import bounding + dedup** — the bundled example CSV imports exactly 5
  of 6 rows by default (max-candidates truncation); a custom
  `--max-candidates` is respected; same-origin candidates are deduplicated;
  import never touches `fetch` at all (asserted by monkey-patching
  `globalThis.fetch` to throw if called).
- **Dry-run writes only to fakes** — after a dry-run, the injected
  `FakeCrawlRepository`/`FakeClinicRepository` (not any real client) hold
  the created rows.
- **`--max-pages`** — a crawl job never fetches more pages than the bound.
- **No outreach send** — every draft created during a pipeline run stays
  `status: "draft"`, `humanReviewed: false`; `--no-outreach-draft` produces
  zero draft rows.
- **Fixture-only default behavior** — even without any real-crawl flag
  passed at all, a run completes entirely from fixture content.
- **`--allow-real-crawl` gate** — a non-allowlisted candidate host fails
  closed before any network call, including DNS.
- **Job status transitions / cleanup behavior** — a clinic with no website
  URL fails with a `validation` reason and never gets an orphaned
  `crawl_jobs` row stuck in `pending`/`running`; one candidate's failure in
  a batch doesn't affect or hide the others' successful completion.

## Known limitations / next steps

- `scan_assets` (step 8) is only exercised if screenshot metadata is passed
  into `runCrawlJob` — this pipeline doesn't generate any yet (no
  screenshot capture tool exists in this codebase; see
  `docs/technical/crawler-next-steps.md`).
- The example CSV's non-bare-`example.com` rows are not guaranteed to
  resolve under `--allow-real-crawl` — this is intentional (fail closed,
  not a broken demo) but means a *complete* live real-crawl smoke test
  currently only exercises one candidate end-to-end. Add more genuinely
  resolvable safe fixture domains if broader live-mode coverage is needed
  later.
- `--target staging` still requires the same env-var handling documented in
  `docs/technical/crawler-supabase-staging-validation.md` (no secrets in
  files; `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` via `.env.local` or the
  shell environment only).
- This pipeline is CSV/manual-import only, per `PROJECT_CRAWLER.md` phase 1.
  Google Places/SERP-based discovery remains explicitly out of scope until
  a future, separately-authorized task.
