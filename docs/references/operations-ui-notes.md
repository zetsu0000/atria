# Operations UI (`/operacao`) — notes

## Routes

- `/operacao` → redirects to `/operacao/leads`
- `/operacao/leads` — lead queue
- `/operacao/leads/[id]` — lead detail + crawl actions
- `/operacao/acesso-bloqueado` — denied / not configured

## Auth (required)

Preferred model:

1. Supabase Auth session (JWT in cookie)
2. Server validation via `supabase.auth.getUser(accessToken)` using **anon** key
3. Email allow-list: `OPERATIONS_OPERATOR_EMAILS`
4. Every Server Action re-checks `requireOperator()`

Blocked by default when any of these is missing:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `OPERATIONS_OPERATOR_EMAILS`

This cycle does **not** ship a full login product. Wire Supabase Auth (magic link / password) separately, then open `/operacao/leads`.

## Local review fixtures

For screenshots only (never production):

```bash
OPERATIONS_REVIEW_FIXTURES=1 npm run dev
```

Fixtures render sample leads. Mutations remain disabled.

## Security non-goals honored

- No service role in the browser
- No shared password / query-string secret gate
- No public listing APIs
- Sensitive fields (dedup hash, Turnstile, raw provider errors) are not rendered
