# First Real Manual Contact — Go/No-Go Decision

Status date: 2026-07-24
Branch: `feature/crawler-first-manual-contact-go-no-go`
Base tag: `atria-crawler-mvp-readiness-checklist-v2`

This document decides whether a human operator can safely perform the
**first real manual outreach contact** for one already-validated staging
prospect. It does not send anything, does not mark anything as sent, and
does not record a `manual_send_logged` event. It only reviews existing
staging evidence and issues a go/no-go recommendation.

> Esta análise avalia apenas a apresentação digital e a facilidade de
> encontrar informações. Não avalia qualidade médica.

## 1. Executive Decision: **GO**

One clinic — **SkinLaser - Higienopolis** — has sufficient, current,
verified evidence in staging to support a human operator manually sending
the already-approved draft outside this system, on the **e-mail** channel.
No new discovery, no new crawl, and no new outreach copy were needed or
generated for this decision.

## 2. Selected Prospect

| Field | Value |
|---|---|
| Name | SkinLaser - Higienopolis |
| Clinic ID | `bbfd72a3-a013-4a6c-bd82-4a70479d694a` |
| Website | `https://www.skinlaser.com.br/` |
| Specialty | `skin_care_clinic` |
| State | SP |
| Priority tier | `high` (score 75) |
| Suggested next action (prioritization) | `ready_for_manual_outreach_review` |

## 3. Why This Prospect Was Selected

Re-ran `npm run crawler:prioritize-prospects -- --target staging --output
table` against current staging data. Three clinics currently carry an
`approved` human review decision: SkinLaser (`high`, 75), Clínica Dra.
Natália Segatti (`medium`, 60), and Clínica Dermavive (`medium`, 60).
SkinLaser was selected because:

- It is the only `high`-tier prospect in staging today — the same result
  an earlier, independent rehearsal
  (`docs/technical/crawler-approved-manual-outreach-rehearsal.md`) found,
  confirming this ranking is stable over time, not a one-off artifact.
- Its `approved` decision (`bbf7e956-7564-479b-a892-00da2a06c2e4`, reviewer
  "Atria QA", 2026-07-22T17:55:04Z) is the oldest and most thoroughly
  exercised of the three — it has already been walked through the full
  commercial-template → review-pack → approval-gate → manual-outreach-pack
  chain in a prior, dedicated rehearsal, with both channels' drafts
  pre-existing (not freshly generated for this task).
- Both persisted contact evidence signals (phone, WhatsApp, e-mail) are
  extracted at **high confidence**, directly from the clinic's own real
  domain — the strongest contact evidence of the three approved clinics.
- ICP fit is `core`, organization type `independent_clinic`, own website
  confirmed, not a directory/social listing (`facts.hasOwnWebsite: true`,
  `facts.isDirectoryListing: false` in the current prioritization output).

No new crawl was performed and no new candidate discovery was run — this
decision uses only already-persisted staging rows, per the task's scope.

## 4. Channel Selected: **E-mail**

Both channels currently pass the approval gate for this clinic:

| Channel | Outreach message ID | Gate result |
|---|---|---|
| WhatsApp | `ca0c3fba-86ac-442c-afb5-276552287177` | `allowed: true` |
| E-mail | `ba53a89a-f73e-4eb9-86e6-ed05191b4378` | `allowed: true` |

Both are backed by equally strong (`high`-confidence) extracted contact
evidence, so the choice is not forced by missing/blocked evidence (the
"WhatsApp blocked → recommend email only" fallback rule did not apply
here). E-mail was chosen as the **safer first-contact channel** by
judgment, for these reasons:

- E-mail is asynchronous — the recipient reads it on their own time, with
  no expectation of an immediate reply, which better matches the
  soft, no-pressure tone required of this copy ("Sem compromisso").
- The extracted WhatsApp number is the clinic's public, patient-facing
  contact channel. Using it for the very first unsolicited B2B outreach
  (rather than a patient inquiry) is a closer, more personal channel to
  reuse for a different purpose than it was published for — a
  conservative first contact should start with the more clearly
  professional/institutional channel (e-mail) and reserve WhatsApp for a
  possible follow-up only after an initial response or explicit interest.
- Every other rehearsal in this pipeline (runs v1–v4) auto-generates its
  crawl-time draft on the `email` channel by default — e-mail is already
  the pipeline's de facto default first channel throughout this project,
  not a new choice invented for this decision.
- E-mail leaves a clearer, easier-to-review paper trail for the operator to
  double-check wording immediately before sending, compared to a live
  chat-style channel.

WhatsApp remains a validated, gate-allowed option and is not withheld —
it may be used for a later follow-up, but is not the recommendation for
this first contact.

## 5. Evidence Summary

- **Own website, not directory/social:** Confirmed. `websiteUrl`
  `https://www.skinlaser.com.br/`, `hasOwnWebsite: true`,
  `isDirectoryListing: false`.
- **ICP fit:** `core`, `independent_clinic`, `owner_led` decision
  complexity, reason `likely_core_icp`, no blockers.
- **Crawl result usable:** Status `partial` (crawl job
  `81a7b754-e9d9-40d7-b89d-83f1ca2c53a4`, 1 of 19 discovered pages fetched,
  `page_limit_reached` — a page-limit cap, not a technical failure; the
  homepage alone provided enough real evidence for scoring and review).
  This is a documented, informational risk flag (`[medium] crawl_partial`),
  not a stop condition — the same conclusion the earlier rehearsal reached.
- **Contact evidence:** phone `(11) 3155-5555` (high confidence), WhatsApp
  `551131555555` (high confidence, real click-to-chat link built from it),
  e-mail `contato@skinlaser.com.br` (high confidence) — all extracted
  directly from `https://www.skinlaser.com.br/`.
- **Screenshot evidence:** Both desktop and mobile captured successfully
  (assets `2340159e-695f-4365-9695-f226bb031581` and
  `7893b541-7829-484b-892a-673d3f163c21`), private storage paths only, no
  public/signed URL ever generated.

## 6. Score Summary

- **Total:** 80/100 (v1), `scoring version v1`.
- **Dimensions:** Credibilidade 20/20, Clareza 20/20, Mobile 16/20,
  Conversão/Contato e ação 12/20, Atualização 12/20.
- **Explainable:** every point is backed by a named, real signal (accessible
  HTTPS homepage, institutional title, structured headings, service
  candidates detected, both screenshots captured, public WhatsApp/phone/
  e-mail found, a conservative freshness note since no last-modified date
  is available). No generic/placeholder scoring.
- **Disclaimer present, verbatim, confirmed in the current report output:**

  > "Esta análise avalia apenas a apresentação digital e a facilidade de
  > encontrar informações. Não avalia qualidade médica."

## 7. Review/Approval Status

- **Latest human review decision:** `approved`
  (`bbf7e956-7564-479b-a892-00da2a06c2e4`, reviewer "Atria QA", reviewed
  2026-07-22T17:55:04.044598+00:00). Re-confirmed current via
  `crawler:review-queue --status all` in this task — still the clinic's
  latest and only relevant decision; not `needs_changes`, not `rejected`.
- **Approval gate:** re-checked fresh in this task for both channels —
  both return `allowed: true`, `code: null`, reason "Clinic is not
  do_not_contact, the outreach message is in a sendable state, and the
  latest human review decision is approved."
- **Outreach message status:** both the WhatsApp draft
  (`ca0c3fba-86ac-442c-afb5-276552287177`) and the e-mail draft
  (`ba53a89a-f73e-4eb9-86e6-ed05191b4378`) are currently `status: draft` —
  confirmed by the fresh manual outreach pack generated in this task
  (Section 5, "approval gate" table) and by the operational report.
  Neither has ever moved to `sent` or any other non-draft status.
- **Prior manual outreach logs:** exactly 2 rows exist for this clinic
  (`crawler:outreach-log:list`, re-checked fresh in this task), both
  `eventType: "rehearsal_logged"`:
  - `2d4b8191-2ee0-44ea-ad86-72bc733caff8` (2026-07-23, channel whatsapp,
    notes explicitly state "Nothing was sent.")
  - `9feed1a6-ad9a-420e-82a8-eddbc0c72636` (2026-07-22, channel whatsapp,
    notes explicitly state "nenhum envio real ocorreu")
  **No `manual_send_logged` event exists for this clinic or either outreach
  message.** This is the first time a real send would actually be
  authorized for this clinic.

## 8. Final Human QA Checklist

Before the operator sends, confirm each of these personally (from
`docs/operations/crawler-mvp-readiness-checklist.md`, Section 14, applied
to this specific clinic):

- [ ] Latest `human_review_decisions` row is `approved` — yes, re-confirmed
      in this task.
- [ ] Screenshots loaded (no `storage_failed`) and visually match the live
      site — both `status: "captured"`; operator should open the private
      storage paths once more immediately before sending to eyeball them.
- [ ] Operational report shows no unresolved crawl errors for pages
      referenced in the outreach copy — the only flag is the informational
      `crawl_partial` (page-limit only), already accounted for; the copy
      itself references no specific page content that could be stale.
- [ ] Commercial copy reads correctly in Portuguese, is genuinely specific
      to this clinic, contains no placeholder/templated artifacts — see
      Section 9 below.
- [ ] Score is never phrased to the clinic as a medical/clinical judgment —
      confirmed; the disclaimer is present and the copy body never
      mentions clinical quality.
- [ ] Clinic is not flagged `do_not_contact` — confirmed by the approval
      gate result above.
- [ ] Outreach message row is still `status: draft` immediately before the
      manual send — operator should re-run
      `npm run crawler:outreach-log:list -- --target staging --clinic-id
      bbfd72a3-a013-4a6c-bd82-4a70479d694a` one more time right before
      sending, as a final sanity check.
- [ ] The manual send, once performed, will be logged via
      `crawler:outreach-log:record --event-type manual_send_logged` — see
      Section 10.

## 9. Final Copy Review Notes

The e-mail draft (already-approved, verbatim, not modified for this task):

> Assunto: Prévia digital — SkinLaser - Higienopolis
>
> Olá, equipe da SkinLaser - Higienopolis,
>
> Aqui é da Atria. Fizemos um raio-X rápido da primeira impressão digital
> do site de vocês — é só sobre a apresentação do site e a facilidade de
> encontrar informações, não avalia qualidade médica.
>
> Encontramos alguns pontos que podem valer uma olhada rápida. Posso te
> mandar o resumo? Sem compromisso.
>
> Atenciosamente,
> Atria

Checked against every required prohibition:

- [x] No medical-quality claim — the copy explicitly disclaims this
      ("não avalia qualidade médica").
- [x] No fake outcome claim — makes no result/outcome promise of any kind.
- [x] No fake client/testimonial — names no other client, invents no
      testimonial or award.
- [x] No score leak — the number "80" or "80/100" never appears in the
      copy body; the score stays internal to the report/review pack.
- [x] No pressure tactics — "Sem compromisso" and a soft, opt-in question
      ("Posso te mandar o resumo?") explicitly avoid urgency or scarcity
      language.

No copy changes were needed. This is the exact, already-approved draft
persisted at `outreach_messages` row `ba53a89a-f73e-4eb9-86e6-ed05191b4378`.

## 10. Exact Manual Operator Instruction

**The operator may manually send the approved message outside the system
using e-mail. After the manual action, return to the system only to
record a `manual_send_logged` event with the exact outreach_message_id
and channel:**

```
clinic_id:           bbfd72a3-a013-4a6c-bd82-4a70479d694a
outreach_message_id: ba53a89a-f73e-4eb9-86e6-ed05191b4378
channel:             email
```

This task does **not** run that logging command — it is left for the
operator to run only after the real send has actually happened, per
Section 12 below.

## 11. What Must NOT Be Done

- Do not send this message from inside this codebase — there is no send
  code path here; the send happens entirely outside the system (the
  operator's own e-mail client).
- Do not use the WhatsApp Business API or any automated e-mail provider
  send for this contact.
- Do not record `manual_send_logged` before the e-mail has actually been
  sent by a human.
- Do not record `manual_send_logged` as part of this task, under any
  circumstance — this task only decides go/no-go.
- Do not attach or upload any screenshot binary or generate a public/
  signed URL for one.
- Do not add any claim, testimonial, credential, or medical-quality
  statement beyond the already-approved copy shown in Section 9.
- Do not contact any other clinic as part of this decision — this is a
  single-prospect, single-channel go/no-go, not a batch authorization.
- Do not re-run discovery, re-crawl this or any other clinic, or call
  Google Places/SERP as part of acting on this decision.

## 12. Logging Instruction After Human Action

Only after the operator has actually sent the e-mail outside the system:

```bash
npm run crawler:outreach-log:record -- \
  --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --outreach-message-id ba53a89a-f73e-4eb9-86e6-ed05191b4378 \
  --event-type manual_send_logged --channel email \
  --operator-name "<OPERATOR NAME>" --occurred-at <ISO_TIMESTAMP_OF_ACTUAL_SEND> \
  --dry-run false
```

Run with the default `--dry-run` (omit `--dry-run false`) first to preview
the exact payload if any doubt remains about the fields, then re-run with
`--dry-run false` to actually record it. Immediately after, run
`npm run crawler:outreach-log:list -- --target staging --clinic-id
bbfd72a3-a013-4a6c-bd82-4a70479d694a` to confirm the new row and that the
underlying `outreach_messages` row is still `status: draft` (recording a
send event never mutates message status by design).

## 13. Rollback/Stop Conditions

Escalate to a human decision-maker and do not send if, at the moment of
acting on this decision, any of the following is true:

- The clinic's latest `human_review_decisions` row is no longer `approved`
  (re-check immediately before sending — do not rely solely on this
  document if time has passed).
- The approval gate no longer returns `allowed: true` for the e-mail
  outreach message.
- The `outreach_messages` row is found in any status other than `draft`.
- The clinic has been flagged `do_not_contact` since this document was
  written.
- Any new information suggests the website, contact info, or copy is
  stale or no longer accurate (e.g. the clinic has closed, changed
  ownership, or changed its domain).
- A `manual_send_logged` event is discovered to already exist for this
  clinic/message that was not accounted for in Section 7 (would indicate
  a race with another operator).

If any of the above is true: stop, do not send, and re-run the relevant
read-only checks (`review-queue`, `check-outreach-approval-gate`,
`outreach-log:list`) before making a new decision.

## 14. Open Risks

- The crawl behind this evidence is `partial` (homepage only, 1 of 19
  pages) — the score and copy are based on the homepage; if the operator
  has reason to believe the rest of the site materially changes the
  picture, treat this as a reason to pause, not a reason to invent
  additional claims not in evidence.
- Score v1 and commercial template copy remain first-pass calibrations
  (per `docs/operations/crawler-mvp-readiness-checklist.md`, Sections 4
  and 18) — not statistically outcome-validated. This is the *first* real
  send this pipeline will produce evidence for; treat the response (or
  lack of one) as the first real data point, not a foregone conclusion.
- The legacy `service_role` key exposure noted in the MVP readiness
  checklist (Section 9/20) has not been confirmed rotated as part of this
  task — this is an open item independent of this specific send decision,
  carried over from the readiness checklist's own open decisions.
- WhatsApp remains available as a strong alternative channel for this same
  clinic; if e-mail produces no response after a reasonable period, a
  human can revisit this document's channel choice for a follow-up — that
  decision is out of scope here.

## 15. Final Recommendation

**GO** — SkinLaser - Higienopolis, e-mail channel, using the exact,
already-approved draft at outreach message
`ba53a89a-f73e-4eb9-86e6-ed05191b4378`. All required checks pass, both
gate and human review decision are current and `approved`, the copy is
clean, and no prior real send has occurred for this clinic. The operator
may proceed per Section 10, and must log the result per Section 12 only
after actually sending.
