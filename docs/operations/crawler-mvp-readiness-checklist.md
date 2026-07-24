# Crawler / Commercial Operations — MVP Readiness Checklist

Status date: 2026-07-24
Base tag: `atria-crawler-single-prospect-operator-run-v4-shortlist-v1`

This checklist consolidates the state of the Atria crawler and commercial-outreach
pipeline across every technical doc (`docs/technical/crawler-*.md`), the
operator runbook (`docs/operations/crawler-operator-runbook.md`), the operator
handoff pack (`docs/operations/crawler-operator-handoff-pack.md`), and four
validated end-to-end rehearsals (`docs/operations/crawler-single-prospect-operator-run-v1.md`
through `-v4-shortlist.md`) into a single readiness reference. It does not
change any code or behavior — it is a status snapshot and a launch/operator
checklist.

## Status Taxonomy

Every item below uses exactly one of these five labels:

- **Ready** — implemented, tested, and validated against real staging resources.
- **Ready with manual review** — implemented and working, but requires a human
  to check output before it is used commercially.
- **Not ready** — does not exist yet, or exists only partially.
- **Blocked** — exists but cannot proceed due to an external condition, or is
  explicitly forbidden by design as a hard boundary (see Section 6).
- **Future automation** — intentionally manual today; automating it is a later
  decision, not an MVP gap.

## 1. Executive Status

The full chain from discovery to an approved, rehearsal-logged manual outreach
packet has been validated end-to-end, four times, entirely in staging
(`lfkyiztuwptmddsraucg`), with zero writes ever made to production
(`cskodsnvghavkcjwmafr`). The newest rehearsal (run v4,
`docs/operations/crawler-single-prospect-operator-run-v4-shortlist.md`) added
the operator shortlist CLI to the flow and confirmed it reduces manual
ambiguity without weakening any safety gate.

**Must state clearly, and does not change with this document:**

- Production must not be touched yet.
- Actual sending is not implemented — no code path in this repository sends
  a WhatsApp message, e-mail, or any outbound communication.
- The system must not send WhatsApp or e-mail automatically, and never will
  until a separate, explicit decision authorizes building a sender.
- Human approval is required before any real contact.
- Contact is manual and happens outside the system.
- The system may store draft copy and log manual rehearsal/preparation
  (`rehearsal_logged`) or an actual manual send after the fact
  (`manual_send_logged`) — it never performs the send itself.
- No patient data is collected or used — only public clinic website content
  and operational metadata.
- No medical quality is evaluated — score v1 evaluates digital presentation
  only.
- No automated mass outreach — every stage operates on one candidate/clinic
  at a time.
- No Maps scraping or SERP scraping — discovery only calls the official
  Google Places `places:searchText` API.
- Crawls must stay single-prospect / approved-domain only — same-origin,
  bounded pages, explicit per-invocation domain approval, no wildcards.
- The score disclaimer must remain, verbatim, in every score output:

  > "Esta análise avalia apenas a apresentação digital e a facilidade de
  > encontrar informações. Não avalia qualidade médica."

This MVP is ready for **controlled, one-clinic-at-a-time, staging-validated
manual outreach preparation**. It is **not** ready for production, batch
operation, or any automatic send — see Sections 5–7 for exactly what remains
outstanding before any of that changes.

## 2. MVP Scope

The MVP covers one thing: turning a real clinic's public website into an
**approved, human-reviewed, manually-sendable outreach packet** — without ever
sending anything automatically. In order:

```
Google Places discovery
  -> candidate persistence
  -> candidate review / operator shortlist
  -> candidate promotion
  -> approved real-domain crawl
  -> screenshot capture/storage
  -> score v1 (calibrated)
  -> operational report
  -> human review pack
  -> prospect prioritization
  -> commercial templates by tier
  -> human review decision
  -> approval gate
  -> manual outreach-ready packet
  -> manual rehearsal log
  -> [STOP — no automatic sending]
```

Everything left of "human review decision" is automatable-in-principle today.
Everything right of it is, and must remain, a human action outside this
system. Candidate review / operator shortlist is a read-only decision-support
step inserted between candidate persistence and promotion — it narrows which
single candidate an operator should promote, it never promotes anything
itself.

## 3. Ready Items

Fully implemented, tested, and validated directly against real staging data
with no outstanding manual-review caveat beyond the standard human sign-off
already required at the review-decision step:

| Stage/Feature | Notes |
|---|---|
| Google Places discovery | Requires `GOOGLE_PLACES_API_KEY`; `--dry-run` needs no key. Calls only the official `places:searchText` API — no SERP, no Maps scraping. (`docs/technical/crawler-google-places-discovery.md`) |
| Candidate persistence | `prospect_candidates` table, RLS restricted to `service_role`. |
| Candidate review CLI | `crawler:candidates:list` — read-only, never crawls, never calls Google Places, never promotes; surfaces status, blockers, ICP fit, and one suggested action per candidate. (`docs/technical/crawler-candidate-review-cli.md`) |
| Operator shortlist CLI | `crawler:operator:shortlist` — read-only, wraps candidate review with conservative ranking, a summary, and copy-paste-safe next commands (real script names/flags only, never invented). Validated in run v4 to reduce manual ambiguity without ever recommending a duplicate, directory, social-profile, or ICP-blocked candidate. (`docs/technical/crawler-operator-shortlist-cli.md`) |
| Website dedupe normalization | http/https scheme-canonicalized identity comparison at candidate-review time (never at crawl time) — catches stale candidates that a naive scheme-sensitive match would miss. (`docs/technical/crawler-website-dedupe-normalization.md`) |
| Social-profile-website classification | Instagram/Facebook/WhatsApp/Linktree/link-in-bio URLs are never treated as a clinic's own website — flagged `blocked_no_own_website`, distinct from "no website" and "directory". (`docs/technical/crawler-social-profile-website-classification.md`) |
| Crawl error-code report surfacing | Specific `CrawlErrorCode` values (e.g. `redirect_blocked`, `dns_failed`, `timeout`, `page_limit_reached`) are preserved and explained in pt-BR to the operator, never collapsed to a generic message. (`docs/technical/crawler-error-code-report-surfacing.md`) |
| Candidate promotion | `crawler:promote` promotes exactly one candidate to a `clinics` row at a time. |
| Screenshot capture/storage | Private bucket `crawler-screenshots`, 5 MB limit, `image/png` only, `service_role`-only access, no public URLs. Compression retry validated. (`docs/technical/crawler-screenshot-storage-readiness-audit.md`) |
| Operational report | `crawler:report`. |
| Human review pack | `crawler:review-pack`. |
| Prospect prioritization | Read-only ranking; never crawls, never calls an external API, never mutates data. (`docs/technical/crawler-prospect-prioritization.md`) |
| Human review decision / review queue | Append-only `human_review_decisions`; no update/delete method exists. Latest decision always wins. |
| Approval gate | `assertOutreachApprovedForSend` checks clinic/message existence, do-not-contact, sendable status, and latest decision = `approved`. Currently unused by any sender because no sender exists — this is expected, not a gap. |
| Manual outreach log | Append-only `manual_outreach_logs`; CLI defaults to dry-run; `manual_send_logged` re-checks the approval gate. |
| Staging database (Supabase) | `atria-staging` project, fully migrated and validated, RLS enabled, `service_role`-only grants. |

## 4. Ready With Manual Review

Implemented and working, but a human must check the output before any
commercial use:

| Stage/Feature | Notes |
|---|---|
| Approved real-domain crawl | Allowlist defaults to `example.com`; `--approved-domains` extension is per-invocation, never persisted, no wildcards. SSRF/private-IP guards are independent of domain approval. (`docs/technical/crawler-approved-real-domain-crawl.md`) |
| Score v1 | Deterministic, 5 dimensions x 20 pts, schema-enforced non-medical disclaimer. Calibrated against a small number of real staging clinics — treat as directional, not statistically proven. (`docs/technical/crawler-score-calibration-v1.md`) |
| ICP classification | Pure, deterministic classifier (hospital/franchise/chain/directory/wrong-audience businesses flagged, never a clean promote) integrated into candidate review, the operator shortlist, prioritization, and commercial templates. Name/category-keyword heuristic — conservative by design, not exhaustive. (`docs/technical/crawler-icp-classification.md`) |
| Commercial templates by tier | Copy generated only for `high`/`medium` tiers; withheld for `low`/`blocked`/`needs_changes`/no-score/blocked or future_enterprise ICP. Templates are fixed per tier, not yet tuned against real outreach outcomes. Run v4 found a contact-confidence-bar mismatch between this layer and the review pack (see Section 18). |
| Manual outreach-ready packet | Copy is always the verbatim already-approved draft — never freshly generated at packet time. Correctly reports `partial_blocked` when a requested channel has no persisted draft, rather than fabricating copy. |

## 5. Not Ready

Does not exist yet, or exists only partially:

| Item | Notes |
|---|---|
| Batch / multi-clinic operation | Every stage today operates on one candidate/clinic at a time by design. |
| Operator UI (`/operacao`) | All operator actions are CLI scripts today; no dashboard exists. |
| Durable crawl worker / queue | `crawler:queue:process` exists but there is no durable/retrying worker infrastructure. |
| Preview generation table/flow | Out of scope for this MVP slice per `PROJECT_CRAWLER.md`. |
| Statistically validated score/template calibration | Score v1 and commercial templates are first-pass calibrations against a handful of real clinics, not outcome-tuned. |
| TLS-error-specific failure classification | `crawl_jobs.error_code` cannot yet distinguish a TLS certificate error from other low-level fetch exceptions; both collapse to `unexpected_error`. |
| Zero-page-crawl scoring behavior | Pipeline does not yet have a defined scoring behavior for a crawl that captured zero pages. |
| Responsive-design / freshness signals in score v1 | No dimension currently measures responsive layout or content freshness. |
| Staging cleanup/reset cadence | Staging rows accumulate across rehearsals with no defined retention/cleanup policy yet. |

## 6. Blocked / Explicitly Forbidden

Two distinct categories, both hard boundaries for this MVP:

**Explicitly forbidden by design (not a to-do, not a future task without a
separate explicit decision):**

- Automatic sending (email/WhatsApp/any channel) — no sender code path
  exists anywhere in the repository.
- Any production Supabase write — production ref `cskodsnvghavkcjwmafr` has
  never received a migration or a row; there is no `--target production`
  path in any crawler script.
- Automated mass/bulk outreach of any kind.
- Storing or using patient health data.
- Making any medical-quality, patient-outcome, or clinical-competence claim.
- Broad/unbounded crawling, Google Maps scraping, or SERP scraping.
- WhatsApp Business API integration or Resend/e-mail-provider send for
  crawler outreach (`RESEND_API_KEY` exists only for the unrelated
  lead-capture form).

**Blocked by an external condition (per-instance, not systemic):**

- At least one real-domain crawl rehearsal (GRUPO CPD) was blocked by the
  target site's own expired TLS certificate — no workaround was attempted,
  as intended; this stopped that single rehearsal, not the pipeline.
- `robots_denied` blocks a crawl whenever a site's own `robots.txt` forbids
  it — respected unconditionally, never bypassed.

## 7. Future Automation

Intentionally manual today; automating any of these is a later, separate
decision — not an MVP gap:

- Operator UI (`/operacao`) replacing the current CLI-only workflow.
- A durable, retrying crawl worker/queue beyond the current
  `crawler:queue:process` single-invocation script.
- Batch/multi-clinic discovery, promotion, crawling, or review-decision
  recording.
- Any real sender integration (WhatsApp/e-mail), gated behind its own
  explicit authorization and safety review — not something this checklist
  pre-approves.
- Bulk-approval of review decisions (today, intentionally, one clinic at a
  time by a human).
- Statistical/outcome-based recalibration of score v1 and commercial
  template copy once enough real send/response data exists.

## 8. Required Environment Variables (names only)

Persistence (staging/local; no separate production variable exists —
production access is architecturally refused, not just unconfigured):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEAD_HASH_SECRET`

Discovery:

- `GOOGLE_PLACES_API_KEY`

Screenshot storage:

- `SCREENSHOT_STORAGE_BUCKET` — optional; without it, screenshots persist as
  `pending_storage` and no upload is attempted (confirmed again in run v4).

Unrelated to crawler outreach (lead-capture form only — no crawler send
capability exists regardless of these being set):

- `RESEND_API_KEY`
- `LEAD_NOTIFICATION_EMAIL`
- `LEAD_FROM_EMAIL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

No secret values appear in this document or anywhere in this checklist doc set.

## 9. Staging vs. Production Separation

- Staging: Supabase project `atria-staging` (ref `lfkyiztuwptmddsraucg`).
  Fully migrated and validated. This is the only project any crawler/outreach
  script should point at during MVP operation.
- Production: Supabase project `Atria` (ref `cskodsnvghavkcjwmafr`). No
  migration, no row, no write has ever touched it. There is no `--target
  production` path in any crawler script — this is enforced in code
  (`lib/operations/pipeline/target-guard.ts`), not just by convention, and
  every crawler CLI's production-refusal path is covered by tests.
- A prior low-risk legacy `service_role` key exposure was identified during
  earlier staging validation; rotation was recommended but is non-urgent.
  Confirm this has been rotated before treating staging credentials as fully
  sealed (see Section 20).
- Operators must always confirm which Supabase project a script's
  `SUPABASE_URL` resolves to before running any `--target` other than
  `--dry-run` or `local`.
- **Staging data retention:** all rows created during rehearsals and
  validations (four full end-to-end runs so far) exist only in
  `atria-staging` — production has zero rows. Rows accumulate across
  rehearsals (multiple `clinics`, `crawl_jobs`, `scores`, `outreach_messages`
  rows exist for the same test clinics); no cleanup/reset cadence exists yet
  (see Section 5). Raw HTML, cookies, and headers are never persisted — only
  extracted, bounded content and screenshots. Screenshot storage is private
  and `service_role`-only; no public URL is ever generated for a stored
  image.

## 10. Operator Workflow

1. `npm run crawler:operator-preflight -- --target staging` — confirms
   environment/config sanity and production refusal; never prints a secret
   value.
2. `npm run crawler:discover:places -- --target staging --query "<QUERY>"
   --location "<LOCATION>" --max-results 5 --max-pages 1` — one narrow
   Google Places discovery (dry-run first with no key needed).
3. `npm run crawler:candidates:list -- --target staging --discovery-job-id
   <ID> --include-existing --output markdown` — read-only candidate review.
4. `npm run crawler:operator:shortlist -- --target staging --discovery-job-id
   <ID> --include-existing --output markdown` — ranked, decision-ready
   shortlist with a recommended candidate (or a stop reason) and real
   copy-paste-safe next commands.
5. `npm run crawler:promote -- --target staging --candidate-id <ID>` —
   promote exactly one candidate, using the shortlist's recommendation
   (or a manually-selected `promote_candidate`/justified `manual_review`
   candidate).
6. `npm run crawler:queue:process -- --target staging --clinic-ids <ID>
   --max-pages 3 --allow-real-crawl --approved-domains <DOMAIN>
   --capture-screenshots` — controlled crawl + screenshot capture, one
   clinic, explicit approved domain(s) only.
7. `npm run crawler:report -- --target staging --clinic-id <ID>
   --write-artifact` — operational report.
8. `npm run crawler:review-pack -- --target staging --clinic-id <ID>
   --write-artifact` — human review pack.
9. `npm run crawler:prioritize-prospects -- --target staging --output table`
   — prospect prioritization.
10. `npm run crawler:commercial-templates -- --target staging --clinic-id
    <ID> --write-artifact` — commercial template pack (high/medium tier only).
11. `npm run crawler:review-decision -- --target staging --clinic-id <ID>
    --decision approved|rejected|needs_changes --reviewer "<NAME>" --notes
    "<why>"` — record a human decision.
12. `npm run crawler:check-outreach-approval-gate -- --target staging
    --clinic-id <ID> --outreach-message-id <ID>` — confirm the gate allows
    the channel before generating a packet.
13. `npm run crawler:manual-outreach-pack -- --target staging --clinic-id
    <ID> --write-artifact` — manual outreach-ready packet (gate-checked).
14. `npm run crawler:outreach-log:record -- --target staging --clinic-id
    <ID> --outreach-message-id <ID> --event-type rehearsal_logged|
    manual_send_logged --channel <CHANNEL> --operator-name "<NAME>"
    --occurred-at <ISO_TIMESTAMP> [--dry-run false]` — log preparation
    (`rehearsal_logged`) always, or a real send (`manual_send_logged`) only
    after it actually happened outside the system.
15. `npm run crawler:outreach-log:list -- --target staging --clinic-id <ID>`
    — confirm the message row remains `status: draft` in the system
    regardless of what happened outside it.

Full step-by-step detail and rationale lives in
`docs/operations/crawler-operator-runbook.md`; the full command reference
with placeholders and hard safety rules lives in
`docs/operations/crawler-operator-handoff-pack.md`.

## 11. Safety Gates

- SSRF guard: blocks localhost, private IP ranges, CGNAT, cloud metadata
  endpoints, embedded credentials in URLs, non-http(s) schemes, non-80/443
  ports; resolves DNS and re-checks redirect targets.
- Domain allowlist: crawl only proceeds against `example.com` or domains
  explicitly passed via `--approved-domains` for that single invocation;
  never persisted, never wildcarded.
- Crawl limits: GET-only, same-origin only, robots.txt respected, path
  denylist, default max 8 pages / hard cap 20 pages, 10s timeout, 2MB max
  response body, 5 redirect cap, fixed User-Agent `AtriaPreviewBot/1.0`.
- Candidate-quality gates (read-only, pre-promotion): duplicate/existing-clinic
  detection (scheme-normalized), directory-listing detection, social-profile/
  messaging-website detection, and ICP classification all run before a
  candidate can reach a clean `promote_candidate`/`promote_next`
  recommendation — none of these mutate anything, they only classify.
- RLS on every table: `anon`/`authenticated` revoked, `service_role` only.
- Storage hygiene: no tokens, secrets, cookies, raw headers, or raw HTML are
  ever persisted.
- Approval gate: `assertOutreachApprovedForSend` requires the clinic and
  message to exist, neither flagged `do_not_contact`, message status
  sendable, and the *latest* `human_review_decisions` row to be `approved`.
- Append-only decision and log tables: `human_review_decisions` and
  `manual_outreach_logs` have no update/delete path — history cannot be
  silently rewritten.

## 12. No-Send Policy

There is no code path anywhere in this repository that sends a WhatsApp
message, email, or any outbound communication to a clinic. This has been
verified structurally (no provider SDK wired to any send action) and by tests
that spy on `markSent`/`approve`/`createDraft`/`recordDecision` and every
read-only CLI's mutation methods to confirm they are never invoked
automatically. The only thing the system produces is a **draft** the
approval gate will validate if a sender is ever built — no such sender
exists today. Every outreach message row in the database remains
`status: draft` through the entire pipeline, including after a human review
`approved` decision and after a manual outreach log entry is recorded —
confirmed directly, again, in run v4.

Any actual sending happens **outside this system**, manually, by a human
operator, using the approved copy as a reference — never by pasting a
"send" command into this codebase.

## 13. Human Review Requirements

- No commercial copy is produced for a clinic without a corresponding score
  and human review pack.
- No manual outreach packet is generated unless the latest
  `human_review_decisions` row for that clinic/message is `approved`.
- A `needs_changes` or `rejected` decision blocks packet generation until a
  new `approved` decision is recorded — there is no override.
- Review decisions are recorded by a human, one clinic at a time; there is no
  bulk-approval mechanism today (this is intentional, see Section 7).
- The operator shortlist's `promote_next`/`manual_review` recommendation is
  advisory only — it never substitutes for the human review decision later
  in the pipeline, and never promotes, crawls, or approves anything itself.

## 14. Manual QA Checklist Before Contacting a Clinic

Before any human manually contacts a clinic outside this system, confirm:

- [ ] The clinic's latest `human_review_decisions` row is `approved` (not
      `needs_changes` or `rejected`).
- [ ] The screenshots in the review pack actually loaded (no
      `storage_failed` entries) and visually match the live site.
- [ ] The operational report shows no unresolved crawl errors for the pages
      being referenced in the outreach copy.
- [ ] The commercial copy reads correctly in Portuguese, is genuinely
      specific to this clinic, and contains no placeholder/templated
      artifacts.
- [ ] The score shown to the clinic (if any) reads as an operational/digital
      presentation score, never phrased as a medical or clinical judgment.
- [ ] The clinic is not flagged `do_not_contact`.
- [ ] The outreach message row is still `status: draft` in the system
      immediately before the manual send (confirms nothing else touched it).
- [ ] The manual send, once performed outside the system, is logged via
      `crawler:outreach-log:record --event-type manual_send_logged` with
      accurate metadata — never before the send actually happened.

## 15. Launch Criteria

All of the following must be true before this pipeline is used commercially
for a real clinic, beyond controlled rehearsal:

- [ ] This checklist has been reviewed by a human operator, not just an
      agent.
- [ ] The clinic in question has been through the full pipeline in staging
      with a recorded `approved` review decision.
- [ ] The operator has personally verified the manual QA checklist (Section
      14) for that specific clinic.
- [ ] The legacy `service_role` key exposure noted in Section 9 has been
      rotated or explicitly accepted as a residual risk.
- [ ] No automatic sending has been introduced (spot-check: grep the repo
      for any new outbound HTTP client wired to `markSent`/send actions).
- [ ] Production Supabase project remains untouched (spot-check: confirm no
      script defaults or accepts a production ref without an explicit,
      reviewed change).
- [ ] The open decisions in Section 20 have each been explicitly resolved or
      explicitly accepted as residual risk by a human decision-maker.

This checklist alone does not authorize production deployment, batch
operation, or automatic sending — those remain explicitly out of scope for
this MVP regardless of how many clinics pass through it manually.

## 16. Post-Launch Monitoring Checklist

Once manual, one-at-a-time commercial use begins:

- [ ] Track `crawl_jobs.error_code` distribution — watch for a rising share
      of `unexpected_error` that might mask a real, fixable failure class.
- [ ] Track `storage_failed` screenshot events — confirm the compression
      fallback keeps this rare.
- [ ] Track score distribution across new real clinics — watch for drift
      that would suggest recalibration is needed.
- [ ] Track review decisions (`approved` vs `needs_changes`/`rejected`
      ratio) — a high rejection rate signals the templates or score need
      revisiting before continuing outreach.
- [ ] Track `manual_outreach_logs` entries against actual manual sends
      performed outside the system — confirm operators are consistently
      logging what they send.
- [ ] Track how often the operator shortlist's `recommendedCandidateId`
      differs from what the operator ultimately promotes — a high
      divergence rate would suggest the ranking rules need revisiting.
- [ ] Periodically confirm (spot-check query) that no `outreach_messages`
      row has ever reached a non-`draft` status.
- [ ] Periodically confirm the production Supabase project still has zero
      crawler-related rows.

## 17. Rollback / Stop Conditions

Stop all outreach preparation and escalate to a human decision-maker
immediately if any of the following occur:

- Any code path is discovered that could send a message automatically,
  intentionally or not.
- Any script is found to accept or default to a production Supabase target.
- An `outreach_messages` row is found in a non-`draft` status without a
  corresponding, deliberate schema/behavior change that was reviewed.
- A domain outside the explicit `--approved-domains` allowlist is crawled.
- Patient health data, or any data beyond public website content and
  operational metadata, is found stored anywhere in the pipeline.
- A `human_review_decisions` row is found to have been updated or deleted
  rather than appended.
- Score output is found phrasing anything as a medical or clinical
  judgment rather than a digital-presentation judgment.
- The operator shortlist or candidate review CLI is found recommending a
  duplicate, directory, social-profile-only, wrong-audience, or
  hospital/franchise/chain candidate as `promote_next`/`promote_candidate`.

Rollback mechanism: this pipeline is additive-only and staging-only, so
rollback is git-level (revert the offending commit/branch) plus a staging
data cleanup of any rows created under the faulty behavior. No production
rollback procedure is needed because production has never been written to.

## 18. Known Limitations

- Score v1 and commercial templates are calibrated against a small number of
  real staging clinics — treat rankings as directional, not statistically
  validated.
- Screenshot oversized-capture fallback (height-reduction retry) has only
  been exercised in unit tests, not against a real oversized capture in
  staging.
- `crawl_jobs.error_code` cannot yet distinguish a TLS certificate failure
  from other generic fetch errors.
- No defined scoring behavior exists for a crawl that captures zero pages.
- No responsive-design or content-freshness signal in the score model.
- Real-domain crawl has been exercised against a limited set of real clinics;
  one (GRUPO CPD) was blocked by the target site's own expired TLS
  certificate — no workaround was attempted, as intended.
- Everything operates one clinic/candidate at a time; there is no batch mode.
- Directory-listing and social-profile-website detection are both small,
  explicit, manually-curated hostname allowlists — heuristics, not
  exhaustive detectors.
- ICP classification is a conservative name/category-keyword heuristic — a
  single weak signal never fully blocks, which means some genuinely
  wrong-audience or low-fit candidates may still land in `manual_review`
  rather than being blocked outright; this is intentional (avoid false
  positives) but means manual judgment is still required for `maybe`-fit
  candidates.
- Discovery-time deduplication only checks other candidate rows, never
  already-promoted clinics — a re-run of the same query can resurface an
  already-promoted clinic as a "new" candidate. This is caught by
  `--include-existing` in candidate review/shortlist, not by raw discovery
  output; documented and accepted, not a bug.
- **(New, found in run v4)** The commercial template pack applies a
  stricter contact-confidence check before generating a WhatsApp
  click-to-chat link than the operational report/review pack do when
  surfacing extracted contact evidence — an operator reading only the
  template pack could wrongly conclude "no WhatsApp available" when the
  review pack already shows one at medium/high confidence.
- **(New, found in run v4)** The prospect-prioritization tier/score can
  diverge confusingly from the raw score v1 total (e.g. digital score 87/100
  but prioritization tier `medium`/score 50) because prioritization
  separately discounts for crawl status and pending review-decision state.
  Documented in `docs/technical/crawler-score-prioritization-alignment.md`;
  the operator shortlist does not use or reference this second scoring layer
  at all.
- **(New, found in run v4)** When multiple candidates in the same discovery
  batch tie at the shortlist's highest rank score, the tie-break (discovery
  recency) is silent about why one was picked over equally-qualified others
  — low-stakes today, but worth surfacing runner-up candidates more visibly
  in a future iteration.
- No staging cleanup/reset cadence exists yet, despite four rehearsals'
  worth of accumulated rows (see Section 9).

## 19. Evidence From Validated Runs

Four full, staging-only, single-prospect rehearsals have validated this
pipeline end-to-end:

- **Run v1** (`crawler-single-prospect-operator-run-v1.md`) — first attempt;
  stopped early when discovery returned only duplicates, correctly
  demonstrating the "stop rather than broaden the search" rule.
- **Run v2** (`crawler-single-prospect-operator-run-v2.md`) — used the new
  candidate review CLI; crawl failed with `redirect_blocked` against a real
  target, surfacing the need for the website dedupe normalization and
  error-code report surfacing fixes that followed.
- **Run v3** (`crawler-single-prospect-operator-run-v3-icp.md`) — first fully
  successful end-to-end rehearsal with ICP classification active, reaching
  an `approved` review decision.
- **Run v4** (`crawler-single-prospect-operator-run-v4-shortlist.md`) — the
  latest and most complete rehearsal, validating the operator shortlist CLI
  inside the real flow. Concretely demonstrated, on real staging data from a
  single Google Places query (`"clínica dermatológica"` /
  `"Vila Mariana, São Paulo, SP"`):
  - A single, narrow Google Places query (5 results, 1 page) produced 5
    genuinely actionable candidates — 3 clean `promote_candidate`/core-ICP,
    2 `manual_review` solo practitioners — with zero duplicates,
    directories, or social-profile-only websites in this batch.
  - The operator shortlist collapsed candidate review into one
    `recommendedCandidateId`, a clear summary (0 blocked, 0 duplicate, 0
    social/no-own-website), and copy-paste-ready next commands — reducing
    what previously required manually scanning every row to a single
    decision.
  - The shortlist's recommended candidate ("Clínica Dermavive") was
    successfully promoted, crawled (3 pages, approved domain only, SSRF/
    robots/TLS/redirect guards all active and unmodified), scored (87/100
    v1), reported, reviewed (human review pack generated with correctly
    flagged `crawl_partial` risk), prioritized (tier `medium`), given a
    commercial template pack, recorded with an `approved` human review
    decision, gate-checked, packaged into a manual outreach-ready packet,
    and logged with exactly one `rehearsal_logged` event.
  - Outreach remained draft/manual throughout — the outreach message row
    stayed `status: draft`, no `manual_send_logged` event was ever recorded,
    and no WhatsApp API or e-mail-provider send was ever invoked.
  - No production, SERP, Maps scraping, broad crawl, or automatic send
    occurred at any point in the run.

Taken together, these four runs show the pipeline behaves correctly both
when candidates are messy (run v1: all duplicates, correctly stopped) and
when they are clean (run v4: a clean batch correctly recommended and
processed end-to-end), and that each real-data surprise encountered along
the way (scheme-mismatched duplicates, an Instagram-as-website candidate,
an opaque crawl failure code) was fixed at its root rather than worked
around.

## 20. Open Decisions Before First Real Manual Send

These require an explicit human decision — this checklist does not resolve
them on its own:

- [ ] Has the legacy `service_role` key exposure (Section 9) been rotated,
      or is it explicitly accepted as residual risk for the first real send?
- [ ] What staging cleanup/reset cadence, if any, should be adopted before
      rehearsal-row volume becomes unwieldy?
- [ ] Which channel (WhatsApp click-to-chat vs. e-mail) should be used for
      the very first real manual send, given the commercial template pack's
      stricter WhatsApp-confidence bar (Section 18)?
- [ ] Who is authorized to personally perform a real manual send and record
      `manual_send_logged` — should this be restricted to a named list of
      operators?
- [ ] What cadence/volume limit (e.g. N clinics per week) should apply once
      real manual sends begin, to keep this genuinely one-at-a-time rather
      than informally becoming a batch operation?
- [ ] Should the prioritization-vs-digital-score divergence (Section 18) be
      resolved (recalibrated) before it's used to help decide send order for
      real clinics, or is directional-only guidance acceptable for now?
- [ ] At what point (number of real sends, or elapsed time) should score v1
      and commercial template copy be revisited for outcome-based
      recalibration, given both are currently first-pass, not
      statistically validated?

## Operator Launch Checklist

A practical, per-session checklist for actually running the pipeline:

1. Confirm branch/tag (`git branch --show-current`, `git tag
   --points-at HEAD`) and `git status --short` is clean.
2. Confirm `.env.local` is present and git-ignored:
   `git check-ignore .env.local` should print `.env.local`.
3. Run operator preflight: `npm run crawler:operator-preflight --
   --target staging` — confirm `overallStatus` is not `"blocked"` and the
   resolved target is `staging` (or `local`), never production.
4. Run Google Places discovery with a narrow query/location: one query,
   `--max-results 5`, `--max-pages 1`.
5. Run the operator shortlist against the resulting `discovery_job_id`
   (`--include-existing --output markdown`).
6. Select at most one candidate — the shortlist's `recommendedCandidateId`
   if present, otherwise a manually-justified `promote_candidate`/
   `manual_review` pick; never a duplicate, directory, social-profile-only,
   wrong-audience, or hospital/franchise/chain candidate.
7. Promote that one candidate (`npm run crawler:promote`).
8. Crawl only the approved domain, with an explicit `--approved-domains`
   value and `--max-pages 3` (or another small, deliberate cap).
9. Generate the operational report (`npm run crawler:report`).
10. Generate the human review pack (`npm run crawler:review-pack`).
11. Check screenshots (no `storage_failed`) and contact evidence for
    plausibility.
12. Check the score and confirm the disclaimer is present verbatim.
13. Run prioritization (`npm run crawler:prioritize-prospects`).
14. Generate the commercial template pack (only produced for
    high/medium tier — expect nothing for low/blocked/needs_changes).
15. Confirm or record a human review decision (`approved`/`rejected`/
    `needs_changes`).
16. Generate the manual-ready packet, only if the decision is `approved`
    and the approval gate allows the channel.
17. Manually contact the clinic outside the system only if approved — never
    from inside this codebase.
18. Record the manual log only after the human action: `rehearsal_logged`
    for a rehearsal/preparation, `manual_send_logged` only after an actual
    send has already happened.
19. Verify `outreach_messages` remains `status: draft`
    (`npm run crawler:outreach-log:list` plus a direct read-only check).
20. Stop if anything is ambiguous — a missing recommendation, an
    unclear ICP fit, a partial crawl without explanation, or any doubt about
    whether a candidate is genuinely a clean prospect — and escalate to a
    human decision-maker rather than guessing.
