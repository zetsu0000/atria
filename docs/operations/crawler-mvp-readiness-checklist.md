# Crawler / Commercial Operations — MVP Readiness Checklist

Status date: 2026-07-23
Base tag: `atria-crawler-approved-manual-outreach-rehearsal-v1`

This checklist consolidates the state of the Atria crawler and commercial-outreach
pipeline across all prior technical docs (`docs/technical/crawler-*.md`) and the
operator runbook (`docs/operations/crawler-operator-runbook.md`) into a single
readiness reference. It does not change any code or behavior — it is a status
snapshot and a launch/operator checklist.

Status values used throughout:

- **Ready** — implemented, tested, and validated against real staging resources.
- **Ready with manual review** — implemented and working, but requires a human
  to check output before it is used commercially.
- **Not ready** — does not exist yet, or exists only partially.
- **Blocked** — exists but cannot proceed due to an external condition.
- **Future automation** — intentionally manual today; automating it is a later
  decision, not an MVP gap.

## 1. MVP Scope

The MVP covers one thing: turning a real clinic's public website into an
**approved, human-reviewed, manually-sendable outreach packet** — without ever
sending anything automatically. In order:

```
Google Places discovery
  -> candidate persistence
  -> candidate promotion
  -> approved real-domain crawl
  -> screenshot capture/storage
  -> score v1
  -> operational report
  -> human review pack
  -> prospect prioritization
  -> commercial templates by tier
  -> human review decision
  -> approval gate
  -> manual outreach-ready packet
  -> manual outreach log
  -> [STOP — no automatic sending]
```

Everything left of "human review decision" is automatable-in-principle today.
Everything right of it is, and must remain, a human action outside this system.

## 2. What Is Ready

| Stage | Status | Notes |
|---|---|---|
| Google Places discovery | Ready | Requires `GOOGLE_PLACES_API_KEY`; `--dry-run` needs no key. Calls only the official `places:searchText` API. (`docs/technical/crawler-google-places-discovery.md`) |
| Candidate persistence | Ready | `prospect_candidates` table, RLS restricted to `service_role`. |
| Candidate promotion | Ready | `crawler:promote` promotes one candidate to a `clinics` row at a time. |
| Approved real-domain crawl | Ready with manual review | Allowlist defaults to `example.com`; `--approved-domains` extension is per-invocation, never persisted, no wildcards. SSRF/private-IP guards are independent of domain approval. (`docs/technical/crawler-approved-real-domain-crawl.md`) |
| Screenshot capture/storage | Ready | Private bucket `crawler-screenshots`, 5 MB limit, `image/png` only, `service_role`-only access, no public URLs. Compression retry validated. One known gap: the oversized-capture fallback has been unit-tested but not yet exercised on a real oversized capture. (`docs/technical/crawler-screenshot-storage-readiness-audit.md`) |
| Score v1 | Ready with manual review | Deterministic, 5 dimensions x 20 pts, schema-enforced non-medical disclaimer. Calibrated against 5 real staging clinics only — treat as directional, not statistically proven. (`docs/technical/crawler-score-calibration-v1.md`) |
| Operational report | Ready | `crawler:report`. |
| Human review pack | Ready | `crawler:review-pack`. |
| Prospect prioritization | Ready | Read-only ranking; never crawls, never calls an external API, never mutates data. Tier thresholds are a first calibration, not empirically tuned. (`docs/technical/crawler-prospect-prioritization.md`) |
| Commercial templates by tier | Ready with manual review | Copy generated only for `high`/`medium` tiers; withheld for `low`/`blocked`/`needs_changes`/no-score. Templates are fixed per tier, not yet tuned against real outreach outcomes. |
| Human review decision / review queue | Ready | Append-only `human_review_decisions`; no update/delete method exists. Latest decision always wins. |
| Approval gate | Ready (currently unused by any sender, because no sender exists) | `assertOutreachApprovedForSend` checks clinic/message existence, do-not-contact, sendable status, and latest decision = `approved`. |
| Manual outreach-ready packet | Ready with manual review | Copy is always the verbatim already-approved draft — never freshly generated at packet time. |
| Manual outreach log | Ready | Append-only `manual_outreach_logs`; CLI defaults to dry-run; `manual_send_logged` re-checks the approval gate. |
| Staging database (Supabase) | Ready | `atria-staging` project, 34/34 validation checks passed, RLS enabled, `service_role`-only grants. |

## 3. What Is Not Ready

| Item | Status | Notes |
|---|---|---|
| Automatic sending (email/WhatsApp/any channel) | Not ready — by design | No sender code path exists anywhere in the repository. This is a hard boundary, not a to-do. |
| Batch / multi-clinic operation | Not ready | Every stage today operates on one candidate/clinic at a time by design. |
| Operator UI (`/operacao`) | Not ready | All operator actions are CLI scripts today; no dashboard exists. |
| Durable crawl worker / queue | Not ready | `crawler:queue:process` exists but there is no durable/retrying worker infrastructure. |
| Preview generation table/flow | Not ready | Out of scope for this MVP slice per `PROJECT_CRAWLER.md`. |
| Production Supabase project | Not ready — intentionally untouched | Production ref (`Atria`, `cskodsnvghavkcjwmafr`) has never received a migration or a row. |
| Statistically validated score/template calibration | Not ready | Score v1 and commercial templates are first-pass calibrations against a handful of real clinics, not outcome-tuned. |
| TLS-error-specific failure classification | Not ready | `crawl_jobs.error_code` cannot yet distinguish a TLS certificate error from other low-level fetch exceptions; both collapse to `unexpected_error`. |
| Zero-page-crawl scoring behavior | Not ready | Pipeline does not yet have a defined scoring behavior for a crawl that captured zero pages. |
| Responsive-design / freshness signals in score v1 | Not ready | No dimension currently measures responsive layout or content freshness. |

## 4. Required Environment Variables (names only)

Persistence (staging/local; no separate production variable exists — production
access is architecturally refused, not just unconfigured):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEAD_HASH_SECRET`

Discovery:

- `GOOGLE_PLACES_API_KEY`

Screenshot storage:

- `SCREENSHOT_STORAGE_BUCKET`

Unrelated to crawler outreach (lead-capture form only — no crawler send capability
exists regardless of these being set):

- `RESEND_API_KEY`
- `LEAD_NOTIFICATION_EMAIL`
- `LEAD_FROM_EMAIL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

No secret values appear in this document or anywhere in this checklist doc set.

## 5. Required Staging/Production Separation

- Staging: Supabase project `atria-staging` (ref `lfkyiztuwptmddsraucg`). Fully
  migrated and validated. This is the only project any crawler/outreach script
  should point at during MVP operation.
- Production: Supabase project `Atria` (ref `cskodsnvghavkcjwmafr`). No
  migration, no row, no write has ever touched it. There is no `--target
  production` path in any crawler script — this is enforced in code, not just
  by convention.
- A prior low-risk legacy `service_role` key exposure was identified during
  staging validation; rotation was recommended but is non-urgent. Confirm this
  has been rotated before treating staging credentials as fully sealed.
- Operators must always confirm which Supabase project a script's `SUPABASE_URL`
  resolves to before running any `--target` other than `--dry-run` or `local`.

## 6. Operator Workflow Summary

1. `npm run crawler:operator-preflight` — confirms environment/config sanity.
2. `npm run crawler:discover:places` — Google Places discovery (dry-run first).
3. Inspect candidates directly (REST query against staging).
4. `npm run crawler:promote` — promote one candidate to a clinic.
5. Approve the real domain manually via `--approved-domains` for that invocation only.
6. `npm run crawler:controlled:staging` (or equivalent) with `--allow-real-crawl` — crawl + screenshot capture.
7. `npm run crawler:report` — generate the operational report.
8. `npm run crawler:review-pack` — generate the human review pack.
9. `npm run crawler:review-decision` — record a human `approved` / `rejected` / `needs_changes` decision.
10. `npm run crawler:manual-outreach-pack` — build the manual outreach-ready packet (gate-checked; withheld unless approved).
11. `npm run crawler:outreach-log:record` — log the manual send event (dry-run by default).
12. `npm run crawler:outreach-log:list` and a direct DB check — confirm the message row remains `status: draft` in the system regardless of what happened outside it.

Full step-by-step detail lives in `docs/operations/crawler-operator-runbook.md`.

## 7. Safety Gates

- SSRF guard: blocks localhost, private IP ranges, CGNAT, cloud metadata
  endpoints, embedded credentials in URLs, non-http(s) schemes, non-80/443
  ports; resolves DNS and re-checks redir=== targets.
- Domain allowlist: crawl only proceeds against `example.com` or domains
  explicitly passed via `--approved-domains` for that single invocation; never
  persisted, never wildcarded.
- Crawl limits: GET-only, same-origin only, robots.txt respected, path
  denylist, default max 8 pages / hard cap 20 pages, 10s timeout, 2MB max
  response body, 5 redirect cap, fixed User-Agent `AtriaPreviewBot/1.0`.
- RLS on every table: `anon`/`authenticated` revoked, `service_role` only.
- Storage hygiene: no tokens, secrets, cookies, raw headers, or raw HTML are
  ever persisted.
- Approval gate: `assertOutreachApprovedForSend` requires the clinic and
  message to exist, neither flagged `do_not_contact`, message status
  sendable, and the *latest* `human_review_decisions` row to be `approved`.
- Append-only decision and log tables: `human_review_decisions` and
  `manual_outreach_logs` have no update/delete path — history cannot be
  silently rewritten.

## 8. No-Send Policy

There is no code path anywhere in this repository that sends a WhatsApp
message, email, or any outbound communication to a clinic. This has been
verified structurally (no provider SDK wired to any send action) and by tests
that spy on `markSent`/`approve`/`createDraft`/`recordDecision` to confirm they
are never invoked automatically. The only thing the system produces is a
**draft** the approval gate will validate if a sender is ever built — no such
sender exists today. Every outreach message row in the database remains
`status: draft` through the entire pipeline, including after a human review
`approved` decision and after a manual outreach log entry is recorded.

Any actual sending happens **outside this system**, manually, by a human
operator, using the approved copy as a reference — never by pasting a
"send" command into this codebase.

## 9. Human Review Requirements

- No commercial copy is produced for a clinic without a corresponding score
  and human review pack.
- No manual outreach packet is generated unless the latest
  `human_review_decisions` row for that clinic/message is `approved`.
- A `needs_changes` or `rejected` decision blocks packet generation until a
  new `approved` decision is recorded — there is no override.
- Review decisions are recorded by a human, one clinic at a time; there is no
  bulk-approval mechanism today (this is intentional, see Future Automation
  note below).

## 10. Current Known Limitations

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

## 11. Manual QA Checklist Before Contacting a Clinic

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
      `crawler:outreach-log:record` with accurate metadata.

## 12. Data Retention / Staging Rows Notes

- All rows created during rehearsals and validations exist only in the
  `atria-staging` Supabase project — production has zero rows.
- No patient health data is collected, stored, or referenced anywhere in
  this pipeline; only public clinic website content and operational
  metadata are handled.
- Raw HTML, cookies, and headers are never persisted — only extracted,
  bounded content and screenshots.
- Staging rows accumulate across rehearsals (multiple `clinics`,
  `crawl_jobs`, `scores`, `outreach_messages` rows exist for the same test
  clinics). Before broader use, decide and document a staging cleanup/reset
  cadence — none exists today.
- Screenshot storage is private and `service_role`-only; no public URL is
  ever generated for a stored image.

## 13. Launch Criteria

All of the following must be true before this pipeline is used commercially
for a real clinic, beyond controlled rehearsal:

- [ ] This checklist has been reviewed by a human operator, not just an
      agent.
- [ ] The clinic in question has been through the full pipeline in staging
      with a recorded `approved` review decision.
- [ ] The operator has personally verified the manual QA checklist (Section
      11) for that specific clinic.
- [ ] The legacy `service_role` key exposure noted in Section 5 has been
      rotated or explicitly accepted as a residual risk.
- [ ] No automatic sending has been introduced (spot-check: grep the repo
      for any new outbound HTTP client wired to `markSent`/send actions).
- [ ] Production Supabase project remains untouched (spot-check: confirm no
      script defaults or accepts a production ref without an explicit,
      reviewed change).

This checklist alone does not authorize production deployment, batch
operation, or automatic sending — those remain explicitly out of scope for
this MVP regardless of how many clinics pass through it manually.

## 14. Post-Launch Monitoring Checklist

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
- [ ] Periodically confirm (spot-check query) that no `outreach_messages`
      row has ever reached a non-`draft` status.
- [ ] Periodically confirm the production Supabase project still has zero
      crawler-related rows.

## 15. Rollback / Stop Conditions

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

Rollback mechanism: this pipeline is additive-only and staging-only, so
rollback is git-level (revert the offending commit/branch) plus a staging
data cleanup of any rows created under the faulty behavior. No production
rollback procedure is needed because production has never been written to.
