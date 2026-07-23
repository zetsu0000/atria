# Crawler Error-Code Report Surfacing

Status date: 2026-07-23

## Root Cause (from `crawler-single-prospect-operator-run-v2.md`)

During the second single-prospect rehearsal, the "Clínica High Line" crawl
job failed with a specific, already-known `error_code`:
`redirect_blocked` (the redirect-safety guard correctly refused a redirect
outside the approved domain). But the operational report, human review
pack, and score evidence all described it identically to *every other*
0-page crawl failure — generically, as "site inacessível durante o scan
(possível falha de conexão, DNS, certificado/TLS ou timeout)". An operator
had to query `CrawlRepository.getCrawlJob` directly (no CLI exposed this)
to learn the real, specific reason.

The `crawl_jobs.error_code` column has already been reasonably specific
since `docs/technical/crawler-job-error-reason-fix.md` — the gap was
entirely in *surfacing*: nothing downstream (report, review pack, score
evidence) ever read it.

## Fields Surfaced

`OperationalReport.websiteAnalyzed` and `HumanReviewPack.websiteAnalyzed`
(structurally identical) both gained four new fields, populated whenever a
crawl job exists:

- `errorCode` — the raw `crawl_jobs.error_code`, verbatim (e.g. `"redirect_blocked"`). Null when there's no error.
- `errorMessage` — the crawl job's already-safe, generic `error_message` (see `lib/crawler/errors.ts`'s `safeErrorMessage`) — never a raw exception or stack trace. Null when there's no error.
- `failureExplanation` — a new, operator-friendly Portuguese explanation of `errorCode`.
- `suggestedNextAction` — a new, operator-friendly Portuguese suggested next step for that specific failure.

The human review pack's `riskFlags` were also enhanced: the existing
`crawl_failed`/`crawl_partial` flags now interpolate the specific error
code, explanation, and suggested action into their `message`, instead of
one generic sentence — so the failure reason is visible at the
prack's-most-prominent level, not just nested in `websiteAnalyzed`.

Both Markdown renderers (`render-operational-report-markdown.ts`,
`render-human-review-pack-markdown.ts`) print these fields in the
"Website analisado" section, only when `errorCode` is present.

## Why Not `crawl_findings`

The task considered surfacing a "relevant crawl_findings summary" too.
Investigated first: every `crawl_findings` row written for a job-level
fetch/robots failure (`lib/crawler/run-crawl.ts`) has a `summary` field
that is **already byte-identical** to `safeErrorMessage(errorCode)` — the
same generic string now surfaced via `errorMessage`. Only one call site
(`page_limit_reached`) populates the optional `details` field, and that
code path is a `partial` status, not a 0-page failure. Reading
`crawl_findings` for this specific gap would therefore add a new
`CrawlRepository` method (interface + Supabase adapter + Fake adapter)
for **zero additional operator information** in the concrete cases this
fix targets. Skipped deliberately — the smallest safe fix here is
surfacing `error_code`/`error_message`, which already covers it.

## Failure Reason Mapping

New module: `lib/operations/report/crawl-failure-explanation.ts` —
`explainCrawlFailure(errorCode: string | null)`. Pure, static, no network
call, shared by both builders. Exhaustive over every real `CrawlErrorCode`
(`lib/crawler/errors.ts`) — TypeScript enforces every code has an entry:

| Code | Explanation (pt-BR) | Suggested action |
|---|---|---|
| `redirect_blocked` | O crawl foi bloqueado por redirecionamento fora do domínio aprovado. | Revisar manualmente o domínio de destino antes de aprovar novo domínio. |
| `robots_denied` | robots.txt bloqueou o acesso automatizado. | Não insistir no crawl; revisar manualmente presença pública se necessário. |
| `dns_failed` | Falha de DNS impediu a resolução do domínio. | Confirmar manualmente se o domínio está ativo antes de tentar novamente. |
| `timeout` | O carregamento do site expirou (timeout) antes de completar. | Tentar novamente mais tarde; se persistir, revisar manualmente. |
| `blocked_host` | O host de destino não está na lista de domínios aprovados. | Confirmar o domínio e adicioná-lo via --approved-domains. |
| `invalid_url` | A URL informada para o crawl é inválida. | Corrigir a URL cadastrada da clínica. |
| `response_too_large` | A resposta do site excedeu o limite de tamanho permitido. | Revisar manualmente o site. |
| `unsupported_content_type` | O tipo de conteúdo retornado não é suportado. | Revisar manualmente o site. |
| `http_error` | O servidor de destino retornou um erro HTTP. | Revisar manualmente se o site está no ar. |
| `parse_failed` | A página não pôde ser processada com segurança. | Revisar manualmente o conteúdo da página. |
| `persistence_failed` | Os resultados do crawl não puderam ser armazenados. | Repetir o crawl; tratar como problema interno. |
| `page_limit_reached` | O limite de páginas configurado foi atingido. | Repetir com um limite maior, se necessário. |
| `unexpected_error` | Falha genérica e não classificada (pode ser TLS/certificado, DNS, timeout, ou outro erro de baixo nível). | Não presumir a causa; revisar manualmente. |
| `cancelled` | O job de crawl foi cancelado. | Repetir manualmente se ainda relevante. |
| `job_not_found` / `job_not_pending` / `configuration` | (operational/internal cases) | Verificar job/config antes de repetir. |

`tls_error`, `certificate`, and `fetch_failed` (named in this fix's
original request) are **not real `CrawlErrorCode` values today** — TLS/
certificate failures still collapse into `unexpected_error` (the same
limitation `crawler-job-error-reason-fix.md` already documented; not
addressed by this fix, since distinguishing them requires a
crawl-execution change, explicitly out of scope — "do not change crawl
execution"). Small alias entries for these three names exist in the
mapping module so it is ready if/when the crawl-execution layer ever adds
a distinct code, but no code path produces them today.

An unrecognized/future error code still gets a safe, explicit fallback:
*"Falha de crawl não classificada (código: "X") — motivo específico
desconhecido pelo sistema."* with suggested action *"Revisar manualmente
antes de qualquer decisão comercial."* — never a throw, never a silently
empty field.

## Score Evidence Behavior

`lib/score/calculate.ts`'s `UnreachableReasonCode` grew from 3 to 6
values: `no_website`, `robots_denied`, **`redirect_blocked`** (new),
**`dns_failed`** (new), **`timeout`** (new), `unreachable_generic`
(unchanged fallback). Each has its own evidence text and warning text,
type-checked exhaustively (`Record<UnreachableReasonCode, ...>`).

`scripts/crawler/recalculate-score.ts` — the existing, already-safe
command for re-scoring an already-persisted crawl job without re-crawling
— now maps `crawlJob.errorCode` to the new specific reasons before
`redirect_blocked`/`dns_failed`/`timeout`; anything else (including
`unexpected_error`) still falls to `unreachable_generic`, honestly, since
no more specific cause is actually known for those.

**Total scoring rules are unchanged** — every unreachable reason still
scores exactly 0 in every dimension. This fix is evidence/surfacing only;
no failure reason ever inflates a score.

## Staging Validation

Against the real "Clínica High Line" case from
`crawler-single-prospect-operator-run-v2.md`:

- Clinic: `e7a46c30-76b0-4832-80c6-778ccb6b67f3`
- Crawl job: `b5348d75-d6c6-4109-a724-6c0ae600b437` (`status: "failed"`, `errorCode: "redirect_blocked"`)

**Read-only regeneration** (report + review pack, no mutation):

```bash
npx tsx scripts/crawler/generate-operational-report.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437 --output json

npx tsx scripts/crawler/generate-human-review-pack.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437 --output json
```

Result — `websiteAnalyzed` now shows:

```json
"errorCode": "redirect_blocked",
"errorMessage": "A redirect target was blocked.",
"failureExplanation": "O crawl foi bloqueado por redirecionamento fora do domínio aprovado.",
"suggestedNextAction": "Revisar manualmente o domínio de destino antes de aprovar novo domínio."
```

The review pack's `crawl_failed` risk flag now reads: *"The most recent
crawl job failed (redirect_blocked): O crawl foi bloqueado por
redirecionamento fora do domínio aprovado. Próxima ação sugerida: Revisar
manualmente o domínio de destino antes de aprovar novo domínio."*

**Score recalculation (mutating — done once, documented here):**

```bash
npx tsx scripts/crawler/recalculate-score.ts \
  --target staging --clinic-id e7a46c30-76b0-4832-80c6-778ccb6b67f3 \
  --crawl-job-id b5348d75-d6c6-4109-a724-6c0ae600b437
```

This **appended one new `scores` row** (`05bf4dce-74e4-4a98-b647-463c56322456`,
`total: 0`, `unreachableReason: "redirect_blocked"`) — necessary to
demonstrate the improved score-evidence text against real data, since the
score row from run v2 (`dd2f41ac-...`) was computed before this fix and
still carries the old `unreachable_generic` text. Re-generating the report
afterward confirms the credibility dimension's evidence now reads: *"O
crawl foi bloqueado por um redirecionamento para fora do domínio aprovado
— não há evidência para avaliar credibilidade."* — total score remained
`0` (no inflation).

**No outreach mutation:** no `outreach_messages` row exists for this
clinic at all (crawl fetched 0 pages, so draft creation never triggered,
same as documented in run v2) — nothing in this validation created,
approved, or sent anything. No `manual_outreach_logs` entry was recorded
either. Production was never touched — every command used `--target
staging`.

## Limitations

- TLS/certificate failures still collapse into `unexpected_error` — no
  dedicated `CrawlErrorCode` exists for them (pre-existing, documented
  limitation, unchanged by this fix; changing it is a crawl-execution
  change, out of scope here).
- `crawl_findings` remain unread by report/review-pack generation — see
  "Why Not `crawl_findings`" above; deliberate, not an oversight.
- The failure-explanation mapping is a static, hand-written table — a
  future new `CrawlErrorCode` value would need a new entry here (enforced
  by TypeScript's exhaustive `Record` type, so this can never silently
  drift out of sync).
- Score evidence only distinguishes `redirect_blocked`/`dns_failed`/
  `timeout` from the generic bucket for **new** score computations
  (`recalculate-score.ts`, or the main crawl pipeline if it's ever
  extended to score 0-page crawls) — an already-persisted score row from
  before this fix keeps its old, more generic evidence text until
  recalculated.

## No Production, No Crawl, No Google/SERP, No Outreach

This fix touches only report/review-pack generation and score
recalculation — all read-only except the one, explicitly-documented
`recalculate-score` run above, which only re-scores an already-persisted
crawl job (no re-crawl). It never calls the Google Places API or any
search engine, never creates or sends outreach, and never touches
production — every command used `--target staging` exclusively, verified
by the same production-refusal guard every other crawler CLI already
uses.
