# Commercial templates by tier

Tier-aware, review-only outreach copy and operator guidance, built
directly from the prospect prioritization result
(`docs/technical/crawler-prospect-prioritization.md`) plus already-
persisted score/review-decision/manual-outreach-log data. **No sending
exists anywhere in this module.** Every draft stays `reviewRequired:
true` — an operator always reads, edits, and sends manually, outside
this codebase.

## Relationship to the Manual Outreach Pack

This is a distinct, earlier-stage tool from the Manual Outreach Pack
(`docs/technical/crawler-manual-outreach-pack.md`):

| | Manual Outreach Pack | Commercial templates by tier |
| --- | --- | --- |
| Copy source | Verbatim, already-persisted, already gate-approved `outreach_messages` row | Freshly computed from current score/tier — never reads or writes `outreach_messages` |
| Gate dependency | Requires the outreach approval gate to pass | No relationship to the approval gate at all |
| Question it answers | "Send exactly this, it was already approved" | "Given this prospect's current tier, what *should* I consider saying, if anything?" |
| When it's useful | Right before an operator actually sends | Right after prioritization, to decide *whether* it's even worth reaching out yet |

They are complementary, not substitutes — nothing here changes how the
Manual Outreach Pack works, and nothing there changes how this works.

## Tier behavior

Reuses the exact same per-item scoring the prioritization layer uses
(`prioritizeClinic`/`prioritizeCandidate`, now exported from
`lib/operations/prioritization/prioritize-prospects.ts` specifically so
this module never re-derives priority independently — the tier shown
here always agrees with `crawler:prioritize-prospects` for the same id).

| Tier | External copy? | Behavior |
| --- | --- | --- |
| **high** | Yes | "Ready for human review" framing — mentions Atria prepared a short digital-presence review, asks permission to share the summary. |
| **medium** | Yes | Softer — asks if they'd be interested in seeing a quick observation about their site, no "review already done" framing. |
| **low** | **No, by default** | No draft generated. `blockedReason` stays `null` (this is a recommendation, not a hard block) — a warning explains manual research or a later revisit is the better next step. |
| **blocked** | No | No draft generated. `blockedReason` is populated (internal-only) explaining exactly why, sourced from the same blockers the prioritization layer already computed. |

Copy eligibility is **stricter than tier alone**:

- A **candidate** (not yet promoted) never produces copy, regardless of
  tier — it has no crawl/score evidence yet, matching
  `buildOutreachDraft`'s own "no evidence, no draft" rule used elsewhere
  in this codebase.
- A clinic with **no score at all** never produces copy, even if its
  numeric tier happens to be "medium" (a "high" tier is numerically
  unreachable without a score — see the point-weight analysis in
  `docs/technical/crawler-prospect-prioritization.md`; the module's own
  code comment documents this).
- A clinic whose **latest review decision is `needs_changes`** never
  produces copy, even when the numeric tier would otherwise be
  high/medium — a human explicitly asked for changes, and copy must not
  be silently regenerated as if that request never happened. This is a
  stricter rule than the tier score alone provides, since
  `needs_changes` is only a −10 penalty in the prioritization model, not
  a hard override.
- `rejected` and `do_not_contact` are already hard overrides inside the
  tier scorer itself (both force `priorityTier: "blocked"`), so they're
  covered by the tier check without any extra logic in this module.

## Recommended next actions

Reuses the prioritization model's own `suggested_next_action` enum
verbatim — never re-derived independently:

`review_pack` · `retry_crawl` · `approve_domain` · `skip` ·
`needs_manual_research` · `ready_for_manual_outreach_review`

## Example internal summary (never sent externally)

```
SkinLaser - Higienopolis — prioridade high (score 75)
Motivos: Possui site próprio (não é listagem de diretório de terceiros).
Evidência visual (screenshot) já capturada. Score digital disponível:
80/100 (v1). Score na faixa que sugere oportunidade clara de melhoria
(site funcional, com espaço real de evolução). Contato público
(telefone/WhatsApp/e-mail) encontrado. Última decisão de revisão
humana: approved. Bloqueios/riscos: Crawl mais recente ficou parcial
(limite de páginas ou falhas de busca).
```

The internal summary is the one place score numbers are allowed to
appear — never in the WhatsApp/email body itself.

## Example WhatsApp/email drafts

**High tier (WhatsApp):**

```
Olá! Aqui é da Atria.
Fizemos uma revisão rápida da presença digital de SkinLaser - Higienopolis — é só sobre apresentação do site e facilidade de contato, não avalia qualidade médica.
Posso te mandar o resumo?
```

**High tier (email), subject "Prévia digital — {name}":**

```
Olá, equipe da SkinLaser - Higienopolis,

Aqui é da Atria. Preparamos uma revisão rápida da apresentação digital do site de vocês — é só sobre a apresentação do site e a facilidade de encontrar informações, não avalia qualidade médica.

Podemos te mandar um resumo, se fizer sentido para vocês. Sem compromisso.

Atenciosamente,
Atria
```

**Medium tier (WhatsApp)** — deliberately different wording, softer ask,
no "we already reviewed it" framing:

```
Olá! Aqui é da Atria.
Notamos alguns pontos na apresentação digital do site da {name}. Você teria interesse em ver uma observação rápida sobre isso? Não avalia qualidade médica — só o site.
```

**Medium tier (email)**, subject "Observação rápida — {name}":

```
Olá, equipe da {name},

Aqui é da Atria. Trabalhamos com apresentação digital de clínicas e notamos alguns pontos no site de vocês que talvez valham uma olhada.

Se fizer sentido, posso compartilhar uma observação rápida — sem compromisso. A análise é só sobre o site, não avalia qualidade médica.

Atenciosamente,
Atria
```

## Blocked/no-send policy

- `whatsapp`/`email` are always the tagged-union shape
  `{ available: true, ... }` or `{ available: false, unavailableReason
  }` — never a partial/ambiguous state.
- `blockedReason` is populated only for genuinely blocking states
  (numeric `blocked` tier, `needs_changes` decision) — `low` tier
  deliberately leaves it `null` since it's a recommendation, not a
  block, with the reasoning surfaced in `warnings` instead.
- No provider integration (WhatsApp Business API, email sender) exists
  anywhere in this codebase, and this module adds none — `markSent` is
  never called, `outreach_messages` is never read or written at all by
  this builder.

## Safety constraints (tested)

- Required disclaimer (`SCORE_DISCLAIMER`) always present, verbatim, in
  every pack regardless of tier.
- No medical-quality-evaluation language in any generated copy.
- No invented testimonials, clients, awards, or credentials (CRM/RQE)
  in any generated copy.
- No internal score number (`/100`, "score") ever appears in
  WhatsApp/email body text — only in the internal `reasonSummary`.
- Production is always refused via the shared
  `selectRepositories`/`assertSafeTarget` gate.
- The builder's dependency surface never includes an `outreachRepo` at
  all — there is structurally no way for it to read or write
  `outreach_messages`.

## CLI usage

```
npm run crawler:commercial-templates -- --target staging --clinic-id <id>
npm run crawler:commercial-templates -- --target staging --candidate-id <id> --output json
npm run crawler:commercial-templates -- --target staging --tier high --limit 5 --output markdown --write-artifact
```

Exactly one of `--clinic-id` / `--candidate-id` / `--tier` is required.
`--tier` sweeps every prospect at that tier (per the current
prioritization ranking) and generates a pack for each. `--write-artifact`
writes to the gitignored `artifacts/commercial-templates/`. Production
is always refused.

## Staging rehearsal result

Ran read-only against real, retained staging data — **no new crawl,
job, or outreach row was created; every table's row count was
independently re-verified unchanged before and after** (4 `clinics`, 5
`prospect_candidates`, 8 `crawl_jobs`, 12 `scan_assets`, 10 `scores`, 7
`outreach_messages`, 4 `human_review_decisions`, 1
`manual_outreach_log`):

- **SkinLaser - Higienopolis** (`bbfd72a3-...`, `high`, score 75):
  generated the full "ready for review" WhatsApp + email drafts shown
  above, with a real click-to-chat link built from its own published
  WhatsApp number. `recommendedNextAction: ready_for_manual_outreach_review`.
- **Dra Ana Paula Pedrino...** (`9c107389-...`, `blocked`, score −125):
  no external copy generated; `blockedReason` cites the exact chain —
  robots.txt block with no salvageable evidence, missing score, missing
  contact, and a `rejected` review decision. `recommendedNextAction: skip`.
- **GRUPO CPD - Centro Paulista...** (`8634b1cb-...`, `low`, score 30):
  no external copy generated by default; `blockedReason` is `null`
  (this is a recommendation, not a block) and a warning explicitly
  recommends manual research or a later revisit.
  `recommendedNextAction: review_pack`.

Both markdown artifacts and a JSON tier-sweep (`--tier blocked`) were
generated and written to the gitignored
`artifacts/commercial-templates/` directory.

## Limitations

- Copy templates are fixed per tier (two variants: high, medium) — not
  yet parameterized by specialty, city, or any other segment. A future
  task could add further variation if warranted.
- The click-to-chat WhatsApp link is only produced when the clinic has
  a `whatsapp`-type contact already recorded in `clinic_contacts` with a
  parseable `wa.me` phone number — no phone-number guessing or
  formatting normalization beyond what's already published by the site
  itself.
- Like the prioritization layer it depends on, the specific
  point-weight thresholds that determine tier (and therefore whether
  copy is generated at all) are a first, reasonable calibration, not
  empirically tuned against real outreach outcomes yet.

## Files changed

- `lib/operations/prioritization/prioritize-prospects.ts` (exported
  `prioritizeClinic`/`prioritizeCandidate` — no behavior change, just
  visibility, so this module can score a single id the exact same way)
- `lib/operations/commercial-templates/types.ts` (new)
- `lib/operations/commercial-templates/build-commercial-template-pack.ts` (new)
- `lib/operations/commercial-templates/render-commercial-template-pack-markdown.ts` (new)
- `lib/operations/commercial-templates.test.ts` (new — 19 tests)
- `scripts/crawler/generate-commercial-template-pack.ts` (new)
- `package.json` (+ `crawler:commercial-templates`)
- `.gitignore` (+ `/artifacts/commercial-templates/`)
- `docs/technical/crawler-commercial-templates-by-tier.md` (this file)

## Verification

- `npm test` — 416/416 passing (19 new tests, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed via `supabase/.temp/project-ref` before running against real data.
- No crawl was performed — every field read comes from already-persisted rows.
- No Google Places/SERP call was made.
- No outreach was sent — this module never reads or writes `outreach_messages` at all; re-queried every retained table's row count directly before and after running the CLI against staging and confirmed all counts unchanged.
- No secrets were stored in any file, log, or this document.
