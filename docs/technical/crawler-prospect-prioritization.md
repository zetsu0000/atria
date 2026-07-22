# Prospect prioritization

A read-only ranking layer over already-persisted crawler data, so a
human operator spends review time on the best targets first instead of
working through candidates/clinics in arbitrary or chronological order.
**Never crawls, never calls an external API, never sends anything, never
mutates a single row.**

## Purpose

Every earlier stage of this pipeline (discovery, promotion, crawl,
score, review, manual outreach pack, manual outreach log) operates on
one clinic/candidate at a time, by id. Nothing previously ranked *across*
them. This layer answers "which of these should I look at first?" using
only data that already exists.

## Model

Two kinds of prospects are ranked side by side:

- **`clinic`** — an already-promoted clinic, scored using its full
  history: latest crawl job, screenshot evidence, latest score, public
  contacts, latest human review decision, and manual outreach log
  recency.
- **`candidate`** — a not-yet-promoted `prospect_candidates` row
  (excluding ones already `promoted_to_clinic` or `duplicate`, which are
  either represented via their clinic or not independently actionable).
  Candidates never have crawl data yet, so they always map to
  `suggested_next_action: "needs_manual_research"` (or `"skip"` if
  they're a directory listing or already `rejected`).

Every clinic starts from a **base score of 20** (a candidate starts from
50 — it has no evidence to lose yet, only a name and a website URL to
gain from). Points are added/subtracted for each signal found; a small
number of **hard overrides** force `priority_tier: "blocked"` regardless
of the numeric score.

### Positive signals (clinic)

| Signal | Points |
| --- | --- |
| Has its own website (not a directory listing) | +10 |
| Screenshot evidence captured (desktop or mobile, `captured`/`pending_storage`) | +15 |
| Crawl failed but a screenshot still proves the site is real/reachable | +10 (vs. −30 for a bare failure with no evidence at all — see "robots/TLS blockers" below) |
| Has a score at all | +10 |
| Score is in the "clear improvement opportunity" sweet spot (30–85/100 — a functional site with real room to grow) | +10 |
| Has a public phone/WhatsApp/email contact (from `clinic_contacts`, populated automatically during a real crawl) | +10 |
| Latest human review decision is `approved` | +10 |

### Negative signals / blockers (clinic)

| Signal | Points | Hard override? |
| --- | --- | --- |
| No website at all | −20 | no |
| Website is a known third-party directory listing | −60 | no (but forces `suggested_next_action: "skip"`) |
| `robots_denied` with no screenshot evidence | −40 | no |
| `robots_denied` **with** screenshot evidence | −15 | no |
| Any other crawl failure with no screenshot evidence | −30 | no |
| Crawl `partial` (page limit / partial fetch failures) | −10 | no |
| Score total > 85 (little room left to sell) | −5 | no |
| No score available at all | −15 | no |
| No public contact found | 0 (no bonus, not a separate penalty) | no |
| Latest decision `needs_changes` | −10 | no |
| Latest decision `rejected` | −100 | **yes** — `priority_tier` forced to `blocked` |
| `do_not_contact` | −100 | **yes** — `priority_tier` forced to `blocked` |
| A real manual outreach event (`manual_send_logged`/`response_logged`/`follow_up_logged`/`no_response_logged`) was logged within the last 30 days | −20 | no |

`rehearsal_logged` **never** counts toward "recently contacted" — it
explicitly proves the logging pipeline works without asserting a real
contact happened (see
`docs/technical/crawler-manual-outreach-logging.md`), so it must never
suppress a legitimate future outreach attempt.

### Robots/TLS blockers, deliberately not treated as uniformly disqualifying

Per the task's own guidance ("no robots/TLS blocker unless that blocker
itself is commercially useful evidence"): a crawl that fails to fetch
page *content* but still successfully captures a screenshot (a real,
observed scenario — see
`docs/technical/crawler-small-batch-operator-rehearsal.md`'s Dermaclinic
finding) is treated much more leniently than a crawl that fails with
*nothing* to show for it. The screenshot itself is commercially useful
evidence that the site is real and reachable, even though text
extraction failed — so `suggested_next_action` for that case is
`retry_crawl`, not `skip`.

`robots_denied` specifically is always treated as more serious than a
generic fetch error, screenshot or not — there is no bypass anywhere in
this codebase, and a site that explicitly disallows crawling is a weaker
prospect regardless.

### Tiers

```
score >= 70   → high
score >= 40   → medium
score >= 15   → low
score <  15   → blocked
```

...**unless** `do_not_contact` or the latest review decision is
`rejected`, in which case `priority_tier` is always `blocked`
regardless of the numeric score (a rejected clinic with excellent
evidence must never rank above an unreviewed one).

Note: a numeric score can still land a clinic in the `blocked` tier
(< 15) for reasons *other* than a hard override — e.g. a `needs_changes`
decision stacked on top of a crawl failure. In that case
`suggested_next_action` is still whatever the workflow-state logic below
produces (e.g. `retry_crawl`), not automatically `skip` — `blocked` here
communicates "very low priority right now," not necessarily "never
revisit."

### `suggested_next_action`

Independent of the numeric tier — driven by workflow state:

1. `do_not_contact` or `rejected`, or a directory listing → **`skip`**
2. Candidate, not yet promoted → **`needs_manual_research`**
3. Clinic, no crawl job exists yet → **`approve_domain`**
4. Clinic, latest crawl `failed`/`partial` and no score exists → **`retry_crawl`**
5. Clinic, latest review decision `approved` → **`ready_for_manual_outreach_review`**
6. Otherwise → **`review_pack`**

### What's intentionally not used as a direct signal

`crawl_pages` and `crawl_findings` have no repository-level "list" read
method in this codebase (`CrawlRepository.recordPage`/`recordFinding`
are write-only) — adding one purely for this ranking would have been
speculative scope creep. Their signal is already substantially captured
indirectly through `crawl_jobs.status`/`pagesFetched` and `scan_assets`
(screenshots). `extracted_content` is used indirectly too, via
`clinic_contacts` (populated automatically from extraction candidates
during a real crawl — see `lib/operations/run-crawl-job.ts`) rather than
re-parsing candidates directly.

## Genuine gap discovered (small, necessary addition)

Neither `ClinicRepository` nor `DiscoveryRepository` had any way to
**enumerate** clinics/candidates at all — every existing method takes a
specific id, a dedupe key, or (for the review queue) piggybacks on
`ScoreRepository.listRecent` to discover clinic ids indirectly, which
silently excludes any clinic that has no score yet (exactly the clinics
this ranking most needs to surface as `low`/`blocked`, per the small-batch
rehearsal's own findings). Two small, purely-additive read methods were
added:

- `ClinicRepository.listClinics(limit)` 
- `DiscoveryRepository.listCandidates(limit)`

Both just wrap `SELECT * ... ORDER BY created_at DESC LIMIT $1` (or the
equivalent in-memory sort for the fake), implemented in the interface,
the fake, and the Supabase adapter, consistent with every other method
in those files. No migration was needed — no new column or table.

## CLI usage

```
npm run crawler:prioritize-prospects -- --target staging
npm run crawler:prioritize-prospects -- --target staging --tier high --output markdown --write-artifact
npm run crawler:prioritize-prospects -- --target staging --limit 5 --output json
```

Flags: `--target local|staging` (required, production always refused),
`--limit` (default 20), `--tier high|medium|low|blocked|all` (default
`all`), `--output table|json|markdown` (default `table`),
`--write-artifact` (writes to the gitignored `artifacts/prioritization/`).

## Staging result

Ran against the real, retained staging data from every prior rehearsal
in this pipeline's history — 4 clinics, 5 prospect candidates (excluding
already-promoted/duplicate ones leaves 2 actionable candidates), no
mutation:

```
tier     score  kind       name                                   next_action
-------  -----  ---------  -------------------------------------  ---------------------------------
high     75     clinic     SkinLaser - Higienopolis                ready_for_manual_outreach_review
low      30     clinic     GRUPO CPD - Centro Paulista...          review_pack
blocked  10     clinic     Dermaclinic                             retry_crawl
blocked  -10    candidate  Dra. Ana Carolina Apolinário Sala...    skip
blocked  -125   clinic     Dra Ana Paula Pedrino | Dermatologia... skip
```

### Current top opportunity

**SkinLaser - Higienopolis** (`bbfd72a3-a013-4a6c-bd82-4a70479d694a`) —
`high`, score 75, `ready_for_manual_outreach_review`. Reasons: own
website, screenshot captured, score 80/100 (v1, in the improvement-opportunity
sweet spot), public WhatsApp contact found, latest decision `approved`.
Its one blocker is informational only: the crawl was `partial` (bounded
to 1 page by design in the original rehearsal). This exactly matches
every prior task's own conclusion about this clinic — the model
correctly reproduces what was already known to be true.

### Blocked/low-quality examples (real, from staging)

- **Dra Ana Paula Pedrino...** (`9c107389-...`, score −125, `blocked`,
  `skip`): `robots_denied` with zero salvageable evidence, no score, no
  contact, and a `rejected` review decision (hard override) — correctly
  the single lowest-ranked item in staging.
- **Dra. Ana Carolina Apolinário Sala...** (`c9e9fa26-...`, candidate,
  score −10, `blocked`, `skip`): flagged purely for being on
  `doctoralia.com.br`, a known third-party directory — never even
  reached the crawl stage, correctly deprioritized before any crawl
  attempt would have been wasted on it.
- **Dermaclinic** (`9e76f7e5-...`, score 10, `blocked`,
  `retry_crawl`): the "commercially useful evidence despite a blocker"
  case in practice — crawl failed, but screenshot evidence plus a
  `needs_changes` (not `rejected`) decision keeps it actionable via
  `retry_crawl` rather than `skip`, exactly as designed.

## Limitations

- The directory-listing detector is a small, explicit allowlist (5
  known domains — `doctoralia.com.br`/`.com`, `boaconsulta.com`,
  `clinicorp.com`, `guiamedico.com.br`), not a general classifier. A new
  directory platform not on this list would not be automatically caught
  — an operator's own judgment (as documented in
  `docs/operations/crawler-operator-runbook.md`'s step 3) remains the
  final check.
- `crawl_pages`/`crawl_findings` are not directly read (see "What's
  intentionally not used" above) — their signal is currently only
  captured indirectly.
- The "score sweet spot" (30–85) and every point value in the model are
  a first, reasonable calibration, not empirically tuned against real
  outreach outcomes (none exist yet — no real send has occurred through
  this pipeline as of this task). Revisit once real
  `manual_send_logged`/`response_logged` data accumulates.
- `listClinics`/`listCandidates` fetch `limit * 5` rows before
  filtering/ranking/truncating to `--limit`, matching the same
  over-fetch pattern already used by `listReviewQueue`. At very large
  data volumes this is not the most efficient possible query, but is
  consistent with the rest of this codebase's current scale and
  read-only cost profile.

## Files changed

- `lib/operations/repositories/clinic-repository.ts` (+ `listClinics`)
- `lib/operations/repositories/discovery-repository.ts` (+ `listCandidates`)
- `lib/operations/repositories/fakes.ts` (both fake implementations)
- `lib/operations/supabase/clinic-repository.supabase.ts` (+ `listClinics`)
- `lib/operations/supabase/discovery-repository.supabase.ts` (+ `listCandidates`)
- `lib/discovery/google-places.test.ts` (updated a local `DiscoveryRepository` test double to implement the new required method)
- `lib/operations/prioritization/types.ts` (new)
- `lib/operations/prioritization/prioritize-prospects.ts` (new)
- `lib/operations/prioritization/render-prioritization-markdown.ts` (new)
- `lib/operations/prospect-prioritization.test.ts` (new — 17 tests)
- `scripts/crawler/prioritize-prospects.ts` (new)
- `package.json` (+ `crawler:prioritize-prospects`)
- `.gitignore` (+ `/artifacts/prioritization/`)
- `docs/technical/crawler-prospect-prioritization.md` (this file)

## Verification

- `npm test` — 397/397 passing (17 new tests, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed via `supabase/.temp/project-ref` before running against real data.
- No crawl was performed — every field read comes from already-persisted rows via existing (or the two newly-added, purely read-only) repository methods.
- No Google Places/SERP call was made.
- No outreach was sent — this layer is entirely read-only; re-queried every retained table's row count directly before and after running the CLI against staging and confirmed all counts unchanged (4 clinics, 5 prospect_candidates, 8 crawl_jobs, 12 scan_assets, 10 scores, 7 outreach_messages, 4 human_review_decisions, 1 manual_outreach_log).
- No secrets were stored in any file, log, or this document.
