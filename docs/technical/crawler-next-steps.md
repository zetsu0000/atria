# Crawler next steps

> **Update (2026-07-20, `feature/crawler-persistence-adapters`):** items 1 and 3
> below are now implemented — see `docs/technical/crawler-persistence-adapters.md`
> and `docs/technical/crawler-run-job-flow.md`. Nothing in that work applied a
> remote migration, crawled a real site, or sent outreach. Remaining gaps from
> that pass are listed under "Gaps opened by the persistence-adapter layer"
> below.
>
> **Update (2026-07-20, same branch, follow-up):** the `crawl_jobs.lead_id`
> gap listed below is now resolved via migration
> `20260720150000_crawl_jobs_lead_or_clinic.sql` (additive, **not applied to
> any remote/staging project**). `crawl_jobs` now supports both lead-centric
> and clinic-centric execution — see "Crawl persistence" in
> `docs/technical/crawler-persistence-adapters.md` and the corresponding
> section in `docs/technical/crawler-run-job-flow.md`.

Ordered recommendations after this foundation:

1. ~~**Persistence adapters** for discovery/clinics/scores/outreach (service-role), mirroring `lib/crawler/persistence.ts`.~~ Done — `lib/operations/repositories/*` (interfaces) + `lib/operations/supabase/*` (adapters).
2. **Authorized local Playwright/Puppeteer** screenshot capture writing to private storage + `scan_assets` rows. Still not implemented — `CrawlRepository.saveAsset` accepts metadata but nothing captures real screenshots yet.
3. ~~**Wire extraction** into `runCrawlJob` to persist `extracted_content` after each job.~~ Done for the new clinic-centric orchestrator (`lib/operations/run-crawl-job.ts`). The original lead-centric `lib/crawler/run-crawl.ts` still does not persist extraction/score — see gap below.
4. **Calibrate score** (`placeholder-v0` → reviewed rules) with human-labeled samples.
5. **Google Places discovery** behind explicit credentials + rate limits (still candidate table first).
6. **Operator UI** on `/operacao` for candidate review / promote / approve outreach (no mass send).
7. **Durable worker** for crawls (Edge Function / queue) before raising page limits.
8. **Preview generation** table + private links after qualified interest only.
9. Harden DNS rebinding further (connect-by-IP + SNI) if production crawls are enabled.

## Gaps opened by the persistence-adapter layer

- ~~**`crawl_jobs.lead_id` is still `not null`.**~~ **Resolved** by migration
  `20260720150000_crawl_jobs_lead_or_clinic.sql` (additive, not applied
  remotely): `lead_id` is now nullable, and a check constraint
  (`crawl_jobs_requires_lead_or_clinic`) requires at least one of `lead_id`
  / `clinic_id`. `lib/operations/run-crawl-job.ts` no longer requires a
  `leadId` for a pure clinic-centric run — it validates "at least one of
  leadId/clinicId" in application code before creating a job, and never
  fabricates a `leadId`.
- **`clinics.do_not_contact` has no dedicated column.** It is currently
  tracked inside `clinics.source_attribution` as
  `{ doNotContact: boolean, doNotContactReason: string | null }`
  (`ClinicRepository.setDoNotContact`). This avoids a schema change now, but
  is a weaker guarantee than a real column with an index and a `not null
  default false` constraint — a future additive migration should promote it.
- **`extracted_content` has no `schema_version` or `requires_human_review`
  column.** The adapter stores the semantic version inside
  `payload.schemaVersion` and always writes `review_status = 'pending_review'`
  (never `approved`, enforced in code, not just convention). A future
  migration could add these as first-class columns if extraction volume
  grows enough to need direct SQL filtering on them.
- **Two crawl runners now coexist.** `lib/crawler/run-crawl.ts` (existing,
  lead-centric, drives `lib/leads` status transitions, persists straight to
  Supabase) and `lib/operations/run-crawl-job.ts` (new, clinic-centric,
  persists exclusively through injected repositories, does not touch lead
  status). See `docs/technical/crawler-run-job-flow.md` for the full
  comparison. Converging them into one runner is a reasonable follow-up now
  that the lead-id gap above no longer blocks it.
- **Real screenshot capture is still not implemented.** `saveAsset` /
  `scan_assets` accept metadata only; nothing in this repo captures actual
  desktop/mobile screenshots yet (item 2 above).
- **Concurrency was simplified to sequential (1 page in flight)** in the new
  orchestrator, versus `DEFAULT_CONCURRENCY = 2` in the legacy runner. This
  was a deliberate simplification for a first pass; revisit if crawl latency
  matters before a durable worker (item 7) exists.

Still forbidden until explicitly approved:

- production mass crawl
- automatic email/WhatsApp sending
- AI invention of CRM/RQE/services
- landing / Clínica Aurora UI changes
