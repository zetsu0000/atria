# Lead capture — setup

Do not commit `.env.local`. Copy `.env.example` and fill real values locally or in the host secrets store.

## 1) Environment variables

```bash
cp .env.example .env.local
```

Required for successful submissions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEAD_HASH_SECRET`
- `NEXT_PUBLIC_SITE_URL` (production domain when known)

Required for production anti-spam:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Optional but recommended after persistence works:

- `RESEND_API_KEY`
- `LEAD_NOTIFICATION_EMAIL`
- `LEAD_FROM_EMAIL`

Optional for the floating WhatsApp contact on the landing:

- `NEXT_PUBLIC_WHATSAPP_NUMBER` (digits only, with country code — e.g. `5511999999999`)

## 2) Supabase

1. Create a Supabase project.
2. Open SQL editor or use Supabase CLI.
3. Apply `supabase/migrations/20260718120000_create_leads.sql`.
4. Confirm RLS is enabled and **no** anon/authenticated policies exist for `public.leads`.
5. Copy project URL and **service role** key into server env only.
6. Never expose the service role key with `NEXT_PUBLIC_`.

Access model: server-only inserts/updates through the service role. Browser clients must not read or write `leads`.

## 3) Resend

1. Create a Resend account.
2. Verify a sending domain (or use the onboarding sender only for tests).
3. Create an API key.
4. Set:
   - `RESEND_API_KEY`
   - `LEAD_FROM_EMAIL` (authorized sender)
   - `LEAD_NOTIFICATION_EMAIL` (internal inbox)
5. Notification runs **after** persistence. Failure is logged and recorded on the row; the visitor still sees success if the lead was stored.

No automated confirmation e-mail is sent to the lead in this foundation.

## 4) Cloudflare Turnstile

1. Create a Turnstile widget in Cloudflare.
2. Choose a mode suitable for forms (managed recommended).
3. Set domains for local and production hosts.
4. Copy site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
5. Copy secret key → `TURNSTILE_SECRET_KEY` (server only).
6. Tokens are verified server-side and never stored.

Behavior:

- **Production without Turnstile config:** `configuration_error` (no silent bypass, no fake success).
- **Development/test without Turnstile config:** explicit server warning + bypass for local iteration; persistence still required for success.

## 5) Development vs production without credentials

| Missing piece | Development | Production |
| --- | --- | --- |
| Supabase / hash secret | `configuration_error` | `configuration_error` |
| Turnstile | warned bypass | `configuration_error` |
| Resend | notification skipped; success still possible after persist | same |

The project builds without production secrets. Missing secrets never produce fake success.

## 6) Verify locally

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Manual checks: `/`, `/previa/clinica-aurora`, `/privacidade`, `/termos`, form states, keyboard, 200% zoom.
