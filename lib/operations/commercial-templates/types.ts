/**
 * Structured shape of the commercial template pack — tier-aware,
 * review-only outreach copy and operator guidance, built directly from
 * the prospect prioritization result
 * (lib/operations/prioritization/prioritize-prospects.ts) plus
 * already-persisted score/review-decision/manual-outreach-log data.
 *
 * Distinct from the Manual Outreach Pack
 * (lib/operations/manual-outreach/) in one important way: that pack only
 * ever surfaces an *already-persisted, already gate-approved*
 * outreach_messages row — it never invents copy. This pack is the
 * earlier-stage tool: "given this prospect's current tier, what *should*
 * an operator consider saying, if anything?" It always freshly computes
 * copy (or explicitly withholds it) from current evidence; it never
 * reads or writes outreach_messages, and it has no relationship to the
 * outreach approval gate — the two are complementary, not substitutes.
 * Nothing produced here is ever sent; every draft stays
 * `reviewRequired: true` with no send-capable code path anywhere.
 */
import type { PriorityTier, SuggestedNextAction } from "@/lib/operations/prioritization/types";

export type CommercialTemplateKind = "clinic" | "candidate";
export type CommercialTemplateChannel = "whatsapp_manual" | "email";

export type CommercialCopyAvailable = {
  channel: CommercialTemplateChannel;
  available: true;
  subject: string | null;
  body: string;
  clickToChatUrl: string | null;
};

export type CommercialCopyUnavailable = {
  channel: CommercialTemplateChannel;
  available: false;
  unavailableReason: string;
};

export type CommercialCopySection = CommercialCopyAvailable | CommercialCopyUnavailable;

export type RiskFlagSeverity = "info" | "medium" | "high";

export type RiskFlag = {
  code: string;
  severity: RiskFlagSeverity;
  message: string;
};

export type CommercialTemplatePack = {
  reviewRequired: true;
  generatedAt: string;
  /** Verbatim copy of lib/score/calculate.ts SCORE_DISCLAIMER — always present, never altered. */
  disclaimer: string;

  /** 1. Priority tier this pack was built from — always matches what `crawler:prioritize-prospects` would report for the same id right now. */
  priorityTier: PriorityTier;

  kind: CommercialTemplateKind;
  id: string;
  displayName: string;

  /** 2. Plain, internal, one-paragraph summary of why this tier/action — never sent externally, may reference internal score numbers. */
  reasonSummary: string;

  /** 3. Recommended next action (reuses the prioritization model's own enum, never re-derived independently). */
  recommendedNextAction: SuggestedNextAction;
  recommendedNextActionLabel: string;

  /** 4. Operator checklist. */
  operatorChecklist: string[];

  /** 5. WhatsApp draft, only when the tier/decision state allows external copy at all. */
  whatsapp: CommercialCopySection;

  /** 6. Email draft, same eligibility as WhatsApp. */
  email: CommercialCopySection;

  /** 7. Populated only when copy was withheld (blocked tier, needs_changes decision, do_not_contact, or no evidence at all) — internal-only, never external copy. */
  blockedReason: string | null;

  /** 8. Risk flags — data-availability/compliance concerns, never medical or commercial claims. */
  riskFlags: RiskFlag[];

  /** Data-availability notes — never medical or commercial claims. */
  warnings: string[];
};
