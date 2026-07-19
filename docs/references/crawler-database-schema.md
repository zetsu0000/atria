# Crawler database schema

Migration: `supabase/migrations/20260719180000_crawler_data_foundation.sql`

## `leads.status` (expanded)

Operational: `new`, `contacted`, `qualified`, `crawl_pending`, `crawling`, `crawl_complete`, `preview_in_progress`, `preview_ready`, `approved`, `published`, `lost`, `archived`

Legacy retained: `replied`, `meeting`, `proposal`, `won`, `do_not_contact`

## `lead_status_history`

| Column | Notes |
| --- | --- |
| id | uuid PK |
| lead_id | FK → leads CASCADE |
| from_status / to_status | constrained |
| reason | ≤500 |
| actor_type | system\|operator\|crawler\|automation |
| actor_identifier | ≤160 |
| created_at | timestamptz |

Indexes: `(lead_id, created_at desc)`  
RLS on; revoke anon/authenticated; grant service_role

## `crawl_jobs`

| Column | Notes |
| --- | --- |
| id | uuid PK |
| lead_id | FK → leads RESTRICT |
| requested_url / normalized_origin | ≤2048 |
| status | pending\|running\|completed\|partial\|failed\|cancelled |
| max_pages | 1–20, default 10 |
| pages_* counters | non-negative |
| started_at / completed_at | nullable |
| error_code / error_message | safe codes only |
| created_at / updated_at | trigger-maintained |

Indexes: lead+created, status+created  
RLS + service_role only

## `crawl_pages`

Normalized extracts per job; unique `(crawl_job_id, normalized_url)`  
Cascades with job delete  
JSON: `headings`, `links_internal`  
`main_text` ≤ 50_000  
No raw HTML / cookies / headers / scripts

## `crawl_findings`

Operational findings: category, severity, code, summary, optional page_url, details jsonb  
Cascades with job delete

## Secrets / Turnstile

No crawler table stores Turnstile tokens or API secrets.
