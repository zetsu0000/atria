/**
 * Outreach approval gate — a reusable, read-only guard that any future
 * outreach-send code path must call and pass before it could ever send
 * anything. This module does not send anything itself, does not implement
 * provider sending (email/WhatsApp), does not mark anything `sent`, does
 * not mutate `human_review_decisions`, and does not auto-approve.
 *
 * Required for `allowed: true`:
 *  1. The clinic exists.
 *  2. The outreach message exists and belongs to that clinic.
 *  3. Neither the clinic nor the outreach message is `do_not_contact`
 *     blocked — checked before, and independent of, the review decision,
 *     so an old "approved" decision can never override a do_not_contact
 *     flag set afterward.
 *  4. The outreach message's own status is still a sendable candidate
 *     state (`draft` or `approved`) — not already `sent`, and not
 *     `rejected`/`ignored`/`replied`.
 *  5. The clinic's *latest* human_review_decisions row (by `reviewedAt`)
 *     has `decision: "approved"`. Latest always wins — an older
 *     `approved` decision superseded by a later `needs_changes` blocks,
 *     and vice versa.
 *
 * Any single failure short-circuits with a specific `code` and a plain-
 * English `reason` — never a generic "not allowed".
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { HumanReviewDecisionRecord } from "@/lib/operations/repositories/types";

/** Outreach message statuses that are still viable candidates for a future send — never already sent, rejected, ignored, or replied. */
const SENDABLE_OUTREACH_STATUSES = new Set(["draft", "approved"]);

export type OutreachApprovalBlockCode =
  | "clinic_not_found"
  | "outreach_message_not_found"
  | "outreach_message_wrong_clinic"
  | "do_not_contact"
  | "outreach_not_sendable_status"
  | "missing_review_decision"
  | "review_decision_rejected"
  | "review_decision_needs_changes"
  | "review_decision_not_approved";

export type OutreachApprovalInput = {
  clinicId: string;
  outreachMessageId: string;
};

export type OutreachApprovalDeps = {
  clinicRepo: ClinicRepository;
  outreachRepo: OutreachRepository;
  humanReviewRepo: HumanReviewRepository;
};

export type OutreachApprovalResult =
  | { allowed: true; reason: string; decision: HumanReviewDecisionRecord }
  | { allowed: false; code: OutreachApprovalBlockCode; reason: string; decision: HumanReviewDecisionRecord | null };

const REASON_BY_DECISION: Partial<Record<HumanReviewDecisionRecord["decision"], OutreachApprovalBlockCode>> = {
  rejected: "review_decision_rejected",
  needs_changes: "review_decision_needs_changes",
};

/**
 * Read-only check — never throws, never mutates anything. Returns a
 * structured, always-informative result for a caller (CLI, future sender)
 * to display or act on.
 */
export async function canPrepareOutreachForSend(
  input: OutreachApprovalInput,
  deps: OutreachApprovalDeps,
): Promise<OutreachApprovalResult> {
  const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
  if (!clinicResult.ok) {
    return { allowed: false, code: "clinic_not_found", reason: "Clinic not found.", decision: null };
  }
  const clinic = clinicResult.value;

  const messageResult = await deps.outreachRepo.getMessage(input.outreachMessageId);
  if (!messageResult.ok) {
    return { allowed: false, code: "outreach_message_not_found", reason: "Outreach message not found.", decision: null };
  }
  const message = messageResult.value;

  if (message.clinicId !== input.clinicId) {
    return {
      allowed: false,
      code: "outreach_message_wrong_clinic",
      reason: "Outreach message does not belong to the given clinic.",
      decision: null,
    };
  }

  if (clinic.doNotContact || message.doNotContactBlocked) {
    return {
      allowed: false,
      code: "do_not_contact",
      reason: clinic.doNotContactReason
        ? `Clinic is marked do_not_contact: ${clinic.doNotContactReason}`
        : "Clinic or outreach message is marked do_not_contact.",
      decision: null,
    };
  }

  if (!SENDABLE_OUTREACH_STATUSES.has(message.status)) {
    return {
      allowed: false,
      code: "outreach_not_sendable_status",
      reason: `Outreach message status "${message.status}" is not a sendable candidate state (must be "draft" or "approved").`,
      decision: null,
    };
  }

  const decisionResult = await deps.humanReviewRepo.getLatestDecisionForClinic(input.clinicId);
  const latestDecision = decisionResult.ok ? decisionResult.value : null;

  if (!latestDecision) {
    return {
      allowed: false,
      code: "missing_review_decision",
      reason: "No human review decision has been recorded for this clinic yet.",
      decision: null,
    };
  }

  if (latestDecision.decision !== "approved") {
    const code = REASON_BY_DECISION[latestDecision.decision] ?? "review_decision_not_approved";
    return {
      allowed: false,
      code,
      reason: `Latest human review decision is "${latestDecision.decision}", not "approved".`,
      decision: latestDecision,
    };
  }

  return {
    allowed: true,
    reason: "Clinic is not do_not_contact, the outreach message is in a sendable state, and the latest human review decision is approved.",
    decision: latestDecision,
  };
}

export class OutreachNotApprovedForSendError extends Error {
  code: OutreachApprovalBlockCode;

  constructor(code: OutreachApprovalBlockCode, reason: string) {
    super(reason);
    this.name = "OutreachNotApprovedForSendError";
    this.code = code;
  }
}

/**
 * Throwing variant for a future sender to call defensively, e.g.:
 *
 *   await assertOutreachApprovedForSend({ clinicId, outreachMessageId }, deps);
 *   // only reachable past this line if a human explicitly approved —
 *   // still does not send anything itself; that is the caller's job,
 *   // and does not exist anywhere in this codebase today.
 *
 * Never marks anything sent, never mutates review decisions, never
 * auto-approves — purely a read-only precondition check that throws
 * instead of returning a result object.
 */
export async function assertOutreachApprovedForSend(
  input: OutreachApprovalInput,
  deps: OutreachApprovalDeps,
): Promise<HumanReviewDecisionRecord> {
  const result = await canPrepareOutreachForSend(input, deps);
  if (!result.allowed) {
    throw new OutreachNotApprovedForSendError(result.code, result.reason);
  }
  return result.decision;
}
