# Crawler ICP (Ideal Customer Profile) Classification

Status date: 2026-07-23

## Why This Exists

Google Places discovery finds anything that technically looks like a
clinic — including hospitals, franchise units, multi-unit clinic chains,
third-party directory listings, and businesses that aren't a clinic at
all (pharmacies, labs, suppliers, courses). None of these are a good fit
for the Atria MVP even when they crawl cleanly and score well digitally:
Atria's MVP targets **independent, owner-led, small/mid-size clinics**
where a single decision-maker can say yes to modernizing their own site.
A hospital's procurement process, a franchise's corporate marketing team,
or a compounding pharmacy's business model are all a different sale
entirely (or, for hospitals/chains, potentially a *future* enterprise
product — just not this MVP).

Before this change, an operator reviewing candidates or reading the
prioritization ranking had no signal for this at all — a technically
well-scored hospital or a wrong-audience business (e.g. a pharmacy whose
name happens to start with "Dermatológica") could look exactly as
promotable as a genuine independent dermatology clinic. This fix adds a
pure, deterministic classifier that flags this before an operator spends
review time on it.

**Product boundaries unchanged:** this classifier never evaluates medical
quality, never assesses provider competence, never touches patient data,
and never makes a medical claim. The required disclaimer — *"Esta análise
avalia apenas a apresentação digital e a facilidade de encontrar
informações. Não avalia qualidade médica."* — is untouched and still
verbatim everywhere it already appeared.

## ICP Model / Enums

`lib/operations/icp-classification/types.ts`:

```ts
type IcpOrganizationType =
  | "independent_clinic" | "solo_practitioner" | "franchise_unit"
  | "clinic_chain" | "hospital" | "directory_listing"
  | "wrong_audience" | "unknown";

type IcpFit = "core" | "maybe" | "poor" | "blocked" | "future_enterprise";

type IcpDecisionComplexity = "owner_led" | "local_manager" | "corporate" | "unknown";

type IcpReasonCode =
  | "hospital_or_large_institution" | "franchise_or_chain"
  | "directory_listing" | "wrong_audience" | "no_own_website"
  | "duplicate_existing" | "unclear_icp" | "likely_core_icp"
  | "needs_manual_review";
```

`classifyIcp()` (`lib/operations/icp-classification/classify-icp.ts`) maps
`organizationType` → `icpFit` → `decisionComplexity` as follows:

| organizationType | icpFit | decisionComplexity |
|---|---|---|
| `independent_clinic` (has own, non-directory website) | `core` | `owner_led` |
| `independent_clinic` (no website yet) | `maybe` | `owner_led` |
| `solo_practitioner` | `maybe` | `owner_led` |
| `franchise_unit` | `poor` | `local_manager` |
| `clinic_chain` | `future_enterprise` | `corporate` |
| `hospital` | `future_enterprise` | `corporate` |
| `directory_listing` | `blocked` | `unknown` |
| `wrong_audience` | `blocked` | `unknown` |
| `unknown` (empty/unparseable name) | `maybe` | `unknown` |

`duplicate_existing` is **not** produced by `classifyIcp` itself — it's
reserved for the caller (the candidate review CLI already has its own,
separate, more precise duplicate/existing-clinic detection — see
`docs/technical/crawler-website-dedupe-normalization.md`) to fold into a
combined reasons/blockers view if useful. Keeping the classifier itself
free of duplicate-detection logic keeps it a pure function of
name/website/category alone.

## Signals Used

Only already-persisted, already-public evidence — no crawl, no LLM, no
external call:

1. **Name** (`rawName`/`displayName`), normalized via the same
   `normalizeClinicName` already used elsewhere in discovery (lowercase,
   accents stripped, punctuation collapsed to spaces).
2. **Website origin**, reusing the *exact same* `isDirectoryListing`
   detector prioritization already uses (now extracted to
   `lib/discovery/directory-listing.ts` so both modules can import it
   without a circular dependency).
3. **Google Places category types** (`sourceAttribution.raw.types`, when
   present) — a secondary, reinforcing signal only; the name-based
   heuristic alone is always sufficient.

## Conservative Rules

Per the product spec, a single weak/ambiguous word never overblocks:

- **Wrong audience / hospital**: a single strong keyword or category type
  is sufficient (these are distinctive: "farmacia", "hospital",
  `pharmacy`, `hospital` category, etc.) — no reinforcement needed.
- **Franchise/chain**: one strong keyword ("franquia", "franchise") is
  sufficient alone, but a **weak** keyword ("rede", "grupo", "unidade",
  "matriz", "filial") needs **two or more together** to escalate past
  `independent_clinic`. A single occurrence of "grupo" or "centro médico"
  alone never escalates — confirmed against real staging data ("GRUPO
  CPD - Centro Paulista de Dermatologia" correctly stays
  `independent_clinic`/`core`).
- **Solo practitioner**: a bare "Dr./Dra." personal-name page resolves to
  `maybe`, never a hard block — and if the name *also* contains a
  clinic-business keyword ("clínica", "instituto"), that's treated as
  stronger evidence of a real clinic business, resolving to
  `independent_clinic`/`core` instead (confirmed against real candidates:
  "Dra Mirelle Furlan - Dermatologia **Clinica**" → `independent_clinic`).
- **Category-type false positives**: a wrong-audience category match
  (e.g. `store`) is ignored if a clinic-positive category (`doctor`,
  `medical_clinic`, `dermatologist`, `skin_care_clinic`, `beautician`,
  `clinic`) is also present — real dermatology/aesthetic clinics that
  also sell skincare products at retail are routinely co-tagged `store`
  by Google Places (this was found and fixed during this task's own
  staging validation, see Limitations).
- Everything else falls through to `independent_clinic`/`core` — no
  positive evidence required beyond having its own, non-directory
  website.

## What Is Blocked

`icpFit: "blocked"` — `directory_listing` and `wrong_audience` only. This
is a **hard override**: `prioritizeClinic`/`prioritizeCandidate` force
`priorityTier: "blocked"` regardless of any other evidence (matching the
existing `do_not_contact`/`rejected` hard-override pattern), and the
candidate review CLI maps it to `suggestedAction: "blocked_icp"`
(`"blocked_directory"` for the directory case specifically, since that
check already existed and is unchanged). A wrong-audience candidate with
a maximal, high-tier-shaped technical score still ranks `blocked` —
verified by a dedicated test.

## What Is `future_enterprise`

`hospital` and `clinic_chain` (a parent/multi-unit entity, not a single
branch). Not a hard block — not a wrong-audience business, just not the
MVP's target profile today. A heavy score penalty (`-40`) and an explicit
commercial-template withhold (see below) apply regardless of how
technically strong the crawl/score evidence is, so a hospital never
outranks an equally-evidenced independent clinic merely because its
website happens to be more complete — verified by a comparative test.
`franchise_unit` (a single branch of a chain/franchise) gets a similar
but slightly lighter treatment (`icpFit: "poor"`, `-35`) since a single
unit may still have *some* local decision-making, even if reduced.

## Candidate Review Output Changes

`npm run crawler:candidates:list` now includes, on every item:
`organization_type`, `icp_fit`, `decision_complexity`, `icp_reasons`,
`icp_blockers` (raw `IcpReasonCode[]`), plus human-readable pt-BR text
folded into the existing `blockers` array. A new `suggestedAction` value,
**`blocked_icp`**, covers hospital/franchise/chain/wrong-audience (when
not already a directory listing, which keeps its existing
`blocked_directory` action). `solo_practitioner`/weak-signal `maybe`
candidates map to the existing `manual_review` action.

**Priority order is unchanged and preserved**: promoted/duplicate/
rejected/no-website/directory-listing/existing-clinic-match are all
checked, in that order, *before* ICP — a hospital-named candidate that's
already `rejected` still shows `blocked_existing`, not `blocked_icp`
(verified by a dedicated test) — exactly matching "duplicates still
remain duplicate/blocked_existing before ICP promotion."

## Prioritization / Template Changes

`prioritizeClinic`/`prioritizeCandidate`
(`lib/operations/prioritization/prioritize-prospects.ts`) now compute
`classifyIcp` and apply a score adjustment (skipped entirely for
`directory_listing`, which the pre-existing directory branch already
fully scores/blocks, to avoid double-penalizing):

| icpFit | score adjustment | tier effect |
|---|---|---|
| `core` | none | business as usual |
| `maybe` | `-15` | soft nudge, can still reach medium |
| `poor` | `-35` | typically lands in `low` |
| `future_enterprise` | `-40` | typically lands in `low`/`medium`, never outranks an equally-evidenced independent clinic |
| `blocked` | `-60`, **plus hard tier override to `"blocked"`** | never escapes blocked, regardless of score |

Every `PrioritizedProspect` now carries an `icp: IcpClassification` field.

`build-commercial-template-pack.ts` withholds copy explicitly (checked
before the generic tier-based branches, mirroring how directory listings
are already checked explicitly) for `future_enterprise` and `poor`
ICP fit — with a specific message naming the reason ("possível
oportunidade enterprise futura" / "unidade de franquia/rede") rather than
the generic "low priority" text, so an operator understands *why*.
`blocked` ICP is already covered by the existing `priorityTier ===
"blocked"` branch (via the hard override above).
Rejected/do_not_contact/needs_changes behavior is unchanged — verified by
a dedicated regression test.

## Staging Validation

Read-only, against the exact discovery job from
`crawler-single-prospect-operator-run-v2.md`
(`1257e023-ead6-4fd0-9cc2-51c2ffedecfe`):

```bash
npm run crawler:candidates:list -- \
  --target staging --discovery-job-id 1257e023-ead6-4fd0-9cc2-51c2ffedecfe \
  --include-existing --output markdown

npx tsx scripts/crawler/prioritize-prospects.ts --target staging --output table --limit 20
```

Confirmed against real data:

- The known directory-listing candidate ("Dra. Ana Carolina Apolinário
  Sala" on doctoralia.com.br) still shows `blocked_directory`, unaffected.
- The SkinLaser scheme-mismatch duplicate still shows `blocked_existing`
  (website-normalized match), unaffected by ICP — duplicate detection
  still wins, as designed.
- **A real, previously-unflagged wrong-audience candidate was correctly
  caught**: "Dermatológica - Farmácia de Manipulação em Curitiba" (a
  compounding pharmacy) now shows `blocked_icp`/`wrong_audience`, dropping
  from `medium` (score 60, `needs_manual_research`) to `blocked` (score
  0, `skip`) in prioritization — exactly the kind of prospect this
  feature exists to catch.
- "GRUPO CPD - Centro Paulista de Dermatologia" (a real clinic with a
  single weak "grupo" signal) correctly stays `independent_clinic`/`core`
  — confirming the conservative "single weak signal never overblocks"
  rule holds on real data, not just fixtures.
- All five candidates from the discovery job, and the broader staging
  pool (15 prospects), were inspected read-only — **no staging row was
  mutated**.

## Limitations

- **A real false positive was found and fixed during this task's own
  staging validation**: "Clinica Derma Line" (a genuine dermatology/
  aesthetic clinic that also sells skincare products at retail) is
  tagged `store` by Google Places alongside its real `medical_clinic`/
  `doctor`/`skin_care_clinic` categories. The initial category-type list
  included `store`, misclassifying it as `wrong_audience`. Fixed by
  removing the overly-generic `store` category and adding a
  clinic-positive-category safety net (see `classify-icp.ts`). Kept as a
  documented lesson: **any future category-type addition to the
  wrong-audience list must be checked against real staging data first**,
  not assumed safe from the category name alone.
- The name-keyword lists (hospital/wrong-audience/chain/solo-practitioner)
  are hand-written and Portuguese/Brazil-specific — not exhaustive, and
  will miss phrasings not anticipated here. When uncertain, the design
  intentionally resolves to `maybe`/`needs_manual_review` rather than
  guessing, but a genuinely novel wrong-audience business type with no
  matching keyword could still slip through as `independent_clinic`.
- `franchise_unit` vs. `clinic_chain` distinction (unit-level keyword
  presence) is a simple heuristic, not a real corporate-structure lookup
  — there is no such data source available.
- Google Places category types are the only external-metadata signal
  used; no other provider's taxonomy is supported (not needed today,
  since Google Places is the only discovery source in this pipeline).
- This classifier does not know about `crawl_findings`/extracted page
  content — it classifies from name/website/category alone, before any
  crawl happens. A clinic that only reveals it's actually a chain
  *inside* its crawled page content (not in its name/category) won't be
  caught by this layer; that would require a separate, later signal not
  in scope here.

## No Production, No Crawl, No Google/SERP, No Outreach

This classifier is a pure, in-memory function — no network call, no
database write, no LLM. Every consumer (`list-candidates.ts`,
`prioritize-prospects.ts`, `build-commercial-template-pack.ts`) is
already read-only and already refuses production via the shared
`target-guard`. Staging validation used `--target staging` exclusively
and mutated zero rows. No Google Places or search-engine call was made —
the optional category-type signal only ever reads already-persisted
`sourceAttribution`, never fetches anything fresh. No outreach message
was created, approved, or sent.
