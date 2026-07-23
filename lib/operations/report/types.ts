/**
 * Structured shape of the "Raio-X da Primeira Impressão Digital" operational
 * report — always human-review material, never a trigger for automatic
 * outreach. Every field here is either copied verbatim from already-
 * persisted data (clinic, crawl job, score, scan_assets, extracted_content,
 * outreach draft) or a generic, evidence-tied heuristic string — nothing is
 * invented (no medical claims, clients, testimonials, awards, or outcomes),
 * and medical quality is never evaluated.
 */

export type ReportStatus = "draft" | "incomplete_report";

export type ScreenshotSectionStatus =
  | "captured"
  | "pending_storage"
  | "capture_failed"
  | "storage_failed"
  | "missing";

export type ScreenshotSection = {
  status: ScreenshotSectionStatus;
  assetId: string | null;
  storagePath: string | null;
  capturedAt: string | null;
};

export type ScoreDimensionKey = "credibility" | "clarity" | "mobile" | "actionability" | "freshness";

export type ScoreDimensionSection = {
  key: ScoreDimensionKey;
  labelPt: string;
  points: number | null;
  max: 20;
};

export type EvidenceEntry = {
  reason: string;
  sourceUrl: string | null;
  points: number;
};

export type OperationalReport = {
  /** "draft" when score is available; "incomplete_report" only when --allow-incomplete was used and score is missing. Never anything else — this artifact is never a send trigger. */
  status: ReportStatus;
  /** Always true. This report is preparation material for a human reviewer, never an automated action. */
  reviewRequired: true;
  generatedAt: string;
  /** Verbatim copy of lib/score/calculate.ts SCORE_DISCLAIMER — always present, never altered. */
  disclaimer: string;

  clinicIdentity: {
    clinicId: string;
    displayName: string;
    normalizedWebsiteOrigin: string | null;
    city: string | null;
    state: string | null;
    specialty: string | null;
    status: string;
  };

  provenance: {
    sourceType: string;
    sourceAttribution: Record<string, unknown>;
    dedupeKey: string;
    leadId: string | null;
  };

  websiteAnalyzed: {
    crawlJobId: string | null;
    requestedUrl: string | null;
    normalizedOrigin: string | null;
    crawlStatus: string | null;
    pagesFetched: number | null;
    pagesDiscovered: number | null;
    pagesFailed: number | null;
    startedAt: string | null;
    completedAt: string | null;
    /** The crawl job's raw error_code (e.g. "redirect_blocked"), verbatim — never a raw exception message. Null when the crawl has no error (succeeded, or no job exists). */
    errorCode: string | null;
    /** The crawl job's already-safe, generic error_message (see lib/crawler/errors.ts's safeErrorMessage) — never a raw exception/stack trace. */
    errorMessage: string | null;
    /** Operator-friendly, Portuguese explanation of errorCode — see lib/operations/report/crawl-failure-explanation.ts. Null when errorCode is null. */
    failureExplanation: string | null;
    /** Operator-friendly, Portuguese suggested next step for this specific failure. Null when errorCode is null. */
    suggestedNextAction: string | null;
  };

  scoreSummary: {
    available: boolean;
    total: number | null;
    scoringVersion: string | null;
    reviewStatus: string | null;
  };

  scoreDimensions: ScoreDimensionSection[];

  evidenceByDimension: Record<ScoreDimensionKey, EvidenceEntry[]>;

  screenshots: {
    desktop: ScreenshotSection;
    mobile: ScreenshotSection;
  };

  extractedContentSummary: {
    available: boolean;
    schemaVersion: string | null;
    requiresHumanReview: boolean;
    candidateCountsByKind: Record<string, number>;
    contacts: Array<{ kind: string; value: string; sourceUrl: string; confidence: string }>;
  };

  /** Evidence-grounded, never invented — derived only from low-scoring dimensions' own recorded reasons. */
  mainIssues: string[];

  /** Generic, hedged guidance tied to the lowest-scoring dimension — never a specific factual claim about the clinic. */
  suggestedImprovementAngle: string;

  outreachDraft: {
    available: boolean;
    channel: string | null;
    subject: string | null;
    body: string | null;
    /** Status of the underlying outreach_messages row, if any — surfaced for visibility only; this report is never what sends it. */
    status: string | null;
    clickToChatUrl: string | null;
  };

  humanReviewChecklist: string[];

  /** Data-availability notes (e.g. "score missing", "mobile screenshot missing") — never medical or commercial claims. */
  warnings: string[];
};
