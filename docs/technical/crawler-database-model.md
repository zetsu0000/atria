# Crawler database model

## Strategy

Additive schema only. Existing inbound `leads` and crawl tables are preserved.

## Physical tables

### Existing

| Table | Role |
| --- | --- |
| `leads` | Inbound preview requests + commercial pipeline |
| `lead_status_history` | Lead status audit |
| `crawl_jobs` | Site scan jobs (**canonical physical name for “scans”**) |
| `crawl_pages` | Visited pages (**canonical physical name for “scan_pages”**) |
| `crawl_findings` | Operational crawl findings |

### Added in `20260720120000_discovery_clinic_score_foundation.sql`

| Table | Role |
| --- | --- |
| `discovery_jobs` | Manual/CSV/API-shaped discovery jobs (no live API required) |
| `prospect_candidates` | Raw candidates before promotion |
| `clinics` | Canonical clinic/prospect records |
| `clinic_contacts` | Contacts with provenance + review status |
| `scan_assets` | Screenshot/asset **metadata** (private storage paths) |
| `extracted_content` | Versioned extraction candidates JSON |
| `scores` | Digital first-impression scores + evidence |
| `outreach_messages` | Human-reviewed outreach drafts (no auto-send) |

## Naming map

| PROJECT_CRAWLER.md | Physical |
| --- | --- |
| scans | `crawl_jobs` |
| scan_pages | `crawl_pages` |
| scan_assets | `scan_assets` |

## Additive changes to `crawl_jobs`

- `max_pages` default → **8**
- `clinic_id` nullable FK → `clinics`
- `requires_human_review` boolean default `true`
- (`20260720150000_crawl_jobs_lead_or_clinic.sql`, not applied remotely)
  `lead_id` is now nullable (FK preserved), and a check constraint
  `crawl_jobs_requires_lead_or_clinic` requires `lead_id is not null or
  clinic_id is not null` — `crawl_jobs` now supports both lead-centric
  (inbound) and clinic-centric (discovery/outbound) crawls.

## RLS

Every operational table:

- `ENABLE ROW LEVEL SECURITY`
- `REVOKE ALL` from `anon`, `authenticated`
- `GRANT ALL` to `service_role`

No browser policies. Admin auth policies deferred.

## Leads compatibility

- `clinics.lead_id` nullable FK → `leads`
- `outreach_messages.lead_id` nullable FK → `leads`
- Lead status enums from prior migrations remain intact
