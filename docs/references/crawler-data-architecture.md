# Crawler data architecture

## Scope

Internal operational foundation for analyzing **public clinic websites** linked to leads.

Out of scope this cycle: public UI, admin UI, screenshots, LLM analysis, image downloads, production worker hosting.

## Modules

| Path | Role |
| --- | --- |
| `lib/leads/status.ts` | Status enum + transition rules |
| `lib/leads/status-operations.ts` | Atomic-ish status update + history |
| `lib/crawler/*` | URL policy, robots, fetch, parse, discover, run, persistence |
| `lib/operations/*` | Stable contracts for a future internal UI |
| `lib/supabase/service-client.ts` | Shared service-role client |

## Future UI contracts (server-only)

- `opCreateCrawlJob`
- `opGetCrawlJob`
- `opListCrawlJobsForLead`
- `opExecuteCrawlJob`
- `opCancelCrawlJob`
- `opListCrawlPages`
- `opDeleteCrawlJob` / `opDeleteCrawlDataForLead`
- `opUpdateLeadStatus`
- `opListLeadStatusHistory`
- `opListAllowedLeadTransitions`

Do **not** wire these to public unauthenticated Route Handlers.

## Execution model

`runCrawlJob` is a reusable in-process runner.

- Suitable for small jobs (default ≤10 pages) in a controlled server context
- **Not** a durable background worker
- Future: Supabase Edge Function, Vercel background/workflow, or dedicated worker
- Do not assume a long-lived Next.js request for production crawls

## Retention

- Crawl pages/findings cascade-delete with `crawl_jobs`
- Jobs reference leads with `ON DELETE RESTRICT` (deleting a lead requires clearing crawl jobs first, or use `opDeleteCrawlDataForLead`)
- No automatic retention purge in this cycle
- Leads are never auto-deleted by crawler code
