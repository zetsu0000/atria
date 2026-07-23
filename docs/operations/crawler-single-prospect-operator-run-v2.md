# Crawler Single-Prospect Operator Run — v2

Status date: 2026-07-23
Branch: `feature/crawler-single-prospect-operator-run-v2`
Base tag: `atria-crawler-candidate-review-cli-v1`
Target: `staging` (`lfkyiztuwptmddsraucg`) only. Production (`cskodsnvghavkcjwmafr`) was never touched.

This is the second real operational rehearsal of the single-prospect flow,
run specifically to validate the improved Step B ("Review candidates") using
the new `crawler:candidates:list` CLI
(`docs/technical/crawler-candidate-review-cli.md`). Unlike
`crawler-single-prospect-operator-run-v1.md` (which stopped at candidate
selection because every discovery result duplicated already-triaged
records), this run produced 5 new candidates, promoted one, and carried it
through crawl → score → prioritization → template — where it correctly
stopped at **template withheld** (low priority tier, score 0/100) rather
than proceeding to a review decision or outreach preparation.

## 1. Exact Commands Run (secrets redacted — none were ever printed)

```bash
# Step 2-4: preflight
npx tsx scripts/crawler/operator-preflight.ts --target staging

# Step 5-6: one narrow, real Google Places discovery
npx tsx scripts/crawler/discover-google-places.ts \
  --target staging --query "clínica dermatológica" --location "Moema, São Paulo, SP" \
  --max-results 5 --max-pages 1

# Step 7: review candidates with the new CLI (markdown)
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id 1257e023-ead6-4fd0-9cc2-51c2ffedecfe \
  --include-existing --output markdown

# Step 8: only-promotable, JSON
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id 1257e023-ead6-4fd0-9cc2-51c2ffedecfe \
  --include-existing --only-promotable --output json

# Step 11: promote exactly one candidate
npx tsx scripts/crawler/promote-candidate.ts \
  --target staging --candidate-id 1db0855c-5586-4564-ac89-5a30e994fb54

# Step 13: controlled crawl, one clinic, explicit approved domain, max 3 pages
npx tsx scripts/crawler/process-crawl-queue.ts \
  --target staging --clinic-ids e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --allow-real-crawl --approved-domains highlineclinica.com.br \
  --max-pages 3 --capture-screenshots

# Diagnostic (read-only, scratchpad script — not part of the repo): fetch the
# crawl job's specific errorCode via the existing CrawlRepository.getCrawlJob
# read method, since neither the operational report nor the review pack
# surfaces it (see Section 18, Limitation 1).

# Step 16: recalculate an honest score for the 0-page crawl
npx tsx scripts/crawler/recalculate-score.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437

# Step 14: operational report (re-run after the score existed)
npx tsx scripts/crawler/generate-operational-report.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437 --output json

# Step 15: human review pack
npx tsx scripts/crawler/generate-human-review-pack.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437 --output json

# Step 17: prioritization
npx tsx scripts/crawler/prioritize-prospects.ts --target staging --output table --limit 30

# Step 18: commercial template pack
npx tsx scripts/crawler/generate-commercial-template-pack.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 --output json
```

Steps 19–22 (review decision, manual outreach pack, log) were **not
executed** — see Section 16.

## 2. Selected Query/Location

- Query: `"clínica dermatológica"`
- Location: `"Moema, São Paulo, SP"`
- Limits applied: `--max-results 5`, `--max-pages 1`.

## 3. Discovery Result Summary

```json
{
  "discoveryJobId": "1257e023-ead6-4fd0-9cc2-51c2ffedecfe",
  "totalFoundByProvider": 5,
  "importedCount": 5,
  "duplicateCount": 0,
  "rejectedCount": 0
}
```

Unlike v1, this query/location produced 5 brand-new `prospect_candidates`
rows: Clinica Derma Line, Dra Mirelle Furlan, Dra. Danielle Bacha, Skinlaser
Dermatologia Médica Ltda - Moema, Clínica High Line.

## 4. Candidate Review CLI Output Summary

`crawler:candidates:list --include-existing` classified all 5 as
`promote_candidate` — no blockers, no directory listings, all with their own
domains. `--only-promotable` correctly returned all 5.

One candidate — **"Skinlaser Dermatologia Médica Ltda - Moema"**
(`95109461-d223-4479-adb4-94bac1292e26`, website
`http://www.skinlaser.com.br/`) — is, by human judgment, almost certainly
the *same real business* as the already-promoted, already-approved,
already-rehearsed clinic "SkinLaser - Higienópolis"
(`bbfd72a3-a013-4a6c-bd82-4a70479d694a`, website
`https://www.skinlaser.com.br/`) from the prior manual outreach rehearsal.
The `--include-existing` live dedupe check did **not** catch this — see
Section 18, Limitation 2. This candidate was deliberately excluded from
selection rather than promoted a second time.

## 5. Selected Candidate

**Clínica High Line** (`1db0855c-5586-4564-ac89-5a30e994fb54`) —
`https://highlineclinica.com.br/`, own domain, no blockers, plausible clinic
business name, distinct from every already-known staging record.

## 6. Promoted Clinic ID

`e7a46c30-76b0-4832-80c6-778ccb6b67f3` — "Clínica High Line", status
`prospect`, website `https://highlineclinica.com.br/`.

## 7. Crawl Job ID/Result

- Crawl job: `b5348d75-d6c6-4109-a724-6c0ae600b437`
- `--approved-domains highlineclinica.com.br`, `--max-pages 3`, `--allow-real-crawl`, `--capture-screenshots`
- Result: **`status: failed`**, `pagesDiscovered: 1`, `pagesFetched: 0`, `pagesFailed: 1`
- `errorCode: "redirect_blocked"`, `errorMessage: "A redirect target was blocked."`

The homepage issued a redirect to a target outside the explicitly approved
domain (`highlineclinica.com.br`) — the crawler's redirect-target guard
correctly refused to follow it. No workaround was attempted (same standing
policy as the earlier GRUPO CPD TLS-certificate case in
`docs/technical/crawler-approved-real-domain-crawl.md`): no wildcard
domains, no bypass, no retry with an expanded domain list within this run.

## 8. Screenshot/Storage Result

Both desktop and mobile screenshots were captured successfully
(`captureStatus: "pending_storage"` — no `SCREENSHOT_STORAGE_BUCKET`
configured, so bytes were never uploaded, matching the documented,
expected behavior when that env var is absent). Notably, screenshot
capture **succeeded** even though the text-content crawl **failed** on the
exact same redirect — see Section 18, Limitation 3, for why this is worth
flagging.

## 9. Operational Report Result

- First generation (before scoring): `status: "incomplete_report"` (score missing), generated read-only with `--allow-incomplete`.
- Second generation (after `recalculate-score`): `status: "draft"`, complete. Every score dimension shows 0/20 with evidence: *"Site inacessível durante o scan (possível falha de conexão, DNS, certificado/TLS ou timeout) — não há evidência real para avaliar [dimension]."*

## 10. Review Pack Result

Generated successfully (`status: "draft"`). `internalSummary`: *"Clínica High
Line — score 0/100 (v1) — crawl failed (0 páginas analisadas) —
screenshots: desktop capturado, mobile capturado. Revisão humana
obrigatória antes de qualquer contato."*

## 11. Score Result

Recalculated via `recalculate-score.ts` (an existing, safe, already-designed
command for exactly this scenario — it never re-crawls, only re-scores
already-persisted data):

```json
{
  "scoringVersion": "v1",
  "total": 0,
  "dimensions": { "credibility": 0, "clarity": 0, "mobile": 0, "actionability": 0, "freshness": 0 },
  "unreachableReason": "unreachable_generic",
  "isDirectoryListing": false
}
```

Honest, non-fabricated zero — consistent with score v1's calibration
guarantee that a missing/unreachable site never produces a fake positive
score.

## 12. Prioritization/Template Result

- Prioritization: **`low` tier, priority score 20** (not `blocked`) — the clinic still earns partial credit for having its own, non-directory domain and a successfully captured screenshot, even though the content score is 0.
- Commercial template pack: generated, but **both channels withheld**:
  - `whatsapp.available: false`, `email.available: false`
  - `unavailableReason`: *"Prioridade baixa — outreach direto não é recomendado por padrão. Priorizar pesquisa manual ou revisita futura."*
  - `operatorChecklist` explicitly states: *"Nenhuma copy externa foi gerada — não enviar nada manualmente para este prospect agora."*
  - `riskFlags`: `crawl_failed` (medium), `missing_contact` (info).

This is the **template withheld** stop condition, triggered by real
evidence rather than assumed.

## 13. Review Decision Result

**Not recorded.** Evidence is not strong enough to justify either
`approved` or `needs_changes` as a meaningful judgment: the crawl never
reached the site's actual content, so there is nothing substantive for a
human to approve, reject, or request changes on — only "retry the crawl (or
extend `--approved-domains` to the real redirect target) and re-evaluate"
is a reasonable next step, which is not one of the three decision values
and would misrepresent what happened if forced into one of them.

## 14. Manual Outreach Packet/Log Result

**Not attempted.** No `outreach_messages` row exists for this clinic —
`process-crawl-queue.ts`'s draft-creation step, like scoring and content
extraction, only runs when `pagesFetched > 0`, and this crawl fetched 0
pages. `record-manual-outreach-log.ts` requires an
`--outreach-message-id`, so there was nothing valid to log against. No
`rehearsal_logged` or `prepared_for_manual_review` event was recorded,
since neither event would correspond to anything real for this clinic.

## 15. Retained Staging Rows

- 1 new `discovery_jobs` row: `1257e023-ead6-4fd0-9cc2-51c2ffedecfe` (`candidatesCreated: 5`).
- 5 new `prospect_candidates` rows (4 still `status: "new"`, 1 now `status: "promoted_to_clinic"`).
- 1 new `clinics` row: `e7a46c30-76b0-4832-80c6-778ccb6b67f3` ("Clínica High Line").
- 1 new `crawl_jobs` row: `b5348d75-d6c6-4109-a724-6c0ae600b437` (`status: "failed"`, `errorCode: "redirect_blocked"`).
- 2 new `scan_assets` rows (desktop + mobile screenshots, `captureStatus: "pending_storage"`, no bytes uploaded).
- 1 new `scores` row: `dd2f41ac-5207-4a80-afd9-ac4c67ece12d` (`total: 0`, `scoringVersion: "v1"`).
- 0 new `outreach_messages`, `human_review_decisions`, or `manual_outreach_logs` rows.
- No existing staging row was modified.

## 16. Stop/Proceed Reasoning

**Proceeded** through discovery → candidate review → promotion → crawl →
score recalculation → report → review pack → prioritization → template,
using only real, already-existing commands, exactly as the task's required
flow specifies. **Stopped** at the template step once it concretely
confirmed `template_withheld` (low tier, score 0, both channels
unavailable) — one of the explicit stop conditions for this task. Did not
force a review decision onto genuinely inconclusive evidence (crawl never
reached real content), and did not fabricate a log entry against a
nonexistent outreach message. This mirrors the same discipline exercised in
v1 (stop rather than substitute/force progress when the evidence doesn't
support it) while still demonstrating, for the first time in this
rehearsal series, the full pipeline running end-to-end through a real
promotion and a real (failed) crawl attempt.

## 17. Safety Confirmations

- [x] Staging target only (`lfkyiztuwptmddsraucg`) used for every real command; production ref (`cskodsnvghavkcjwmafr`) never used.
- [x] `operator-preflight` confirmed `overallStatus: "ready"` before any other command ran.
- [x] Exactly one Google Places query, one page, max 5 results — no SERP call, no Google Maps scraping.
- [x] Exactly one candidate promoted (of 5 available) — the SkinLaser-Moema duplicate was deliberately not promoted.
- [x] Exactly one clinic crawled, `--max-pages 3`, explicit `--approved-domains highlineclinica.com.br` (no wildcards), SSRF/redirect-target guard active and correctly triggered (`redirect_blocked`), robots.txt policy unaffected (crawl never got far enough to need it), TLS validation never bypassed.
- [x] No outreach message created (crawl fetched 0 pages, so draft creation never triggered), no template copy generated (withheld by design), no log entry recorded, no send of any kind.
- [x] No WhatsApp API or e-mail provider send invoked — none exist in this codebase and none were called.
- [x] No secret value (API key, service role key, DB URL) was printed, logged, or written to this document, any artifact, or the scratchpad diagnostic script.
- [x] No file under `app/`, `components/`, `lib/`, or `scripts/` was modified — only this doc was created. (The scratchpad read-only diagnostic script used to fetch the crawl job's `errorCode` lives outside the repository, in the session scratchpad directory, and was never committed.)

## 18. Limitations Found

1. **Neither the operational report nor the human review pack surfaces `crawl_jobs.error_code`.** Both show `crawlStatus: "failed"` and page counts, but not *why* — an operator has to already know to query `CrawlRepository.getCrawlJob` directly (no CLI wraps this single-job read) to learn it was specifically `redirect_blocked` rather than a TLS/DNS/timeout failure. This compounds the already-documented limitation in `docs/technical/crawler-job-error-reason-fix.md` (TLS vs. generic errors still collapse at the score-evidence level — see also point 1a below) with a second, distinct gap: even the *job-level* error code, which IS specific, never reaches operator-facing output.
   - 1a. At the score-evidence level, `redirect_blocked` and every other 0-page failure cause collapse into the same generic `unreachable_generic` text ("possível falha de conexão, DNS, certificado/TLS ou timeout") — `recalculate-score.ts` only special-cases `robots_denied` distinctly; every other `errorCode` (including the now-specific `redirect_blocked`) is not passed through to the score evidence at all.
2. **`--include-existing` did not catch a real duplicate.** "Skinlaser Dermatologia Médica Ltda - Moema" (`http://www.skinlaser.com.br/`) is almost certainly the same business as the already-promoted "SkinLaser - Higienópolis" (`https://www.skinlaser.com.br/`), but the dedupe key differs by URL scheme (`http` vs `https`) and possibly by normalization details, so `findClinicByDedupeKey` found no match. The candidate review CLI's live dedupe check is only as good as the underlying dedupe key's normalization — this is a real, actionable gap worth a dedicated follow-up (e.g. normalizing scheme before computing the dedupe key).
3. **Screenshot capture is not guaranteed to respect the same redirect-target restriction as the text-crawl path.** The text-crawler's `fetchHtmlPage` re-validates every redirect hop against the SSRF/approved-domains guard and correctly refused this redirect (`redirect_blocked`). Screenshot capture (`lib/crawler/screenshot-capture.ts`) only validates the *initial* URL before Playwright begins navigation — the code's own comment confirms this ("Already validated as a safe, public, allowlisted URL by the caller"), but a real browser natively follows HTTP redirects, and nothing in this pipeline re-validates the redirect *target* against the same allowlist during that browser navigation. In this run the practical exposure was minimal (no storage bucket configured, so nothing was uploaded), but the architectural asymmetry is real: screenshot capture could silently render content from a domain outside `--approved-domains` that the text-crawl path would have refused. Worth a dedicated security review before this matters at scale.
4. **No CLI exists to fetch a single crawl job's full record read-only.** This forced use of a one-off, scratchpad-only diagnostic script (not committed) to read `crawl_jobs.error_code` for this documentation. A small, read-only `crawler:crawl-job:show --crawl-job-id <id>` CLI (same read-only pattern as `list-candidates.ts`) would close this gap cleanly.

## 19. Recommendation for Next Run

1. Prioritize fixing Limitation 1 (surface `error_code`/`error_message` in the operational report and review pack) and Limitation 1a (pass the specific `errorCode` through to score evidence, not just `robots_denied`) — both are small, additive, and would have saved real diagnostic time in this run.
2. Consider normalizing URL scheme (and trailing slash/`www.`) before computing a candidate's/clinic's `dedupeKey`, to close Limitation 2 — otherwise `--include-existing` will keep missing real duplicates discovered under a different scheme.
3. Treat Limitation 3 (screenshot capture's redirect-target exposure) as a security-review follow-up, not a blocker for continued staging use — but do not enable `SCREENSHOT_STORAGE_BUCKET` in a real commercial run until it's addressed, since a stored screenshot of an unintended redirect target would be a real, retrievable artifact instead of today's harmless `pending_storage` no-op.
4. For the next single-prospect rehearsal, either retry a fresh query/location to get a clean successful crawl end-to-end (to validate the *happy path* through review decision → manual outreach packet → rehearsal log, which neither v1 nor v2 has exercised yet), or deliberately pick a clinic candidate to specifically exercise the `needs_changes` review-decision path with genuinely-collected (not zero-page) evidence.
5. Consider the small read-only `crawler:crawl-job:show` CLI from Limitation 4 as a lightweight, low-risk addition alongside the candidate review CLI.
