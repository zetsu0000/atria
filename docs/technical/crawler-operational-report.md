# Crawler operational report — "Raio-X da Primeira Impressão Digital"

> First operational report generator for Atria. Read-only: builds a
> structured report from already-persisted clinic/crawl/score/screenshot/
> extraction/outreach data. **Never crawls, never calls an external API,
> never sends anything.** Always human-review material — `reviewRequired`
> is always `true`, and `status` is only ever `"draft"` or
> `"incomplete_report"`, never anything resembling "sent" or "approved for
> commercial use."

## New files

```
lib/operations/report/
  types.ts                               — OperationalReport shape
  build-operational-report.ts            — read + combine + build (no side effects)
  render-operational-report-markdown.ts  — pure, deterministic Markdown rendering

lib/operations/operational-report.test.ts — 14 tests (see "Tests" below)

scripts/crawler/generate-operational-report.ts — CLI

docs/technical/crawler-operational-report.md — this document
```

Also touched (small, additive):

- `lib/operations/repositories/crawl-repository.ts` /
  `lib/operations/repositories/fakes.ts` /
  `lib/operations/supabase/crawl-repository.supabase.ts` — two new
  read-only methods needed to build a report from just a clinic id:
  `getLatestCrawlJobForClinic(clinicId)` and
  `listAssetsForCrawlJob(crawlJobId)`. Neither writes anything; both are
  plain `SELECT`s against the existing `crawl_jobs` / `scan_assets` tables
  — no migration.
- `package.json` — new `crawler:report` script.
- `.gitignore` — added `/artifacts/reports/` (same pattern as the existing
  `/artifacts/crawler/` entry) so `--write-artifact` output is never
  committed.

## Report format

Both formats are built from the exact same `OperationalReport` object
(`lib/operations/report/types.ts`) — Markdown is a pure formatting pass
over it, JSON is the object itself. Nothing is computed differently between
the two.

### Required sections (all present, in this order)

1. Identidade da clínica
2. Origem/proveniência
3. Website analisado
4. Resumo do score
5. Dimensões do score (Credibilidade, Clareza, Mobile, Conversão/Contato e
   ação, Atualização)
6. Evidências por dimensão
7. Screenshots (homepage desktop + mobile)
8. Resumo de conteúdo/contatos extraídos
9. Principais problemas de apresentação digital
10. Ângulo de melhoria sugerido
11. Rascunho de outreach
12. Checklist de revisão humana
13. Aviso obrigatório (disclaimer, verbatim, repeated at both the top and
    the bottom of the Markdown rendering)

## CLI

```
npm run crawler:report -- --target local --clinic-id <id>
npm run crawler:report -- --target staging --clinic-id <id> --crawl-job-id <id> --output json
npm run crawler:report -- --target local --clinic-id <id> --allow-incomplete --write-artifact
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--target local\|staging` | Yes | No `--dry-run` mode exists for this command — the report reads *existing* persisted data, so there's nothing to fake against. Refused exactly like every other controlled-pipeline command if it (or the resolved `SUPABASE_URL`) would touch production — see `lib/operations/pipeline/target-guard.ts`, reused as-is. |
| `--clinic-id <id>` | Yes | Refused immediately if omitted. |
| `--crawl-job-id <id>` | No | Defaults to the clinic's most recently created crawl job (`getLatestCrawlJobForClinic`). |
| `--output markdown\|json` | No (default `markdown`) | |
| `--write-artifact` | No | Also writes the rendered output to `artifacts/reports/<clinicId>.{md,json}` — gitignored, local only. Never uploaded, never made public. |
| `--allow-incomplete` | No | See "Handling of missing score" below. |

## Handling of missing screenshots

Non-fatal, always. If a desktop or mobile `scan_assets` row isn't found for
the resolved crawl job, that viewport's `screenshots.<viewport>.status` is
`"missing"` and a note is added to `warnings`. If a row exists but capture
or upload previously failed (see
`docs/technical/crawler-screenshot-score-assets.md`), the report surfaces
the real `metadata.captureStatus` (`capture_failed` / `storage_failed` /
`pending_storage`) instead of pretending it succeeded.

## Handling of missing score

The only **hard-fail** condition. `buildOperationalReport` returns
`{ ok: false, reason: "missing_score", ... }` unless `allowIncomplete` is
passed, in which case it still builds the full report with
`status: "incomplete_report"`, `scoreSummary.available: false`, and a
`warnings` entry. Every other missing input (crawl job, screenshots,
extracted content, outreach draft) is always non-fatal — the report is
still generated with the affected section marked unavailable/missing.

## How the disclaimer is enforced

`report.disclaimer` is always set from `lib/score/calculate.ts`'s exported
`SCORE_DISCLAIMER` constant — the report never has its own copy of the
string. This means the score module and the report can never drift out of
sync; the exact required text —

> "Esta análise avalia apenas a apresentação digital e a facilidade de
> encontrar informações. Não avalia qualidade médica."

— is guaranteed present in both `status: "draft"` and
`status: "incomplete_report"` reports (tested explicitly), and is rendered
twice in the Markdown output (top banner + section 13) so it can't be
missed by a scrolling reviewer.

## Never invents claims; never evaluates medical quality

- **Section 9 (main issues)** is derived only from dimensions scoring below
  a fixed threshold (12/20), quoting that dimension's own first recorded
  evidence reason — never a new claim.
- **Section 10 (improvement angle)** picks one of five fixed, generic,
  hedged sentences (one per dimension, e.g. *"Considerar destacar canais de
  contato... de forma mais visível"*) keyed to the single lowest-scoring
  dimension — never a specific factual assertion about the clinic (no
  invented services, credentials, or outcomes).
- **Section 8 (extracted content)** only ever lists what
  `lib/crawler/extract-candidates.ts` actually extracted from the public
  page (phone/email/whatsapp/social candidates with their real source
  URL and confidence) — nothing is added or embellished.
- **Section 12 (human review checklist)** explicitly instructs the human
  reviewer not to add CRM, RQE, credentials, testimonials, awards, or
  medical claims that aren't already in the evidence — reinforcing the
  same rule at the point of human handoff.
- There is no "medical quality" field anywhere in `OperationalReport`, and
  nothing in the codebase computes one — `calculatePlaceholderScore`
  (reused, unmodified by this task) only ever scores digital presentation
  and findability.

## Tests

`lib/operations/operational-report.test.ts` (14 tests; kept at
`lib/operations/*.test.ts` rather than the suggested nested
`lib/operations/report/build-operational-report.test.ts` path — the same
established workaround as every other test file in this repo, since
`package.json`'s `test` script (`tsx --test lib/**/*.test.ts`) only expands
one directory level under a non-globstar shell):

1. Complete report: clinic + crawl job + score + both screenshots +
   extracted content + outreach draft, all combined correctly.
2. Missing screenshots still produce a full report with
   `status: "missing"` per viewport and matching `warnings`.
3. Missing score fails by default (`reason: "missing_score"`).
4. `--allow-incomplete` (`allowIncomplete: true`) produces
   `status: "incomplete_report"` instead of failing; also covers the
   no-crawl-job-at-all case.
5. Disclaimer is always the exact required string, in both complete and
   incomplete reports, and matches `SCORE_DISCLAIMER` by reference.
6. No medical-quality field or claim anywhere in the report.
7. No invented claims/testimonials/awards/credentials/outcomes appear in
   any data section (the human-review checklist's own warnings against
   these terms are explicitly excluded from that check, since naming a
   term to warn against it isn't the same as attributing it to the
   clinic).
8. Outreach section always reflects `status: "draft"` and
   `reviewRequired: true`; the underlying `outreach_messages` row is
   never anything but `draft`.
9. Production is refused via the same `target-guard.ts` gate reused from
   the controlled pipeline.
10. Markdown rendering is deterministic (same input → identical output,
    verified twice) and contains all 13 required section headings in
    order, plus the disclaimer text.
11. JSON report shape is stable — every top-level key present, the five
    score dimensions in the fixed order, and the object round-trips
    through `JSON.stringify`/`JSON.parse` without losing any key.
12. No external API call — verified by monkey-patching `globalThis.fetch`
    to throw if called; `buildOperationalReport` only reads from the
    injected repositories.

## Known limitations / next steps

- No preview/UI surface for this report yet — it's CLI/Markdown/JSON only,
  matching this track's "no UI changes" boundary.
- `--crawl-job-id` resolution picks the single most recent crawl job; if a
  clinic has multiple independent scan histories that need comparing, a
  future `--list-crawl-jobs`-style command would be a reasonable follow-up.
- The "main issues" / "improvement angle" heuristics are placeholder-v0,
  same caveat as `calculatePlaceholderScore` itself — calibration is a
  known future step, not attempted here.
