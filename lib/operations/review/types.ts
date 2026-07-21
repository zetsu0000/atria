/**
 * Structured shape of the human review package — a cleaner, internal/
 * commercial-review repackaging of the operational report, built for a
 * human to approve before any contact with a clinic. Every field here is
 * either copied verbatim from already-persisted data (clinic, crawl job,
 * score, scan_assets, extracted content, outreach drafts) or a generic,
 * evidence-tied heuristic string — nothing is invented (no medical claims,
 * clients, testimonials, awards, or patient outcomes), and medical quality
 * is never evaluated. Every suggested message stays `status: "draft"` /
 * `reviewRequired: true` — this package never sends anything and has no
 * send-capable code path.
 */

export type ReviewPackStatus = "draft" | "incomplete_review_pack";

export type ScoreDimensionKey = "credibility" | "clarity" | "mobile" | "actionability" | "freshness";

export type ScoreDimensionSection = {
  key: ScoreDimensionKey;
  labelPt: string;
  points: number | null;
  max: 20;
};

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

export type SuggestedMessageDraft = {
  channel: "email" | "whatsapp_manual";
  /** False only when there is no evidence at all to draft from, or the clinic is do_not_contact. */
  available: boolean;
  unavailableReason: string | null;
  subject: string | null;
  body: string | null;
  clickToChatUrl: string | null;
  /** Always "draft" when available — never anything else. This package never marks anything sent. */
  status: "draft" | null;
  reviewRequired: true;
  /** True when this mirrors an already-persisted outreach_messages row; false when freshly generated in-memory for this package only (never persisted, never written to any repository). */
  persisted: boolean;
  persistedMessageId: string | null;
};

export type RiskFlagSeverity = "info" | "medium" | "high";

export type RiskFlag = {
  code: string;
  severity: RiskFlagSeverity;
  message: string;
};

export type HumanReviewPack = {
  /** "draft" when a score is available; "incomplete_review_pack" only when --allow-incomplete was used and score is missing. */
  status: ReviewPackStatus;
  /** Always true. This package is preparation material for a human reviewer, never an automated action. */
  reviewRequired: true;
  generatedAt: string;
  /** Verbatim copy of lib/score/calculate.ts SCORE_DISCLAIMER — always present, never altered. */
  disclaimer: string;

  /** 1. Plain, factual, evidence-tied summary — no invented claims, no quality judgments beyond what was measured. */
  internalSummary: string;

  /** 2. Clinic identity and source. */
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

  /** 3. Website analyzed. */
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
  };

  /** 4. Score summary. */
  scoreSummary: {
    available: boolean;
    total: number | null;
    scoringVersion: string | null;
    reviewStatus: string | null;
  };

  scoreDimensions: ScoreDimensionSection[];

  /** 5. Screenshot references (metadata only — never binary bytes, never a public URL). */
  screenshots: {
    desktop: ScreenshotSection;
    mobile: ScreenshotSection;
  };

  /** 6. Key issues found — evidence-grounded, derived only from low-scoring dimensions' own recorded reasons. */
  keyIssues: string[];

  /** 7. Suggested angle for outreach — generic, hedged guidance, never a specific factual claim about the clinic. */
  suggestedOutreachAngle: string;

  /** 8. Suggested WhatsApp message draft. */
  suggestedWhatsappDraft: SuggestedMessageDraft;

  /** 9. Suggested email draft. */
  suggestedEmailDraft: SuggestedMessageDraft;

  /** 10. Human approval checklist. */
  humanApprovalChecklist: string[];

  /** 11. Risk flags — data-availability and compliance concerns, never medical or commercial claims. */
  riskFlags: RiskFlag[];

  /** Data-availability notes — never medical or commercial claims. */
  warnings: string[];
};
