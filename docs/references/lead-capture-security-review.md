# Lead capture — security review

## Findings addressed

| Topic | Status |
| --- | --- |
| Secret exposure | Service role, Resend, Turnstile secret, hash secret are server-only. Only Turnstile site key and site URL are public. |
| Validation bypass | Authoritative Zod/allow-list validation on server. Client validation is UX only. |
| Unexpected fields | Rejected by allow-list before accept. |
| Injection | Notification HTML escapes user values. No raw HTML render of lead fields. |
| URL safety | http/https only; credentials in URL rejected; hash stripped. |
| Medical data | Form copy forbids patient data; schema has no clinical fields. |
| Consent | Explicit, unchecked by default, timestamp + text version stored. |
| Dedup | HMAC-SHA256 with `LEAD_HASH_SECRET`; source string never logged. |
| Rate limit | Adapter exists; **process-local only** — not durable multi-instance protection. |
| Turnstile | Verified server-side; tokens not stored; provider errors not exposed. |
| CSRF | Same-site Server Action POST model; no public write API on `leads`. |
| Error leakage | Generic Portuguese messages; no stack/provider payloads to client. |
| Logging | Operational codes only; no API keys, tokens, full payloads, cookies, or raw dedup material. |
| DB access | RLS on; anon/authenticated revoked; service role only. |
| Fake success | Success requires durable insert. Missing config → `configuration_error`. |

## Residual risks / limitations

1. In-memory rate limiting is not shared across instances.
2. No durable IP storage; only short HMAC fragments used for rate keys when IP headers exist.
3. Legal pages contain placeholders and require qualified legal review.
4. Provider integrations were not end-to-end tested with live credentials in this cycle.
5. Dependency surface increased (`zod`, `@supabase/supabase-js`); keep updated.

## Explicit non-goals of this cycle

- Public lead listing
- Admin authentication UI
- Confirmation e-mail to the clinic contact
- Storing Turnstile tokens or full request headers
