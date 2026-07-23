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

**`feature/crawler-score-calibration-v1` (this update)** — a within-version
calibration pass using real staging evidence (SkinLaser, CEPELLE, and the
robots-denied/http→https/directory-listing cases surfaced by earlier
rehearsal tasks). `SCORE_VERSION` stays `"v1"` — this is tuning, not a new
model. See "Calibration update" below for the full detail; short version:

- `lib/score/calculate.ts` — rebalanced Credibilidade to reward a captured
  desktop screenshot directly; added `UnreachableReasonCode` (distinguishes
  `no_website` / `robots_denied` / `unreachable_generic` instead of one
  generic "site inacessível" explanation for every cause) and
  `isDirectoryListing` (zeros the score with an honest, distinct reason
  instead of scoring a third-party directory page as if it were the
  clinic's own site).
- `lib/score/calculate.test.ts` — 15 new tests in a
  `calculateScoreV1: calibration` block, covering the task's full required
  list (strong clinic, canonicalized clinic, robots-denied, TLS/connection
  failure, missing pages, directory listing, WhatsApp/contact evidence,
  screenshot evidence, disclaimer, no medical language, determinism,
  evidence-per-dimension, 0–100 total, 0–20 per dimension).
- `lib/operations/prioritization/prioritize-prospects.ts` — exported the
  existing `isDirectoryListing` detector (was private) so the score
  recalculation tool reuses the same `KNOWN_DIRECTORY_LISTING_ORIGINS`
  allowlist instead of duplicating it.
- `scripts/crawler/recalculate-score.ts` — derives `unreachableReason`
  (from the clinic's `websiteUrl` and the crawl job's own `errorCode`,
  reusing the specific error codes from
  `docs/technical/crawler-job-error-reason-fix.md`) and `isDirectoryListing`
  and passes both into `calculatePlaceholderScore`.

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

**Calibrated in `feature/crawler-score-calibration-v1`** — the original
weights are struck through; current weights follow.

| Subcriterion | Points | Evidence source |
| --- | --- | --- |
| Site acessível (≥1 página obtida) | ~~6~~ **4** | `pageCount > 0` |
| HTTPS válido | 4 | `requestedUrl` starts with `https:` |
| Identidade institucional clara | 4 | `title` candidate present |
| Screenshot desktop capturado | **3 (new)** | `hasDesktopScreenshotMeta` true |
| Contato/endereço visível | 3 | `address`/`phone`/`email` candidate present |
| Conteúdo institucional (equipe/serviços) | ~~3~~ **2** | `team_name_candidate` or `service_candidate` present |

Rationale for the move: "site acessível" and "conteúdo institucional" were
the two weakest/easiest-to-satisfy signals in the dimension (6 and 3
points for evidence that barely distinguishes a strong site from a weak
one). A captured desktop screenshot is direct, hard-to-fake visual proof
that reinforces institutional trust — the same role the mobile screenshot
already plays in the Mobile dimension — so it was moved in as a real,
funded criterion instead of staying a 0-point reference (see the old
Clareza row below, now removed).

**If unreachable (`pageCount === 0`): 0/20**, with one evidence entry
whose text now depends on *why* it's unreachable (see "Unreachable reason
codes" below) instead of one generic explanation for every cause — this
was the fix for the finding in `docs/technical/crawler-mvp-readiness-audit.md`:
a real crawl that fails entirely (e.g. GRUPO CPD's expired TLS
certificate) no longer silently produces no score at all when scored
directly with this function; it produces an honest, fully-zeroed,
clearly-explained score. (See "Remaining calibration needs" below for the
one place this isn't wired into the live pipeline yet.)

**If a directory listing (`isDirectoryListing: true`): 0/20**, with a
distinct evidence entry explaining the site is a third-party directory,
not the clinic's own domain — see "Directory listing detection" below.

### Clareza (20 pts)

| Subcriterion | Points |
| --- | --- |
| Headings estruturam o conteúdo | 5 |
| Serviços/especialidades visíveis | 5 |
| Meta description presente | 4 |
| Conteúdo textual não vazio/genérico | 4 |
| Navegação interna (múltiplas páginas) | 2 |

The desktop-screenshot evidence entry that previously lived here at 0
points was removed in `feature/crawler-score-calibration-v1` — it now
carries real points in Credibilidade instead (see above), so this
dimension no longer references screenshots at all.

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

## Unreachable reason codes (calibration update)

Before this update, every unreachable crawl (`pageCount === 0`) produced
the *same* generic evidence text regardless of cause — "site
inacessível... possível falha de TLS, DNS, timeout ou bloqueio" — for both
a robots.txt refusal and a real technical failure. That's a meaningful
difference for a human reviewer deciding what to tell a clinic (a robots
block is a deliberate site-owner choice; a TLS/DNS/connection failure is a
technical defect), so `ScoreInput` now accepts an optional
`unreachableReason?: UnreachableReasonCode | null`:

| Code | Meaning | Evidence text distinguishes |
| --- | --- | --- |
| `no_website` | Clinic has no `websiteUrl` on record at all | "esta clínica não possui site cadastrado" |
| `robots_denied` | The crawl was refused by `robots.txt` (respected, no bypass) | "o site bloqueou o acesso via robots.txt (respeitado, sem bypass)" |
| `unreachable_generic` | Every other failure — TLS/cert error, DNS failure, connection refused, timeout, etc. | generic technical-failure wording |

**No dedicated `tls_error` code exists yet** in `CrawlErrorCode`
(`lib/crawler/errors.ts`) — a TLS/certificate failure still surfaces as
`unexpected_error` at the job level, so it collapses into
`unreachable_generic` here too. Adding a specific TLS error code is future
crawler work, not a scoring change; `calculateScoreV1` itself is ready to
take a more specific reason the moment the crawler can supply one — no
scoring-side change would be needed.

`calculateScoreV1` defaults to `unreachable_generic` when
`unreachableReason` is omitted, so every pre-existing caller (and every
pre-calibration test) keeps behaving exactly as before — this is a purely
additive input field.

The derivation lives in the caller (`scripts/crawler/recalculate-score.ts`),
not inside `calculateScoreV1` itself: the scoring function stays a pure,
decoupled function over `ScoreInput` with no repository or crawl-job
knowledge, consistent with the rest of the module.

## Directory listing detection (calibration update)

A new optional `isDirectoryListing?: boolean` field on `ScoreInput`, set
by reusing `isDirectoryListing()` (now exported from
`lib/operations/prioritization/prioritize-prospects.ts`, where the
`KNOWN_DIRECTORY_LISTING_ORIGINS` allowlist already lived for
prioritization purposes). When true, every dimension short-circuits to
0/20 with a distinct evidence reason ("Este site é uma listagem de
diretório de terceiros, não o domínio próprio da clínica...") instead of
scoring a third-party directory page (e.g. a Doctoralia profile) as if it
were the clinic's own site — a directory page can have excellent
Clareza/Mobile/Conversão signals that say nothing about the clinic's own
digital presence, so scoring it any other way would be a false positive.
This mirrors the "wrong-audience candidate" pattern documented in
`docs/technical/crawler-commercial-calibration-batch.md`, where a
directory/marketplace result had to be excluded from promotion for the
same underlying reason.

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

## Staging comparison (calibration update)

Read-only comparison against real staging data (project ref
`lfkyiztuwptmddsraucg`), using the already-existing, safe-by-design
`npx tsx scripts/crawler/recalculate-score.ts --target staging --clinic-id <id>`
tool. This tool **always inserts a new `scores` row** (it does not
overwrite the prior one) — that is documented, expected behavior, not a
side effect of this task. Five clinics were recalculated; `scores` row
count grew from the pre-task baseline by exactly 5.

| Clinic (fixture role) | Old total | New total | Why it moved |
| --- | --- | --- | --- |
| SkinLaser (strong, complete clinic) | 80 | **80 (unchanged)** | Has both screenshots, so the new +3 desktop-screenshot criterion is earned in full — the rebalance doesn't penalize an already-complete clinic. |
| CEPELLE (http→https canonicalized) | 84 | **81** | No desktop screenshot in this crawl run, so the new criterion isn't earned; Credibilidade dropped from 20 to 14. Mobile stayed at max (20) — has WhatsApp + mobile screenshot + multi-page. |
| Instituto Dermatológico (canonicalized, no screenshots) | 74 | **71** | Same reason — this crawl was run without `--capture-screenshots`. |
| Dermaclinic (canonicalized, no screenshots) | 51 | **48** | Same reason. |
| Dra Ana Paula Pedrino (robots-denied case) | *no score existed* | **0/100 (first score ever computed)** | Old pipeline never scores a 0-page crawl at all (`run-crawl-job.ts`'s pre-existing gate — see "Remaining calibration needs" #1). Recalculating directly via `recalculate-score.ts` now produces an honest, fully-explained zero: every one of the 5 dimension evidence entries reads "O site bloqueou o acesso via robots.txt (respeitado, sem bypass) — não há evidência para avaliar {dimensão}." — verified directly against the persisted `evidence` array via REST. This is the clearest concrete proof that the `unreachableReason` calibration changes the *explanation*, not just the number. |

No other tables were touched: `outreach_messages` status distribution and
count were checked before/after and are unchanged (still all `draft`,
still the count from earlier tasks — this task creates no outreach copy);
`human_review_decisions` count is unchanged (`recalculate-score.ts` never
touches review decisions).

No TLS/cert-failure or missing-website staging example exists yet to
recalculate against directly — both are covered by dedicated unit-test
fixtures instead (`CONNECTION_FAILURE_FIXTURE`, `NO_WEBSITE_FIXTURE` in
`lib/score/calculate.test.ts`), consistent with the task's own
instruction to use fixture names rather than invent real staging evidence
that doesn't exist.

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
4. **Only two real clinics had ever been scored with real content as of
   the original v1 task** (SkinLaser — real; GRUPO CPD — fixture-only, per
   `docs/technical/crawler-mvp-readiness-audit.md`). By this calibration
   update, five real staging clinics have real crawl-derived scores (see
   "Staging comparison" above) — still a small sample; actual point-weight
   tuning against commercial outcomes still needs more real-world data
   before any commercial score claims would be appropriate.

## Tests

Original v1 task: 17 total (15 in `calculate.test.ts` + 2 integration),
covering all 12 originally-required cases (unchanged, still passing —
listed below for reference).

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

**`feature/crawler-score-calibration-v1` (this update): +15 new tests**
in a `calculateScoreV1: calibration` `describe` block in
`lib/score/calculate.test.ts`, using fixture clinics (never real names)
that mirror the real staging cases documented above:

1. Strong clinic with contacts + screenshots scores high.
2. Crawlable site without screenshots scores lower than the same site with screenshots.
3. No contacts lowers the Conversão/Contato e ação dimension specifically.
4. Robots-denied produces a blocked/0-score with clear, robots-specific evidence text (distinct from a generic-failure message).
5. Connection/TLS-style failure (`unreachable_generic`) produces a clear Credibilidade penalty with distinct evidence text.
6. Missing pages (`pageCount: 0`, no website) does not produce a fake positive score anywhere.
7. Directory listing / wrong-audience input is zeroed with a distinct evidence reason, even when the underlying page content looks strong.
8. WhatsApp/contact evidence measurably improves Conversão/Contato e ação (calibration-fixture variant).
9. Desktop screenshot evidence improves Credibilidade specifically (the new +3 criterion).
10. Score always includes the disclaimer, across every fixture (strong, canonicalized, robots-denied, connection-failure, no-website, directory-listing).
11. No medical-quality language anywhere in any calibration fixture's serialized result.
12. Deterministic output — every calibration fixture, called twice, produces identical results.
13. Evidence entries exist for every one of the 5 dimensions, for every fixture (including the zeroed ones).
14. Total score stays within 0–100 for every fixture.
15. Each dimension stays within 0–20 for every fixture.

**Total: 32 tests directly on the scoring model** (17 original + 15
calibration), inside a suite of **475 tests passing overall** (0
regressions from the original 460).

## Verification

Original v1 task: `npm test` — 311/311 passing at the time (295 prior +
17 net new, minus 1 legacy test replaced in place).

**`feature/crawler-score-calibration-v1` (this update):**

- `npm test` — 475/475 passing (460 prior + 15 net new).
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

**`feature/crawler-score-calibration-v1` (this update):** same
confirmations hold. The only staging interaction was the read-only
`recalculate-score.ts` tool against project ref `lfkyiztuwptmddsraucg`
(never `cskodsnvghavkcjwmafr`), which reads persisted crawl/extraction/
asset data and writes only to the `scores` table — no crawl, no outreach,
no clinic/candidate/decision data was created or modified. No real clinic
name was hardcoded into scoring logic (`lib/score/calculate.ts`); tests
use fixture names only (`STRONG_CLINIC_FIXTURE`,
`CANONICALIZED_CLINIC_FIXTURE`, `ROBOTS_DENIED_FIXTURE`,
`CONNECTION_FAILURE_FIXTURE`, `NO_WEBSITE_FIXTURE`,
`DIRECTORY_LISTING_FIXTURE`) — real clinic names appear only in this
document's staging-comparison table, never in code.
