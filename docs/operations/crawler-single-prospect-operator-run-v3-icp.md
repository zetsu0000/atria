# Crawler Single-Prospect Operator Run — v3 (ICP Classification Active)

Status date: 2026-07-24
Branch: `feature/crawler-single-prospect-operator-run-v3-icp`
Base tag: `atria-crawler-icp-classification-v1`
Target: `staging` (`lfkyiztuwptmddsraucg`) only. Production (`cskodsnvghavkcjwmafr`) was never touched.

This is the third real operational rehearsal of the single-prospect flow,
and the first run with ICP classification
(`docs/technical/crawler-icp-classification.md`) active end-to-end. Unlike
v1 (stopped at candidate selection — all duplicates) and v2 (stopped at
template generation — crawl failed with `redirect_blocked`), **this run
completed the full pipeline through an approved human review decision and
a gate-checked manual outreach packet** — the first fully successful
happy-path rehearsal in this series.

## 1. Exact Commands Run (secrets redacted — none were ever printed)

```bash
# Step 2-4: preflight
npx tsx scripts/crawler/operator-preflight.ts --target staging

# Step 5-6: one narrow, real Google Places discovery
npx tsx scripts/crawler/discover-google-places.ts \
  --target staging --query "clínica dermatológica" --location "Pinheiros, São Paulo, SP" \
  --max-results 5 --max-pages 1

# Step 7: review candidates with ICP classification (markdown)
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id c04f4961-57ff-47dd-8ebf-b4dd12dd863c \
  --include-existing --output markdown

# Step 8: only-promotable, JSON, to inspect ICP fields precisely
npx tsx scripts/crawler/list-candidates.ts \
  --target staging --discovery-job-id c04f4961-57ff-47dd-8ebf-b4dd12dd863c \
  --include-existing --only-promotable --output json

# Step 12: promote exactly one candidate
npx tsx scripts/crawler/promote-candidate.ts \
  --target staging --candidate-id 4f674f27-ffcc-4ea8-8303-a7c85bc30e3e

# Step 14: controlled crawl, one clinic, explicit approved domain, max 3 pages
npx tsx scripts/crawler/process-crawl-queue.ts \
  --target staging --clinic-ids 87722758-55cd-41c6-806d-03f467cd7203 \
  --allow-real-crawl --approved-domains nataliasegatti.com.br \
  --max-pages 3 --capture-screenshots

# Step 15: operational report
npx tsx scripts/crawler/generate-operational-report.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 \
  --crawl-job-id 69e0bcf2-927c-4580-9fd0-44e6fefbd849 --output json

# Step 16: human review pack
npx tsx scripts/crawler/generate-human-review-pack.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 \
  --crawl-job-id 69e0bcf2-927c-4580-9fd0-44e6fefbd849 --output json

# Step 18: prioritization
npx tsx scripts/crawler/prioritize-prospects.ts --target staging --output table --limit 20

# Step 19: commercial template pack
npx tsx scripts/crawler/generate-commercial-template-pack.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 --output json

# Step 20: record an approved human review decision (evidence was strong)
npx tsx scripts/crawler/review-decision.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 \
  --decision approved --reviewer "Operator Run v3" --notes "<see Section 14>"

# Step 21: manual outreach-ready packet (gate-checked)
npx tsx scripts/crawler/generate-manual-outreach-pack.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 --output json

# Step 22: record a rehearsal log only — never manual_send_logged
npx tsx scripts/crawler/record-manual-outreach-log.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 \
  --outreach-message-id 8ce4627e-8f90-4c1a-b439-5e146fd27e96 \
  --event-type rehearsal_logged --channel email \
  --operator-name "Operator Run v3" --occurred-at 2026-07-24T00:31:00Z \
  --dry-run false

# Step 23: confirm the outreach message is still draft (read-only)
npx tsx scripts/crawler/list-manual-outreach-logs.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203
npx tsx scripts/crawler/check-outreach-approval-gate.ts \
  --target staging --clinic-id 87722758-55cd-41c6-806d-03f467cd7203 \
  --outreach-message-id 8ce4627e-8f90-4c1a-b439-5e146fd27e96
```

## 2. Selected Query/Location

- Query: `"clínica dermatológica"`
- Location: `"Pinheiros, São Paulo, SP"`
- Limits applied: `--max-results 5`, `--max-pages 1`.

## 3. Discovery Result Summary

```json
{
  "discoveryJobId": "c04f4961-57ff-47dd-8ebf-b4dd12dd863c",
  "totalFoundByProvider": 5,
  "importedCount": 5,
  "duplicateCount": 0
}
```

5 brand-new `prospect_candidates` rows: "Clínica Dermatológica e Nutrição
Lumina Pelle", "Clínica Dra. Natália Segatti", "Dra Gisele Siqueira",
"Dermaclinic", "Dra. Paula Ferreira". `duplicateCount: 0` at
*discovery* time is notable — "Dermaclinic" is, in fact, an
already-promoted clinic in staging from an earlier session, but
discovery-time dedup only checks against other *candidate* rows
(`findCandidateByDedupeKey`), never against already-promoted clinics —
this gap is exactly what Step 7's `--include-existing` check exists to
catch (see Section 4).

## 4. Candidate Review CLI Output Summary

All 5 candidates, with ICP fields:

| Candidate | organization_type | icp_fit | decision_complexity | suggested_action |
|---|---|---|---|---|
| Clínica Dra. Natália Segatti | `independent_clinic` | `core` | `owner_led` | `promote_candidate` |
| Clínica Dermatológica e Nutrição Lumina Pelle | `independent_clinic` | `core` | `owner_led` | `promote_candidate` |
| Dra Gisele Siqueira | `solo_practitioner` | `maybe` | `owner_led` | `manual_review` |
| Dra. Paula Ferreira | `solo_practitioner` | `maybe` | `owner_led` | `manual_review` |
| Dermaclinic | `independent_clinic` | `core` | `owner_led` | `blocked_existing` (matched already-promoted clinic `9e76f7e5-5c24-434c-96ce-8ce22768e457` via normalized website — duplicate detection still took priority over ICP, as designed) |

`--only-promotable` correctly narrowed this to exactly 2 candidates
("Clínica Dra. Natália Segatti" and "Lumina Pelle") — both `core` ICP fit,
no blockers.

## 5. ICP Classification Result for Each Candidate

- **Clínica Dra. Natália Segatti** — `independent_clinic`/`core`/`owner_led`. Name contains "Clínica" + a named doctor; own real domain (`nataliasegatti.com.br`); no directory/chain/hospital/wrong-audience signal. `icpReasons: ["likely_core_icp"]`, `icpBlockers: []`.
- **Clínica Dermatológica e Nutrição Lumina Pelle** — `independent_clinic`/`core`/`owner_led` **by the classifier**, but its `websiteUrl` is `https://www.instagram.com/luminapelle/` — an Instagram profile, not a real business website. `normalizedWebsiteOrigin` literally resolves to `https://www.instagram.com`. Instagram is not in the known-directory allowlist (it's not a *clinic* directory like Doctoralia), so neither the existing directory check nor the ICP classifier catches this — see Section 17/19.
- **Dra Gisele Siqueira** / **Dra. Paula Ferreira** — both `solo_practitioner`/`maybe`/`owner_led`. Bare "Dra." personal-name pages, own real domains, no "clínica"/"instituto" keyword present — correctly resolved to the conservative `maybe` bucket rather than a confident `core`, per the documented rule.
- **Dermaclinic** — classifier itself says `independent_clinic`/`core` (a real, legitimate clinic — it's the same business already promoted earlier in staging), but `suggestedAction` is `blocked_existing` because the duplicate/existing-clinic check runs *before* ICP in the priority chain, exactly as designed.

## 6. Selected Candidate

**Clínica Dra. Natália Segatti** (`4f674f27-ffcc-4ea8-8303-a7c85bc30e3e`) —
the only candidate that is simultaneously: not a duplicate, not a
directory listing, not wrong-audience, not hospital/franchise/chain,
`icpFit: core`, and has a genuine, crawlable own website. "Lumina Pelle"
was deliberately excluded by operator judgment (see Section 17) despite
also showing `core`/`promote_candidate`.

## 7. Promoted Clinic ID

`87722758-55cd-41c6-806d-03f467cd7203` — "Clínica Dra. Natália Segatti",
website `http://nataliasegatti.com.br/`.

## 8. Crawl Job ID/Result

- Crawl job: `69e0bcf2-927c-4580-9fd0-44e6fefbd849`
- `--approved-domains nataliasegatti.com.br`, `--max-pages 3`, `--allow-real-crawl`, `--capture-screenshots`
- Result: **`status: "partial"`** (page limit reached, expected with `--max-pages 3`), `pagesDiscovered: 51`, `pagesFetched: 3`, `pagesFailed: 0`, `errorCode: "page_limit_reached"`
- This is the **first fully successful real-domain crawl** across this rehearsal series (v1 never reached a crawl; v2's crawl failed with `redirect_blocked`).

## 9. Screenshot/Storage Result

Both desktop (`14317e88-c886-4354-898b-f5db36a7ebac`) and mobile
(`468a19a4-4123-45ed-923e-774bc17f02d9`) screenshots captured
successfully, `captureStatus: "pending_storage"` (no `SCREENSHOT_STORAGE_BUCKET`
configured, expected behavior — bytes never uploaded, no storage failure).

## 10. Operational Report Result

`status: "draft"`, complete. Score 88/100 (v1). Real evidence: HTTPS
confirmed, institutional title, contact/address candidates, service
candidates, headings, meta description, internal navigation, WhatsApp
click-to-chat link, phone, two social links (Facebook, Instagram).
`mainIssues`: only actionability slightly below expected (8/20) — "Telefone
ou WhatsApp público candidato encontrado" was the limiting factor. An
outreach draft (email channel) was auto-created by the crawl pipeline
(`8ce4627e-8f90-4c1a-b439-5e146fd27e96`), correctly `status: "draft"`.

## 11. Review Pack Result

`status: "draft"`. `internalSummary`: *"Clínica Dra. Natália Segatti —
score 88/100 (v1) — crawl partial (3 páginas analisadas) — screenshots:
desktop capturado, mobile capturado."* Risk flags: `crawl_partial`
(medium, page-limit-reached — explained via the error-code-surfacing
fix), `low_confidence_contact_data` (info), `requires_human_review`
(info) — nothing hard-blocking. Both WhatsApp (freshly generated,
click-to-chat link resolved from the real published WhatsApp link) and
email (persisted, matching the crawl-generated draft) suggested drafts
are `available: true`.

## 12. Score Result

Computed automatically during the crawl (no `recalculate-score` needed —
`pagesFetched: 3 > 0`, so the main pipeline scored it inline): `total: 88`,
`scoringVersion: "v1"`. Every dimension near-maximal except actionability
(8/20, the only real gap: contact is present but not visually prominent).

## 13. Prioritization/Template Result

- Prioritization: **`medium` tier, priority score 50**. Breakdown: base 20 + own website +10 + screenshot evidence +15 − partial-crawl penalty −10 + score-available +10 − "score already very high, little improvement room" −5 + public-contact +10 = 50. Not an ICP effect — `icp.icpFit: "core"` applied no adjustment; this is the pre-existing score-based tier model doing exactly what it's designed to do (a near-perfect 88/100 site has less "before/after" story to sell, which the model already penalizes independent of ICP).
- Commercial template: generated for both channels (`medium` tier → softer `mediumTierCopy`), `blockedReason: null`. No medical claims, no invented testimonials, disclaimer present, no internal score number leaked into copy.

## 14. Review Decision Result

Recorded **`approved`** (`4d46d8f0-abad-4f48-92ca-19c87975cb4c`), reviewer
"Operator Run v3", with notes: *"Clínica independente real, site próprio,
score 88/100, contatos públicos reais (WhatsApp/telefone/redes sociais),
sem CRM/RQE/depoimentos inventados. ICP core, sem bloqueios. Rehearsal de
operador (run v3 ICP)."* This is the strongest evidence seen across all
three rehearsals in this series, justifying a real `approved` decision
rather than stopping short.

## 15. Manual Packet/Log Result

- `generate-manual-outreach-pack.ts` → `status: "partial_blocked"`. The
  `email` channel is **`allowed`** (approval gate passed: not
  `do_not_contact`, message sendable, latest decision `approved`) and
  fully populated. The `whatsapp_manual` channel shows `blocked` with
  `code: "no_persisted_draft_for_channel"` — **not** an approval failure,
  simply that the crawl pipeline only auto-creates one draft (email, by
  default) and no separate WhatsApp draft was ever persisted for this
  clinic. This is expected, documented behavior, not a stop condition.
- Logged **`rehearsal_logged`** only (`fefba758-a3bb-4d92-88d2-b4a6b88015d1`,
  channel `email`) — never `manual_send_logged`, since no human sent
  anything outside the system in this rehearsal.
- Confirmed read-only afterward: `check-outreach-approval-gate.ts` shows
  `allowed: true` (meaning a real sender, if one existed, would be
  permitted to use this draft) but the message itself remains
  `status: "draft"` throughout — nothing was ever sent.

## 16. Retained Staging Rows

- 1 new `discovery_jobs` row: `c04f4961-57ff-47dd-8ebf-b4dd12dd863c` (`candidatesCreated: 5`).
- 5 new `prospect_candidates` rows (1 now `promoted_to_clinic`, 4 still `new`).
- 1 new `clinics` row: `87722758-55cd-41c6-806d-03f467cd7203`.
- 1 new `crawl_jobs` row: `69e0bcf2-927c-4580-9fd0-44e6fefbd849` (`status: "partial"`).
- 2 new `scan_assets` rows (screenshots, `pending_storage`).
- 1 new `scores` row (`total: 88`, `scoringVersion: "v1"`).
- 1 new `outreach_messages` row: `8ce4627e-8f90-4c1a-b439-5e146fd27e96` (`status: "draft"`, channel `email`) — auto-created by the crawl pipeline.
- 1 new `human_review_decisions` row: `4d46d8f0-abad-4f48-92ca-19c87975cb4c` (`decision: "approved"`).
- 1 new `manual_outreach_logs` row: `fefba758-a3bb-4d92-88d2-b4a6b88015d1` (`eventType: "rehearsal_logged"`).
- No existing staging row was modified; no row was deleted.

## 17. Stop/Proceed Reasoning

**Proceeded** through the full pipeline — discovery → ICP-aware candidate
review → promotion → real crawl → report → review pack →
prioritization → template → **approved** review decision → gate-checked
manual outreach packet → rehearsal log. This is the first run in the
series to reach the end without stopping.

**One deliberate operator judgment call**: "Lumina Pelle" was excluded
from selection even though both the pre-existing "has own website" gate
and the new ICP classifier marked it `promote_candidate`/`core`. Its
`websiteUrl` is an Instagram profile, not a real business website — no
existing check (directory allowlist, ICP classifier) currently
distinguishes "has a URL" from "has a real, crawlable business site."
Promoting and crawling it would likely either fail outright (Instagram
blocks most automated fetches) or produce meaningless "evidence" from a
social media page rather than the clinic's real digital presence. This
is documented as a real limitation, not silently worked around — see
Section 19.

## 18. Safety Confirmations

- [x] Staging target only (`lfkyiztuwptmddsraucg`) used for every real command; production ref (`cskodsnvghavkcjwmafr`) never used.
- [x] `operator-preflight` confirmed `overallStatus: "ready"` before any other command ran.
- [x] Exactly one Google Places query, one page, max 5 results — no SERP call, no Google Maps scraping.
- [x] Exactly one candidate promoted (of 5 available).
- [x] Exactly one clinic crawled, `--max-pages 3`, explicit `--approved-domains nataliasegatti.com.br` (no wildcards), SSRF guard active, robots.txt respected (crawl completed cleanly, no robots-related failures), TLS never bypassed.
- [x] No WhatsApp API or e-mail provider send invoked — none exist in this codebase and none were called.
- [x] `manual_send_logged` was never used — only `rehearsal_logged`, matching the task's explicit instruction.
- [x] The outreach message row remained `status: "draft"` at every checkpoint, confirmed read-only at the end.
- [x] No secret value (API key, service role key, DB URL) was printed, logged, or written to this document or any artifact.
- [x] No file under `app/`, `components/`, `lib/`, or `scripts/` was modified — only this doc was created.

## 19. Limitations Found

1. **Instagram-only "websites" are not distinguished from real business sites.** Neither the pre-existing directory-listing allowlist (`lib/discovery/directory-listing.ts` — scoped to *clinic-specific* directories like Doctoralia, not general social platforms) nor the new ICP classifier flags a candidate whose `websiteUrl` is a social-media profile URL rather than an owned domain. "Lumina Pelle" passed both checks as `core`/`promote_candidate`. This is a real, actionable gap — worth a dedicated follow-up (e.g. a small, explicit "known social-platform-only origins" list, similar in spirit to the directory-listing allowlist).
2. **Discovery-time dedup doesn't check against already-promoted clinics.** "Dermaclinic" was re-discovered as `duplicateCount: 0`/status `new`, even though it's the exact same business already promoted in a prior session. The candidate review CLI's `--include-existing` check caught it correctly, but an operator who skips that step (or only reads the raw discovery output) could be misled into thinking it's a fresh prospect. This is a pre-existing, already-documented characteristic of the discovery-time dedupe (see `docs/technical/crawler-website-dedupe-normalization.md`), reconfirmed here against a new real example.
3. **A near-perfect score (88/100) caps prioritization at `medium`, not `high`.** Not an ICP issue — the pre-existing score-tier model treats a very high score as "little improvement room to sell," which is a deliberate, already-documented design choice (`docs/technical/crawler-score-prioritization-alignment.md`), reconfirmed here rather than newly discovered.
4. **`generate-manual-outreach-pack.ts`'s `partial_blocked` status conflates two different situations**: a channel blocked by the approval gate (a real reason to stop) vs. a channel blocked only because no draft was ever persisted for it (not a real block, just "nothing to check"). Both surface as `riskFlags: [{ code: "channel_blocked" }]` with the same `severity: "high"`, which could read as more alarming than it is. Worth a follow-up to distinguish these two cases with different severities/messages.

## ICP Evaluation (required questions)

**Did ICP classification prevent any poor-fit candidate from moving
forward?** Yes, in principle — this discovery batch happened to contain
no hospitals/franchises/chains/wrong-audience businesses to demonstrate
against directly, but the *broader* staging pool (inspected read-only in
this same run, see the full-pool table in Section 4's underlying data)
already contains a real, previously-unflagged example from a prior
session ("Dermatológica - Farmácia de Manipulação em Curitiba", a
compounding pharmacy) that ICP classification now correctly flags
`blocked_icp`/`wrong_audience` — see
`docs/technical/crawler-icp-classification.md`'s own staging validation.
Within *this* run's 5 candidates, ICP correctly downgraded 2 solo-name
pages to `maybe`/`manual_review` instead of a confident `promote_candidate`.

**Did it classify any candidate too aggressively?** No false
over-blocking occurred in this run. The two solo-practitioner candidates
were downgraded to `maybe` (not blocked), and the single weak signal seen
in the broader pool ("GRUPO CPD," one occurrence of "grupo") correctly
stayed `independent_clinic`/`core` per the conservative two-signal rule.

**Did it miss any obvious franchise/hospital/chain/wrong-audience
signal?** Not among these 5 candidates (none were actually
franchises/hospitals/chains/wrong-audience by inspection). It did,
however, miss a *different* class of poor-fit signal not in its original
scope: an Instagram-only "website" ("Lumina Pelle") — see Limitation 1.
This isn't a classification miss in the hospital/franchise/wrong-audience
sense the feature targeted, but it is a real gap in the broader "is this
a genuine, crawlable clinic website" question.

**Did the operator still need manual judgment?** Yes, and this run
demonstrates exactly why that's by design, not a shortfall: the operator
had to (1) recognize that "Lumina Pelle" needed exclusion despite a clean
ICP verdict, (2) decide that 88/100 with real contact evidence justified
an `approved` decision rather than requesting changes, and (3) recognize
that `partial_blocked` on the manual outreach pack was a benign
"no draft for this channel" situation, not a real approval failure.
ICP classification narrows what needs judgment; it doesn't remove the
need for it.

**Did the flow improve compared with run v2?** Substantially. Run v2
stopped at template generation because the crawl itself failed
(`redirect_blocked`) — a crawl-execution issue, unrelated to ICP. This
run's crawl succeeded, and ICP classification meant the operator spent no
time considering the two solo-practitioner candidates as clean promotes,
and would have been protected from promoting a hospital/franchise/chain/
wrong-audience candidate had one appeared in this batch (as directly
demonstrated against the real pharmacy example in the broader staging
pool). Combined with the error-code-surfacing fix from the prior task,
this run reached, for the first time in this series, a genuine `approved`
review decision and a gate-checked, ready-to-manually-send draft.

## 20. Recommendation for Next Run

1. Add a small, explicit "known social-platform-only origin" detector (Instagram, Facebook, WhatsApp-only, Linktree, etc.) — reusing the same allowlist pattern as `lib/discovery/directory-listing.ts` — so candidates like "Lumina Pelle" are flagged `blocked_no_website`-equivalent rather than a clean `promote_candidate`. This directly closes Limitation 1.
2. Consider a distinct `riskFlags` severity/code for "channel has no persisted draft" vs. "channel blocked by approval gate" in `generate-manual-outreach-pack.ts`, closing Limitation 4.
3. Since this run reached a genuine `approved` decision with a real, gate-checked, ready-to-send email draft, the next logical step (still entirely manual, still no system send) would be for a human operator to actually review and manually send this specific draft outside the system, then log `manual_send_logged` — the first real end-to-end commercial use of this pipeline, if the business decides to proceed.
4. Consider generating a WhatsApp draft explicitly (not just relying on the crawl pipeline's default email-only draft creation) for clinics where a real WhatsApp number was found in `extractedContentSummary.contacts`, so `generate-manual-outreach-pack.ts` doesn't report `partial_blocked` for a channel that's genuinely available, just never drafted.
