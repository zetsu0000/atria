/**
 * Provenance-aware extraction candidates.
 * Values are candidates for human review — never published facts.
 */

export const EXTRACTION_KINDS = [
  "title",
  "meta_description",
  "heading",
  "visible_text",
  "phone",
  "whatsapp",
  "email",
  "address",
  "social_link",
  "service_candidate",
  "team_name_candidate",
  "page_link",
  "image_candidate",
] as const;

export type ExtractionKind = (typeof EXTRACTION_KINDS)[number];

export const EXTRACTION_METHODS = [
  "html_anchor",
  "html_text",
  "meta",
  "json_ld",
  "heading",
  "img",
  "other",
] as const;

export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "needs_review",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ExtractionCandidate = {
  kind: ExtractionKind;
  value: string;
  sourceUrl: string;
  sourcePage: string;
  extractionMethod: ExtractionMethod;
  confidence: ConfidenceLevel;
  reviewStatus: ReviewStatus;
};

export type PageExtractionInput = {
  pageUrl: string;
  html: string;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  mainText: string | null;
  linksInternal: string[];
};
