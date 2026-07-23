# Crawler Website Dedupe Normalization

Status date: 2026-07-23

## Root Cause (from `crawler-single-prospect-operator-run-v2.md`)

During the second single-prospect rehearsal, Google Places discovery
returned "Skinlaser Dermatologia Médica Ltda - Moema"
(`http://www.skinlaser.com.br/`) as a brand-new, `promote_candidate`
candidate — even though it is almost certainly the same real business as
the already-promoted, already-approved clinic "SkinLaser - Higienópolis"
(`https://www.skinlaser.com.br/`). The operator recognized this by eye;
`crawler:candidates:list --include-existing` did not.

Two separate issues were involved:

1. **`normalizeWebsiteOrigin`** (`lib/discovery/normalize.ts`) preserved the
   URL scheme in its output (`url.origin`), so `http://www.skinlaser.com.br`
   and `https://www.skinlaser.com.br` produced two *different* normalized
   origins — the same real site, treated as two different identities.
2. **The candidate review CLI's `--include-existing` check** only ever did
   an *exact* `dedupeKey` lookup (`ClinicRepository.findClinicByDedupeKey`).
   `dedupeKey` is a hash of `normalizedWebsiteOrigin` **and**
   `normalizedName` **and** `phone`/`email`/`city` together — so even with
   the scheme fixed, two listings for the same website under different
   business names (a very real Google Places pattern: multiple listings
   for one clinic) would still produce different `dedupeKey`s and never
   match via that exact lookup alone.

Both had to be fixed for the review CLI to actually catch this case.

## Normalization Rule Implemented

`normalizeWebsiteOrigin` (`lib/discovery/normalize.ts`) now treats
`http://` and `https://` as the same identity:

- Hostname is lowercased (unchanged from before).
- Path, query string, and hash are ignored (unchanged — `URL.origin` never
  includes them).
- A trailing slash never affects the result (unchanged — origins never
  have one).
- **New:** the scheme is canonicalized — `http://host` and `https://host`
  both normalize to `https://host`. This is a pure string transform with
  no network call; it does not "trust" that the site truly serves HTTPS,
  it only asserts that the two schemes represent the same identity for
  dedupe purposes.

This single fix propagates everywhere `normalizedWebsiteOrigin` already
feeds into dedupe: `buildCandidateDedupeKey`'s hash, the in-batch
`classifyCandidateDuplicate`'s `byWebsiteOrigin` set (used during a single
discovery/CSV-import run), and — new in this change — the candidate review
CLI's live existing-clinic check.

**Separately**, `lib/operations/discovery/list-candidates.ts`'s
`--include-existing` check was extended with a second, independent match:
after the existing exact-`dedupeKey` lookup (preserved, checked first), it
now also fetches the current clinic list once (`clinicRepo.listClinics`)
and matches on **normalized website origin alone** — re-normalizing each
stored origin through the fixed `normalizeWebsiteOrigin` at comparison
time, so it works correctly even for rows persisted *before* this fix,
with no backfill/migration required. Each `CandidateReviewItem` now
carries `existingClinicMatchReason`: `"dedupe_key"` for the exact match, or
`"normalized_website"` for the website-only match — so the operator always
sees *why* a match was flagged.

## What Is Intentionally Not Normalized

- **www vs. apex** (`www.example.com` vs. `example.com`) are treated as
  *different* origins, deliberately. The repository has no established
  convention that they're always the same site — some businesses run
  genuinely different content on each — so silently merging them risks
  hiding a real difference rather than catching a real duplicate. This is
  tested explicitly (`lib/discovery/normalize.test.ts`,
  `lib/operations/candidate-review.test.ts`) rather than left as an
  untested assumption. If a future rehearsal finds a real www/apex
  duplicate slipping through, that should be a separate, deliberate
  decision — not an accidental side effect of this change.
- **Subdomains** (`sub.example.com` vs. `example.com`, or two different
  subdomains of the same apex) are never conflated — `URL.origin` already
  treats these as distinct hosts, and this fix does not change that.
- **Custom ports** are preserved as part of the origin (an extremely rare
  case for real clinic websites) — scheme canonicalization does not touch
  the port.
- **Crawl-time safety is completely untouched.** `lib/crawler/url-policy.ts`'s
  `isSameOrigin` (the SSRF/redirect-safety same-origin check the bounded
  crawl loop enforces) remains deliberately scheme-strict and is a fully
  separate function — a mid-crawl http→https redirect is still correctly
  refused as a different origin by that check. `canonicalizeHttpToHttpsIfSafe`
  (the network-validated starting-URL upgrade used before a crawl begins)
  is likewise untouched. This dedupe-layer fix never makes a network call
  and never decides what URL a crawl actually requests — see the doc
  comment on `normalizeWebsiteOrigin` itself for the same guarantee stated
  in code.
- **Discovery-time candidate-vs-candidate matching** for two *already-persisted*
  candidates that only share a website (not run in the same batch) was not
  extended — `lib/discovery/providers/google-places.ts`'s `existing_in_db`
  check still only compares the full `dedupeKey`. This gap is scoped
  identically to what the exact-`dedupeKey` check has always had, and is
  out of scope for this fix, which specifically targets the candidate
  review CLI's clinic-comparison path (the concrete gap the run-v2
  rehearsal found).

## Candidate Review Behavior

`npm run crawler:candidates:list -- --include-existing` now performs, per
not-yet-dispositioned candidate:

1. Exact `dedupeKey` match against clinics (unchanged, checked first —
   same signal `promote-candidate.ts` uses to link idempotently).
2. If no exact match, a normalized-website-only match against every
   existing clinic (new).

Either match sets `suggestedAction: "blocked_existing"`,
`existingClinicId`, and `existingClinicMatchReason` (`"dedupe_key"` or
`"normalized_website"`), with a blocker message that names which kind of
match was found. `--only-promotable` correctly excludes both kinds.

## Promotion Behavior

**Unchanged, and intentionally so.** `promote-candidate.ts`
(`lib/operations/promote-candidate.ts`) still only checks the exact
`dedupeKey` before deciding whether to link to an existing clinic or
create a new one — matching the database's own `clinics_dedupe_key_unique`
constraint, which is likewise scoped to the exact key, not the website
alone. Promoting a candidate that only matches an existing clinic by
website (different listing name) still creates a **second** clinic row —
documented and tested explicitly
(`lib/operations/promote-candidate.test.ts`, test 10) rather than left as
an untested assumption.

This is a deliberate "smallest safe fix" scope decision: extending
`promoteCandidateToClinic` to also refuse or link on a website-only match
is a real product decision (refuse? auto-link? require a flag?) that
wasn't part of this fix's ask. **The operator handoff pack's Step B is the
enforcement point today** — an operator following
`docs/operations/crawler-operator-handoff-pack.md`'s documented workflow
(review before promote) will see `blocked_existing` before ever running
`crawler:promote` on a website-only duplicate.

## Staging Validation

Read-only, against the exact scenario from
`crawler-single-prospect-operator-run-v2.md`:

```bash
npm run crawler:candidates:list -- \
  --target staging \
  --discovery-job-id 1257e023-ead6-4fd0-9cc2-51c2ffedecfe \
  --include-existing \
  --output markdown
```

**Result:** "Skinlaser Dermatologia Médica Ltda - Moema"
(`95109461-d223-4479-adb4-94bac1292e26`) now shows:

```
Ação sugerida: Bloqueado — já existe no sistema
Clínica existente (mesmo website): bbfd72a3-a013-4a6c-bd82-4a70479d694a
Bloqueios: Já existe uma clínica com o mesmo website (normalizado,
  http/https tratados como o mesmo site): bbfd72a3-a013-4a6c-bd82-4a70479d694a.
```

`bbfd72a3-a013-4a6c-bd82-4a70479d694a` is the real, already-approved
"SkinLaser - Higienópolis" clinic — confirming the fix correctly matched
against real staging data. Before the fix (`crawler-single-prospect-operator-run-v2.md`),
this same candidate showed `suggestedAction: "promote_candidate"` with no
`existingClinicId`. The other four candidates from the same discovery job
are unaffected: "Clínica High Line" still correctly shows `skip_duplicate`
(already promoted in run v2), and the three genuinely-new candidates
("Dra. Danielle Bacha", "Dra Mirelle Furlan", "Clinica Derma Line") still
correctly show `promote_candidate` — proving the fix is precise, not
over-broad. No staging row was mutated to run this validation (read-only
command, verified by the existing no-mutation test suite).

## Limitations

- The website-only match fetches the full clinic list once per
  `list-candidates.ts` invocation (`clinicRepo.listClinics(500)`) — fine at
  today's staging scale (a handful of clinics), not optimized for a large
  clinic table.
- www/apex and discovery-time candidate-vs-candidate matching remain
  unfixed, as documented above — these are explicit, tested-as-absent
  behaviors, not oversights.
- A genuinely ambiguous case (two clinics that legitimately share one
  website, e.g. a franchise) would collide in the origin index; the first
  one fetched wins the match, and the collision itself is not surfaced as
  its own signal — this is expected to be rare enough at current scale to
  defer, not a case this fix tries to detect.
- This fix does not retroactively change any already-persisted
  `normalized_website_origin` value in the database — it only changes how
  *comparisons* are made (both at write time for new rows, and at
  comparison time for the review CLI, which re-normalizes stored values on
  read) — there is no migration/backfill involved.

## No Production, No Crawl, No Google/SERP, No Outreach

This fix touches only the discovery-normalization and candidate-review
read paths. It never crawls, never calls the Google Places API or any
search engine, never sends outreach, and never touches production —
staging validation used `--target staging` exclusively, and the fix itself
made no Supabase writes (the only exception, run once for validation, is
already covered by the existing production-refusal guard shared by every
crawler CLI).
