# Small-batch operator rehearsal

Runs `docs/operations/crawler-operator-runbook.md` end-to-end, for real,
against staging, with a deliberately small batch (2 candidates, not
scale) — following the runbook's own steps in order, using its own
inspection criteria at each decision point. **This is docs/rehearsal
only — no code was changed.** Every failure encountered below was
handled correctly and safely by code that already existed; nothing was
a bug, and nothing required a new flag, script, or migration.

## 1. Preflight result

```
cat supabase/.temp/project-ref   # lfkyiztuwptmddsraucg — confirmed staging
npm run crawler:operator-preflight -- --target staging
```

`overallStatus: "ready"`. All checks `ok` except
`screenshot_storage_config`, which was a `warning` (env var not set) —
handled the same way every prior rehearsal has, by passing
`--screenshot-storage-bucket crawler-screenshots` explicitly on the
crawl command.

## 2. Query/location used

```
npm run crawler:discover:places -- --dry-run --query "dermatologia" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

Rehearsed with `--dry-run` first (fixture data, no network call, no API
key needed) — confirmed the output shape before spending a real API
call. Then ran for real:

```
npm run crawler:discover:places -- --target staging --query "dermatologia" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

Strict limits honored: `--max-results 3`, `--max-pages 1`, no
`--promote` (promotion deferred to its own deliberate step). Discovery
job `564b4dbd-09fe-47f7-a6a2-7466f2f10a2c`, `pagesFetched: 1`,
`totalFoundByProvider: 3`, `importedCount: 2` (1 was a duplicate of an
already-known candidate and was correctly skipped, not re-imported).

## 3. Candidates found

Inspected directly via REST, per the runbook's own step 3 procedure:

| Candidate | Website | Assessment |
| --- | --- | --- |
| `a63d2f37-ea6b-47c1-a990-f736be69ed59` — "Dra Ana Paula Pedrino \| Dermatologia..." | `https://grupocpd.com.br/sobre-nos-grupo-centro-paulista-de-dermatologia/` | Real clinic domain, but same `normalized_website_origin` as the already-promoted GRUPO CPD clinic (`8634b1cb-...`) — a near-duplicate. |
| `c9e9fa26-70cb-4267-ae5b-160da07407c9` — "Dra. Ana Carolina Apolinário Sala..." | `https://www.doctoralia.com.br/...` | **Third-party directory listing** (Doctoralia), not the clinic's own domain — exactly what the runbook's step 3 says to skip. |

**Decision:** did not promote `c9e9fa26` — a large third-party directory
platform is not a single clinic's own website, and crawling it would not
match this pipeline's "one approved domain per rehearsal, no broad
crawl" design. `a63d2f37` was promoted anyway, deliberately, to exercise
the review pipeline against a domain overlap and let the review step
itself catch and document the duplicate — a realistic operator scenario.

## 4. Candidates promoted

Two, at the "at most 2" limit:

1. **`a63d2f37` → clinic `9c107389-5bda-4411-809a-e87be54425b8`**
   ("Dra Ana Paula Pedrino...") — promoted via `npm run crawler:promote`.
   `promoteCandidateToClinic` dedupes by the *candidate's* dedupe key, not
   by website domain, so this correctly created a new, separate clinic
   record rather than silently merging into the existing GRUPO CPD
   clinic — worth noting as a real product-shape observation, not a bug:
   two clinic records can legitimately point at the same domain today.
2. **A second, already-queued candidate, not from today's search:**
   `c51ddcdd-e5ee-4ed1-ac5c-650a7ccc4381` ("Dermaclinic",
   `dermaclinic.com.br`) → clinic `9e76f7e5-5c24-434c-96ce-8ce22768e457`.
   This candidate was sitting in `prospect_candidates` with `status:
   "new"` from an earlier, unrelated rehearsal — inspecting the current
   candidate pool (step 3) surfaced it, and promoting it was the only way
   to get a second, own-domain (non-directory) candidate into this
   batch, since today's discovery query only produced the two candidates
   above.

## 5. Domains approved

Explicitly, per candidate, per invocation — never persisted, never
wildcarded:

- `grupocpd.com.br,www.grupocpd.com.br` for clinic `9c107389-...`
- `dermaclinic.com.br,www.dermaclinic.com.br` for clinic `9e76f7e5-...`

## 6. Crawl results

```
npm run crawler:queue:process -- --target staging --allow-real-crawl --capture-screenshots \
  --screenshot-storage-bucket crawler-screenshots \
  --approved-domains <domain>,<www-domain> --clinic-ids <clinic-id> --max-pages 3
```

Both bounded to `--max-pages 3`. Both failed — for two different,
legitimate, safety-respecting reasons:

- **Clinic `9c107389-...`** (crawl job `f2a7100e-8f7c-453f-af13-2c1033db326b`):
  `status: "failed"`, `error_code: "robots_denied"`, `error_message:
  "robots.txt denies crawling this resource."`, 0 pages fetched. **The
  crawler correctly respected the site's own robots.txt and refused to
  fetch the page — no bypass, no override flag exists for this.**
- **Clinic `9e76f7e5-...`** (crawl job `02c63c9f-e310-459d-a083-f92921bd0760`):
  `status: "failed"`, `error_code: "unexpected_error"` (the specific
  underlying cause is intentionally not exposed —
  `lib/crawler/errors.ts`'s `safeErrorMessage` strips internal detail by
  design), `pages_discovered: 1`, `pages_fetched: 0`, `pages_failed: 1`.

Neither failure corrupted any downstream state — both crawl jobs simply
recorded `status: "failed"` with a real error code, exactly as designed.

## 7. Screenshot/storage results

- **Clinic `9c107389-...`**: no screenshots — the crawl never reached
  the page-load stage (`robots_denied` short-circuits before any browser
  navigation).
- **Clinic `9e76f7e5-...`**: **both desktop and mobile screenshots
  captured successfully** (`captureStatus: "captured"`) via Playwright,
  despite the content-fetch step failing with `unexpected_error` — the
  two subsystems (raw HTTP content fetch vs. full-browser screenshot
  capture) are independent, and one failing does not block the other.
  Uploaded to the **private** `crawler-screenshots` bucket:
  - `private/scan-assets/02c63c9f-e310-459d-a083-f92921bd0760/desktop.png` (asset `80b89312-623d-4d47-952e-f753a7c68677`)
  - `private/scan-assets/02c63c9f-e310-459d-a083-f92921bd0760/mobile.png` (asset `60cf2a4b-7f3a-4bb5-9dcf-8adb0770962e`)
  - Re-verified directly: `GET .../storage/v1/object/public/crawler-screenshots/...desktop.png` → **HTTP 400** — not publicly accessible, exactly as designed.

## 8. Scores

**None.** Both crawls fetched 0 pages, so no `extracted_content` and no
score were ever produced — `scores` count stayed at 10 throughout this
rehearsal (unchanged from before). This is the score model's designed
behavior (`pageCount === 0` → explicit "unreachable" gate in every
dimension), not a gap — it just never had a chance to run here because
neither crawl produced any pages at all.

## 9. Reports/review packs

Both generated with `--allow-incomplete` (required, since neither has a
score) and `--write-artifact`:

- `artifacts/reports/9c107389-5bda-4411-809a-e87be54425b8.md`
- `artifacts/review-packs/9c107389-5bda-4411-809a-e87be54425b8.md`
- `artifacts/reports/9e76f7e5-5c24-434c-96ce-8ce22768e457.md`
- `artifacts/review-packs/9e76f7e5-5c24-434c-96ce-8ce22768e457.md`

Both correctly show `status: "incomplete_report"` /
`"incomplete_review_pack"`, `_Score pendente..._` in the improvement
angle, `_Nenhum rascunho de outreach encontrado..._` in the outreach
draft section, and risk flags:

- `9c107389-...`: `[high] crawl_failed`, `[high] missing_score`,
  `[info] missing_screenshot_desktop`, `[info] missing_screenshot_mobile`.
- `9e76f7e5-...`: `[high] crawl_failed`, `[high] missing_score` (no
  missing-screenshot flags — the screenshots did exist).

Neither pack was silently generated as if complete — every gap is
explicit, matching the runbook's documented failure-handling guidance.

## 10. Review decisions

Both recorded, append-only, via `crawler:review-decision`:

- **`9c107389-...` → `rejected`** (`d09bdeb1-672b-4b26-ae31-9eeefeabb6cd`,
  reviewer "Atria QA"): robots.txt blocks the crawl entirely (no bypass
  attempted or available), and the domain duplicates an already-promoted
  clinic — not viable for outreach.
- **`9e76f7e5-...` → `needs_changes`** (`7d236059-172f-45e7-9b42-4b5f7d4834bc`,
  reviewer "Atria QA"): crawl failed with an unexplained fetch error
  despite successful screenshots; recommends a re-attempt or manual
  investigation before any further action, rather than a final
  rejection.

Both decisions have `scoreId: null`, `outreachMessageId: null` — an
honest reflection that neither exists for these clinics.

Note: `npm run crawler:review-queue -- --target staging --status all`
only lists clinics with **at least one score** (by design — see
`lib/operations/review-queue/list-review-queue.ts`), so neither of these
two clinics appears in that listing even though a review decision was
successfully recorded for each directly. This is consistent, not a bug:
the review-decision CLI operates on a clinic id directly and never
required a queue entry to exist first.

## 11. Manual outreach logs

**None were recorded for either new clinic — correctly.** Neither crawl
produced any evidence, so `buildOutreachDraft` never had anything to
draft from, so no `outreach_messages` row exists for either clinic
(confirmed via direct REST query: `[]` for both `clinic_id`s). Since
`recordManualOutreachLog` requires an existing, real
`outreach_message_id`, there is nothing to log a rehearsal event
against for this batch's two candidates.

This was verified as a real safety property, not assumed: attempted
`npm run crawler:outreach-log:record ... --event-type rehearsal_logged
... --dry-run false` against a syntactically-valid but non-existent
`--outreach-message-id` for clinic `9e76f7e5-...`. Result:
`[record-manual-outreach-log] BLOCKED (not_found): Outreach message not
found.` — exit code 1, **nothing inserted** (re-confirmed via REST:
`manual_outreach_logs` count for both new clinics stayed at 0
throughout).

The one existing `manual_outreach_log` row in staging
(`9feed1a6-ad9a-420e-82a8-eddbc0c72636`, `rehearsal_logged`, from the
immediately preceding manual-outreach-logging task, for SkinLaser) is
unrelated to this batch and was left untouched — it already fully
demonstrates the successful `rehearsal_logged` path for a clinic that
*does* have real evidence and a real outreach draft. This rehearsal's
contribution is the complementary, equally important finding: the
logging step correctly refuses to operate on a clinic that never made it
that far.

## 12. Confirm outreach remains draft

Re-queried directly after every step above:

```
outreach_messages: distinct statuses = {"draft"}, count = 7 (unchanged from before this task)
```

All 7 rows (1 GRUPO CPD, 6 SkinLaser) remain exactly as they were before
this rehearsal — this batch's two new clinics contributed zero new
outreach rows, by design, since neither produced any evidence to draft
from. No outreach was sent by anyone or anything.

## Retained staging rows (this rehearsal's additions)

Nothing was deleted or modified — every table in this pipeline is
append-only/additive. New rows added by this task:

| Table | New rows | IDs |
| --- | --- | --- |
| `prospect_candidates` | 2 | `a63d2f37-...` (promoted), `c9e9fa26-...` (left `new`, not promoted — directory listing) |
| `clinics` | 2 | `9c107389-...` ("Dra Ana Paula Pedrino...", `grupocpd.com.br` subpage), `9e76f7e5-...` ("Dermaclinic", `dermaclinic.com.br`) |
| `crawl_jobs` | 2 | `f2a7100e-...` (`failed`/`robots_denied`), `02c63c9f-...` (`failed`/`unexpected_error`) |
| `scan_assets` | 2 | `80b89312-...` (desktop), `60cf2a4b-...` (mobile) — both for the Dermaclinic crawl job only |
| `scores` | 0 | Neither crawl produced a score |
| `outreach_messages` | 0 | Neither clinic produced evidence to draft from |
| `human_review_decisions` | 2 | `d09bdeb1-...` (`rejected`), `7d236059-...` (`needs_changes`) |
| `manual_outreach_logs` | 0 | Refused (correctly) — no outreach message exists to log against |

Full staging state after this rehearsal: 4 `clinics`, 8 `crawl_jobs`, 10
`scores` (unchanged), 7 `outreach_messages` (unchanged, all `draft`), 4
`human_review_decisions`, 1 `manual_outreach_log` (unchanged, the
pre-existing SkinLaser rehearsal row).

## Blockers / limitations discovered

None required a code change — all are documented operational realities:

1. **`robots_denied` is a hard stop with no override.** By design, there
   is no flag anywhere in this pipeline to bypass a site's own
   robots.txt. If a real prospective clinic's site disallows crawling,
   the only paths forward are manual, outside this pipeline (e.g. asking
   the clinic directly), or accepting the rejection.
2. **`unexpected_error` on content fetch is intentionally opaque.**
   `safeErrorMessage` strips internal detail from `crawl_jobs.error_message`
   for every generic failure, by design (avoids leaking internal stack
   traces/library errors into a field a human reviewer reads). This
   means diagnosing *why* a specific fetch failed (TLS version mismatch?
   redirect loop? content-type issue?) currently requires server-side
   log access outside what this pipeline's own persisted rows expose —
   worth flagging as a possible future observability gap, not something
   this task changed.
3. **A completely-failed crawl (0 pages) cannot reach the
   manual-outreach-log step at all**, by design — there's no evidence,
   so no draft, so no `outreach_message_id` to log against. This is a
   correct safety property (confirmed above), not a missing feature: an
   operator has nothing to send, so there is nothing to log a send
   attempt for either.
4. **Two clinic records can point at the same website domain.**
   `promoteCandidateToClinic` dedupes by the *candidate's* dedupe key,
   not by website origin, so promoting a different-named candidate that
   happens to share a domain with an already-promoted clinic creates a
   second, independent clinic record. Not a bug (a dermatologist's
   individual profile page and a clinic's institutional homepage on the
   same domain are legitimately different things sometimes), but worth
   an operator's attention at inspection time (step 3) — exactly what
   this rehearsal demonstrated by rejecting it at the review-decision
   step instead.
5. **`crawler:review-queue` only lists clinics with a score.** A clinic
   whose crawl fails before scoring never appears there, even with a
   recorded decision. Not a blocker for this rehearsal (the decision CLI
   works directly on a clinic id), but worth knowing if you expect to
   find every reviewed clinic in that listing.

## Verification

- `npm test` — 380/380 passing (unchanged — no code or test files were added; this task is documentation/rehearsal only).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed via `supabase/.temp/project-ref` before this rehearsal began.
- No broad crawl — every real-crawl command was bounded to `--max-pages 3` and an explicit, per-invocation, 2-entry `--approved-domains` allowlist (apex + www) for exactly the one clinic being crawled; both crawls failed before fetching a single page, so in practice zero page bodies were ever retrieved from either domain.
- No Google/SERP beyond the official Places API — one `--target staging` discovery call, `--max-results 3 --max-pages 1`, no scraping, no browser automation against Google.
- No outreach was sent — no outreach draft was ever created for either new clinic (nothing to send), and all 7 pre-existing `outreach_messages` rows remain `status: "draft"`, unchanged.
- No secrets were stored in any file, log, or this document — the service-role key was used only as an unprinted HTTP header for direct REST verification queries, matching every prior rehearsal's convention.
