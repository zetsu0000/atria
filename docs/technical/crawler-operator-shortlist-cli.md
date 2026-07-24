# Crawler Operator Shortlist CLI

Status date: 2026-07-23

## Why this CLI exists

Even with `list-candidates.ts` (`docs/technical/crawler-candidate-review-cli.md`),
an operator still had to manually: read every candidate row, mentally
combine `icp_fit` + website classification + duplicate status into one
decision, copy the right candidate ID by hand, and re-assemble the exact
next commands (promote → crawl) from memory. This is exactly the kind of
manual overhead the single-prospect operator run rehearsals kept surfacing
before "operator run v4."

`scripts/crawler/operator-shortlist.ts` (via
`npm run crawler:operator:shortlist`) closes this gap: it wraps the same,
already-tested candidate classification (`listCandidatesForReview`,
`lib/operations/discovery/list-candidates.ts`) and adds a conservative
ranking, a summary, and copy-paste-safe next commands — so an operator can
go from "here's a discovery job" to "here's the one candidate to promote
next, and here are the exact commands" without re-deriving anything by
hand. It never re-implements ICP/social/directory/duplicate logic — it
only ranks and relabels what `listCandidatesForReview` already decided.

## Exact command

```bash
npm run crawler:operator:shortlist -- \
  --target staging \
  --discovery-job-id <DISCOVERY_JOB_ID> \
  --limit 5 \
  --output markdown
```

Optional flags:

| Flag | Default | Notes |
|---|---|---|
| `--include-existing` | off | Runs the same extra read-only dedupe-against-clinics check `list-candidates.ts --include-existing` does. |
| `--only-actionable` | off | Only display items whose recommendation is `promote_next` or `manual_review` — blocked/duplicate rows are still counted in the summary, just not printed. |
| `--max-candidates <n>` | 20 | How many raw candidates from this discovery job to fetch/consider before ranking. |
| `--limit <n>` | 5 | How many top-ranked items to display after ranking. |
| `--output table\|json\|markdown` | table | Rendering format. |

`--discovery-job-id` is required — a shortlist is always scoped to one
discovery job, never "all candidates."

## Output fields

Summary (always first):

- `discovery_job_id`
- total candidates reviewed
- actionable count (`promote_next` + `manual_review`)
- blocked count (everything not actionable)
- duplicate count (`skip_duplicate`)
- social/no-own-website count (`blocked_no_own_website`)
- recommended next candidate ID, if any
- stop reason, if no candidate is recommended

Per candidate:

- `rank`, `candidate_id`, name, `website_url`, city/state
- `suggested_action` (the underlying `CandidateReviewAction`, unchanged)
- `organization_type`, `icp_fit`, `decision_complexity`
- `blockers`, `reasons` (pt-BR, human-readable)
- duplicate/existing clinic match (`existing_clinic_id` +
  `existing_clinic_match_reason`), when `--include-existing` found one
- website classification: `own_website` / `social_profile` /
  `messaging_link_in_bio` / `directory` / `unknown` — a finer split of the
  existing directory/social-profile checks, for display only
- operator recommendation: `promote_next` / `manual_review` /
  `skip_duplicate` / `blocked_no_own_website` / `blocked_directory` /
  `blocked_icp` / `blocked_wrong_audience`

`operator_recommendation` is a simplified relabeling of `suggested_action`
(`lib/operations/operator-shortlist/build-operator-shortlist.ts`,
`deriveOperatorRecommendation`) — it never makes a new decision. The only
place it's more specific than `suggested_action` is splitting
`blocked_icp` into `blocked_wrong_audience` (organization_type
`wrong_audience`) vs. a generic `blocked_icp` (hospital/franchise/chain),
since those call for different manual follow-up.

## Ranking rules

Three conservative tiers, matching the task's own framing:

- **Highest (`promote_next`, score 100):** the candidate's `suggested_action`
  is already `promote_candidate` — independent clinic, ICP fit `core`, own
  website, not a directory, not a social profile, no existing-clinic
  conflict.
- **Medium (`manual_review`, score 50):** ICP fit `maybe` (solo
  practitioner or a weak/ambiguous name signal), or `status === "needs_review"`.
- **Low/blocked (everything else, score 0):** duplicate/already-existing,
  directory, social-profile-as-primary-website, no website, wrong
  audience, hospital/franchise/chain, or any other ICP-blocked reason.

Ties within the same tier keep discovery order (`created_at` descending,
inherited from `listCandidatesForReview`) — a stable sort, so ranking is
fully deterministic for the same input.

This deliberately never overranks a hospital/franchise/chain even if its
website looks professional, never overranks a social-profile-only
candidate, and never overranks a duplicate — all three always land in the
lowest tier alongside every other blocked reason. When ICP fit is `maybe`
(ambiguous), the candidate is ranked medium and recommended for manual
review, never promoted automatically.

## Stop reasons

`recommendedCandidateId` is only set when at least one candidate in the
full reviewed pool (independent of `--only-actionable`/`--limit` display
filtering) has recommendation `promote_next`. Otherwise `stopReason` is
set instead, distinguishing two cases:

- No candidates matched this discovery job at all.
- Candidates exist, but none is ready to promote — the message includes
  how many were reviewed/blocked, and tells the operator to manually
  review any `manual_review` candidates before proceeding.

## Command suggestions behavior

When `recommendedCandidateId` is set, the Markdown output prints two
copy-paste-safe commands using only real, existing script names and
flags — verified directly against `scripts/crawler/promote-candidate.ts`
and `scripts/crawler/process-crawl-queue.ts`:

```bash
npm run crawler:promote -- \
  --target staging \
  --candidate-id <CANDIDATE_ID>

npm run crawler:queue:process -- \
  --target staging \
  --clinic-ids <CLINIC_ID> \
  --max-pages 3 \
  --allow-real-crawl \
  --approved-domains <APPROVED_DOMAIN>
```

Note `--clinic-ids` (plural) — the task's own illustrative example used
`--clinic-id` (singular), which does not exist in
`process-crawl-queue.ts`; the real, plural, comma-separated flag is used
here instead, per the "never invent a command" requirement. `<CLINIC_ID>`
and `<APPROVED_DOMAIN>` are always placeholders — the clinic ID doesn't
exist until after promotion, so it is never guessed or fabricated. When
there is no recommended candidate, the section prints a short note
instead of a command.

## Staging validation

Validated read-only against two real discovery jobs (target `staging`, no
mutation in either run):

**Run v3 job (`c04f4961-57ff-47dd-8ebf-b4dd12dd863c`, `--include-existing`):**
5 candidates reviewed, 2 actionable (both solo-practitioner `manual_review`),
2 duplicate/already-existing (`Dermaclinic`, `Clínica Dra. Natália
Segatti`), 1 social-profile (`Lumina Pelle`, Instagram). No `promote_next`
candidate exists in this batch — every non-duplicate/non-social candidate
is only ICP fit `maybe` — so the tool correctly reports a stop reason
instead of a false recommendation. Confirms: the social-profile candidate
is never recommended, both duplicates are never recommended, and no
`core`-fit own-website candidate was silently missed (none exists in this
job).

**Run v2 job (`1257e023-ead6-4fd0-9cc2-51c2ffedecfe`, `--include-existing`):**
5 candidates reviewed, 3 actionable, 2 duplicate/already-existing
(`Clínica High Line`, `Skinlaser Dermatologia Médica Ltda`). The best
own-website ICP-core candidate (`Dra. Danielle Bacha - Dermatologia
Estética, Clínica e Tricologia em Moema`) is surfaced as rank 1 and
`recommendedCandidateId`, with correct, real next commands printed.
Confirms: both duplicates are never recommended, and the best candidate is
surfaced clearly when one exists.

**Empty job (`00000000-0000-0000-0000-000000000000`, a nonexistent discovery job):**
`count: 0`, `stopReason: "Nenhum candidato encontrado para este
discovery_job_id."` — exits cleanly, no error, no crash.

## Limitations

- Inherits every limitation already documented for `list-candidates.ts`
  (`docs/technical/crawler-candidate-review-cli.md`) — a client-side
  filter over one over-fetched batch, `--include-existing`'s extra reads,
  the manually-curated directory/social-profile allowlists.
- The three-tier rank score (100/50/0) does not further distinguish
  severity *within* the blocked tier — a duplicate and a hospital both
  score 0 and are ordered only by original discovery order relative to
  each other. This is intentional (the task only required a combined
  low/blocked tier), not a bug.
- `website classification` is a display-only re-split of the existing
  boolean checks (`isDirectoryListing`, `isSocialProfileWebsite`) — it
  does not change any promotion/ICP decision, only how the shortlist
  labels the primary website.

## No production, no crawl, no Google/SERP, no outreach

This CLI never touches production (refused structurally by
`selectRepositories`/`assertSafeTarget`), never crawls a website, never
calls the Google Places API, SERP, or any external service, and never
creates, mutates, promotes, or sends anything. It only reads
already-persisted `prospect_candidates` (and, with `--include-existing`,
already-persisted `clinics`) — the exact same reads `list-candidates.ts`
already performs.
