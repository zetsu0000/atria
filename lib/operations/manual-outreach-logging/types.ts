/**
 * Shared constants and result shapes for manual outreach logging — the
 * append-only side of the outreach loop: recording what a human operator
 * did *outside* this system after manually contacting a clinic (send,
 * response, follow-up, do-not-contact, rehearsal). No provider
 * integration exists anywhere in this codebase; logging an event is never
 * the same as sending one. See
 * docs/technical/crawler-manual-outreach-logging.md.
 */
import type {
  ManualOutreachLogChannel,
  ManualOutreachLogEventType,
  ManualOutreachLogRecord,
  RepoErrorReason,
} from "@/lib/operations/repositories/types";

export const MANUAL_OUTREACH_LOG_CHANNELS: readonly ManualOutreachLogChannel[] = [
  "whatsapp",
  "email",
  "phone",
  "other",
];

export const MANUAL_OUTREACH_LOG_EVENT_TYPES: readonly ManualOutreachLogEventType[] = [
  "manual_send_logged",
  "response_logged",
  "follow_up_logged",
  "no_response_logged",
  "do_not_contact_logged",
  "rehearsal_logged",
];

/**
 * Event types that must be preceded by a "manual_send_logged" row for the
 * same outreach_message_id — recording a response/follow-up/no-response
 * before any send was ever logged would be recording a fiction.
 * "rehearsal_logged" is deliberately not one of these: it exists to prove
 * the logging pipeline works without asserting a real send happened.
 */
export const EVENT_TYPES_REQUIRING_PRIOR_SEND: readonly ManualOutreachLogEventType[] = [
  "response_logged",
  "follow_up_logged",
  "no_response_logged",
];

export type RecordManualOutreachLogSideEffects = {
  /**
   * True only when event_type is "do_not_contact_logged" and
   * clinicRepo.setDoNotContact succeeded. This is the one, explicitly
   * modeled and tested mutation this module ever performs outside the
   * append-only manual_outreach_logs table itself — every other event
   * type never touches any other table.
   */
  doNotContactUpdated: boolean;
};

export type RecordManualOutreachLogResult =
  | { ok: true; log: ManualOutreachLogRecord; sideEffects: RecordManualOutreachLogSideEffects }
  | { ok: false; reason: RepoErrorReason | "blocked" | "validation"; message: string };

export type ListManualOutreachLogsResult =
  | { ok: true; logs: ManualOutreachLogRecord[] }
  | { ok: false; reason: RepoErrorReason | "validation"; message: string };
