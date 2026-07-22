/**
 * Records a manual outreach log event — append-only, never sends
 * anything, never rewrites outreach copy, never mutates a review
 * decision. This is the write-side counterpart to the Manual Outreach
 * Pack (lib/operations/manual-outreach/): the pack tells an operator what
 * to send; this module lets them record what actually happened,
 * afterward, outside this system.
 *
 * Per-event-type safety rules:
 *
 * - "manual_send_logged": requires clinic exists, outreach message exists
 *   and belongs to the clinic, and — critically — the existing outreach
 *   approval gate (`canPrepareOutreachForSend`,
 *   lib/operations/outreach/approval-gate.ts) still passes for that exact
 *   message at the moment of logging. This reuses the gate rather than
 *   re-implementing its checks (clinic/message existence, do_not_contact,
 *   sendable status, latest decision approved).
 * - "response_logged" / "follow_up_logged" / "no_response_logged":
 *   require a prior "manual_send_logged" row for the same
 *   outreach_message_id — recording a response before any send was ever
 *   logged would be recording a fiction. The approval gate is NOT
 *   re-checked here (a message may legitimately be "sent" status by the
 *   time a response comes in, which the gate would otherwise reject).
 * - "rehearsal_logged": only requires the clinic/message to exist and
 *   belong to each other — no approval gate, no prior-send requirement.
 *   Exists specifically so the logging pipeline can be exercised in
 *   staging without ever asserting a real send occurred.
 * - "do_not_contact_logged": always inserts the append-only log row
 *   first, then — as the one explicitly modeled and tested mutation this
 *   module ever performs outside manual_outreach_logs itself — calls the
 *   already-existing, already-tested `ClinicRepository.setDoNotContact`.
 *   If that mutation fails, the log row still exists and the result
 *   reports `sideEffects.doNotContactUpdated: false` so the caller knows
 *   to follow up manually; the log itself is never lost or rolled back.
 *
 * No other event type ever calls setDoNotContact, markSent, approve,
 * createDraft, or recordDecision. This module has no send-capable code
 * path anywhere.
 */
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import type { ManualOutreachLogRepository } from "@/lib/operations/repositories/manual-outreach-log-repository";
import type {
  CreateManualOutreachLogInput,
  ManualOutreachLogChannel,
  ManualOutreachLogEventType,
} from "@/lib/operations/repositories/types";
import { canPrepareOutreachForSend } from "@/lib/operations/outreach/approval-gate";
import {
  EVENT_TYPES_REQUIRING_PRIOR_SEND,
  MANUAL_OUTREACH_LOG_CHANNELS,
  MANUAL_OUTREACH_LOG_EVENT_TYPES,
  type RecordManualOutreachLogResult,
} from "./types";

export type RecordManualOutreachLogInput = {
  clinicId: string;
  outreachMessageId: string;
  channel: ManualOutreachLogChannel;
  eventType: ManualOutreachLogEventType;
  operatorName: string;
  occurredAt: string;
  notes?: string | null;
  responseReceived?: boolean | null;
  followUpNeeded?: boolean | null;
  followUpAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordManualOutreachLogDeps = {
  clinicRepo: ClinicRepository;
  outreachRepo: OutreachRepository;
  humanReviewRepo: HumanReviewRepository;
  manualOutreachLogRepo: ManualOutreachLogRepository;
};

export async function recordManualOutreachLog(
  input: RecordManualOutreachLogInput,
  deps: RecordManualOutreachLogDeps,
): Promise<RecordManualOutreachLogResult> {
  if (!MANUAL_OUTREACH_LOG_CHANNELS.includes(input.channel)) {
    return {
      ok: false,
      reason: "validation",
      message: `Invalid channel "${input.channel}" — must be one of: ${MANUAL_OUTREACH_LOG_CHANNELS.join(", ")}.`,
    };
  }
  if (!MANUAL_OUTREACH_LOG_EVENT_TYPES.includes(input.eventType)) {
    return {
      ok: false,
      reason: "validation",
      message: `Invalid event_type "${input.eventType}" — must be one of: ${MANUAL_OUTREACH_LOG_EVENT_TYPES.join(", ")}.`,
    };
  }
  if (!input.operatorName || !input.operatorName.trim()) {
    return { ok: false, reason: "validation", message: "operator_name is required." };
  }
  if (!input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) {
    return { ok: false, reason: "validation", message: "occurred_at is required and must be a valid timestamp." };
  }

  const clinicResult = await deps.clinicRepo.getClinic(input.clinicId);
  if (!clinicResult.ok) {
    return { ok: false, reason: clinicResult.reason, message: clinicResult.message };
  }

  const messageResult = await deps.outreachRepo.getMessage(input.outreachMessageId);
  if (!messageResult.ok) {
    return { ok: false, reason: messageResult.reason, message: messageResult.message };
  }
  if (messageResult.value.clinicId !== input.clinicId) {
    return {
      ok: false,
      reason: "validation",
      message: "Outreach message does not belong to the given clinic.",
    };
  }

  let humanReviewDecisionId: string | null = null;

  if (input.eventType === "manual_send_logged") {
    const gate = await canPrepareOutreachForSend(
      { clinicId: input.clinicId, outreachMessageId: input.outreachMessageId },
      { clinicRepo: deps.clinicRepo, outreachRepo: deps.outreachRepo, humanReviewRepo: deps.humanReviewRepo },
    );
    if (!gate.allowed) {
      return {
        ok: false,
        reason: "blocked",
        message: `manual_send_logged blocked by the outreach approval gate (${gate.code}): ${gate.reason}`,
      };
    }
    humanReviewDecisionId = gate.decision.id;
  }

  if (EVENT_TYPES_REQUIRING_PRIOR_SEND.includes(input.eventType)) {
    const priorLogs = await deps.manualOutreachLogRepo.listForOutreachMessage(input.outreachMessageId);
    const hasPriorSend = priorLogs.ok && priorLogs.value.some((log) => log.eventType === "manual_send_logged");
    if (!hasPriorSend) {
      return {
        ok: false,
        reason: "blocked",
        message: `event_type "${input.eventType}" requires a prior "manual_send_logged" row for this outreach message.`,
      };
    }
  }

  const createInput: CreateManualOutreachLogInput = {
    clinicId: input.clinicId,
    outreachMessageId: input.outreachMessageId,
    humanReviewDecisionId,
    channel: input.channel,
    eventType: input.eventType,
    operatorName: input.operatorName.trim(),
    occurredAt: input.occurredAt,
    notes: input.notes ?? null,
    responseReceived: input.responseReceived ?? null,
    followUpNeeded: input.followUpNeeded ?? null,
    followUpAt: input.followUpAt ?? null,
    metadata: input.metadata ?? {},
  };

  const logResult = await deps.manualOutreachLogRepo.recordLog(createInput);
  if (!logResult.ok) {
    return { ok: false, reason: logResult.reason, message: logResult.message };
  }

  let doNotContactUpdated = false;
  if (input.eventType === "do_not_contact_logged") {
    const updated = await deps.clinicRepo.setDoNotContact(
      input.clinicId,
      true,
      input.notes?.trim() || "Registrado via manual outreach log (do_not_contact_logged).",
    );
    doNotContactUpdated = updated.ok;
  }

  return { ok: true, log: logResult.value, sideEffects: { doNotContactUpdated } };
}
