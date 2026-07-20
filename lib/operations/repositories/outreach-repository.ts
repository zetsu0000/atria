import type {
  CreateOutreachMessageInput,
  OutreachMessageRecord,
  RepoResult,
} from "./types";

/**
 * Persistence for `outreach_messages`. Drafts only — this repository never
 * sends anything. `sent` / `replied` / `ignored` are state transitions
 * recorded after a message was sent through a separate, explicitly
 * human-approved channel (outside this foundation).
 *
 * `createDraft` refuses to persist when `doNotContact` is true (mirrors
 * `lib/outreach/draft.ts` `buildOutreachDraft` and the DB check constraint
 * `outreach_messages_sent_requires_review`).
 */
export interface OutreachRepository {
  createDraft(
    input: CreateOutreachMessageInput,
  ): Promise<RepoResult<OutreachMessageRecord>>;

  approve(
    messageId: string,
    reviewedBy: string,
  ): Promise<RepoResult<OutreachMessageRecord>>;

  reject(
    messageId: string,
    reviewedBy: string,
    reason?: string | null,
  ): Promise<RepoResult<OutreachMessageRecord>>;

  /** State transition only. Never calls Resend/WhatsApp/any send API. */
  markSent(messageId: string): Promise<RepoResult<OutreachMessageRecord>>;

  markReplied(messageId: string): Promise<RepoResult<OutreachMessageRecord>>;

  markIgnored(messageId: string): Promise<RepoResult<OutreachMessageRecord>>;

  getMessage(messageId: string): Promise<RepoResult<OutreachMessageRecord>>;

  listForClinic(clinicId: string): Promise<RepoResult<OutreachMessageRecord[]>>;
}
