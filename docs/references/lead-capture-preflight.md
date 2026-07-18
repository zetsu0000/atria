# Lead capture — technical preflight

Inspected on branch `feature/lead-capture-foundation` from tag `atria-preview-approved-v1` (`da35f47`).

## Stack

| Item | Value |
| --- | --- |
| Next.js | `16.2.10` (App Router) |
| React | `19.2.4` |
| TypeScript | `^5` (strict) |
| Styling | Tailwind 4 present; landing uses custom CSS in `app/globals.css` |
| Validation library | none before this work |
| Test runner | none before this work |
| Supabase / Resend / Turnstile | not present |
| Server Actions / Route Handlers | none |
| `.env.example` | absent |
| `robots` / `sitemap` | absent |
| Metadata | basic title/description in `app/layout.tsx` |

## Request form (approved UI)

Source: `components/landing/request-form.tsx`

Fields (order preserved):

1. `name` (required)
2. `clinic` (required)
3. `role` (required select)
4. `location` (required)
5. `siteUrl` (required URL)
6. `whatsapp` (required phone)
7. `email` (required email)
8. `concern` (optional textarea)
9. `consent` (required checkbox, unchecked by default)

Client validation exists (trim, email regex, URL protocol, WhatsApp digit length, consent).

Submission behavior: **simulated**. `preventDefault` + local validate only. Success UI states “Nenhum dado foi enviado.”

Copy on landing (`app/page.tsx`) and form heading still claim local prototype / no transmission.

## Risks before foundation

- Privacy: visitors may believe data is not collected while copy is being updated for real capture.
- Security: no server validation, no anti-spam, no persistence boundary.
- Accessibility: field errors and summary already partially implemented; no submitting/live status for network flow.
- SEO: no canonical/base URL, robots, or sitemap.
- Ops: no provider adapters, no env contract.

## Architecture decision (this cycle)

- **Server Action** for submission (form-native, built-in origin checks in Next.js).
- Shared Zod schema as authoritative contract.
- Provider adapters for Supabase, Resend, Turnstile.
- Honest structured results; never fake success without durable persistence.
