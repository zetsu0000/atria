# Crawler Single-Prospect Operator Run — v4 (Operator Shortlist CLI Active)

Status date: 2026-07-24
Branch: `feature/crawler-single-prospect-operator-run-v4-shortlist`
Base tag: `atria-crawler-operator-shortlist-cli-v1`

This is the fourth full, staging-only, single-prospect rehearsal of the
manual operator pipeline. Runs v1–v3 are documented in
`crawler-single-prospect-operator-run-v1.md`, `-v2.md`, and `-v3-icp.md`.
This run's specific purpose is to validate the new operator shortlist CLI
(`docs/technical/crawler-operator-shortlist-cli.md`,
`npm run crawler:operator:shortlist`) inside the real end-to-end flow —
does it actually save the operator time and reduce ambiguity, or does it
just add another report to read?

## 1. Exact Commands Run (secrets redacted — none were ever printed)

```bash
# Step 1: branch/tag/status
git status --short
git checkout -b feature/crawler-single-prospect-operator-run-v4-shortlist \
  atria-crawler-operator-shortlist-cli-v1

# Step 2-4: preflight (confirms staging target + production refusal, prints no secret values)
npm run crawler:operator-preflight -- --target staging

# Step 5-6: one narrow, real Google Places discovery
npm run crawler:discover:places -- \
  --target staging \
  --query "clínica dermatológica" \
  --location "Vila Mariana, São Paulo, SP" \
  --max-results 5 --max-pages 1

# Step 7: candidate review CLI
npm run crawler:candidates:list -- \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> \
  --include-existing --output markdown

# Step 8: operator shortlist (markdown)
npm run crawler:operator:shortlist -- \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> \
  --include-existing --output markdown

# Step 9: operator shortlist (JSON, only-actionable)
npm run crawler:operator:shortlist -- \
  --target staging --discovery-job-id <DISCOVERY_JOB_ID> \
  --include-existing --only-actionable --output json

# Step 13: promote the shortlist-recommended candidate, using its exact printed command
npm run crawler:promote -- \
  --target staging --candidate-id <CANDIDATE_ID>

# Step 16: controlled crawl, one clinic, explicit approved domain, max 3 pages
npm run crawler:queue:process -- \
  --target staging --clinic-ids <CLINIC_ID> --max-pages 3 \
  --allow-real-crawl --approved-domains www.dermavive.com.br,dermavive.com.br \
  --capture-screenshots

# Step 17: operational report
npm run crawler:report -- --target staging --clinic-id <CLINIC_ID> --write-artifact

# Step 18: human review pack
npm run crawler:review-pack -- --target staging --clinic-id <CLINIC_ID> --write-artifact

# Step 20: prioritization
npm run crawler:prioritize-prospects -- --target staging --output table

# Step 21: commercial template pack
npm run crawler:commercial-templates -- --target staging --clinic-id <CLINIC_ID> --write-artifact

# Step 22: record an approved human review decision (evidence was strong)
npm run crawler:review-decision -- \
  --target staging --clinic-id <CLINIC_ID> \
  --decision approved --reviewer "Operator Run v4 (shortlist rehearsal)" --notes "<see Section 15>"

# Step 23: check the outreach approval gate (read-only)
npm run crawler:check-outreach-approval-gate -- \
  --target staging --clinic-id <CLINIC_ID> --outreach-message-id <OUTREACH_MESSAGE_ID>

# Step 23: manual outreach-ready packet
npm run crawler:manual-outreach-pack -- --target staging --clinic-id <CLINIC_ID> --write-artifact

# Step 24: record a rehearsal log only — never manual_send_logged
npm run crawler:outreach-log:record -- \
  --target staging --clinic-id <CLINIC_ID> \
  --outreach-message-id <OUTREACH_MESSAGE_ID> \
  --event-type rehearsal_logged --channel email \
  --operator-name "Operator Run v4 (shortlist rehearsal)" --occurred-at 2026-07-24T01:24:00Z \
  --dry-run false

# Step 25: confirm the outreach log and message state (read-only)
npm run crawler:outreach-log:list -- --target staging --clinic-id <CLINIC_ID>
```

## 2. Selected Query/Location

- Query: `"clínica dermatológica"`
- Location: `"Vila Mariana, São Paulo, SP"`
- `--max-results 5`, `--max-pages 1` — matches the task's discovery limits exactly.

## 3. Discovery Result Summary

`discoveryJobId`: `0bb1d5f4-04d7-412e-bcd8-191d063c0a1a`

- `pagesFetched`: 1, `totalFoundByProvider`: 5, `importedCount`: 5
- `duplicateCount`: 0, `rejectedCount`: 0, `promotions`: []
- 5 new candidates imported, all Vila Mariana / São Paulo dermatology practices:
  1. Instituto Fraga de Dermatologia
  2. MV Dermatologia
  3. Dermatologista - Dra. Juliana de Morais Fernandes Krakheche - Clínica Dermavive
  4. Dermatologista Vila Mariana - Dra Bárbara Tannús
  5. Dermatologista Estética na Vila Mariana. Dra. Bianca Almeida

Notably clean batch for this query/location — no directories, no social-profile-only websites, no hospitals/chains, no duplicates on this pass.

## 4. Candidate Review CLI Output Summary

`npm run crawler:candidates:list -- --include-existing --output markdown`:

| Candidate | Suggested action | ICP org type | ICP fit |
|---|---|---|---|
| Instituto Fraga de Dermatologia | `promote_candidate` | independent_clinic | core |
| MV Dermatologia | `promote_candidate` | independent_clinic | core |
| Clínica Dermavive (Dra. Juliana Krakheche) | `promote_candidate` | independent_clinic | core |
| Dra Bárbara Tannús | `manual_review` | solo_practitioner | maybe |
| Dra. Bianca Almeida | `manual_review` | solo_practitioner | maybe |

3 clean `promote_candidate` results, 2 `manual_review` (solo practitioners — a single bare "Dra." name signal, exactly the conservative "maybe" behavior documented in `crawler-icp-classification.md`). No `--include-existing` matches found — none of these 5 overlap with an already-promoted clinic.

## 5. Operator Shortlist Result

`npm run crawler:operator:shortlist -- --include-existing --output markdown`:

- **Total revisado:** 5
- **Acionáveis:** 5 (3 `promote_next` + 2 `manual_review`)
- **Bloqueados:** 0
- **Duplicados/já existentes:** 0
- **Sem website próprio (social/mensageria):** 0
- **Candidato recomendado:** `30636337-d22b-411c-ac3d-70fcf7ed11c2` (Clínica Dermavive)

Ranking (rankScore, all deterministic, tie-broken by `created_at desc`):

1. Clínica Dermavive — `promote_next` (100)
2. MV Dermatologia — `promote_next` (100)
3. Instituto Fraga de Dermatologia — `promote_next` (100)
4. Dra. Bianca Almeida — `manual_review` (50)
5. Dra Bárbara Tannús — `manual_review` (50)

The JSON `--only-actionable` run (Step 9) confirmed the exact same shape,
ordering, and `recommendedCandidateId` — stable across output formats.
Command suggestions printed the real, correct commands
(`npm run crawler:promote -- --candidate-id ...` and
`npm run crawler:queue:process -- --clinic-ids ... --max-pages 3
--allow-real-crawl --approved-domains ...`), matching what was actually
run in Steps 13 and 16 below, flag-for-flag.

## 6. Recommended Candidate or Stop Reason

Recommended: `30636337-d22b-411c-ac3d-70fcf7ed11c2` — "Dermatologista - Dra.
Juliana de Morais Fernandes Krakheche - Clínica Dermavive". No stop
condition applied (not a duplicate, not a directory, not a social-profile
website, not wrong-audience, not hospital/franchise/chain, ICP fit `core`).

## 7. Selected Candidate and Why

Selected the shortlist's `recommendedCandidateId` directly, without
manual override. Among the three tied `promote_next` candidates
(Dermavive, MV Dermatologia, Instituto Fraga), the shortlist's rank #1 was
accepted as-is per the task's "choose at most one candidate" instruction
and the shortlist's own design (ties broken by discovery recency, not a
judgment call the operator needs to re-litigate for three otherwise
equally-qualified independent clinics).

## 8. Promoted Clinic ID

`cba81861-298a-4888-8eb8-bc1403076ae8` — display name "Dermatologista -
Dra. Juliana de Morais Fernandes Krakheche - Clínica Dermavive", website
`http://www.dermavive.com.br/`, status `prospect`. Exactly one candidate
promoted, per the task's promotion limit.

## 9. Crawl Job ID/Result

`crawlJobId`: `69f5d65b-4d1b-4575-a046-8bfd0f26e248`

- `finalStatus`: `partial` (`page_limit_reached` — 3 pages fetched, 6 discovered, 0 failed; expected given the required `--max-pages 3` cap, not a technical failure)
- `pagesFetched`: 3
- `scoreTotal`: 87/100 (v1)
- `outreachDraftId`: `e1c020e2-628d-4ea3-b6b1-20af2f5988a2` (email, auto-generated by the crawl step, status `draft`)
- Approved domains used: `www.dermavive.com.br,dermavive.com.br` — explicit, per-invocation, not persisted, no wildcards.
- SSRF guard, robots.txt policy, TLS validation, and redirect guard were all the existing, unmodified `lib/operations/pipeline/controlled-transport.ts` machinery — nothing bypassed.

## 10. Screenshot/Storage Result

Both captured successfully, both `pending_storage` (no `SCREENSHOT_STORAGE_BUCKET` configured, exactly as the preflight warning predicted — expected, not an error):

- Desktop: asset `9b19a2c6-75cd-4cc0-92c2-470dcde7d012`
- Mobile: asset `93e9fc6a-3fe3-490f-a062-598b932d815a`

## 11. Operational Report Result

Written to `artifacts/reports/cba81861-298a-4888-8eb8-bc1403076ae8.md`
(gitignored, not committed). Score 87/100 v1 (Credibilidade 20/20, Clareza
15/20, Mobile 20/20, Conversão/Contato 12/20, Atualização 20/20). Real
contact evidence found: phone `(11) 2366-6007`, WhatsApp click-to-chat
link, Facebook/Instagram social links. Crawl error code
`page_limit_reached` surfaced with a clear pt-BR explanation and suggested
next action ("repeat with a higher page limit if needed"). Draft outreach
copy generated, disclaimer present verbatim, no medical-quality claim.

## 12. Review Pack Result

Written to `artifacts/review-packs/cba81861-298a-4888-8eb8-bc1403076ae8.md`
(gitignored). One `[medium]` risk flag: `crawl_partial` (expected — see
Section 9). Two `[info]` flags: `low_confidence_contact_data`,
`requires_human_review` — both standard boilerplate, not new problems.
Both WhatsApp (click-to-chat, not yet persisted as a draft row) and e-mail
(already-persisted draft) copy shown as draft/`review_required`, disclaimer
present verbatim in both.

## 13. Score Result

Score already computed as part of the crawl step (`scoreTotal: 87`, v1,
`review_status: pending_review`) — no separate recalculation was needed;
`crawler:recalculate-score` was not run since no stale/incomplete score
condition applied.

## 14. Prioritization/Template Result

`npm run crawler:prioritize-prospects --output table`: clinic ranked
**tier `medium`, score 50**, `next_action: review_pack`. Note this
prioritization score (50) is lower than the raw digital score (87) — the
prioritization model (`docs/technical/crawler-score-prioritization-alignment.md`)
discounts for the `crawl_partial` status and for not yet having a review
decision at the time it was run; this is documented, expected behavior of
the existing scoring model, not a bug introduced by this run.

Commercial template pack (medium tier, softer copy) written to
`artifacts/commercial-templates/cba81861-298a-4888-8eb8-bc1403076ae8.md`
(gitignored). One `[info]` risk flag (`crawl_partial`) and one operator
warning: no public WhatsApp *number* met the template pack's stricter
contact-confidence bar for a click-to-chat link, even though the
crawl/review-pack layer did surface WhatsApp evidence at `medium`/`high`
confidence — a pre-existing, documented nuance between the two layers
(see Limitations, Section 19), not something this run's shortlist feature
touches.

## 15. Review Decision Result

Recorded `approved` (`decisionId`: `ee67e3b6-a48b-441c-a30c-7ffbd597a4de`,
reviewer "Operator Run v4 (shortlist rehearsal)"). Rationale used in
`--notes`: score 87/100, own domain confirmed, ICP core/independent_clinic,
real phone/WhatsApp contact found on the site itself, and the only
negative signal (`crawl_partial`) is attributable to this rehearsal's own
deliberate `--max-pages 3` limit, not a real technical or content problem.
The command's own response confirms it never touches `outreach_messages`
status: `"Outreach status unchanged — this command never sends anything
and never auto-approves outreach."`

## 16. Manual Packet/Log Result

Approval gate check: `allowed: true` for the e-mail channel
(`Clinic is not do_not_contact, the outreach message is in a sendable
state, and the latest human review decision is approved.`). WhatsApp
channel came back `blocked` with code `no_persisted_draft_for_channel` —
expected, since the crawl step only auto-generates an e-mail draft, not a
WhatsApp one; the manual outreach pack correctly reported
`status: partial_blocked` and excluded WhatsApp copy rather than
fabricating it.

Manual outreach pack written to
`artifacts/manual-outreach-packs/cba81861-298a-4888-8eb8-bc1403076ae8.md`
(gitignored) — e-mail copy shown as draft, disclaimer present, no
medical-quality claim, no invented client/testimonial/award.

Logged exactly one event: `rehearsal_logged` (log ID
`20f18c7f-7ac4-433d-88cc-374eef890ec9`, channel `email`). No
`manual_send_logged` event was ever recorded — no human sent anything
outside the system during this rehearsal.

## 17. Retained Staging Rows

All in the staging project (`lfkyiztuwptmddsraucg`), all intentionally
kept (this is a real, permanent staging rehearsal record, same pattern as
runs v1–v3):

- 1 discovery job (`0bb1d5f4-04d7-412e-bcd8-191d063c0a1a`) with 5 candidates
- 1 promoted clinic (`cba81861-298a-4888-8eb8-bc1403076ae8`)
- 1 crawl job (`69f5d65b-4d1b-4575-a046-8bfd0f26e248`) with 2 screenshot assets
- 1 score row (v1, total 87)
- 1 outreach message (e-mail, status `draft`)
- 1 human review decision (`approved`)
- 1 manual outreach log (`rehearsal_logged`)

## 18. Stop/Proceed Reasoning

Proceeded through the full pipeline. No stop condition was triggered at
any step:

- No production ref detected anywhere (confirmed by preflight and by
  every command's `--target staging`).
- No secret ever printed (env values are never logged by any command
  used; `npm run` itself redacted flag values with `***` in its own echo).
- The shortlist recommended exactly one clean candidate (not none).
- The candidate was not a duplicate, not a directory, not a social-profile
  website, not wrong-audience, not hospital/franchise/chain, not
  ICP-blocked, and had its own real domain.
- `robots_denied` never occurred.
- The crawl reached `partial` (page-limit only), not a TLS/DNS/redirect
  failure — evaluation was fully possible.
- A real score was computed (87/100) — never missing.
- The commercial template was generated, not withheld.
- The review decision was `approved`, not `rejected`/`needs_changes`.
- The approval gate allowed the e-mail channel.
- No medical-quality claim or invented client/testimonial appeared in any
  generated copy.
- No send-capable path was ever triggered — only `rehearsal_logged`.

## 19. Safety Confirmations

- Target was `staging` (`lfkyiztuwptmddsraucg`) for every real command; production (`cskodsnvghavkcjwmafr`) was never targeted and is refused structurally regardless.
- No secret (API key, service role key, DB URL) appeared in any command output, log, or this document.
- Discovery was a single query, single page, capped at 5 results — never broadened.
- Promotion was limited to exactly one candidate, selected only from the shortlist's clean `promote_next` recommendation.
- Crawl was limited to exactly one clinic, `--max-pages 3`, explicit approved domains only (no wildcards), SSRF guard/robots.txt/TLS validation/redirect guard all active and unmodified.
- No WhatsApp API, no Resend/e-mail-provider send, no automated send path of any kind was invoked.
- `manual_send_logged` was never used — only `rehearsal_logged`.
- The outreach message remained `status: draft` throughout (confirmed both by the manual outreach pack's own gate-check output in Section 16 and the outreach log listing in Step 25 showing only a `rehearsal_logged` row, never a status-mutating one).
- No UI code was touched.

## 20. Limitations Found

- **Contact-confidence bar mismatch between layers:** the operational
  report/review pack surface WhatsApp evidence at `medium`/`high`
  confidence extracted from the crawl, but the commercial template pack
  applies a stricter check before generating a WhatsApp click-to-chat
  link and found none — meaning an operator reading only the template
  pack could wrongly conclude "no WhatsApp available" when the review
  pack already shows one. Pre-existing behavior, not introduced or
  affected by the shortlist CLI; worth a future look but out of scope
  here.
- **Prioritization score vs. digital score can diverge confusingly:**
  score 87/100 (v1) but prioritization tier `medium` (score 50) reads as
  contradictory at a glance unless the operator knows the prioritization
  model separately discounts for `crawl_partial` and pre-decision state.
  Already documented in `crawler-score-prioritization-alignment.md`; the
  shortlist CLI itself does not use or reference this second scoring
  layer at all, so this run only re-confirms an existing, known gap.
- **Ties among multiple equally-ranked `promote_next` candidates:** with
  3 candidates all scoring 100, the shortlist's tie-break (discovery
  recency) is a reasonable default but is silent about *why* one was
  picked over the other two beyond "arrived more recently in this batch."
  For this run all three were dermatology solo/independent practices of
  similar apparent quality, so the choice was low-stakes; a future
  enhancement could optionally surface the runner-up candidates' names in
  the "recommended" summary line for visibility, though this is not
  required by any stop condition or safety rule today.

## 21. Comparison with Run v3

Run v3 (`crawler-single-prospect-operator-run-v3-icp.md`) had the operator
read the raw `list-candidates.ts` markdown output, mentally combine ICP
fit + website checks, and hand-pick the single clean candidate. This run
(v4) instead ran the shortlist CLI immediately after candidate review and
got: a one-line answer ("recommended: `30636337-...`"), a summary
(0 blocked, 0 duplicate, 0 social/no-own-website, 5 total), and
copy-paste-ready next commands, all before the operator had to read a
single per-candidate row in detail. Both runs reached the identical
underlying classification (all three `promote_candidate` candidates were
already visible in `list-candidates.ts` output); the difference is entirely
in how much the operator had to manually assemble versus being handed
directly.

## Important Evaluation

**Did the shortlist reduce manual ambiguity?**
Yes. `list-candidates.ts` alone required scanning 5 rows and mentally
filtering for `promote_candidate` + core ICP fit + no existing-match. The
shortlist collapsed this into one `recommendedCandidateId` field and a
one-line stop/proceed summary — no mental filtering required.

**Did it avoid duplicates/social-profile/no-own-website candidates?**
Not directly tested by *this* batch (none of the 5 candidates were
duplicates or social-profile-only — the query happened to return a clean
set), but this was already validated on real data in the shortlist CLI's
own staging validation (`crawler-operator-shortlist-cli.md`) against run
v2's and v3's discovery jobs, where genuine duplicates and a social-profile
candidate (Lumina Pelle, Instagram) were both correctly excluded from the
recommendation. This run adds a *third* confirming data point that a clean
batch produces a clean, unambiguous recommendation rather than a false
negative.

**Did it recommend the same candidate the operator would choose manually?**
Yes. Manually reading the `list-candidates.ts` output, an operator would
have picked any of the three `promote_candidate` core-ICP candidates —
the shortlist's rank #1 (Clínica Dermavive) is a valid, defensible choice
among them, and none of the three would have been a wrong pick.

**Did ICP classification affect the shortlist correctly?**
Yes. The two solo-practitioner candidates (Bárbara Tannús, Bianca Almeida)
were correctly demoted to `manual_review` (rankScore 50, not 100) purely
because of their `maybe` ICP fit — despite both having perfectly good own
websites and no other blocker. This is the exact conservative behavior
`crawler-icp-classification.md` specifies: a single weak/ambiguous name
signal never fully blocks, but it also never gets auto-promoted alongside
a `core`-fit candidate.

**Did command suggestions save operator time?**
Yes, and they were verified byte-for-byte against what was actually run in
Steps 13 and 16 — `npm run crawler:promote -- --candidate-id
30636337-d22b-411c-ac3d-70fcf7ed11c2` and `npm run crawler:queue:process --
--clinic-ids <CLINIC_ID> --max-pages 3 --allow-real-crawl
--approved-domains <APPROVED_DOMAIN>` were copy-pasted directly, with only
`<CLINIC_ID>` and `<APPROVED_DOMAIN>` needing to be filled in (the latter
by design — the shortlist cannot safely guess which of `dermavive.com.br`
vs `www.dermavive.com.br` an operator wants to explicitly approve).

**Did the operator still need manual judgment?**
Yes, in two places the shortlist does not (and should not) automate: (1)
picking one candidate among multiple tied `promote_next` results is still
a human call, even though this run accepted the shortlist's own
tie-break; and (2) deciding the human review decision (`approved` here)
and personally re-reading every piece of generated copy before any real
send remain fully manual, exactly as every safety document in this repo
requires.

## 22. Recommendation for Next Run

The shortlist CLI performed as designed and measurably reduced the manual
steps between "raw discovery output" and "one confirmed next action." For
run v5, consider: (1) trying a query more likely to surface an existing
duplicate or a social-profile-primary-website candidate, to exercise the
shortlist's blocking behavior end-to-end in a real (not just re-run-v2/v3)
batch; and (2) if the operator UI (`/operacao`) work ever starts, use this
run's exact command sequence (Steps 5–25) as the reference flow to
replicate in the UI, since it is now the shortest fully-validated path
from discovery to a logged rehearsal.
