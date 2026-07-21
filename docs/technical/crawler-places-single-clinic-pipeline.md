# Crawler: first controlled single-clinic pipeline (staging)

> **Status: SUCCESS (fixture-mode crawl) + documented blocker (real-crawl/screenshot).**
> One real Google Places candidate was promoted to a clinic, one
> clinic-centric crawl job was created and completed, a score and an
> outreach **draft** (never sent) were generated, and a full operational
> report was produced. Real-network crawling and screenshot capture
> against the clinic's actual website were attempted and correctly
> **blocked** by the existing host allowlist — the allowlist was **not**
> loosened. **Production was never touched. No broad crawl. No outreach
> was sent. No secrets appear anywhere in this document.**

## Branch / tag baseline

`feature/crawler-places-single-clinic-pipeline`, created from tag
`atria-crawler-places-operational-rehearsal-live-v1` (commit `2d6dfd3`,
"Document live Google Places operational rehearsal").

## Preflight

| Check | Result |
| --- | --- |
| `.env.local` ignored | Yes (`git check-ignore -v` matched `.gitignore:34:.env* .env.local`) |
| `SUPABASE_URL` present | Yes — presence-only check, value never printed |
| `SUPABASE_SERVICE_ROLE_KEY` present | Yes — presence-only check, value never printed |
| `GOOGLE_PLACES_API_KEY` present | Yes — presence-only check, value never printed (not actually needed this round — no new discovery call was made) |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) |
| `SUPABASE_URL` resolves to staging ref | Confirmed via substring check that never echoed the URL |
| Production ref (`cskodsnvghavkcjwmafr`) targeted | Never — `target-guard.ts`'s `assertSafeTarget` was the active gate on every command below |

## Code changed (and why)

One small CLI gap had to be closed before step 3 of this rehearsal could run at all: there was **no existing command** to promote an already-persisted `prospect_candidates` row by id. The only two call sites of `promoteCandidateToClinic` (`run-controlled-pipeline.ts`'s CSV import, and `discover-google-places.ts --promote`) only ever promote rows they *just* recorded in the same invocation — a pre-existing row (like the GRUPO CPD candidate from the prior rehearsal) would dedupe as `existing_in_db`/duplicate and never enter their `imported` loop.

Added:
- `scripts/crawler/promote-candidate.ts` — a thin CLI wrapper (matching the existing conventions in `scripts/crawler/import-candidates.ts` and `process-crawl-queue.ts`) around the already-fully-tested `lib/operations/promote-candidate.ts::promoteCandidateToClinic`. Flags: `--dry-run` / `--target local|staging`, `--candidate-id <id>`. Same `selectRepositories`/target-guard safety gate as every other CLI in this pipeline.
- `package.json`: new `crawler:promote` script entry.

No new test file was added for the CLI wrapper itself, consistent with the existing pattern — none of `import-candidates.ts`, `process-crawl-queue.ts`, `discover-google-places.ts`, or `run-controlled-pipeline.ts` have their own test files either; `npm test` only runs `lib/**/*.test.ts`, and the wrapped logic (`promoteCandidateToClinic`) already has 5 passing tests in `lib/operations/promote-candidate.test.ts` covering exactly this code path.

## Candidate used

- **ID:** `031aa871-be29-40d0-9dd9-1eeab35998e8`
- **Name:** GRUPO CPD - Centro Paulista de Dermatologia e Estética
- **Website:** `https://grupocpd.com.br/`
- Re-queried from staging directly (REST API, service-role key used only as an unprinted request header) before touching it: `status: "new"`, `promoted_clinic_id: null` — confirmed still eligible and unchanged since the prior rehearsal.

## Clinic created

```
npm run crawler:promote -- --target staging --candidate-id 031aa871-be29-40d0-9dd9-1eeab35998e8
```

- **Clinic ID:** `8634b1cb-2d82-40d9-a257-1dca5e7c5b9c`
- `display_name`: GRUPO CPD - Centro Paulista de Dermatologia e Estética
- `website_url`: `https://grupocpd.com.br/`
- `status`: `prospect`
- `source_type`: `google_places`
- Candidate `031aa871-be29-40d0-9dd9-1eeab35998e8` is now `status: "promoted_to_clinic"`, `promoted_clinic_id: 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c` — confirmed by direct query.

## Real-crawl / screenshot attempt: blocked by design (documented, not worked around)

Before running the safe path, the real thing was attempted first, exactly to exercise and document the safety gate:

```
npm run crawler:queue:process -- --target staging --clinic-ids 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c --allow-real-crawl --capture-screenshots --max-pages 3
```

Result: `{"clinicId":"8634b1cb-...","crawlJobId":null,"ok":false,"failureReason":"invalid_url", ...}`.

**Why, precisely:** `lib/operations/pipeline/controlled-transport.ts` hardcodes `ALLOWED_REAL_CRAWL_HOSTNAMES = ["example.com", "www.example.com"]` — a real clinic domain like `grupocpd.com.br` is not on it, by design, and there is deliberately no flag or env override to add one. With `--allow-real-crawl`, `createControlledLookup` throws before any DNS resolution is attempted for a non-allowlisted host; `lib/crawler/url-policy.ts`'s `resolveAndValidatePublicUrl` catches that as `dns_failed`, which `run-crawl-job.ts` surfaces as the outer reason `invalid_url` (only its own `blocked_host` code is special-cased separately). Net effect: **zero network egress** was made toward `grupocpd.com.br` — not even a DNS lookup — and because this validation runs *before* a fresh crawl job is inserted, **no `crawl_jobs` row was created** by this specific attempt (confirmed: the table has exactly one job, the fixture-mode one below, not two).

Per instruction, `grupocpd.com.br` was **not** added to `ALLOWED_REAL_CRAWL_HOSTNAMES`, and no other workaround was attempted. Real-website crawling and screenshot capture (which shares the same allowlist) for this clinic remain out of reach until/unless that allowlist is deliberately and separately extended — a decision this rehearsal explicitly did not make.

## Crawl job created (safe fixture-mode path)

```
npm run crawler:queue:process -- --target staging --clinic-ids 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c --max-pages 3
```

Without `--allow-real-crawl`, every fetch in this pipeline is served from an in-memory fixture regardless of the target URL — **zero real network calls, to any host** (see `controlled-transport.ts` module docs). This is what actually produced a persisted, inspectable `crawl_jobs` row:

- **Crawl job ID:** `abc8e0d3-33a9-4c7a-ab46-a0f092d7ad78`
- `requested_url`: `https://grupocpd.com.br/` (the clinic's real URL — used only as a label; nothing was fetched from it)
- `normalized_origin`: `https://grupocpd.com.br`
- `max_pages`: 3 (limit respected; run used 2)
- `status`: `completed`

### Crawl result

- **Pages crawled:** 2 fetched / 2 discovered / 0 failed (homepage + the fixture's single internal `/contato` link — bounded well under `max_pages=3`).
- **Content source:** `DEFAULT_FIXTURE_HTML` (a canned "Clínica Fixture" page baked into `controlled-transport.ts`), **not** GRUPO CPD's real website content. This is a direct, structural consequence of the allowlist block above, not a data-quality bug — flagging it clearly here so this run is never mistaken for real market data about GRUPO CPD.

### Findings / extracted content

- `extracted_content` row `89db583f-a4e7-4687-89f1-43bcaba83ed0` (version 1, `review_status: pending_review`, `schemaVersion: extraction-candidates-v1`).
- `clinic_contacts`: 2 rows, both derived from the fixture HTML, **not real GRUPO CPD contact details**:
  - `email` — `contato@fixture.example.com` (from `https://grupocpd.com.br/` and `.../contato`)
  - (phone candidates were extracted too, at `low` confidence, and are visible in the report but were not persisted to `clinic_contacts` since that repository only stores non-`low`-confidence candidates)

### Score result

- **Total:** 66/100 (`scoring_version: placeholder-v0`, `review_status: pending_review`)
- Dimensions: credibilidade 12/20, clareza 18/20, mobile 8/20 (placeholder — no screenshot), conversão/contato 20/20, atualização 8/20 (placeholder)
- Persisted as `scores` row `8d6da0e4-ae50-42b2-a034-e942915bce3d`, linked to the clinic and crawl job.
- This score reflects the **fixture** page's structure/content, not GRUPO CPD's real site — same caveat as above.

### Outreach draft (never sent)

- `outreach_messages` row `6dbbe926-7ddf-443f-85bc-79ba3ab60909`: `channel: email`, `status: draft`, `human_reviewed: false`, `do_not_contact_blocked: false`.
- Built by `buildOutreachDraft` (in-memory only) and persisted via `createDraft`, which always inserts `status: "draft"` regardless of caller input. No send-capable code path exists in this pipeline (`markSent` — the only status-transition function — is defined but not called from any script, route, or UI in this codebase).

## Screenshot result: not captured (blocked, correctly)

`--capture-screenshots` was included in the real-crawl attempt above and, per code, requires `--allow-real-crawl` at the CLI layer — which in turn requires an allowlisted host to ever actually navigate anywhere. Since `grupocpd.com.br` is not allowlisted, no screenshot attempt was made against it, and none was faked in fixture mode either (fixture mode doesn't drive a browser at all). Confirmed via direct query: `scan_assets` for this crawl job has **0 rows**. This is the same, single root cause as the crawl blocker above — not a separate failure.

## Report result

Generated both formats, written only to the gitignored `artifacts/reports/` directory (`.gitignore:58`, never committed):

```
npm run crawler:report -- --target staging --clinic-id 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c --crawl-job-id abc8e0d3-33a9-4c7a-ab46-a0f092d7ad78 --output markdown --write-artifact
npm run crawler:report -- --target staging --clinic-id 8634b1cb-2d82-40d9-a257-1dca5e7c5b9c --crawl-job-id abc8e0d3-33a9-4c7a-ab46-a0f092d7ad78 --output json --write-artifact
```

- `artifacts/reports/8634b1cb-2d82-40d9-a257-1dca5e7c5b9c.md` and `.json` — status `draft`, `reviewRequired: true`, both screenshot slots reported as `"missing"`, both carrying the mandatory Portuguese disclaimer ("avalia apenas a apresentação digital... não avalia qualidade médica") and the full human-review checklist. `--allow-incomplete` was not needed — a score existed, so this is a complete (not incomplete) report, just one built on fixture-sourced evidence as noted throughout.

## Retained staging rows (no cleanup performed — retained for inspection, per instruction)

| Table | Row(s) retained |
| --- | --- |
| `prospect_candidates` | `031aa871-be29-40d0-9dd9-1eeab35998e8` (now `promoted_to_clinic`) — plus the 2 sibling candidates from the prior rehearsal, untouched |
| `clinics` | `8634b1cb-2d82-40d9-a257-1dca5e7c5b9c` |
| `crawl_jobs` | `abc8e0d3-33a9-4c7a-ab46-a0f092d7ad78` (`completed`) |
| `extracted_content` | `89db583f-a4e7-4687-89f1-43bcaba83ed0` |
| `clinic_contacts` | `acfb371c-20d0-4201-97c2-fd73ec4ecba8`, `7e40208c-25c7-4686-b886-53b8b57d94cb` (both fixture-derived emails) |
| `scores` | `8d6da0e4-ae50-42b2-a034-e942915bce3d` (total 66) |
| `outreach_messages` | `6dbbe926-7ddf-443f-85bc-79ba3ab60909` (`draft`, never sent) |
| `scan_assets` | none — 0 rows, screenshot never attempted (blocked upstream) |

Nothing was deleted or reset. All of the above remain in staging exactly as created, for inspection.

## Blockers / limitations

1. **No CLI existed to promote a pre-existing candidate by id** — closed by adding `scripts/crawler/promote-candidate.ts` (see "Code changed" above). This is a durable capability, not a one-off hack.
2. **Real crawl and screenshot capture against GRUPO CPD's actual website are blocked by the `ALLOWED_REAL_CRAWL_HOSTNAMES` allowlist** (`example.com`/`www.example.com` only). This is the pipeline working as designed — a deliberate hard boundary — not a bug. It was **not** loosened or worked around. Consequently:
   - The crawl job, extraction, contacts, and score in this rehearsal are all derived from **synthetic fixture content**, not GRUPO CPD's real website.
   - The mobile score dimension used its conservative placeholder value (no screenshot evidence).
   - Any future rehearsal that needs real GRUPO CPD website content or screenshots requires a separate, explicit decision to extend the allowlist (out of scope here) — or a per-environment override mechanism that does not currently exist.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — every command went through `assertSafeTarget`, which resolved to the staging ref throughout.
- No broad crawl — exactly one crawl job, bounded to `max_pages=3` (used 2), and the one real-crawl attempt was blocked before any network call.
- No Google Places/SERP call was made this round — no new discovery, only re-querying and promoting an existing candidate from the prior rehearsal.
- No outreach was sent — one `draft`-status row was created; no send-capable code path was invoked or exists in this pipeline.
- No secrets were stored in any file, log, or this document — `.env.local` remained git-ignored throughout; all presence checks reported only whether a variable was set, never its value; every direct staging query used the service-role key solely as an in-memory HTTP header, never echoed to output.
