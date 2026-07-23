# Crawler Single-Prospect Operator Run — v1

Status date: 2026-07-23
Branch: `feature/crawler-single-prospect-operator-run-v1`
Base tag: `atria-crawler-operator-handoff-pack-v1`
Target: `staging` (`lfkyiztuwptmddsraucg`) only. Production (`cskodsnvghavkcjwmafr`) was never touched.

This documents the first real operational rehearsal attempt of the manual
single-prospect flow described in `docs/operations/crawler-operator-handoff-pack.md`,
run against real staging resources. **The run stopped at candidate
selection** — see Section 17. No promotion, crawl, scoring, review, or
outreach preparation occurred for a new prospect in this run.

## 1. Exact Commands Run (secrets redacted — none were ever printed)

```bash
# Step 2-4: preflight (confirms staging target, refuses production, checks
# only *presence* of env vars, never prints values)
npx tsx scripts/crawler/operator-preflight.ts --target staging

# Step 5: one narrow, real Google Places discovery — single query, single
# page, max 3 results, no --promote
npx tsx scripts/crawler/discover-google-places.ts \
  --target staging --query "dermatologia" --location "São Paulo, SP" \
  --max-results 3 --max-pages 1

# Step 6 (read-only inspection of existing staging data — no new external
# API call): list current prioritized prospects to see whether any of the
# 3 duplicate matches are still promotable candidates
npx tsx scripts/crawler/prioritize-prospects.ts --target staging --output table --limit 30
```

No further commands were run. Steps 7 onward (promote, crawl, report,
review pack, score, template, decision, manual outreach packet, log) were
**not executed** in this run — see Section 17 for why.

## 2. Selected Query/Location

- Query: `"dermatologia"`
- Location: `"São Paulo, SP"`
- Limits applied: `--max-results 3`, `--max-pages 1` (single page of Places results, no SERP, no Maps scraping — only the official Places API call made by `discover-google-places.ts`).

## 3. Discovery Result Summary

```json
{
  "discoveryJobId": "9f565764-18a6-474e-a4b4-4bd0ff80efa2",
  "query": "dermatologia",
  "location": "São Paulo, SP",
  "pagesFetched": 1,
  "truncatedByMaxResults": false,
  "totalFoundByProvider": 3,
  "importedCount": 0,
  "imported": [],
  "duplicateCount": 3,
  "rejectedCount": 0,
  "promotions": []
}
```

All 3 real places returned by the Places API for this query/location matched
an existing `dedupeKey` already recorded in staging (`reason: existing_in_db`
in the underlying result — see `lib/discovery/providers/google-places.ts:422`).
Zero new `prospect_candidates` rows were created. One `discovery_jobs` row
was created and completed (id above), recording the attempt itself with
`candidatesCreated: 0` — this is expected, harmless bookkeeping, not a
promotable artifact.

## 4. Selected Candidate and Why

**None selected.** The read-only prioritization listing (Section 1, step 6)
shows the current staging prospect pool:

| tier | score | kind | name | next_action |
|---|---|---|---|---|
| high | 75 | clinic | SkinLaser - Higienópolis | ready_for_manual_outreach_review |
| medium | 60 | candidate | Dermatológica - Farmácia de Manipulação em Curitiba | needs_manual_research |
| medium | 60 | candidate | Clínica Graciosa | needs_manual_research |
| medium | 60 | candidate | Clínica Dermic - Dermatologia Integrada | needs_manual_research |
| medium | 55 | clinic | CEPELLE Batel | review_pack |
| medium | 50 | clinic | Dermaclinic | review_pack |
| medium | 40 | clinic | Instituto Dermatológico de Curitiba | review_pack |
| low | 30 | clinic | GRUPO CPD | review_pack |
| blocked | -10 | candidate | Dra. Ana Carolina Apolinário Sala | skip |
| blocked | -125 | clinic | Dra Ana Paula Pedrino | skip |

Given the naming (Higienópolis is a São Paulo capital neighborhood) and that
the query matched exactly 3 existing dedupe keys with 0 new results, the
strong inference is that the top 3 real Google Places results for
`"dermatologia"` in `"São Paulo, SP"` are: SkinLaser-Higienópolis (already
`high` tier, already fully rehearsed and `approved` in a prior task),
and the two `blocked` records (already triaged as wrong-audience/solo
individual-practitioner pages, not clinic businesses). None of these is a
valid "select one candidate to promote" target:

- SkinLaser is already a promoted, scored, reviewed, and approved **clinic** — re-promoting is not applicable, and reusing it would not exercise a new promotion step.
- Both `blocked` entries were already triaged as unsuitable audience/quality — proceeding would violate the stop condition "candidate is wrong audience" / "candidate is a directory listing"-equivalent.
- The three `medium` "needs_manual_research" candidates are real, unpromoted candidates — but they come from a different, prior discovery run (Curitiba, PR location, per `docs/technical/crawler-google-places-discovery.md`'s example usage), not from this run's query/location. Substituting one of them here would misrepresent this run's query/location and would effectively be "searching broadly" by falling back to unrelated prior results — explicitly disallowed by this task's instructions.

## 5. Promoted Clinic ID

Not applicable — no candidate was promoted in this run.

## 6. Crawl Job ID and Result

Not applicable — no crawl was run.

## 7. Screenshot/Storage Result

Not applicable.

## 8. Operational Report Result

Not applicable.

## 9. Review Pack Result

Not applicable.

## 10. Score Result

Not applicable for a new prospect. (Existing scores for SkinLaser and other
already-promoted clinics were observed read-only via the prioritization
table above; none were recalculated or modified by this run.)

## 11. Prioritization Result

Ran once, read-only, to inspect the existing staging prospect pool after
discovery returned no new candidates (table reproduced in Section 4). This
call never crawls, never calls an external API, and never mutates any row.

## 12. Template Result

Not applicable — no clinic/candidate was selected to generate a template for.

## 13. Review Decision Result

Not applicable — no new review decision was recorded. (SkinLaser's existing
`approved` decision, from a prior task, was not touched.)

## 14. Manual Outreach Packet Result

Not applicable.

## 15. Log Result

No `manual_outreach_logs` entry was recorded — there was no outreach message
tied to a new prospect from this run to log against. Nothing was prepared,
nothing was rehearsed as "sent."

## 16. Retained Staging Rows

- One new `discovery_jobs` row: `9f565764-18a6-474e-a4b4-4bd0ff80efa2` (status: completed, `candidatesCreated: 0`).
- Zero new `prospect_candidates` rows (all 3 places deduped against existing rows).
- Zero new `clinics`, `crawl_jobs`, `scores`, `outreach_messages`, or `manual_outreach_logs` rows.
- No existing staging row was modified.

## 17. Stop/Proceed Reasoning

**Stopped after Step 6 (candidate selection).** Per the task's explicit
instruction: *"If this repeats only duplicates or poor candidates, document
that and stop. Do not keep searching broadly."* The single narrow discovery
query returned 3/3 duplicates against already-triaged staging records (one
already fully approved and rehearsed, two already blocked as wrong-audience).
There was no new, real, unpromoted, non-blocked candidate produced by this
specific query/location to carry through promotion → crawl → report → review
→ template → decision → outreach packet → log.

Continuing by either (a) re-running discovery with a different query or
location, or (b) silently substituting one of the three unrelated
`needs_manual_research` candidates from a prior Curitiba-location discovery
run, would both constitute broadening the search beyond what this task
explicitly authorized. Both were avoided.

## 18. Safety Confirmations

- [x] Staging target only (`lfkyiztuwptmddsraucg`) used for every real command; production ref (`cskodsnvghavkcjwmafr`) never used, referenced only as a refused/guarded value.
- [x] `operator-preflight` confirmed `overallStatus: "ready"`, target=staging, production guard passed, before any other command ran.
- [x] Exactly one Google Places query, one page, max 3 results — no SERP call, no Google Maps scraping (the discovery CLI only calls the official Places API).
- [x] No promotion executed (0 candidates promoted).
- [x] No crawl executed (0 crawl jobs created).
- [x] No screenshot capture attempted.
- [x] No outreach message created, approved, or sent.
- [x] No WhatsApp API or e-mail provider send invoked — none exist in this codebase and none were called.
- [x] No secret value (API key, service role key, DB URL) was printed, logged, or written to this document or any artifact.
- [x] No file under `app/`, `components/`, `lib/`, or `scripts/` was modified — only this doc was created.

## 19. Limitations Found

- **No "list candidates" CLI.** Inspecting existing `prospect_candidates` rows (beyond what `prioritize-prospects.ts` already surfaces for ranking) still has no dedicated script — confirmed the same gap already noted in `docs/operations/crawler-operator-handoff-pack.md` Section 5, step B.
- **Query/location saturation.** After several prior rehearsal sessions, common narrow queries like `"dermatologia"` + a major São Paulo neighborhood are likely to keep re-surfacing the same already-triaged real places. This will only get more pronounced as staging accumulates more discovery history, reinforcing the staging cleanup/reset cadence gap already flagged in `docs/operations/crawler-mvp-readiness-checklist.md` Section 12 ("Data Retention / Staging Rows Notes").
- **No visibility into *why* a place was previously blocked** without a dedicated read path — the prioritization table shows tier/score/next_action but not the specific disqualifying evidence; that requires generating a review pack for the specific clinic (only possible for already-promoted clinics, not blocked candidates).

## 20. Recommendation for Next Run

1. Before the next single-prospect rehearsal, decide and apply a staging
   cleanup/reset cadence (per the readiness checklist gap in Section 12) so
   repeated narrow queries have a better chance of surfacing genuinely new
   candidates.
2. For the next attempt, use a different, still-narrow query/location pair
   not already exercised in staging (e.g. a different São Paulo
   neighborhood, or a different but still-specific specialty phrasing) —
   rather than reusing `"dermatologia"` + `"São Paulo, SP"` verbatim.
3. If the intent is instead to exercise the promotion→crawl→...→log flow
   using already-existing, already-unpromoted candidates (the three
   `needs_manual_research` Curitiba candidates), do that as its own
   explicitly-scoped follow-up task that names those candidate IDs directly,
   rather than folding it into a "new discovery" run — this keeps the
   query/location documented for each run honest and traceable.
4. Consider adding a lightweight, read-only `list-candidates` CLI (matching
   the pattern of `review-queue.ts`) so operators can inspect
   `prospect_candidates` directly without going through prioritization or a
   direct DB query — this would close the gap noted in Section 19.
