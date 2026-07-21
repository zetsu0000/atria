# Crawler Google Places operational rehearsal — live (staging)

> **Status: SUCCESS through staging discovery.** Dry-run and staging
> discovery both completed cleanly. Promotion, crawl, and outreach were
> intentionally **not** run — out of scope for this rehearsal. **Production
> was never touched. No broad crawl. No outreach was sent. No secrets
> appear anywhere in this document.**

## Branch / tag baseline

`feature/crawler-places-operational-rehearsal-live`, created from tag
`atria-crawler-places-operational-rehearsal-blocked-v1` (commit `cfd64bb`,
"Document blocked Google Places operational rehearsal").

## Preflight

| Check | Result |
| --- | --- |
| `git status --short` (before starting) | Clean working tree |
| `.env.local` present and git-ignored | Yes (`git check-ignore -v` matched `.gitignore:34:.env* .env.local`); does not appear in `git status --short` at any point |
| `GOOGLE_PLACES_API_KEY` present in `.env.local`? | **Yes** — presence-only check via `grep -q '^GOOGLE_PLACES_API_KEY='`; value never read or printed |
| `SUPABASE_URL` present in `.env.local`? | **Yes** — presence-only check; value never printed |
| `SUPABASE_SERVICE_ROLE_KEY` present in `.env.local`? | **Yes** — presence-only check; value never printed |
| `LEAD_HASH_SECRET` present in `.env.local`? | **Yes** — presence-only check; value never printed |
| `supabase/.temp/project-ref` | `lfkyiztuwptmddsraucg` (staging) — matches the required staging ref exactly, not the production ref `cskodsnvghavkcjwmafr` |
| `SUPABASE_URL` resolves to staging ref? | Confirmed via a shell substring check against `lfkyiztuwptmddsraucg` that never echoed the URL itself |

Two credentials had to be added mid-rehearsal by the user directly into
the git-ignored `.env.local` (never pasted into chat, never written by the
assistant): `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (required by
`hasPersistenceConfig()` in `lib/security/env.ts`), then `LEAD_HASH_SECRET`
(also required by that same guard before a real Supabase client is
constructed). Both gaps surfaced as explicit refusals from the code
(`Refusing: --target staging requires SUPABASE_URL...` and `Discovery
persistence is not configured.`) rather than silent fallbacks.

## Dry-run result

```
npm run crawler:discover:places -- --dry-run --query "dermatology clinic" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

Succeeded exactly as designed:

- `mode=dry-run`, no network call, no Supabase write — the fixture
  provider served two canned in-memory places.
- 2 candidates imported: one `status: "new"` (fixture website present),
  one `status: "needs_review"` (no website).
- 0 duplicates, 0 rejected, 0 promotions (`--promote` not passed).
- Nothing durable was written anywhere.

## Staging result: success

```
npm run crawler:discover:places -- --target staging --query "dermatology clinic" --location "São Paulo, SP" --max-results 3 --max-pages 1
```

**Query:** `dermatology clinic`
**Location:** `São Paulo, SP`
**Limits used:** `--max-results 3 --max-pages 1`

Result:

- `discoveryJobId`: `cf14138a-bc54-4a74-a574-4bd2fcc45aa7`
- `pagesFetched`: 1, `totalFoundByProvider`: 3, `importedCount`: 3
- `duplicateCount`: 0, `rejectedCount`: 0
- `promotions`: none (`--promote` not passed)

Independently re-verified by querying staging's REST API directly
(`discovery_jobs` and `prospect_candidates` filtered by the returned
`discoveryJobId`, using the service-role key only as an unprinted request
header) — the persisted rows match the CLI's own output exactly.

### Candidates created

| ID | Name | Status | Website |
| --- | --- | --- | --- |
| `031aa871-be29-40d0-9dd9-1eeab35998e8` | GRUPO CPD - Centro Paulista de Dermatologia e Estética | `new` | `https://grupocpd.com.br/` (present) |
| `5a2778ba-b814-48fb-8a9a-e97f4a20d9d2` | SkinLaser - Higienopolis | `new` | `http://www.skinlaser.com.br/` (present) |
| `c51ddcdd-e5ee-4ed1-ac5c-650a7ccc4381` | Dermaclinic | `new` | `http://www.dermaclinic.com.br/` (present) |

All three candidates have a website; none is `needs_review` or
`rejected` this round (`needs_review` count: 0, `rejected` count: 0).

### Dedupe result

`duplicateCount: 0` — all 3 places returned by the provider were novel
against staging's existing `prospect_candidates` (which was empty before
this run). Each candidate has a unique `dedupe_key`; no in-batch or
cross-batch collisions occurred.

### Candidates eligible for promotion

All 3 candidates are structurally eligible for promotion (`status: "new"`,
website present, no rejection): `031aa871-be29-40d0-9dd9-1eeab35998e8`,
`5a2778ba-b814-48fb-8a9a-e97f4a20d9d2`, `c51ddcdd-e5ee-4ed1-ac5c-650a7ccc4381`.

**No candidate was promoted in this rehearsal** — `--promote` was
intentionally not passed, per the instruction to stop after staging
verification. `promoted_clinic_id` is `null` for all three, confirmed by
direct query.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked,
  targeted, or touched — the target-guard in
  `lib/operations/pipeline/target-guard.ts` and the confirmed staging ref
  match are the basis for this.
- No scraping beyond the single, scoped Google Places API discovery call
  (`maxResults=3`, `maxPages=1`) — no browser automation, no crawl of
  candidate websites.
- No broad crawl — `process-crawl-queue` / `run-controlled-pipeline` were
  not invoked.
- No outreach was sent or drafted.
- No promotion occurred.
- No report was generated.
- No secrets were stored in any file, log, or this document by the
  assistant — `.env.local` remained git-ignored throughout and was edited
  only by the user; all presence checks reported only whether a variable
  was set, never its value; the one direct staging query used the
  service-role key solely as an in-memory HTTP header, never echoed to
  output.
