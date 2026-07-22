/**
 * Structured shape of the Manual Outreach Pack — the final operator-facing
 * artifact used immediately before a human manually contacts a clinic.
 *
 * Unlike the human review pack (lib/operations/review/), which is
 * preparation material generated *before* a review decision exists, this
 * pack can only be generated for a clinic whose latest human review
 * decision is "approved" AND whose specific outreach message(s) pass the
 * read-only outreach approval gate
 * (lib/operations/outreach/approval-gate.ts's `canPrepareOutreachForSend`).
 * Copy shown here is never freshly generated — it is always the exact,
 * already-persisted, already-gate-validated `outreach_messages` row body,
 * so what the operator reads here is guaranteed to be what actually passed
 * approval. This module has no send-capable code path and never mutates
 * `outreach_messages` or `human_review_decisions`.
 */

export type ManualOutreachPackStatus = "ready" | "partial_blocked";

/** CLI/task-facing channel names ("whatsapp"/"email"/"both") map to these internal outreach_messages channel values. */
export type ManualOutreachChannel = "whatsapp_manual" | "email";

export type ChannelGateStatus = "allowed" | "blocked";

/**
 * One row per requested channel — always present for every channel the
 * caller asked about, whether it ended up allowed or blocked. `code` is
 * either a code from `OutreachApprovalBlockCode`
 * (lib/operations/outreach/approval-gate.ts) when the approval gate itself
 * ran and blocked, or a manual-outreach-pack-specific code
 * ("no_persisted_draft_for_channel", "outreach_message_wrong_channel")
 * when this builder could not even find a message to hand to the gate.
 */
export type ChannelApprovalResult = {
  channel: ManualOutreachChannel;
  status: ChannelGateStatus;
  outreachMessageId: string | null;
  code: string | null;
  reason: string;
};

export type ManualOutreachCopyAvailable = {
  channel: ManualOutreachChannel;
  available: true;
  outreachMessageId: string;
  /** The persisted message's own status at generation time — always a sendable candidate state ("draft" or "approved"), since the gate just confirmed it. Never "sent". */
  outreachStatus: string;
  subject: string | null;
  /** Verbatim, unmodified `outreach_messages.body` — exactly what passed the approval gate. Never rewritten by this builder. */
  body: string;
  clickToChatUrl: string | null;
  /**
   * Optional, pack-only annotation — never part of `body`, never meant to
   * be pasted into the outbound message. Present only when
   * `includeScoreInCopy` was passed; otherwise null.
   */
  internalScoreNote: string | null;
};

export type ManualOutreachCopyBlocked = {
  channel: ManualOutreachChannel;
  available: false;
  blockCode: string | null;
  blockReason: string;
};

export type ManualOutreachCopySection = ManualOutreachCopyAvailable | ManualOutreachCopyBlocked;

export type ManualOutreachScreenshotReference = {
  status: string;
  assetId: string | null;
  /** Private Supabase Storage path — never a public or signed URL. Only populated when `includeScreenshotLinks` was passed; otherwise null even if a screenshot exists. */
  storagePath: string | null;
  capturedAt: string | null;
};

export type RiskFlagSeverity = "info" | "medium" | "high";

export type RiskFlag = {
  code: string;
  severity: RiskFlagSeverity;
  message: string;
};

export type ManualOutreachPack = {
  /** "ready" when every requested channel's gate passed; "partial_blocked" when at least one requested channel passed and at least one was blocked. (When *no* requested channel passes, no pack is built at all — see BuildManualOutreachPackResult.) */
  status: ManualOutreachPackStatus;
  reviewRequired: true;
  generatedAt: string;
  /** Verbatim copy of lib/score/calculate.ts SCORE_DISCLAIMER — always present, never altered. */
  disclaimer: string;

  /** 1. Operator summary — plain, factual, one paragraph. */
  operatorSummary: string;

  /** 2. Clinic identity. */
  clinicIdentity: {
    clinicId: string;
    displayName: string;
    normalizedWebsiteOrigin: string | null;
    city: string | null;
    state: string | null;
    specialty: string | null;
    status: string;
  };

  /** 3. Website analyzed. */
  websiteAnalyzed: {
    crawlJobId: string | null;
    requestedUrl: string | null;
    normalizedOrigin: string | null;
    crawlStatus: string | null;
    pagesFetched: number | null;
  };

  /** 4. Approval status — the clinic-level decision the approval gate relied on. */
  approvalStatus: {
    hasApprovedDecision: boolean;
    latestDecisionId: string | null;
    decision: string | null;
    reviewer: string | null;
    reviewedAt: string | null;
  };

  /** 5. Approval gate result — one entry per requested channel. */
  approvalGateResults: ChannelApprovalResult[];

  /** 6. Score summary. */
  scoreSummary: {
    available: boolean;
    total: number | null;
    scoringVersion: string | null;
  };

  /** 7. Key evidence summary — short, evidence-grounded, never invented. */
  keyEvidenceSummary: string[];

  /** 8. Screenshot asset references (metadata only — never binary bytes, never a public URL). */
  screenshots: {
    desktop: ManualOutreachScreenshotReference;
    mobile: ManualOutreachScreenshotReference;
  };

  /** 9. Risk flags. */
  riskFlags: RiskFlag[];

  /** 10. Final WhatsApp copy (present only when whatsapp was a requested channel). */
  whatsapp: ManualOutreachCopySection | null;

  /** 11. Final email copy (present only when email was a requested channel). */
  email: ManualOutreachCopySection | null;

  /** 13. Manual sending checklist (operator-facing). */
  operatorChecklist: string[];

  /** 14. Post-send logging checklist — text-only; no logging is persisted by this pack (see docs: future work). */
  postSendLoggingChecklist: string[];

  includeScoreInCopy: boolean;
  includeScreenshotLinks: boolean;

  /** Data-availability notes — never medical or commercial claims. */
  warnings: string[];
};
