# Crawler data foundation — preflight

Branch: `feature/crawler-data-foundation`  
Base: `6904895` (`atria-lead-capture-live-verified-v1` lineage)

## Current lead table

`public.leads` (migration `20260718120000_create_leads.sql`):

- Contact + clinic fields, consent, source, `dedup_hash`, notification fields
- `status` default `new` with check:
  `new | qualified | contacted | replied | meeting | proposal | won | lost | do_not_contact`
- RLS on; revoke anon/authenticated; grant service_role only
- No status history table

## Current status behavior

- Inserts always set `status = 'new'`
- No server API to change status
- No transition validation
- No history audit trail

## Current migrations (repo)

1. `20260718120000_create_leads.sql` — leads foundation  
Remote may also have `create_leads` / `harden_leads_updated_at_search_path` applied via MCP (names differ from file timestamp).

## Database access model

- Server-only Supabase client via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Client never receives service-role key
- Lead capture uses Server Action (`lib/leads/submit-lead.ts`) + injectable core

## Existing server-side providers

| Area | Module |
| --- | --- |
| Persistence | `lib/leads/persistence.ts` |
| Notification | `lib/leads/notification.ts` |
| Turnstile | `lib/security/turnstile.ts` |
| Rate limit | `lib/security/rate-limit.ts` |
| Env | `lib/security/env.ts` |

## Crawler-related code

None. PRODUCT.md mentions crawler as future; no `lib/crawler` yet.

## SSRF risks (to address)

- User-supplied `website_url` on leads
- Open redirects to private IPs / metadata
- DNS rebinding after hostname allow
- `file:` / credentialed URLs / localhost / RFC1918 / link-local
- Following cross-origin links
- Unbounded response size / redirect chains

## Database changes required

1. Expand `leads.status` allowed values (keep legacy + new operational)
2. `lead_status_history` — audit of status changes
3. `crawl_jobs` — job lifecycle linked to leads
4. `crawl_pages` — normalized page extracts
5. `crawl_findings` — operational findings/errors (used by runner)

All: RLS on, no anon/authenticated policies, service_role only. Cascade delete crawl pages/findings with jobs; jobs set null or restrict on lead (restrict lead delete; allow deleting crawl data independently).

## Recommended approach

1. Shared `lib/supabase/service-client.ts` (no behavior change for leads)
2. `lib/leads/status.ts` + `status-operations.ts` for transitions + history
3. `lib/crawler/*` pure modules (URL policy, robots, fetch, parse, discover, run, persistence)
4. `lib/operations/*` stable contracts for a future internal UI (no routes/UI)
5. Mocked network tests; optional example.com smoke only if needed
6. Document durable worker requirement — MVP runner is a reusable function, not a fake background job
