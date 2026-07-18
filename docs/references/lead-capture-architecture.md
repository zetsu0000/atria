# Lead capture — architecture

## Decision

Submission uses a **Next.js Server Action** (`lib/leads/submit-lead.ts`).

Rationale:

- the approved UI is already a native `<form>`;
- Server Actions provide origin-bound POST handling suitable for same-site forms;
- one transport path avoids maintaining both a Route Handler and an Action;
- structured JSON-like results map cleanly to client status UI.

Core orchestration is in `lib/leads/submit-lead-core.ts` so tests can inject provider doubles without Next request APIs.

## Flow

1. Client performs lightweight validation for fast feedback.
2. Client calls `submitLead(formData)`.
3. Server parses only allow-listed fields (`schema.ts`).
4. Server rejects unexpected keys.
5. Server requires persistence configuration (`SUPABASE_*` + `LEAD_HASH_SECRET`).
6. Process-local rate-limit adapter runs.
7. Turnstile is verified when configured (required in production).
8. HMAC dedup hash is checked against recent rows.
9. Lead is inserted via Supabase service role.
10. Resend notification runs after persistence (failure does not undo persistence).
11. Structured result is returned; success only after durable insert.

## Result statuses

`success` · `validation_error` · `duplicate` · `rate_limited` · `spam_rejected` · `configuration_error` · `service_unavailable` · `server_error`

## Lead contract

| Field | Source | Required | Max | Normalization |
| --- | --- | --- | --- | --- |
| name | form | yes | 120 | trim + collapse whitespace |
| clinic | form | yes | 160 | trim + collapse whitespace |
| role | form | yes | 40 | allow-list |
| location | form | yes | 120 | trim + collapse whitespace |
| siteUrl | form | yes | 2048 | http(s) only, strip hash |
| whatsapp | form | yes | 32 raw / 10–13 digits | digits only |
| email | form | yes | 254 | trim + lowercase |
| concern | form | no | 1000 | empty → null |
| consent | form | yes | — | must be explicit true/`on` |
| turnstileToken | widget | prod when configured | 2048 | never stored |
| source | client constant | no | 64 | default `landing-solicitar` |

Consent text version recorded: `2026-07-18-v1`.

## Providers

| Concern | Module | Notes |
| --- | --- | --- |
| Persistence | `lib/leads/persistence.ts` | Supabase service role |
| Notification | `lib/leads/notification.ts` | Resend HTTP API, HTML-escaped |
| Anti-spam | `lib/security/turnstile.ts` | siteverify server-side |
| Dedup | `lib/leads/duplicate-protection.ts` | HMAC-SHA256, 48h window |
| Rate limit | `lib/security/rate-limit.ts` | process-local adapter only |

## UI freeze boundary

Landing `/` and `/previa/clinica-aurora` remain visually frozen. Allowed deltas are form honesty copy, submission states, consent legal links, restrained Turnstile, and minimal CSS for those states. Legal routes are new and outside the freeze.
