# Crawler Social/Profile Website Classification

Status date: 2026-07-24

## Root Cause (from `crawler-single-prospect-operator-run-v3-icp.md`)

During the third single-prospect rehearsal, one real discovered candidate
— "Clínica Dermatológica e Nutrição Lumina Pelle" — had
`websiteUrl: "https://www.instagram.com/luminapelle/"`. Its name reads as
a genuine independent clinic, so ICP classification correctly saw
`organizationType: "independent_clinic"`; and since Instagram is not a
*clinic directory* (it's not on the `KNOWN_DIRECTORY_LISTING_ORIGINS`
allowlist), the existing directory check didn't catch it either. The
result: `icpFit: "core"`, `suggestedAction: "promote_candidate"` — a
clean, confident recommendation for a candidate that has **no real,
crawlable business website at all**, only a social profile. The operator
had to notice this and exclude it manually.

An Instagram/Facebook/WhatsApp/link-in-bio profile can be genuinely
useful **contact/context evidence** (and this fix never removes or
penalizes that), but it is not the clinic's "own website" for
promotion/crawl-readiness purposes — there is no real page to crawl,
screenshot, or modernize, which is the entire commercial premise of
Atria's offer.

## Detection Rule

New module: `lib/discovery/social-profile-website.ts` —
`isSocialProfileWebsite(normalizedWebsiteOrigin)`. Same shape and
conventions as `lib/discovery/directory-listing.ts` (a small, explicit,
non-exhaustive hostname allowlist, reusing the shared `hostnameOf`
helper), but a **deliberately separate function and module** — a social
profile is a different kind of "not the clinic's real site" than a
third-party clinic directory, and the two must never be conflated (the
task's own explicit requirement).

Known platforms checked: `instagram.com`, `facebook.com`, `fb.com`,
`linktr.ee`, `beacons.ai`, `bio.link`, `linkin.bio`, `wa.me`,
`api.whatsapp.com`, `chat.whatsapp.com`.

## What Counts as "Own Website"

Any domain not on the social-profile allowlist and not on the
directory-listing allowlist — including any real business domain,
regardless of how simple or dated the site is. Presence of a real domain
is what matters; content quality is a separate, later concern (score,
screenshots, review).

## What Does Not Count

- The primary `website_url`/`normalizedWebsiteOrigin` field resolving to
  a known social-media, link-in-bio, or WhatsApp-messaging platform.
- **Does not apply** to social links found elsewhere — e.g. a real
  clinic's own crawled page linking out to its Instagram account in the
  footer. This fix only inspects the candidate/clinic's *primary*
  website field; it never touches extracted content, and never removes
  social/contact evidence already surfaced in the operational
  report/review pack (task requirement: "Do not remove social/contact
  evidence from crawled content; this fix is about website_url/own-site
  readiness"). Verified by a dedicated test using a candidate whose real
  own domain happens to share its name with an Instagram reference.

## Candidate Review Behavior

`classifyCandidate` (`lib/operations/discovery/list-candidates.ts`) gained
one new check, positioned after every duplicate/existing-clinic signal
and the ICP-blocked/poor/future_enterprise check (all of which still take
priority — a hospital whose only "website" happens to be Instagram still
shows `blocked_icp`, not this new action) but before the generic
`maybe`/needs_review fallback:

- If `isSocialProfileWebsite(candidate.normalizedWebsiteOrigin)` is true → **`suggestedAction: "blocked_no_own_website"`** (a new `CandidateReviewAction` value, distinct from `blocked_no_website` — no URL at all — and `blocked_directory` — a third-party clinic directory).
- `--only-promotable` correctly excludes it (verified against real staging data — see Staging Validation).

## ICP/Prioritization Behavior

`classifyIcp` (`lib/operations/icp-classification/classify-icp.ts`) now
computes `isSocialProfileWebsite` right after the directory check. It:

- Always adds `social_profile_website` to `blockers` when true (a new
  `IcpReasonCode`, distinct from `no_own_website`, which means no URL at
  all).
- Caps `icpFit` at `"maybe"` in the `independent_clinic` default branch —
  never `"core"` — even when the name reads as a genuine clinic.
- Never *un-caps* an already-worse classification: a hospital/wrong-
  audience/franchise/chain business with a social-profile website still
  gets its own (worse) `icpFit`, since those checks return early, before
  this cap would apply.

Since `prioritizeClinic`/`prioritizeCandidate` already read `icp.icpFit`
and apply a score penalty for `"maybe"` (`-15`, unchanged by this fix), a
social-profile-website prospect automatically ranks lower than an
equally-evidenced real-domain clinic — no separate prioritization code
change was needed (verified by a comparative test: two identically-
evidenced clinics, one Instagram-only, one real-domain — the Instagram
one always scores lower).

## Commercial Template Behavior

`build-commercial-template-pack.ts` gained one new explicit withhold
check (mirroring the existing directory-listing and future_enterprise/
poor-ICP checks): if the clinic's `normalizedWebsiteOrigin` is a social
profile, copy is withheld with a specific reason — **unless** the
clinic's latest human review decision is `"approved"`. This is the one
soft-withhold in this module with an explicit human override, matching
the task's own spec ("withheld unless a real own website exists and
review explicitly approves") — a human who has explicitly reviewed and
approved a clinic despite its Instagram-only presence may still see copy.

## Staging Validation

Read-only, against the exact "Lumina Pelle" case from
`crawler-single-prospect-operator-run-v3-icp.md`:

```bash
npm run crawler:candidates:list -- \
  --target staging --discovery-job-id c04f4961-57ff-47dd-8ebf-b4dd12dd863c \
  --include-existing --output markdown

npm run crawler:candidates:list -- \
  --target staging --discovery-job-id c04f4961-57ff-47dd-8ebf-b4dd12dd863c \
  --include-existing --only-promotable --output json
```

**Result:** "Clínica Dermatológica e Nutrição Lumina Pelle" now shows:

```
Ação sugerida: Bloqueado — website é perfil social/mensageria, não domínio próprio
ICP: independent_clinic — fit: maybe — decisão: owner_led
Bloqueios: O website informado é um perfil de rede social/mensageria
  (ex.: Instagram, Facebook, WhatsApp, link-in-bio), não um domínio
  próprio da clínica.
```

`--only-promotable` against this discovery job now returns `count: 0`
(the other previously-promotable candidate from this batch, "Clínica Dra.
Natália Segatti," is already promoted from the prior rehearsal) — exiting
cleanly with the existing helpful empty-result note. No staging row was
mutated.

## Limitations

- The allowlist is small and hand-curated — a link-in-bio or messaging
  platform not on this list (new/regional services, e.g. a Brazil-
  specific link-in-bio tool) would still slip through as an apparent
  "own website." Extending the list is a one-line change when a new
  platform is found in real data (same maintenance model as
  `directory-listing.ts`).
- This only inspects the *primary* website field. A candidate whose
  `websiteUrl` happens to be a personal blog on a free subdomain (e.g.
  `clinica.wordpress.com`) is not caught by this fix — that's a
  different, not-yet-addressed class of "not really an own business
  site."
- The commercial-template "approved decision overrides the withhold"
  behavior is unique to this specific check in this module — every other
  soft/hard withhold in `build-commercial-template-pack.ts` (low tier,
  future_enterprise/poor ICP) does **not** have this override. This
  asymmetry is intentional (per the task's explicit spec) but worth
  knowing if extending this module further.

## No Production, No Crawl, No Google/SERP, No Outreach

This fix is a pure, static hostname check — no network call, no database
write. Staging validation used `--target staging` exclusively, was fully
read-only, and mutated zero rows. No Google Places or search-engine call
was made. No outreach message was created, approved, or sent.
