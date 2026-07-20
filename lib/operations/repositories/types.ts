/**
 * Shared repository contracts for the crawler/discovery persistence layer.
 *
 * These types describe domain shapes independent of Supabase. Repositories
 * are implemented against these interfaces so crawler/discovery/score/
 * outreach core logic can run against fake in-memory adapters in tests, with
 * no live Supabase connection and no live network access.
 *
 * Physical table mapping: see docs/technical/crawler-database-model.md.
 */
import type {
  CandidateStatus,
  ClinicRecordShape,
  ClinicStatus,
  DiscoverySourceType,
} from "@/lib/discovery/types";
import type {
  ExtractionCandidate,
  ReviewStatus,
} from "@/lib/crawler/extraction-types";
import type { ScanAssetMetadata } from "@/lib/crawler/screenshot-metadata";
import type { CrawlErrorCode } from "@/lib/crawler/errors";
import type { DigitalScore, ScoreEvidence } from "@/lib/score/calculate";
import type { OutreachDraft } from "@/lib/outreach/draft";

export type RepoErrorReason =
  | "not_found"
  | "conflict"
  | "validation"
  | "configuration"
  | "unavailable"
  | "blocked";

export type RepoResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: RepoErrorReason; message: string };

// ---------------------------------------------------------------------------
// discovery_jobs
// ---------------------------------------------------------------------------

export type DiscoveryJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type DiscoveryJobRecord = {
  id: string;
  sourceType: DiscoverySourceType;
  status: DiscoveryJobStatus;
  query: Record<string, unknown>;
  notes: string | null;
  candidatesCreated: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CreateDiscoveryJobInput = {
  sourceType: DiscoverySourceType;
  query?: Record<string, unknown>;
  notes?: string | null;
};

export type CompleteDiscoveryJobInput = {
  status: "completed" | "failed" | "cancelled";
  candidatesCreated: number;
  errorCode?: string | null;
  errorMessage?: string | null;
};

// ---------------------------------------------------------------------------
// prospect_candidates
// ---------------------------------------------------------------------------

export type ProspectCandidateRecord = {
  id: string;
  discoveryJobId: string | null;
  sourceType: DiscoverySourceType;
  status: CandidateStatus;
  rawName: string;
  normalizedName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  sourceAttribution: Record<string, unknown>;
  dedupeKey: string;
  promotedClinicId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordCandidateInput = {
  discoveryJobId?: string | null;
  sourceType: DiscoverySourceType;
  rawName: string;
  normalizedName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  sourceAttribution: Record<string, unknown>;
  dedupeKey: string;
};

// ---------------------------------------------------------------------------
// clinics
// ---------------------------------------------------------------------------

export type ClinicRecord = {
  id: string;
  displayName: string;
  normalizedName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  status: ClinicStatus;
  leadId: string | null;
  sourceType: DiscoverySourceType | "inbound_lead";
  sourceAttribution: Record<string, unknown>;
  dedupeKey: string;
  notes: string | null;
  /**
   * Derived from `source_attribution.doNotContact`. There is no dedicated
   * `do_not_contact` column on `clinics` yet — see
   * docs/technical/crawler-next-steps.md for the follow-up migration.
   */
  doNotContact: boolean;
  doNotContactReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClinicInput = ClinicRecordShape & { leadId?: string | null };

// ---------------------------------------------------------------------------
// clinic_contacts
// ---------------------------------------------------------------------------

export type ContactType =
  | "email"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "form"
  | "other";

export type ContactExtractionMethod =
  | "manual"
  | "html_anchor"
  | "html_text"
  | "meta"
  | "json_ld"
  | "import"
  | "other";

export type ConfidenceLevel = "low" | "medium" | "high";

export type ContactReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_review";

export type ClinicContactRecord = {
  id: string;
  clinicId: string;
  contactType: ContactType;
  value: string;
  normalizedValue: string;
  sourceUrl: string | null;
  extractionMethod: ContactExtractionMethod;
  confidence: ConfidenceLevel;
  reviewStatus: ContactReviewStatus;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateClinicContactInput = {
  clinicId: string;
  contactType: ContactType;
  value: string;
  normalizedValue: string;
  sourceUrl?: string | null;
  extractionMethod?: ContactExtractionMethod;
  confidence?: ConfidenceLevel;
  provenance?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// crawl_jobs / crawl_pages / crawl_findings
// (canonical physical name for "scans" / "scan_pages" — see gap audit)
// ---------------------------------------------------------------------------

export type CrawlJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type CrawlJobRecord = {
  id: string;
  /**
   * At least one of `leadId` / `clinicId` is always present — enforced in
   * application code (repository `createCrawlJob`) and by the DB check
   * constraint `crawl_jobs_requires_lead_or_clinic`. Legacy/inbound crawls
   * carry `leadId`; discovery/outbound crawls carry `clinicId` with
   * `leadId: null` until a lead exists for that clinic.
   */
  leadId: string | null;
  clinicId: string | null;
  requestedUrl: string;
  normalizedOrigin: string;
  status: CrawlJobStatus;
  maxPages: number;
  pagesDiscovered: number;
  pagesFetched: number;
  pagesFailed: number;
  requiresHumanReview: boolean;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrawlJobInput = {
  /**
   * At least one of `leadId` / `clinicId` is required — repository
   * implementations reject a call where both are missing/null with a
   * `validation` error, before ever reaching the DB check constraint
   * `crawl_jobs_requires_lead_or_clinic` (migration
   * `20260720150000_crawl_jobs_lead_or_clinic.sql`).
   */
  leadId?: string | null;
  clinicId?: string | null;
  requestedUrl: string;
  normalizedOrigin: string;
  maxPages?: number;
};

export type UpdateCrawlJobCountersInput = {
  pagesDiscovered?: number;
  pagesFetched?: number;
  pagesFailed?: number;
  status?: CrawlJobStatus;
  errorCode?: CrawlErrorCode | null;
  errorMessage?: string | null;
  completedAt?: string | null;
};

export type CrawlPageInput = {
  url: string;
  normalizedUrl: string;
  path: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  headings: string[];
  mainText: string | null;
  linksInternal: string[];
  contentHash: string | null;
  fetchDurationMs: number | null;
  fetchedAt: string | null;
  errorCode: CrawlErrorCode | null;
};

export type CrawlFindingInput = {
  category: "security" | "robots" | "fetch" | "parse" | "content" | "ops";
  severity: "info" | "low" | "medium" | "high";
  code: string;
  summary: string;
  details?: Record<string, unknown>;
  pageUrl?: string | null;
};

// ---------------------------------------------------------------------------
// scan_assets (metadata only — never binary bytes)
// ---------------------------------------------------------------------------

export type ScanAssetRecord = {
  id: string;
  crawlJobId: string;
  assetType: ScanAssetMetadata["assetType"];
  storagePath: string;
  contentType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  pageUrl: string | null;
  reviewStatus: ReviewStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateScanAssetInput = ScanAssetMetadata & { crawlJobId: string };

// ---------------------------------------------------------------------------
// extracted_content
// ---------------------------------------------------------------------------

export type ExtractedContentRecord = {
  id: string;
  crawlJobId: string;
  clinicId: string | null;
  /** Physical `version` integer column (unique per crawl_job_id). */
  version: number;
  /** Semantic schema tag stored inside `payload.schemaVersion` (no dedicated column). */
  schemaVersion: string;
  payload: Record<string, unknown>;
  candidates: ExtractionCandidate[];
  requiresHumanReview: boolean;
  reviewStatus: ReviewStatus;
  createdAt: string;
};

export type CreateExtractedContentInput = {
  crawlJobId: string;
  clinicId?: string | null;
  version?: number;
  schemaVersion: string;
  payload?: Record<string, unknown>;
  candidates: ExtractionCandidate[];
  /** Defaults to true. Extracted candidates are never public facts. */
  requiresHumanReview?: boolean;
};

// ---------------------------------------------------------------------------
// scores
// ---------------------------------------------------------------------------

export type ScoreReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_review"
  | "adjusted";

export type ScoreRecord = {
  id: string;
  crawlJobId: string | null;
  clinicId: string | null;
  credibility: number;
  clarity: number;
  mobile: number;
  actionability: number;
  freshness: number;
  total: number;
  evidence: ScoreEvidence[];
  disclaimer: string;
  reviewStatus: ScoreReviewStatus;
  scoringVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateScoreInput = {
  crawlJobId?: string | null;
  clinicId?: string | null;
  score: DigitalScore;
};

// ---------------------------------------------------------------------------
// outreach_messages
// ---------------------------------------------------------------------------

export type OutreachChannel = "email" | "whatsapp_manual" | "other";
export type OutreachStatus =
  | "draft"
  | "approved"
  | "sent"
  | "replied"
  | "ignored"
  | "rejected";

export type OutreachMessageRecord = {
  id: string;
  clinicId: string;
  leadId: string | null;
  channel: OutreachChannel;
  status: OutreachStatus;
  subject: string | null;
  body: string;
  evidence: OutreachDraft["evidence"];
  clickToChatUrl: string | null;
  humanReviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  doNotContactBlocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateOutreachMessageInput = {
  clinicId: string;
  leadId?: string | null;
  draft: OutreachDraft;
  /** Caller-supplied clinic do_not_contact flag; persisted as do_not_contact_blocked. */
  doNotContact: boolean;
};
