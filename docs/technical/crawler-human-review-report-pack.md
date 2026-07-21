# Human review package generator

A generator that turns the existing "Raio-X da Primeira Impressão Digital"
operational report into a cleaner, internal/commercial-review artifact —
the package a human reviews and approves before any contact with a
clinic. Read-only, never crawls, never calls an external API, and has no
send-capable code path anywhere in it.

## What it is not

- Not a sending mechanism. Every suggested message stays `status: "draft"`
  / `reviewRequired: true`. No code path in this generator (or the
  repository interfaces it depends on) can mark a message `sent`.
- Not a medical evaluator. It never assesses medical quality, never
  mentions patient outcomes, and never implies Atria is a medical
  provider — copy stays framed as a website/digital-presence review only.
- Not a content inventor. Every field is either copied verbatim from
  already-persisted data or a generic, evidence-tied heuristic string.
  Testimonials, awards, credentials, clients, and outcomes are never
  fabricated.

## Files

- `lib/operations/review/types.ts` — the `HumanReviewPack` shape.
- `lib/operations/review/build-human-review-pack.ts` — the builder.
  Internally calls the existing, already-tested `buildOperationalReport`
  (`lib/operations/report/build-operational-report.ts`) for all
  repository-querying and missing-data handling, then transforms its
  output — it does not re-implement that logic.
- `lib/operations/review/render-human-review-pack-markdown.ts` — pure,
  deterministic Markdown rendering.
- `lib/operations/human-review-pack.test.ts` — 18 tests.
- `scripts/crawler/generate-human-review-pack.ts` — the CLI.

## Package sections (mapped to the 12 required)

| # | Section | Field(s) |
| --- | --- | --- |
| 1 | Internal summary | `internalSummary` — one factual sentence: clinic name, score, crawl status/pages, screenshot availability. No quality adjectives beyond what was measured. |
| 2 | Clinic identity and source | `clinicIdentity`, `provenance` |
| 3 | Website analyzed | `websiteAnalyzed` |
| 4 | Score summary | `scoreSummary`, `scoreDimensions` |
| 5 | Screenshot references | `screenshots.desktop` / `.mobile` — asset ID, storage path, capture timestamp. **Metadata only — never binary bytes, never a public URL.** |
| 6 | Key issues found | `keyIssues` — reused directly from the operational report's evidence-grounded `mainIssues` |
| 7 | Suggested angle for outreach | `suggestedOutreachAngle` — reused directly from the operational report's `suggestedImprovementAngle` |
| 8 | Suggested WhatsApp message draft | `suggestedWhatsappDraft` |
| 9 | Suggested email draft | `suggestedEmailDraft` |
| 10 | Human approval checklist | `humanApprovalChecklist` |
| 11 | Risk flags | `riskFlags` |
| 12 | Required disclaimer | `disclaimer` — verbatim `SCORE_DISCLAIMER` |

## Suggested WhatsApp/email drafts — how they're built

For each channel (`email`, `whatsapp_manual`):

1. If a persisted `outreach_messages` draft already exists for that
   channel (queried via `outreachRepo.listForClinic`, latest by
   `createdAt`), it is surfaced as-is — `persisted: true`,
   `persistedMessageId` set to the real row ID.
2. Otherwise, one is computed **fresh, in-memory only**, from the exact
   same evidence used for scoring (`report.evidenceByDimension`, flattened
   into observations) via the existing `buildOutreachDraft`
   (`lib/outreach/draft.ts`) — **never persisted by this builder, never
   written to any repository.** This is what "missing outreach draft
   handled gracefully" means in practice: the package still produces a
   usable, evidence-grounded draft rather than just reporting "missing."
3. Only `available: false` when there is no evidence at all to draft from
   (score/extraction missing), or the clinic is marked `do_not_contact`
   (in which case a `do_not_contact` risk flag, severity `high`, is also
   raised).

**WhatsApp phone number:** the click-to-chat number is read only from a
`whatsapp`-kind contact the site itself already published (parsed from the
`phone=` query parameter of the site's own `wa.me`/`api.whatsapp.com`
click-to-chat link, already extracted and persisted by the crawl) — never
guessed, inferred, or derived from a raw phone-number string. If no such
link exists, the suggested WhatsApp draft still has body text (useful for
manual copy-paste) but `clickToChatUrl: null`, with a warning added so a
human knows to add a number manually.

## Risk flags

Computed only from real, already-persisted state — never invented:

| Code | Severity | Trigger |
| --- | --- | --- |
| `do_not_contact` | high | `clinic.doNotContact` is true |
| `no_crawl_job` | high | No crawl job found for the clinic |
| `crawl_failed` | high | Most recent crawl job status is `failed` |
| `crawl_partial` | medium | Most recent crawl job status is `partial` (page-limit or fetch failures) |
| `missing_score` | high | No score available (only reachable with `--allow-incomplete`) |
| `low_score` | medium | Score total < 50/100 |
| `missing_screenshot_desktop` / `_mobile` | info | Respective screenshot missing or capture failed |
| `low_confidence_contact_data` | info | Any extracted contact candidate has `confidence: "low"` |
| `requires_human_review` | info | Extracted content is flagged `requiresHumanReview` (effectively always, by design of this pipeline) |

## CLI

```
npx tsx scripts/crawler/generate-human-review-pack.ts --target local --clinic-id <id>
npx tsx scripts/crawler/generate-human-review-pack.ts --target staging --clinic-id <id> --crawl-job-id <id> --output json
npx tsx scripts/crawler/generate-human-review-pack.ts --target local --clinic-id <id> --allow-incomplete --write-artifact
```

New `package.json` script: `npm run crawler:review-pack -- <flags>`.

Flags: `--target local|staging` (required — production is refused the
same way as every other CLI in this pipeline, via
`selectRepositories`/`assertSafeTarget`), `--clinic-id` (required),
`--crawl-job-id` (optional, defaults to the clinic's most recent crawl
job), `--output markdown|json` (default markdown), `--write-artifact`
(writes to `artifacts/review-packs/<clinicId>.md|json`, newly added to
`.gitignore` — no public upload, local only), `--allow-incomplete`
(produces `status: "incomplete_review_pack"` instead of failing when no
score exists).

## Verified against real staging data

Run against the real `SkinLaser - Higienopolis` clinic/crawl from the
prior rehearsal (`docs/technical/crawler-second-real-domain-rehearsal.md`
— clinic `bbfd72a3-a013-4a6c-bd82-4a70479d694a`, crawl job
`c915a569-bcba-4bf2-aa95-cd66446eeb24`, real crawl succeeded, real
screenshots captured, score 72/100):

```
npm run crawler:review-pack -- --target staging \
  --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id c915a569-bcba-4bf2-aa95-cd66446eeb24 \
  --output markdown --write-artifact
```

Result (written only to the gitignored `artifacts/review-packs/`, never
committed):

- `status: "draft"`, disclaimer present verbatim.
- Internal summary, identity, website-analyzed, and score sections
  populated from the real crawl/score.
- Both screenshots: `pending_storage` (real captures, metadata only — same
  as the underlying rehearsal; no storage bucket configured).
- **Suggested email draft:** surfaced the already-persisted draft
  (`persisted: true`, id `4696afcb-a8e8-4d1a-8cf7-5874fec21159`).
- **Suggested WhatsApp draft:** none was persisted, so one was generated
  fresh (`persisted: false`) — and its click-to-chat link correctly reused
  the real phone number (`551131555555`) the site itself publishes via its
  own WhatsApp button, extracted during the crawl.
- **Risk flags:** `crawl_partial` (medium — the 3-page bound didn't
  exhaust the site's 19 discovered pages) and `requires_human_review`
  (info).
- One warning: no persisted WhatsApp draft was found (expected — only an
  email draft was created in the prior rehearsal), explaining why that
  draft was generated fresh rather than surfaced as persisted.

## Tests (18 total, `lib/operations/human-review-pack.test.ts`)

Covers all 15 required cases from the task, plus 3 extra edge cases
(no-evidence-and-no-draft, `do_not_contact` blocking, not-found handling):

1. Complete package with score/screenshots/report/draft.
2. Missing screenshots handled gracefully (status `missing`, risk flags raised, package still builds).
3. Missing outreach draft handled gracefully (a fresh draft is generated instead of failing; confirms nothing was persisted as a side effect).
4. Missing score fails by default (`reason: "missing_score"`).
5. `--allow-incomplete` produces `status: "incomplete_review_pack"`.
6. Disclaimer always included, verbatim, matching `SCORE_DISCLAIMER` — in both the JSON shape and the rendered Markdown.
7. No medical-quality evaluation — no `medicalQuality` field, no medical-quality-judgment phrasing, no patient-outcome phrasing anywhere in the serialized package.
8. No invented testimonials/awards/credentials/client claims (checked against the whole package except the checklist, which deliberately *names* these terms to warn against them).
9. Suggested WhatsApp draft stays `draft`/`reviewRequired: true`, never `sent`.
10. Suggested email draft stays `draft`/`reviewRequired: true`, never `sent`.
11. Production is refused (via the shared `selectRepositories`/`assertSafeTarget` gate).
12. Markdown rendering is deterministic; all 11 numbered headings present, in order.
13. JSON shape is stable — every required top-level key present, dimension order fixed, round-trips through `JSON.stringify`/`JSON.parse` without losing shape.
14. No external API calls — `globalThis.fetch` is spied and confirmed never called.
15. No sending path exists — `markSent`, `approve`, and `createDraft` on the injected `outreachRepo` are spied and confirmed never called; zero rows end up persisted.

## Verification

- `npm test` — 240/240 passing (222 prior + 18 new).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No broad crawl — this generator is entirely read-only against
  already-persisted data; it does not crawl anything itself.
- No Google Places/SERP call was made — no new discovery.
- No outreach was sent — every suggested draft stays `status: "draft"`;
  no `markSent`/`approve` call exists anywhere in this code path (verified
  by test #15).
- No secrets were stored in any file, log, or this document.
