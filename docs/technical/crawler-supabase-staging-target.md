# Crawler / Supabase staging target

> **Status: migrations applied, tables/constraint/RLS verified, fixture-only
> smoke test passed (34/34 checks), all rows cleaned up.** This document
> identifies the staging target, how the direct-connection blocker was
> resolved, and the full verification results. **No passwords, tokens, API
> keys, database URLs, or login links appear in this document.**

## Staging project

| Field | Value |
| --- | --- |
| Name | `atria-staging` |
| Project ref | `lfkyiztuwptmddsraucg` |
| Organization ID | `swupyubacgwxrqehxvcf` (same organization as the existing `Atria` project) |
| Region | `sa-east-1` (South America — São Paulo) |
| Status | `ACTIVE_HEALTHY` |
| Created | 2026-07-20 |
| Migrations applied | 2026-07-20 |
| Documented | 2026-07-20 |

## How it was identified / created

`supabase projects list` was checked first for a project already named one
of `atria-staging`, `Atria Staging`, `atria-dev`, or `Atria Dev`. None of
the four existing projects (`focusroute`, `omarcelodaia-cursos`, `rodada`,
`Atria`) matched. A new project named exactly `atria-staging` was created in
the same organization as `Atria` (`swupyubacgwxrqehxvcf`), region
`sa-east-1`. The database password was generated locally with `openssl rand
-base64 32` immediately before the create call, passed only as an in-memory
shell variable, never echoed, never written to a file, and discarded
(`unset`) right after.

## Confirmation: production was not touched

- The existing `Atria` project (ref `cskodsnvghavkcjwmafr`, org
  `swupyubacgwxrqehxvcf`) was **not** linked, modified, or targeted by any
  command across this entire multi-round task.
- `supabase link` was run **only** with `--project-ref lfkyiztuwptmddsraucg`
  (the `atria-staging` project). All `db push`, verification, and smoke-test
  commands operated against that same linked project only.
- Both `supabase/.temp/` and `supabase/.branches/` are gitignored, so none
  of the local link state can be committed.

## `db push` — initially blocked, then resolved via pooler connection

The Supabase CLI's `db push` resolves the **direct** Postgres host
(`db.<ref>.supabase.co`) to an **IPv6-only** address. In this environment, a
bare TCP handshake to that address succeeded, but the full Postgres
protocol/TLS session never completed — `db push` hung indefinitely at
`Initialising login role...` on four separate attempts, while every
HTTPS-based CLI command (`projects list`, `link`, `migration list`) worked
normally. This pointed to an environment-level limitation on raw Postgres
wire-protocol traffic specific to this sandbox, not a problem with the
staging project or the migrations.

**Resolution:** the CLI also supports `--db-url` to target the Supabase
**connection pooler** instead of the direct host — the pooler is
dual-stack/IPv4-capable and was not affected by the same limitation. Since
the database password had already been intentionally discarded and could
not safely be reconstructed by this session, the user ran the push
**themselves, in their own local terminal** (outside any tool this session
could observe), using a script that:

1. Prompted for the staging DB password with a non-echoing `read -s` (only
   possible in a real interactive terminal).
2. URL-encoded it and built a pooler connection string
   (`postgresql://postgres.lfkyiztuwptmddsraucg:***@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`).
3. Ran `supabase db push --db-url "$DB_URL" --dry-run`, which the user
   reviewed before confirming.
4. Ran `supabase db push --db-url "$DB_URL" --yes`.
5. Ran `supabase migration list` and confirmed all 4 migrations now show a
   `remote` timestamp.
6. Redacted the connection string/password from its own output before
   printing anything, and discarded all sensitive variables at the end.

This session never received, stored, or displayed the database password at
any point in this process.

## Confirmation: migrations applied

Independently re-verified by this session immediately after (read-only,
no password needed — the CLI's normal linked-project connection path,
same one used throughout for `migration list`):

| Local migration | Applied on `atria-staging`? |
| --- | --- |
| `20260718120000_create_leads` | **Yes** |
| `20260719180000_crawler_data_foundation` | **Yes** |
| `20260720120000_discovery_clinic_score_foundation` | **Yes** |
| `20260720150000_crawl_jobs_lead_or_clinic` | **Yes** |

`supabase db reset` was never run against any remote project. `supabase
migration list` shows `local` and `remote` timestamps matching exactly for
all four migrations.

## Verification results (Phase 4 + 5)

Full results, methodology, and the note about an accidental legacy-key
exposure are in `docs/technical/crawler-supabase-staging-validation.md`.
Summary: **34/34 checks passed** — all 13 tables exist, the
`crawl_jobs_requires_lead_or_clinic` constraint behaves correctly (lead-only
✅, clinic-only ✅, neither ❌ with `23514`), RLS denies `anon` (`42501`) and
allows `service_role`, and the full fixture-only smoke test (discovery job
→ candidate → promote → contact → clinic-centric crawl job → page →
extraction → asset → score → outreach draft, never sent) succeeded with
verified cleanup of every row created, including cascade-deleted rows.

## Scope confirmations

- No UI was modified.
- No real clinic website was crawled; no screenshot bytes were uploaded.
- No outreach was sent — the smoke-test draft was re-fetched from the
  database and confirmed to still be `status: "draft"`.
- Production (`Atria`, ref `cskodsnvghavkcjwmafr`) was not touched, linked,
  or targeted by any command across this entire task.
- No secrets (passwords, tokens, database URLs, login links) were printed
  to any output this session recorded, or written to any committed file.
  One exception is noted transparently in
  `docs/technical/crawler-supabase-staging-validation.md`: a legacy JWT
  `service_role` key was briefly displayed by an unmasked CLI call; it
  grants access only to this empty staging project, and rotating it via the
  Dashboard is a recommended (non-urgent) follow-up — see that document for
  detail.
- No commit was made in this round.
