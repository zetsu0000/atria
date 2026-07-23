# Approved manual outreach rehearsal

A staging-only, read-mostly rehearsal of the final commercial operating
path — the sequence a human operator actually follows once a prospect is
approved, ending in a manual, human-sent message that this system never
sends itself:

```
prioritization → commercial template pack → human review pack
  → confirm approved decision → manual outreach-ready packet
  → (optional) non-send rehearsal log → no system sending
```

This is not a new feature. Every tool used already existed from earlier
tasks (`crawler:prioritize-prospects`, `crawler:commercial-templates`,
`crawler:review-pack`, `check-outreach-approval-gate`,
`generate-manual-outreach-pack`, `record-manual-outreach-log`) — this
task's job was to walk the full chain end to end against real staging
data and confirm every step behaves as documented, together.

Disclaimer (unchanged, present in every artifact generated below):

> "Esta análise avalia apenas a apresentação digital e a facilidade de
> encontrar informações. Não avalia qualidade médica."

## No code changed

This task is a rehearsal, not an implementation change. No `lib/` or
`scripts/` file was modified — only this document was added.

## 1–2. Prioritization → selected prospect

`npm run crawler:prioritize-prospects -- --target staging --tier high`
returned exactly one `high`-tier prospect:

| Field | Value |
| --- | --- |
| Name | SkinLaser - Higienopolis |
| Clinic ID | `bbfd72a3-a013-4a6c-bd82-4a70479d694a` |
| Kind | clinic |
| Priority score | 75 |
| Priority tier | **high** |
| Suggested next action | `ready_for_manual_outreach_review` |

Only one `high`-tier prospect existed in staging, so selection was
unambiguous — no tie-breaking or manual judgment call was needed.

## 3. Why it is high priority

Reasons from `prioritizeProspects` (`lib/operations/prioritization/prioritize-prospects.ts`):

- Possui site próprio (não é listagem de diretório de terceiros).
- Evidência visual (screenshot) já capturada.
- Score digital disponível: 80/100 (v1).
- Score na faixa que sugere oportunidade clara de melhoria (site funcional, com espaço real de evolução).
- Contato público (telefone/WhatsApp/e-mail) encontrado.
- Última decisão de revisão humana: approved.

One blocker/risk noted, informational only: "Crawl mais recente ficou
parcial (limite de páginas ou falhas de busca)" — the crawl hit its page
limit at 1/19 discovered pages, which is why the score is based on the
homepage only. This did not prevent `high` tier, matching
`docs/technical/crawler-score-prioritization-alignment.md`'s documented
formula (screenshot + real score in the 30–85 "clear opportunity" band +
public contact + an `approved` decision easily clears the 70-point
threshold for `high`).

## 4. Commercial template pack result

`npm run crawler:commercial-templates -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a`:

- `priorityTier: "high"`, `blockedReason: null`.
- Both channels available: `whatsapp.available: true`, `email.available: true`.
- `operatorChecklist` includes "Envio permanece manual — este pacote não envia nada."
- No score number, testimonial, award, or medical-quality language present in either draft body (matches the module's own safety tests).

## 5. Human review pack

`npm run crawler:review-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --output json`
confirmed the underlying evidence the `approved` decision was based on:

- `scoreSummary`: total 80/100, `scoringVersion: "v1"`.
- `scoreDimensions`: Credibilidade 20/20, Clareza 20/20, Mobile 16/20, Conversão/Contato e ação 12/20, Atualização 12/20.
- `screenshots`: both desktop and mobile `status: "captured"` (private storage paths only, never a public/signed URL).
- Two already-persisted draft messages: WhatsApp (`ca0c3fba-86ac-442c-afb5-276552287177`) and email (`ba53a89a-f73e-4eb9-86e6-ed05191b4378`), both `status: "draft"`.
- `humanApprovalChecklist` present, unchanged, requiring explicit human approval before any send, by any channel.

## 6. Review decision status

**Confirmed existing, not recorded new.** Per the task's instruction to
"record one only if evidence supports it" — evidence already supported
an existing decision, so nothing new was written.

`check-outreach-approval-gate` (read-only precondition check) against
the WhatsApp draft returned:

```json
{
  "allowed": true,
  "code": null,
  "reason": "Clinic is not do_not_contact, the outreach message is in a sendable state, and the latest human review decision is approved.",
  "latestDecision": {
    "id": "bbf7e956-7564-479b-a892-00da2a06c2e4",
    "decision": "approved",
    "reviewer": "Atria QA",
    "reviewedAt": "2026-07-22T17:55:04.044598+00:00"
  }
}
```

This decision was recorded in an earlier task
(`docs/technical/crawler-skinlaser-human-approval.md`) and remains the
clinic's latest decision — `human_review_decisions` row count is
unchanged by this task.

## 7. Manual outreach-ready packet result

`npx tsx scripts/crawler/generate-manual-outreach-pack.ts --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --include-screenshot-links --output json`
returned `"status": "ready"` with every required field present:

| Field | Value |
| --- | --- |
| Clinic identity | SkinLaser - Higienopolis, `skin_care_clinic`, SP |
| Website | `https://www.skinlaser.com.br/` |
| Score | 80/100 (v1) |
| Key evidence | 5 bullet points, one per dimension, each citing a real signal (accessible homepage, structured headings, captured mobile screenshot, public phone/WhatsApp, conservative freshness note) |
| WhatsApp draft | available, click-to-chat URL built from a real public WhatsApp contact |
| Email draft | available, subject + body |
| Screenshot references | desktop + mobile, both `status: "captured"`, private storage paths only (`private/scan-assets/...`), no public/signed URL generated |
| Approval status | `hasApprovedDecision: true`, decision id `bbf7e956-...`, reviewer "Atria QA" |
| Approval gate results | both channels `"allowed"` |
| Operator checklist | 11 items, ending in "Operador enviará manualmente — este pacote não envia nada." and "Operador registrará o resultado após o envio." |

No screenshot binary was attached or uploaded anywhere — only the
existing private storage path was surfaced, exactly as the flag's own
documentation promises ("never a public/signed URL").

## Whether any log was recorded

**Yes — a `rehearsal_logged` event, never `manual_send_logged`.**

```
npx tsx scripts/crawler/record-manual-outreach-log.ts --target staging \
  --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --outreach-message-id ca0c3fba-86ac-442c-afb5-276552287177 \
  --event-type rehearsal_logged --channel whatsapp \
  --operator-name "Atria QA" --occurred-at 2026-07-23T00:57:50Z \
  --notes "Rehearsal only ... Nothing was sent." \
  --dry-run false
```

Run first with the default `--dry-run true` to confirm the exact payload
before writing anything, then re-run with `--dry-run false` to actually
record it. Resulting row: id `2d4b8191-2ee0-44ea-ad86-72bc733caff8`,
`eventType: "rehearsal_logged"`, `sideEffects.doNotContactUpdated: false`.

Per `prioritize-prospects.ts`'s own `REAL_CONTACT_EVENT_TYPES` set,
`rehearsal_logged` is explicitly excluded from ever counting as a real
contact — recording it does **not** lower this clinic's future priority
score or mark it as recently contacted, unlike a real
`manual_send_logged` event would.

## Retained staging rows

Confirmed via direct read (REST `select` only, no write) against
`outreach_messages` for this clinic after every step above: **6 rows, all
`status: "draft"`** — none is `"sent"` or any other non-draft status.
`human_review_decisions` count for this clinic is unchanged (still the
one pre-existing `approved` row). `manual_outreach_logs` for this clinic
grew from 1 to 2 rows (both `rehearsal_logged` — the pre-existing one
from an earlier task's rehearsal, plus this task's new one). No
`clinics`, `crawl_jobs`, `scores`, or `prospect_candidates` row was
created, updated, or deleted by any tool used in this task.

## Safety confirmations

- **No production touched** — only staging (`lfkyiztuwptmddsraucg`) was
  read from or written to (the single `rehearsal_logged` insert).
- **No crawl was performed** — every tool used reads already-persisted
  `crawl_jobs`/`scan_assets`/`extracted_content` rows; none re-crawls.
- **No Google Places/SERP call was made.**
- **No secrets appear in this document, any artifact, or any log
  entry** — only clinic IDs, message IDs, and public-facing copy that
  was already reviewed and approved in an earlier task.
- **No outreach was sent.** No WhatsApp Business API, no email provider,
  and no automatic-send code path exists anywhere in this codebase — the
  entire pipeline, end to end, ends at a human-reviewed draft plus an
  optional after-the-fact log. This rehearsal only exercised the
  non-send log event type (`rehearsal_logged`); `manual_send_logged` was
  never used.
- **No screenshot binary or public URL was generated or exposed** — only
  private storage paths were surfaced, matching every other read-only
  tool in this pipeline.
