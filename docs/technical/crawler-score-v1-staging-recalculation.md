# Score v1 staging recalculation — SkinLaser

Recalculates and persists a score-v1 score for the existing SkinLaser
real crawl data (`docs/technical/crawler-score-calibration-v1.md`),
purely from already-persisted data — **no new crawl was performed.**
Regenerates the operational report and human review pack from that new
score. The existing `needs_changes` review decision and all outreach
drafts were deliberately left unchanged.

## Code changed (and why)

One small, well-justified addition: `scripts/crawler/recalculate-score.ts`
(+ `npm run crawler:recalculate-score`). No existing CLI recomputes a
score from already-persisted extraction/screenshot data without
re-crawling — `process-crawl-queue.ts --crawl-job-ids` *resumes* a job by
re-running the actual bounded crawl loop, which is explicitly not wanted
here ("do not crawl"). The new script:

1. Fetches the clinic, the target crawl job (latest by default), its
   latest `extracted_content`, and its `scan_assets`.
2. Calls `calculatePlaceholderScore` (score-v1 internals, per
   `docs/technical/crawler-score-calibration-v1.md`) with the real
   persisted candidates, `pageCount` from the crawl job's own
   `pagesFetched`, real screenshot presence (excluding `capture_failed`,
   matching the existing convention), and the crawl job's real
   `requestedUrl` for the HTTPS check.
3. Persists the result via the existing `scoreRepo.saveScore` — no new
   table, no migration.

No test file was added, consistent with every other thin CLI wrapper in
`scripts/crawler/` (none have their own test file — the underlying
`calculatePlaceholderScore`/`calculateScoreV1` logic this script calls
already has 15+ dedicated tests).

## Clinic and crawl job used

- **Clinic:** SkinLaser - Higienopolis, `bbfd72a3-a013-4a6c-bd82-4a70479d694a`
- **Crawl job:** `81a7b754-e9d9-40d7-b89d-83f1ca2c53a4` (the most recent
  one — `status: partial`, 1 page fetched, from the screenshot-compression
  rehearsal, `docs/technical/crawler-screenshot-compression.md`, where
  both desktop and mobile screenshots uploaded successfully)

## Old score (before this task)

`placeholder-v0`, total **68/100**, computed at the time of the original
crawl — same underlying evidence, older/looser scoring rules (e.g. a
40%-of-max unconditional Atualização baseline, a boolean-only Mobile
check with no WhatsApp/page-count subcriteria breakdown).

## New score v1 (this task)

New row `12fd6a90-2131-4707-8ef4-796c93867afd`, `scoring_version: "v1"`,
total **80/100** — independently re-verified by direct REST query,
matching the CLI's own output exactly.

### Dimension scores

| Dimension | v0 (previous) | v1 (this task) | Max |
| --- | --- | --- | --- |
| Credibilidade | — | **20** | 20 |
| Clareza | — | **20** | 20 |
| Mobile | — | **16** | 20 |
| Conversão/Contato e ação | — | **12** | 20 |
| Atualização | — | **12** | 20 |
| **Total** | 68 | **80** | 100 |

(v0 didn't expose a comparable per-dimension breakdown at this level of
granularity in this document's prior rehearsals — the meaningful
comparison is the total, and the new evidence-level rationale below.)

Real evidence behind each v1 dimension score (51 real extracted
candidates from the actual SkinLaser homepage were used):

- **Credibilidade (20/20):** site acessível (+6), HTTPS válido (+4,
  `https://www.skinlaser.com.br/`), título institucional (+4), contato
  encontrado (+3), conteúdo institucional/serviços (+3).
- **Clareza (20/20):** headings (+5), serviços/especialidades (+5), meta
  description (+4), conteúdo textual (+4), navegação interna (+2).
- **Mobile (16/20):** screenshot mobile capturado com sucesso (+10,
  asset `7893b541-...`), WhatsApp presente (+6). The remaining 4 points
  (multi-page bonus) weren't earned because this crawl job was bounded
  to `max-pages 1` — correct, not a bug.
- **Conversão/Contato e ação (12/20):** telefone/WhatsApp (+8), e-mail
  (+4). No contact-page or scheduling-link candidates were found among
  the single page's links (both those subcriteria require a
  `page_link` candidate, and only 1 page was fetched).
- **Atualização (12/20):** conservative baseline (+4), social presence
  found (+8, Instagram/Facebook/YouTube/TikTok links present). No
  multi-page bonus for the same reason as Mobile.

## Screenshot/storage status (unchanged by this task, re-confirmed)

- Desktop: `captured`, asset `2340159e-695f-4365-9695-f226bb031581`,
  real `storage_path` in the private `crawler-screenshots` bucket.
- Mobile: `captured`, asset `7893b541-7829-484b-892a-673d3f163c21`,
  real `storage_path`.
- Both referenced correctly in the new score's evidence (asset IDs
  quoted verbatim) and in the regenerated report/pack.

## Report regeneration result

```
npm run crawler:report -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output markdown --write-artifact
npm run crawler:report -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output json --write-artifact
```

Both regenerated successfully, written only to the gitignored
`artifacts/reports/bbfd72a3-a013-4a6c-bd82-4a70479d694a.{md,json}`
(overwriting the prior, v0-based report for the same clinic — filenames
are keyed by clinic, not by score/crawl-job version). "Resumo do score"
now shows **80/100**, `scoring_version: v1`. Zero warnings.

## Review pack regeneration result

```
npm run crawler:review-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output markdown --write-artifact
npm run crawler:review-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output json --write-artifact
```

Both regenerated successfully, written only to the gitignored
`artifacts/review-packs/bbfd72a3-a013-4a6c-bd82-4a70479d694a.{md,json}`.
`scoreSummary.scoringVersion: "v1"`, total 80/100. Risk flags unchanged
in kind (`crawl_partial` — medium, `requires_human_review` — info) since
neither depends on the score version. The suggested WhatsApp draft was
generated fresh again (no persisted WhatsApp draft exists), same as
prior rehearsals — this task didn't change that behavior.

## Review decision: unchanged (as required)

Per instruction, the existing decision was **not** touched. Re-confirmed
by direct query after all of the above: still exactly one row,
`a769b0ea-3739-4f4d-80ab-2c8000a7e596`, `decision: "needs_changes"`,
`reviewer: "Atria QA"`, same original `reviewed_at`
(`2026-07-22T13:16:49Z`) — recalculating the score did not create,
modify, or supersede any review decision. A fresh decision reflecting
the new v1 score is a deliberate, separate, future human action, not
something this task performs automatically.

## Outreach: remains draft (confirmed)

All 4 `outreach_messages` rows for this clinic re-queried directly after
this task's changes — every one still `status: "draft"`. Nothing was
sent, approved, or otherwise transitioned.

## Retained staging rows (no cleanup — retained for inspection)

Everything from every prior rehearsal remains untouched, plus:

| Table | New row this round |
| --- | --- |
| `scores` | `12fd6a90-2131-4707-8ef4-796c93867afd` (`v1`, total 80) |

No other table gained or lost rows — `human_review_decisions`,
`outreach_messages`, `crawl_jobs`, `scan_assets`, `extracted_content`,
`clinics` are exactly as documented in prior rehearsal docs.

## Verification

- `npm test` — 311/311 passing (unchanged — no test file added, matching every other thin CLI wrapper's convention).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed — the new score was computed entirely from already-persisted `extracted_content`/`scan_assets`/`crawl_jobs` rows; zero new network requests to any clinic website.
- No Google Places/SERP call was made.
- No outreach was sent — all 4 outreach drafts re-confirmed `status: "draft"` after this task's changes.
- No secrets were stored in any file, log, or this document.
