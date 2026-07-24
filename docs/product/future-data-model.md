# Modelo de dados futuro — Atria

> Tabelas e entidades **ainda não** refletidas nas migrations atuais.
> Modelo implementado vive em `PRODUCT.md` § Dados.
> Fonte histórica: `PRODUCT-v1.2-archive.md`.


<!-- linhas 838-1210 do archive v1.2 -->
# 13. Modelo de dados

## 13.0 Convenções

- usar UUID;
- usar timestamps;
- aplicar RLS;
- usar enums ou check constraints;
- registrar `created_at` e `updated_at`;
- usar `deleted_at` quando remoção lógica for necessária;
- armazenar hashes de tokens, não tokens públicos em texto puro;
- versionar estruturas JSON;
- validar JSON por schema antes de persistir e renderizar;
- não armazenar dados de pacientes.


## 13.1 clinics

```text
id uuid pk
public_name text
legal_name text nullable
website_url text nullable
specialty text
city text
state text
phone text nullable
whatsapp text nullable
email text nullable
address text nullable
instagram_url text nullable
google_business_url text nullable
status enum
created_at timestamptz
updated_at timestamptz
```

Status:

- prospect;
- qualified;
- previewing;
- client;
- inactive;
- archived.

## 13.2 scans

```text
id uuid pk
clinic_id uuid fk
status enum
source_url text
desktop_screenshot_url text nullable
mobile_screenshot_url text nullable
scanned_pages jsonb
schema_version integer
error_message text nullable
started_at timestamptz
completed_at timestamptz nullable
created_at timestamptz
```

Status:

- queued;
- running;
- completed;
- failed;
- requires_review.

## 13.3 extracted_content

```text
id uuid pk
scan_id uuid fk
clinic_name text nullable
page_title text nullable
meta_description text nullable
services jsonb
team jsonb
contacts jsonb
addresses jsonb
social_links jsonb
detected_pages jsonb
images jsonb
raw_summary text nullable
schema_version integer
created_at timestamptz
```

## 13.4 scores

```text
id uuid pk
scan_id uuid fk
credibility integer
clarity integer
mobile integer
actionability integer
freshness integer
total integer
auto_notes jsonb
manual_notes jsonb
manual_reviewed boolean
reviewed_by uuid nullable
reviewed_at timestamptz nullable
created_at timestamptz
```

## 13.5 templates

```text
id uuid pk
name text
slug text unique
specialty text
audience_type enum
version integer
schema jsonb
active boolean
created_at timestamptz
updated_at timestamptz
```

Audience type:

- doctor;
- clinic.

## 13.6 previews

```text
id uuid pk
clinic_id uuid fk
scan_id uuid nullable fk
template_id uuid nullable fk
token_hash text unique
slug text
status enum
content_json jsonb
theme_json jsonb
schema_version integer
preview_url text nullable
expires_at timestamptz nullable
sent_at timestamptz nullable
view_count integer default 0
last_viewed_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Status:

- draft;
- internal_review;
- ready;
- sent;
- viewed;
- converted;
- archived.

## 13.6.1 preview_assets

```text
id uuid pk
preview_id uuid fk
asset_type enum
storage_path text
mime_type text
width integer nullable
height integer nullable
size_bytes bigint nullable
created_at timestamptz
```

Asset type:

- current_desktop;
- current_mobile;
- proposal_desktop;
- proposal_mobile;
- supporting_image;
- document.

## 13.6.2 status_history

```text
id uuid pk
entity_type enum
entity_id uuid
from_status text nullable
to_status text
changed_by uuid nullable
change_source text
notes text nullable
created_at timestamptz
```

## 13.7 leads

```text
id uuid pk
clinic_id uuid nullable fk
preview_id uuid nullable fk
contact_name text nullable
contact_role text nullable
contact_email text nullable
contact_phone text nullable
source text
channel text
stage enum
first_contact_at timestamptz nullable
last_contact_at timestamptz nullable
next_action_at timestamptz nullable
do_not_contact boolean default false
contact_consent boolean default false
contact_consent_at timestamptz nullable
consent_text_version text nullable
privacy_notice_version text nullable
notes text nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

Stage:

- new;
- qualified;
- contacted;
- replied;
- meeting;
- proposal;
- won;
- lost;
- do_not_contact.

## 13.8 projects

```text
id uuid pk
clinic_id uuid fk
lead_id uuid nullable fk
preview_id uuid nullable fk
plan enum
status enum
deposit_status enum
final_payment_status enum
domain text nullable
deployment_url text nullable
maintenance_active boolean default false
onboarding_completed_at timestamptz nullable
direction_approved_at timestamptz nullable
final_approved_at timestamptz nullable
published_at timestamptz nullable
warranty_ends_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Plan:

- essential;
- standard;
- premium;
- custom.

Payment status:

- not_required;
- pending;
- paid;
- overdue;
- refunded;
- cancelled.

Status:

- pending_payment;
- onboarding;
- content_review;
- homepage_review;
- production;
- final_review;
- ready_to_publish;
- published;
- warranty;
- maintenance;
- cancelled.

## 13.9 onboarding_submissions

```text
id uuid pk
project_id uuid fk
token_hash text unique
clinic_data jsonb
team_data jsonb
services_data jsonb
contact_data jsonb
social_data jsonb
asset_urls jsonb
approval_contact jsonb
schema_version integer
submitted_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

## 13.10 approvals

```text
id uuid pk
project_id uuid fk
token_hash text unique
type enum
status enum
artifact_version integer
preview_version_id uuid nullable
content_snapshot_hash text nullable
requested_changes jsonb nullable
approved_by_name text nullable
approved_by_email text nullable
approved_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Type:

- homepage;
- final;
- publication.

Status:

- pending;
- changes_requested;
- approved;
- expired.

## 13.11 deployments

```text
id uuid pk
project_id uuid fk
provider text
provider_project_id text nullable
preview_url text nullable
production_url text nullable
domain text nullable
status enum
dns_snapshot jsonb nullable
rollback_snapshot jsonb nullable
deployed_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Status:

- draft;
- preparing;
- preview_ready;
- awaiting_approval;
- deploying;
- active;
- failed;
- rolled_back;
- archived.

---
