# Crawler / Supabase staging validation

> **Status: STOPPED — no staging project identified.** Per explicit
> instruction ("If no staging Supabase project is clearly configured, STOP
> and report what is missing"), no migration was applied and no smoke test
> was run against any remote project. **No production project was touched.
> No real clinic website was crawled. No outreach was sent. No
> secret/credential values are recorded in this document.**

## Branch

`feature/crawler-supabase-staging-validation`, created from tag
`atria-crawler-supabase-local-validation-v1` → `f28a824` ("Validate crawler
persistence against local Supabase"), pushed as an empty baseline before any
work in this round.

## Phase 1 — Identify staging safely (read-only checks)

Commands run, in order:

```
supabase --version
supabase projects list
supabase status || true
ls -la supabase
find supabase -maxdepth 3 -type f | sort
find supabase -iname "*project-ref*" -o -iname "config.toml"
env | grep -i "SUPABASE_ACCESS_TOKEN\|SUPABASE_PROJECT"
ls -la | grep -i "\.env"
grep -rl "SUPABASE_URL" .env* 2>/dev/null
```

### Findings

| Check | Result |
| --- | --- |
| `supabase --version` | `2.109.1` — CLI available |
| `supabase projects list` | **Fails**: `LegacyPlatformAuthRequiredError — Access token not provided. Supply an access token by running 'supabase login' or setting the SUPABASE_ACCESS_TOKEN environment variable.` No account is authenticated in this environment, so the CLI cannot even enumerate what remote projects (staging or otherwise) exist under any account. |
| `supabase status` | Returns only the **local** Docker-based stack (`API_URL: http://127.0.0.1:54321`, `DB_URL: postgresql://...@127.0.0.1:54322/postgres`, etc.) — this is the same local instance validated in `docs/technical/crawler-supabase-local-validation.md`, not a remote project. |
| `supabase/config.toml` | **Absent.** This repo's `supabase/` directory has never been initialized as a linked Supabase project (`supabase init` was never run in a way that persisted a config file). |
| project-ref file | **Absent.** No `supabase link` has ever been run — there is no record anywhere in the repo of which remote project (if any) this codebase is supposed to target. |
| `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_*` env vars | Not set in this environment. |
| `.env` / `.env.local` files | Only `.env.example` exists (a committed template with placeholder values like `https://YOUR_PROJECT.supabase.co` — not real credentials). No `.env.local` or other file with actual `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` values for any remote project (staging or production) exists in this working tree. |

### Conclusion

There is **no staging Supabase project identifiable** from this repository
or this machine:

- no linked project ref,
- no `supabase login` session / access token,
- no `.env.local` (or equivalent) carrying a staging project's URL or keys.

Per the task's explicit instruction, this is a **STOP** condition, not an
"ambiguous/could-be-production" condition — there is nothing to
disambiguate because no remote project reference exists at all. Proceeding
past this point would mean either (a) guessing at a project, which risks
targeting the wrong environment, or (b) running `supabase login` /
`supabase link` unilaterally, which is an account-level action outside the
scope of "read-only checks" this phase was limited to.

**Phases 2–3 (migration application, table/constraint/RLS verification,
adapter smoke test against staging) were not attempted.** Nothing was
applied to any remote Supabase project — staging or production.

## What is missing to unblock this

To run this validation against a real staging project, the following needs
to exist first (none of it should be provided to or created by this
session without explicit, separate authorization, since it involves
account-level auth and picking a specific remote project):

1. An authenticated Supabase CLI session (`supabase login`, or
   `SUPABASE_ACCESS_TOKEN` set in the environment).
2. A **staging** project identified by its project ref, explicitly
   confirmed (by name/ref, not guessed) to be non-production — e.g. via
   `supabase projects list` once authenticated, cross-checked against
   whatever naming convention distinguishes staging from production for
   this Supabase organization.
3. Either `supabase link --project-ref <staging-ref>` (persists
   `supabase/.temp/project-ref`, safe/reversible, does not touch data) or
   equivalent explicit `--project-ref` flags passed to `supabase db push`.
4. Local credentials for that staging project (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) available only as environment variables at
   run time — never written into a committed file, per the same convention
   already used for local validation
   (`docs/technical/crawler-supabase-local-validation.md`).

Once those exist, Phases 2–4 of the original task (apply migrations
non-destructively, verify the 13 tables + lead-or-clinic constraint + RLS
via disposable rows in a rollback/cleanup pattern, run the fixture-only
adapter smoke test, update this document with real results) can be executed
following the same rollback/cleanup methodology already proven against
local Supabase.

## Confirmations

- **No production project was touched** — no project of any kind was
  touched; nothing was identified to touch.
- **No real clinic website was crawled** — no crawl logic ran in this
  round.
- **No outreach was sent** — no outreach logic ran in this round.
- **No secret/credential values appear in this document** — confirmed by
  inspection; the checks above intentionally only recorded presence/absence
  of files and env var *names*, never values.
- **No code was changed** — this round only added this documentation file.
