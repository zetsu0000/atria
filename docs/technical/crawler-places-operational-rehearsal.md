# Crawler Google Places operational rehearsal

> **Status: PARTIAL — blocked on a missing credential, not a code defect.**
> The dry-run rehearsal passed cleanly. The staging rehearsal could not run
> because `GOOGLE_PLACES_API_KEY` is not present in this environment. Per
> instruction, this was treated as a stop-and-document blocker — the user
> was not asked to paste the key into chat, no workaround was attempted,
> and nothing was created in staging as a result. **Production was never
> touched. No scraping. No broad crawl. No outreach was sent. No secrets
> appear anywhere in this document.**

## Branch / tag baseline

`feature/crawler-places-operational-rehearsal`, created from tag
`atria-crawler-google-places-discovery-v1` (commit `818cf52`, "Add Google
Places discovery provider"). No code was changed in this rehearsal — see
"Verification" below for why.

## Preflight

| Check | Result |
| --- | --- |
| `git status --short` (before starting) | Clean working tree |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) |
| `supabase migration list` | All 4 local migrations applied remotely — unchanged since the prior rehearsal |
| `GOOGLE_PLACES_API_KEY` present in environment? | **No** — confirmed via a shell check that reported only whether the variable was set (its value was never read, printed, or required to answer that question) |
| `.env.local` present in this repo? | No |

## Dry-run result

```
npm run crawler:discover:places -- --dry-run --query "dermatology clinic" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

Succeeded exactly as designed:

- `mode=dry-run`, no `GOOGLE_PLACES_API_KEY` needed, no network call, no
  Supabase write — the fixture provider (`createFixtureGooglePlacesProvider`)
  served two canned in-memory places.
- `query="dermatology clinic"`, `location="São Paulo, SP"`,
  `maxResults=3`, `maxPages=1` (the fixture set only has 2 entries, so
  `maxResults=3` was not the binding constraint here — `truncatedByMaxResults: false`).
- 2 candidates imported: one `status: "new"` (has a fixture website), one
  `status: "needs_review"` (no website) — exactly the "missing website
  handled" behavior documented in
  `docs/technical/crawler-google-places-discovery.md`.
- 0 duplicates, 0 rejected, 0 promotions (`--promote` not passed).
- Everything lived only in that one process's in-memory fake repositories;
  nothing durable was written anywhere.

## Staging result: blocked

```
npm run crawler:discover:places -- --target staging --query "dermatology clinic" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

This was attempted (with `SUPABASE_URL` pointed at the linked staging
project only — no service-role key, no Google key, nothing sensitive
involved) specifically to capture the CLI's own clear refusal for this
record:

```
[discover-google-places] REFUSED: GOOGLE_PLACES_API_KEY is not set. Set it as an environment variable (never commit it) or use --dry-run.
```

Exit code `1`. This refusal happens **before** any Supabase client is
constructed or any network call is made — `selectRepositories` succeeds
structurally (the staging ref matches), but the CLI checks for
`GOOGLE_PLACES_API_KEY` and exits before ever calling
`discoveryRepo.createDiscoveryJob`. Confirmed independently: staging's
`prospect_candidates`, `clinics`, and `discovery_jobs` tables were queried
immediately after and remain at `0` rows — this attempt created nothing.

### Why this blocks the rest of the rehearsal's scope

Steps 3–9 of this rehearsal's scope (staging candidate persistence, dedupe
against real staging data, promotion, the post-promotion controlled
pipeline, score generation, screenshot capture, and the operational
report) all require **real, persisted staging candidate/clinic IDs**
returned from an actual successful Google Places discovery run. That
could not happen here, for a structural reason worth recording precisely:

- `--dry-run` needs no API key, but each CLI invocation constructs fresh,
  process-local in-memory fake repositories — an ID printed by one
  `--dry-run` invocation does not exist in a second, separate invocation's
  memory. Dry-run mode cannot be chained across commands to reach
  `process-crawl-queue` / `generate-operational-report`, which both
  require `--target local|staging` (real, persisted data) to operate on
  an ID from a prior step.
- `--target local` or `--target staging` (non-dry-run) always require
  `GOOGLE_PLACES_API_KEY` for the real provider — this is independent of
  which Supabase target is used, so switching to `local` would not have
  helped either.

In short: there is no code path today that reaches persisted
`prospect_candidates` from Google Places without the real API key. This is
by design (no fixture bypass into a real database), not a gap to patch as
part of a rehearsal.

Per instruction, the user was **not** asked to paste the key into chat.
This is a stop-and-document blocker, to be revisited whenever
`GOOGLE_PLACES_API_KEY` is provisioned through the environment.

## Scope items not exercised (blocked, not skipped)

| Scope item | Status |
| --- | --- |
| 1. Google Places dry-run discovery | **Done** — see above |
| 2. Google Places staging discovery | **Blocked** — `GOOGLE_PLACES_API_KEY` absent |
| 3. Candidate persistence in staging | Blocked (depends on 2) |
| 4. Dedupe behavior (against staging data) | Blocked (depends on 2) — dedupe logic itself remains covered by the 22 automated tests added in the prior task (`lib/discovery/google-places.test.ts`), which is what actually verifies this behavior today |
| 5. Promotion of 1–3 candidates | Blocked (depends on 2) — the dry-run rehearsal above did not pass `--promote`, to avoid implying a promotion happened against anything but in-memory fixtures |
| 6. Controlled pipeline after promotion | Blocked (depends on 5) |
| 7. Score generation | Blocked (depends on 6) |
| 8. Screenshot metadata/capture | Blocked (depends on 6) |
| 9. Operational report generation | Blocked (depends on 5–8) |
| 10. Cleanup / retention | **N/A — nothing was created in staging**, confirmed by direct query (see below) |

## Candidates created

- Dry-run: 2 (in-memory only, discarded when the process exited).
- Staging: **0** — confirmed by querying `prospect_candidates`,
  `clinics`, and `discovery_jobs` immediately after the blocked attempt.

## Dedupe result

Not exercised against real staging data this round (blocked). The
mechanism itself — in-batch duplicate detection and
`findCandidateByDedupeKey` against existing rows — is unchanged from the
prior task and remains covered by dedicated tests in
`lib/discovery/google-places.test.ts` (`describe("dedupe")`), which
continue to pass (see "Verification").

## Promotions

None. `--promote` was not passed in the dry-run command above, and the
staging command never reached the point where promotion could occur.

## Pipeline / score / screenshot / report result

Not run — each depends on a real, persisted clinic ID from a successful
staging discovery, which did not happen. See "Why this blocks the rest of
the rehearsal's scope" above.

## Cleanup / retention result

Nothing to clean up. Staging's `prospect_candidates`, `clinics`, and
`discovery_jobs` tables were `0` rows before this rehearsal and remain `0`
rows after it — verified by direct query, not inferred.

## Verification

- `npm test` — 212/212 passing (no change from the prior task; no test was
  added or removed, since no code changed).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean (this document is the only new file).
- `git status --short` — only this document is untracked; no other file
  changed.

No code changes were needed for this rehearsal — only commands were run
and their results documented, per instruction.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked,
  targeted, or touched.
- No scraping — the only command that could have made a network call
  (`--target staging`, no dry-run) was refused before any request was
  attempted.
- No broad crawl — no crawl of any kind ran in this rehearsal.
- No outreach was sent — no outreach draft was even created, since no
  clinic was ever persisted.
- No secrets were stored in any file, log, or this document — the
  environment check confirmed only whether `GOOGLE_PLACES_API_KEY` was
  set, never its value, and no other credential was written anywhere.
