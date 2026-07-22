# Atria crawler/prospecting system — MVP readiness audit

> **Audit only. No code was changed to produce this document.** All
> claims below are backed by either the current source code, the existing
> test suite (276/276 passing), or a fresh, read-only staging query run
> specifically for this audit (results included verbatim below, service-
> role key used only as an unprinted header — no secret appears in this
> document).

## Executive summary

The crawler/prospecting pipeline is a complete, working, safety-gated
loop from discovery through a human-approval checkpoint: **discover →
promote → crawl (fixture or approved-real-domain) → score → screenshot →
report → human review pack → review decision → outreach approval gate.**
Every stage has automated tests and every stage that touches a real
external resource (Google Places, a real clinic website, Supabase
staging) has been exercised at least once against the real thing, not
just fixtures — and the results are documented.

**No outreach has ever been sent, and no code path exists anywhere in
this repository that can send one.** The system currently has exactly
one human review decision on record: **`needs_changes`** for SkinLaser -
Higienopolis, the one clinic with real, successful crawl data. That
alone is the load-bearing fact for this audit's outreach recommendation
below.

The system is **staging-validated, not production-deployed** — no
`--target production` path exists anywhere (it is architecturally
refused, not just undocumented), and this MVP has never touched the
`Atria` production Supabase project (ref `cskodsnvghavkcjwmafr`).

## 1. Discovery

| Path | Status | Notes |
| --- | --- | --- |
| CSV/manual import | Working, tested | `scripts/crawler/import-candidates.ts` / `lib/operations/pipeline/import-candidates.ts`. Bounded by `--max-candidates` (default 5), deduplicates by website origin. No external API. |
| Google Places (official provider) | Working, exercised live twice | `lib/discovery/providers/google-places.ts`. Real API calls made in `docs/technical/crawler-places-operational-rehearsal-live.md` — 3 real candidates discovered for query "dermatology clinic" / "São Paulo, SP". |
| `--dry-run` | Working, no key/network needed | In-memory fixture provider, zero network calls, zero Supabase writes. |
| `--target staging` | Working, exercised live | Requires `GOOGLE_PLACES_API_KEY` + staging Supabase creds; refuses production the same way every other CLI does. |
| Limits | `--max-results` (default 10), `--max-pages` (default 1) | Both enforced before any row is persisted. |
| Dedupe | In-batch + against existing `prospect_candidates` by dedupe key (normalized website origin) | `duplicateCount: 0` in every live run so far — untested at scale, but the mechanism itself has dedicated unit tests (`describe("dedupe")` in `lib/discovery/google-places.test.ts`). |

**Not implemented:** any other discovery source (manual web search, directories, referrals) — out of MVP scope, consistent with `AGENTS.md`'s "no external API integrations" default posture beyond the one explicitly built.

## 2. Candidate → clinic promotion

`lib/operations/promote-candidate.ts::promoteCandidateToClinic` — fully tested (5 tests), idempotent (a second candidate with the same dedupe key links to the existing clinic rather than duplicating it), refuses `duplicate`/`rejected`/already-`promoted_to_clinic` candidates.

One real gap was found and closed during this MVP build: there was no CLI to promote an **already-persisted** candidate from an earlier discovery run (only same-run promotion existed). `scripts/crawler/promote-candidate.ts` (`npm run crawler:promote`) closes it — a thin, tested wrapper, no new logic.

**Status: production-ready as a mechanism.** Exercised live twice (GRUPO CPD, SkinLaser), both clinics created correctly with source attribution preserved.

## 3. Controlled crawl

| Mode | Status | Detail |
| --- | --- | --- |
| Fixture mode (default, no `--allow-real-crawl`) | Production-ready | Zero network calls of any kind, including DNS — serves `DEFAULT_FIXTURE_HTML`. Used successfully as the safe fallback when a real domain isn't reachable/approved. |
| Approved real-domain mode | **Staging-validated, real crawls performed** | `--allow-real-crawl --approved-domains <d1,d2>` — default allowlist stays `example.com` only; approval is explicit, per-invocation, never persisted, never wildcarded (`isValidApprovedDomainEntry` rejects `*`, IPs, protocols, paths, ports). Exercised against two real domains: `grupocpd.com.br` (blocked by the site's own **expired TLS certificate** — the crawler correctly refused, no workaround attempted) and `skinlaser.com.br` (succeeded: 3 real pages, real contacts extracted). |
| SSRF/private-IP guard | Production-ready, defense-in-depth, directly tested | Two independent layers: (a) `isBlockedHostname` rejects `localhost`/`*.internal`/`*.local`/cloud-metadata names **before** the crawl-hostname allowlist is even consulted; (b) `isBlockedIpAddress` rejects any *resolved* private/loopback/link-local/CGNAT/metadata IP, **even for an explicitly-approved domain** — proven by a dedicated test (`lib/operations/controlled-automation-pipeline.test.ts`: "an approved domain that resolves to a private IP is still blocked"). |
| Allowlist behavior | Production-ready | Hardcoded `ALLOWED_REAL_CRAWL_HOSTNAMES = ["example.com", "www.example.com"]`; extendable only via `--approved-domains`, which is validated, logged, and never widens beyond exact hostnames (no subdomain wildcards — `*.grupocpd.com.br` was tested and confirmed to never match `sub.grupocpd.com.br` via literal-string comparison, not glob). |
| Max pages/jobs limits | Production-ready | `--max-pages` bounds the bounded-BFS crawler (verified live: SkinLaser's `max-pages 3` correctly stopped at 3 of 19 discovered pages, `status: "partial"`, `page_limit_reached` finding recorded). Single-clinic-at-a-time only — no batch/bulk mode exists. |
| Path denylist | Pre-existing, unchanged, confirmed still in force | `shouldSkipPath` excludes `/login`, `/admin`, `/cart`, `/checkout`, `/portal`, `/paciente`, `/account`, `/dashboard`, and more. |
| Redirect handling | Production-ready, one real limitation found (not a bug) | `isSameOrigin` requires protocol match on every redirect hop. Both real clinic domains recorded `http://` URLs that force-redirect to `https://` — a same-host, cross-protocol redirect the crawler correctly refuses to follow. Resolved by correcting the clinic's own recorded URL to `https://` (`scripts/crawler/update-clinic-website.ts`), not by loosening the guard. |

**No form submission is possible** (GET-only by construction) and **no downloads** (non-HTML content-type refused) — structural, not configurable.

## 4. Screenshot capture

| Aspect | Status |
| --- | --- |
| Desktop/mobile capture | **Staging-validated with a real capture.** SkinLaser: both viewports captured successfully via real headless Chromium (Playwright), real `capturedAt` timestamps. |
| Gating | Production-ready, tested repeatedly | Requires both `--capture-screenshots` AND `--allow-real-crawl`; silently (safely) skipped otherwise, never a crash. Also bound by the same host allowlist as crawling — GRUPO CPD's attempt correctly produced `capture_failed` (same root cause as its TLS-expired crawl, not a separate bug). |
| `scan_assets` persistence | Production-ready | Metadata-only rows (`capture_status`, `captured_at`, dimensions) — never binary image bytes stored in this table. |
| Storage `pending_storage` behavior | **This is the actual current limitation, not a bug.** No Supabase Storage bucket has been configured in any environment used so far (`--screenshot-storage-bucket` was never passed). Every captured screenshot — including SkinLaser's real, successful capture — exists only as `pending_storage` metadata: `storage_path: ""`. **The literal image bytes are not retained anywhere by this system today.** A human reviewing the human-review-pack today cannot yet visually see the screenshot — only that it was captured. |

**Recommended before commercial use:** provision a private Supabase Storage bucket and pass `--screenshot-storage-bucket` so future captures actually upload and a reviewer can see the image, not just its metadata.

## 5. Score

| Aspect | Status |
| --- | --- |
| Version | **`placeholder-v0`** — explicitly named as a placeholder in the schema itself (`lib/score/calculate.ts`), not a finished scoring model. |
| Dimensions | Fixed 5: credibilidade, clareza, mobile, conversão/ação, atualização — each 0–20, total 0–100. |
| Disclaimer | Hardcoded, schema-enforced (`z.literal(SCORE_DISCLAIMER)`), verbatim in every score, report, and review pack: *"Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica."* Cannot be omitted or altered by any code path — it's a Zod literal, not a default. |
| Calibration | **Not calibrated against real-world outcomes.** Two real data points exist: GRUPO CPD 66/100 (from fixture content only — not the clinic's real site, since its crawl was blocked), SkinLaser 68→72/100 (from real site content, real screenshots). Two data points is not enough to validate the scoring model's usefulness or accuracy — this is a known, explicit MVP limitation, not a bug. |
| Mobile dimension | Structurally penalized when no screenshot exists (conservative placeholder), and even with a captured screenshot, the score does not yet perform any actual visual/pixel analysis — the screenshot's *existence* is scored, not its content. |

**Not ready for calibrated commercial claims** ("your score means X in the market") — ready only as a structured, evidence-tied internal talking point for a human-reviewed conversation.

## 6. Operational report

`lib/operations/report/build-operational-report.ts` + `render-operational-report-markdown.ts`. Read-only, reuses persisted data only, `status: "draft"` or `"incomplete_report"` (never anything else), 13 markdown sections, always includes the disclaimer and a 7-item human-review checklist. **Production-ready as a mechanism.** Generated live for both real clinics; SkinLaser's report shows zero warnings (fully complete); GRUPO CPD's shows the fixture-content caveat explicitly.

## 7. Human review pack

`lib/operations/review/build-human-review-pack.ts` — a commercial-facing repackaging of the operational report: internal summary, suggested WhatsApp draft (reusing the site's own published WhatsApp number when found — never guessed), suggested email draft, risk flags (`do_not_contact`, `crawl_partial`, `low_score`, `missing_screenshot_*`, `requires_human_review`), 8-item approval checklist. 18 tests including explicit checks for "never evaluates medical quality" and "never invents testimonials/awards/claims." **Production-ready as a mechanism**, generated live for SkinLaser from real data.

## 8. Review queue

| Aspect | Status |
| --- | --- |
| `human_review_decisions` table | **Applied to staging, verified.** Additive-only migration (`20260721230000_human_review_decisions.sql`), same RLS/`service_role`-only pattern as every other table. `supabase migration list` confirms `local`/`remote` match. |
| Append-only design | Production-ready, tested | `recordDecision` only ever inserts; "current status" is always the latest row by `reviewed_at`. No update/delete method exists — a review history is preserved, not overwritten. |
| Staging migration status | **Applied** (`docs/technical/crawler-review-queue-staging-validation.md`) — re-confirmed for this audit (see "Staging evidence" below). |
| `needs_changes` decision recorded | **Yes — confirmed live for this audit.** SkinLaser has exactly one decision: `needs_changes`, reviewer "Atria QA", notes "Revisar copy antes de qualquer contato. Ensaio staging.", `reviewed_at: 2026-07-22T13:16:49Z`. |

## 9. Outreach approval gate

`lib/operations/outreach/approval-gate.ts` — `canPrepareOutreachForSend` / `assertOutreachApprovedForSend`. **This task added no sender — the gate exists, tested, and unused by any runtime code**, because nothing sends anything yet.

Confirmed by code + 17 tests, and cross-checked against the real staging data pulled for this audit:

| Requirement | Status |
| --- | --- |
| `approved` required | Enforced — only `decision: "approved"` (the *latest* one) passes |
| `rejected` blocks | Tested directly |
| `needs_changes` blocks | Tested directly — **and this is SkinLaser's actual current state**: running the gate against SkinLaser today would return `{ allowed: false, code: "review_decision_needs_changes" }` |
| Missing decision blocks | Tested directly — **and this is GRUPO CPD's actual current state** (zero rows in `human_review_decisions` for that clinic): the gate would return `{ allowed: false, code: "missing_review_decision" }` |
| `do_not_contact` blocks | Tested directly, and proven to override even a prior `approved` decision |
| No sender exists | Confirmed by repo-wide review across this entire MVP build — `markSent` is defined but called from nowhere, anywhere |

**Net effect today: neither of the two clinics in staging can pass the approval gate.** That is the correct, working state of the safety mechanism — not a defect.

## 10. Staging evidence (re-verified live for this audit)

Fresh, read-only queries run specifically for this document (service-role key used only as an unprinted header):

- **Clinics (2 total):** GRUPO CPD - Centro Paulista de Dermatologia e Estética (`8634b1cb-...`), SkinLaser - Higienopolis (`bbfd72a3-...`).
- **SkinLaser real crawl:** confirmed — 2 `scores` rows, the current one `total: 72`, `scoring_version: "placeholder-v0"`.
- **Screenshots:** confirmed `pending_storage` for both `screenshot_desktop` and `screenshot_mobile`, real `capturedAt` timestamps, `storage_path: ""` (no bucket configured — see §4).
- **Review decision:** confirmed exactly one row in `human_review_decisions`, `decision: "needs_changes"` for SkinLaser. Zero rows for GRUPO CPD.
- **Outreach:** 2 `outreach_messages` total (one per clinic), both `status: "draft"`, both `channel: "email"`. None `sent`, `approved`, `replied`, `rejected`, or `ignored`.

## What is production-ready

- Discovery mechanism (CSV + Google Places), promotion, target-guard/production-refusal (used identically by every single CLI in this system, no exceptions), the fixture-mode crawl path, the SSRF/private-IP guard, the approved-domain allowlist mechanism, the operational report generator, the human review pack generator, the review queue (list + record decision), and the outreach approval gate logic.
- All of the above as **mechanisms** — code that is correct, tested, and safe. None of it has been deployed against the production Supabase project, and none of it should be understood as "ready to run unattended at scale" (see limitations below).

## What is staging-ready only

- Everything above has only ever been exercised against `atria-staging` (ref `lfkyiztuwptmddsraucg`), never production. That is by design for this MVP phase, not a gap — but it does mean zero production operational experience exists yet.
- The two real clinic data points (GRUPO CPD, SkinLaser) live only in staging.

## What is not ready

1. **Screenshot storage.** No bucket configured anywhere — captured images are never actually retained, only their metadata. A human reviewer cannot see the screenshot today.
2. **Score calibration.** `placeholder-v0`, two data points, no validation against real market/conversion outcomes.
3. **Any sender.** Does not exist. The approval gate has nothing to gate yet in practice.
4. **Multi-clinic/batch operation.** Every CLI in this system processes exactly one clinic (or a small CSV batch capped at 5) per invocation — there is no queue-worker, scheduler, or bulk-processing mode.
5. **GRUPO CPD's real content.** Still unreachable (expired TLS cert, external to Atria) — its score/report/pack are all fixture-derived, not representative of the real clinic.

## Known risks

- **Score/report could be mistaken for finished, calibrated output** if shown outside this project without the "placeholder-v0" / disclaimer context front-and-center — the disclaimer is schema-enforced, which mitigates but does not eliminate this risk in a copy/paste scenario.
- **Reviewer-side risk, not system risk:** the approval gate cannot verify that a `reviewer` name was actually the person who typed it (`--reviewer` is a free-text CLI flag, no auth). Fine for a single-operator MVP, not fine at team scale without a real identity layer.
- **No screenshot bytes retained** means any future human-facing preview UI has nothing to render yet from this pipeline's own output.

## Security gates currently in place

1. Production refusal (`assertSafeTarget` / `KNOWN_PROJECT_REFS`) — every CLI, no exceptions, tested repeatedly including combined with domain approval and screenshot requests, proven independent of both.
2. Real-crawl hostname allowlist, restrictive by default, explicit-approval-only extension, no wildcards.
3. SSRF/private-IP guard, two independent layers (hostname-based and resolved-IP-based), proven to hold even against an *approved* hostname.
4. Path denylist (login/admin/cart/checkout/portal/patient/account/dashboard/...).
5. GET-only, non-HTML-content-type refusal — no form submission, no downloads possible.
6. `do_not_contact` — checked independently at both the clinic and outreach-message level, proven to override even an `approved` review decision.
7. Outreach approval gate — `approved`-only, latest-decision-wins, read-only, zero mutation capability.
8. RLS + `service_role`-only grants on every table this system writes to, migration-verified in staging.

## Data retained in staging

Nothing has been cleaned up across this entire multi-week build — every row from every rehearsal remains, by design, for inspection:

- 3 `prospect_candidates` (1 promoted to GRUPO CPD, 1 promoted to SkinLaser, 1 unpromoted — Dermaclinic, never processed)
- 2 `clinics`, 2 `crawl_jobs` (1 failed — GRUPO CPD's expired-TLS attempt is a separate row from its earlier fixture-mode success; 1 partial — SkinLaser), extracted content, clinic contacts, 3 `scores` total, 2 `scan_assets` (SkinLaser only), 2 `outreach_messages` (both draft), 1 `human_review_decisions` row.

## Remaining blockers

1. No screenshot storage bucket configured.
2. Score model is uncalibrated (`placeholder-v0`).
3. SkinLaser's own review decision is `needs_changes` — copy/content needs revision before this specific clinic could ever pass the approval gate.
4. GRUPO CPD's real website is unreachable (external, expired cert) — no real data exists for it.
5. No sender exists — intentionally, but it means "approved" today has no downstream effect beyond the gate itself.

## Recommended next 5 steps

1. **Address SkinLaser's `needs_changes` feedback** ("Revisar copy antes de qualquer contato") — regenerate the review pack, get a fresh human review decision. This is the single highest-leverage next step: it's the one clinic with real, complete data, one step away from a legitimate `approved`.
2. **Configure a private Supabase Storage bucket** and re-run SkinLaser's screenshot capture with `--screenshot-storage-bucket` so a reviewer can actually see the images, not just metadata.
3. **Re-check GRUPO CPD's TLS certificate periodically** (external, not fixable by this codebase) — if renewed, re-run the approved-real-domain crawl to get real data for the second clinic.
4. **Widen the discovery sample** (a handful more real Google Places candidates, same query/location or a new one) to get more than 2 data points before drawing any conclusion about score calibration.
5. **Design and gate the actual send mechanism** as a deliberate, separate, small task — it must call `assertOutreachApprovedForSend` as its literal first line, and should very likely remain a manual/operator-triggered action (see recommendation below) rather than an automated batch sender, at least through the rest of this MVP phase.

## Explicit recommendation: should manual outreach start now?

**No — not for either clinic currently in staging, and not yet as a general practice.**

Applying the stated logic strictly:

| Requirement | GRUPO CPD | SkinLaser |
| --- | --- | --- |
| Human review pack exists | Yes (fixture-derived, not real content) | Yes (real content) |
| Human review decision is `approved` | **No — no decision recorded at all** | **No — decision is `needs_changes`** |
| Approval gate passes | **No** (`missing_review_decision`) | **No** (`review_decision_needs_changes`) |
| Copy reviewed | N/A — never reached that stage | Reviewed, and explicitly asked for changes |
| No automated sending | True — nothing sends anything | True |

Neither clinic satisfies "human review decision is approved," which the gate itself enforces mechanically. **GRUPO CPD additionally has no real data to review at all** — any outreach based on its current pack would be built on fixture content, not the actual clinic's website, which would be actively misleading if sent.

**Recommendation:** do not contact SkinLaser or GRUPO CPD yet. The correct next action is step 1 above — resolve the `needs_changes` feedback on SkinLaser's copy, get a fresh `approved` decision recorded via `npm run crawler:review-decision`, and only then would this system's own gate agree that manual, operator-driven, outside-the-system outreach (per the recommendation logic's own constraint — no automated sending exists or should be built yet) is appropriate for that one clinic.

## Verification

- `npm test` — 276/276 passing.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed for this audit — only read-only REST queries against already-persisted staging data.
- No Google Places/SERP call was made.
- No outreach was sent, drafted, or modified.
- No secrets appear in this document.
