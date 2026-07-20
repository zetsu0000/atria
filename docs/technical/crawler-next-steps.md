# Crawler next steps

Ordered recommendations after this foundation:

1. **Persistence adapters** for discovery/clinics/scores/outreach (service-role), mirroring `lib/crawler/persistence.ts`.
2. **Authorized local Playwright/Puppeteer** screenshot capture writing to private storage + `scan_assets` rows.
3. **Wire extraction** into `runCrawlJob` to persist `extracted_content` after each job.
4. **Calibrate score** (`placeholder-v0` → reviewed rules) with human-labeled samples.
5. **Google Places discovery** behind explicit credentials + rate limits (still candidate table first).
6. **Operator UI** on `/operacao` for candidate review / promote / approve outreach (no mass send).
7. **Durable worker** for crawls (Edge Function / queue) before raising page limits.
8. **Preview generation** table + private links after qualified interest only.
9. Harden DNS rebinding further (connect-by-IP + SNI) if production crawls are enabled.

Still forbidden until explicitly approved:

- production mass crawl
- automatic email/WhatsApp sending
- AI invention of CRM/RQE/services
- landing / Clínica Aurora UI changes
