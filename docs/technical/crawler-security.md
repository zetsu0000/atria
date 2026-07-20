# Crawler security

## SSRF / URL policy

Implemented in `lib/crawler/url-policy.ts` + redirect loop in `lib/crawler/fetch-page.ts`.

Blocks:

- localhost / `.local` / `.internal` hostnames
- loopback, private IPv4, link-local, CGNAT (`100.64/10`)
- unique-local / link-local / multicast IPv6
- IPv4-mapped IPv6 to blocked ranges
- cloud metadata IPs/hosts (`169.254.169.254`, etc.)
- embedded credentials
- non-http(s) schemes
- non-80/443 ports
- DNS resolution to blocked addresses
- redirects outside same-origin or to blocked destinations (revalidated each hop)

## Crawl limits

- Default max pages: **8** (`DEFAULT_MAX_PAGES`)
- Hard max: 20
- Same-origin only
- No login / appointment portal path traversal (`shouldSkipPath`)
- No form submission / clicking / CAPTCHA bypass
- Identified UA: `AtriaPreviewBot/1.0`
- robots.txt respected (`lib/crawler/robots.ts`)

## Data rules

- No patient data fields
- No raw HTML persistence in DB pages table (normalized extracts only)
- No secrets / full request headers in findings
- All commercial use requires human review (`requires_human_review`, candidate `reviewStatus`)

## Outreach

`lib/outreach/draft.ts` builds drafts only. No Resend/WhatsApp send in this foundation.
`do_not_contact` blocks draft creation.
`sent` status requires `humanReviewed` (DB check + TS assert).
