import type {
  CreateManualOutreachLogInput,
  ManualOutreachLogRecord,
  RepoResult,
} from "./types";

/**
 * Persistence for `manual_outreach_logs` — an append-only audit log of
 * operator actions taken *outside* this system (manual send, response,
 * follow-up, do-not-contact, rehearsal). There is no update/delete
 * method: a clinic's outreach history is preserved rather than
 * overwritten. This repository has no send-capable method anywhere —
 * recording a log never sends anything.
 */
export interface ManualOutreachLogRepository {
  recordLog(
    input: CreateManualOutreachLogInput,
  ): Promise<RepoResult<ManualOutreachLogRecord>>;

  listForClinic(clinicId: string): Promise<RepoResult<ManualOutreachLogRecord[]>>;

  listForOutreachMessage(
    outreachMessageId: string,
  ): Promise<RepoResult<ManualOutreachLogRecord[]>>;
}
