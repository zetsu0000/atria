# Crawler security policy

## Product boundary

- Crawl only public clinic websites supplied by leads
- No patient data collection by design
- No login, form POST, cookies, or authenticated sessions
- No JS execution
- No social platforms by default
- Respect robots.txt (no bypass)

## SSRF / URL policy

Allowed schemes: `http`, `https` only.

Blocked:

- credentials in URL
- protocol-relative URLs
- localhost / `.local` / internal suffixes
- loopback, RFC1918, link-local, CGNAT, multicast, unspecified
- cloud metadata (`169.254.169.254`, etc.)
- nonstandard ports (only 80/443)
- DNS results resolving to blocked IPs
- cross-origin redirects and links

Every fetch target is re-validated (parse → DNS → IP checks). Redirects use `redirect: "manual"` and re-enter the same validation.

DNS rebinding residual risk: TLS/SNI pin-to-IP is not fully implemented; documented as a follow-up for the durable worker.

## Fetch policy

| Control | Value |
| --- | --- |
| Method | GET only |
| User-Agent | `AtriaPreviewBot/1.0` |
| Timeout | 10s default |
| Max response | 2 MB |
| Max redirects | 5 |
| Concurrency | 2 |
| Delay | robots crawl-delay or 250ms |
| Max pages | default 10 / hard 20 |

Skipped: images, media, PDFs, archives, fonts, mailto/tel/whatsapp, admin/logout/search paths.

## Robots

- Parse `robots.txt` for AtriaPreviewBot / `*`
- Unavailable due to network → conservative home-only policy
- HTTP 404 robots → allow paths with small delay (documented)
- Explicit deny on seed → job fails with `robots_denied`

## Storage hygiene

Never stored:

- Turnstile tokens
- secrets
- cookies
- raw response headers
- raw HTML (default)
- scripts/styles
- stack traces in user-facing fields

## Access control

All crawler tables: RLS enabled, zero anon/authenticated policies, service_role only.

Future: authenticated internal operator role (not in this cycle).
