# Score calibration v1

Replaces `placeholder-v0` with a deterministic, evidence-referenced
`v1` scoring model for the "Raio-X da Primeira Impressão Digital." The
score remains, and will always remain, about **digital presentation
only** — the required disclaimer is schema-enforced (a Zod literal, not
a default), so no code path can omit or alter it:

> "Esta análise avalia apenas a apresentação digital e a facilidade de
> encontrar informações. Não avalia qualidade médica."

## Files changed

- `lib/score/calculate.ts` — the model itself (rewritten internals; see "Backward compatibility" below for why the public function name was kept).
- `lib/score/calculate.test.ts` — replaced with 15 tests covering the v1 model directly.
- `lib/operations/run-crawl-job.ts`, `lib/operations/pipeline/process-crawl-queue.ts`, `scripts/crawler-fixture.ts` — pass `requestedUrl` through so the new Credibilidade "HTTPS válido" subcriterion has real data to check.
- `lib/operations/repositories-fakes.test.ts` — one assertion updated from the literal `"placeholder-v0"` to `"v1"` (the only test anywhere in the codebase that asserted on that exact string).
- `lib/operations/operational-report.test.ts`, `lib/operations/human-review-pack.test.ts` — two tests added confirming the score version flows through to both reports automatically.
- `docs/technical/crawler-score-calibration-v1.md` — this document.

**No migration was needed.** The physical `scores` table (flat
`credibility`/`clarity`/`mobile`/`actionability`/`freshness`/`total`
columns) is unchanged — the richer v1 shape is a computation-time
representation, adapted to the existing schema by a small, pure
conversion function. See "Backward compatibility."

## Scoring model

Two layers, both in `lib/score/calculate.ts`:

1. **`calculateScoreV1(input: ScoreInput): ScoreV1Result`** — the new
   primary API. Returns exactly the shape requested:
   ```ts
   {
     version: "v1",
     totalScore: number,       // 0-100
     maxScore: 100,
     dimensions: [
       { key, labelPt, score, max: 20, rationale },  // × 5
     ],
     evidence: ScoreEvidence[],  // unchanged shape: { dimension, points, reason, sourceUrl? }
     warnings: string[],
     disclaimer: string,
   }
   ```
2. **`scoreV1ToDigitalScore(result: ScoreV1Result): DigitalScore`** —
   adapts that rich shape onto the existing flat, persistable
   `DigitalScore` (unchanged Zod schema, unchanged DB columns).

Every dimension is fully deterministic: identical input always produces
identical output (tested directly — `calculateScoreV1` called twice on
the same input is asserted `deepEqual`, including at the JSON level).

## Dimension criteria (5 × 20 = 100)

### Credibilidade (20 pts)

| Subcriterion | Points | Evidence source |
| --- | --- | --- |
| Site acessível (≥1 página obtida) | 6 | `pageCount > 0` |
| HTTPS válido | 4 | `requestedUrl` starts with `https:` |
| Identidade institucional clara | 4 | `title` candidate present |
| Contato/endereço visível | 3 | `address`/`phone`/`email` candidate present |
| Conteúdo institucional (equipe/serviços) | 3 | `team_name_candidate` or `service_candidate` present |

**If unreachable (`pageCount === 0`): 0/20**, with one clear evidence
entry — this is the fix for the finding in
`docs/technical/crawler-mvp-readiness-audit.md`: a real crawl that fails
entirely (e.g. GRUPO CPD's expired TLS certificate) no longer silently
produces no score at all when scored directly with this function; it
produces an honest, fully-zeroed, clearly-explained score. (See
"Remaining calibration needs" below for the one place this isn't wired
into the live pipeline yet.)

### Clareza (20 pts)

| Subcriterion | Points |
| --- | --- |
| Headings estruturam o conteúdo | 5 |
| Serviços/especialidades visíveis | 5 |
| Meta description presente | 4 |
| Conteúdo textual não vazio/genérico | 4 |
| Navegação interna (múltiplas páginas) | 2 |

Plus a 0-point evidence entry referencing the desktop screenshot asset,
when one exists (unchanged from v0 — visual review stays a human's job).

### Mobile (20 pts)

| Subcriterion | Points |
| --- | --- |
| Screenshot mobile capturado com sucesso | 10 |
| WhatsApp (canal mobile-first) presente | 6 |
| Múltiplas páginas acessíveis | 4 |

A missing or failed mobile capture costs the 10-point baseline but never
fails the computation — the dimension still returns a valid 0-20 score.
**No true responsive-design signal** (e.g. a viewport meta tag) exists
in the extraction pipeline yet — see "Remaining calibration needs."

### Conversão / Contato e ação (20 pts)

| Subcriterion | Points |
| --- | --- |
| Telefone ou WhatsApp visível | 8 |
| E-mail visível | 4 |
| Link para página de contato | 4 |
| Link de agendamento/marcação | 4 |

### Atualização (20 pts)

| Subcriterion | Points |
| --- | --- |
| Nota conservadora (sem data real disponível) | 4 |
| Múltiplas páginas acessíveis (indício estrutural) | 8 |
| Presença social ativa (indício, não prova) | 8 |

This is deliberately the **most conservative** dimension: v0 defaulted
to a 40%-of-max baseline (8/20) regardless of any evidence, which is
itself a mild overclaim about something genuinely unmeasured. v1's
baseline is 20% (4/20) — the remaining 16 points are only ever earned
through actual (weak, honestly-caveated) structural evidence, never
assumed. No copyright-year or `Last-Modified` header signal exists yet
— see "Remaining calibration needs."

## Backward compatibility

`calculatePlaceholderScore` (the function name every existing call site
and ~10 test files already used) is **kept**, deliberately, rather than
renamed — it now delegates to `calculateScoreV1` +
`scoreV1ToDigitalScore` internally. This avoided a mechanical rename
across ~10 files with no behavioral benefit, while still fully
upgrading what the function actually computes. `scoringVersion` changes
from `"placeholder-v0"` to `"v1"` — the one place in the entire test
suite that asserted on the old literal string was updated.

## What score does not mean

- **Not a medical-quality assessment.** No dimension, subcriterion, or
  evidence string ever references clinical competence, treatment
  quality, or provider credentials in a quality sense — tested directly
  by scanning the full serialized result for forbidden phrasing.
- **Not a conversion, revenue, or patient-acquisition estimate.** Never
  claimed anywhere in the model.
- **Not proof of recency.** The Atualização dimension is explicit about
  this in its own evidence text ("não prova atualização") — it measures
  weak structural proxies, not verified update dates.
- **Not testimonials, awards, or credentials.** None are referenced,
  because no such extraction candidate kind exists in this pipeline —
  nothing is invented to fill the gap.
- **Not yet calibrated against real-world commercial outcomes.** See
  next section.

## How to interpret the score

Treat it as a **structured, evidence-tied internal talking point** for
a human-reviewed conversation with a clinic — not a finished, publishable
metric. Every point is traceable to a specific piece of real, extracted
evidence (or an explicit "no evidence found" for 0-point subcriteria),
visible in `evidence[]` and each dimension's `rationale`. A human
reviewer (via the review pack / review queue —
`docs/technical/crawler-human-review-report-pack.md`,
`docs/technical/crawler-review-queue.md`) is still required before any
score, report, or outreach draft is used commercially.

## Why it remains digital-presentation-only

The disclaimer is a Zod `z.literal(...)`, not a default value or a
string that happens to be set — `digitalScoreSchema` will reject any
score object where the disclaimer doesn't match exactly. There is no
code path anywhere in this scoring model (or its callers) that could
produce a score without it.

## Remaining calibration needs after v1

1. **The pipeline still only computes a score when at least one page
   was fetched.** `calculateScoreV1` itself correctly handles
   `pageCount === 0` (0/100, honestly explained) — proven directly by
   unit tests — but `run-crawl-job.ts`'s existing, separately-tested
   gate (`if (pagesFetched > 0)`) was not changed in this task, so a
   fully failed crawl (like GRUPO CPD's) still produces **no score row
   at all** in the live pipeline, not a zeroed one. Changing that gate
   would touch a currently-stable, heavily-tested code path
   (`lib/operations/run-crawl-job.test.ts`'s "marks the job failed when
   every page fails" test explicitly asserts `score === null` today) —
   deliberately left as a separate, future decision rather than bundled
   into this task.
2. **No responsive-design signal** (e.g. a `<meta name="viewport">`
   detection) exists in the extraction pipeline — Mobile's 20 points
   currently rely only on screenshot presence, WhatsApp, and page count.
   Adding a real responsive-design candidate kind is future extraction
   work, out of scope for a scoring-only task.
3. **No real freshness signal** (copyright year in visible text, HTTP
   `Last-Modified`, sitemap `lastmod`) exists — Atualização remains the
   weakest-evidence dimension by design, capped conservatively rather
   than guessed.
4. **Only two real clinics have ever been scored with real content**
   (SkinLaser — real; GRUPO CPD — fixture-only, per
   `docs/technical/crawler-mvp-readiness-audit.md`). v1 is a calibration
   **methodology** upgrade (clearer, deterministic, evidence-referenced
   subcriteria) — actual point-weight tuning against real-world outcomes
   still needs a larger sample before any commercial score claims would
   be appropriate.

## Tests (17 total: 15 in `calculate.test.ts` + 2 integration)

Covers all 12 required cases:

1. Score v1 includes `version: "v1"`.
2. Every dimension caps at max 20 (never exceeds, even with maximal evidence).
3. Total caps at max 100 (and reaches exactly 100 given a fully-evidenced input, constructed deliberately to satisfy every subcriterion).
4. Disclaimer always present, reachable or not.
5. Unreachable/TLS failure (`pageCount: 0`) scores Credibilidade — and every other dimension — at 0, with a clear reason.
6. Missing mobile screenshot penalizes Mobile but never throws.
7. WhatsApp/contact evidence measurably improves Conversão/Contato e ação.
8. No medical-quality, patient-outcome, testimonial, or award language anywhere in the serialized result.
9. Deterministic — identical input, called twice, produces byte-identical output (including a JSON round-trip).
10. Missing data (empty candidates, but reachable) handled gracefully — valid shape, no throw, honest low scores.
11. Both the operational report and the human review pack render `scoringVersion: "v1"` automatically, with zero code changes to either report layer (added as explicit tests to prove this, not just assumed).
12. JSON shape is stable — fixed top-level keys, fixed per-dimension keys, fixed dimension order, round-trips through `JSON.stringify`/`JSON.parse`.

Plus additional coverage: `scoreV1ToDigitalScore`'s adapter produces a
schema-valid, backward-compatible `DigitalScore`; `calculatePlaceholderScore`
(the kept, deprecated-but-supported name) now returns v1-caliber scores;
every pre-existing test that seeds a score via `calculatePlaceholderScore`
across ~10 other test files continues to pass unchanged, since neither
the function's name, signature, nor return type changed.

## Verification

- `npm test` — 311/311 passing (295 prior + 17 net new, minus 1 legacy test replaced in place).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed for this task — purely a scoring-model change, verified entirely by unit tests.
- No Google Places/SERP call was made.
- No outreach was sent — this task touches only score calculation and report rendering, neither of which has any send capability.
- No secrets were stored in any file, log, or this document.
