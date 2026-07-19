# Crawler data foundation — final review

## Delivered

- Expanded lead status model + transition validation + history writes
- Tables: `lead_status_history`, `crawl_jobs`, `crawl_pages`, `crawl_findings`
- SSRF-aware URL policy with DNS IP validation and redirect revalidation
- robots.txt respect with conservative fallback
- Bounded HTML fetch/parse/discover/run pipeline
- Server-only operations facade for a future internal UI
- Focused automated tests (mocked network)
- Docs: preflight, architecture, security, schema

## Explicit non-goals (honored)

- No landing / Clínica Aurora / CSS / navigation / admin UI changes
- No public crawl endpoints
- No production deploy / merge

## Remaining limitations

1. In-process runner is not durable across serverless timeouts
2. DNS rebinding hard-pin (connect-by-IP + SNI) not fully implemented
3. Status history + lead update are sequential, not a single DB transaction/RPC
4. Sitemap URLs are discovery hints only (not full XML sitemap fetch/parse)
5. No authenticated operator role yet (service_role only)
6. No automatic retention purge

## Risks

- Operators must never expose service-role keys to the browser
- Future UI must call server modules behind auth, not public Route Handlers
- Production crawls need a background worker before raising page limits
