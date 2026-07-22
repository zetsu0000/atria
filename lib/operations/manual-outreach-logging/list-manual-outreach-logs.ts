/**
 * Read-only listing of manual outreach log rows — never sends anything,
 * never mutates anything.
 */
import type { ManualOutreachLogRepository } from "@/lib/operations/repositories/manual-outreach-log-repository";
import type { ListManualOutreachLogsResult } from "./types";

export type ListManualOutreachLogsInput = {
  clinicId?: string;
  outreachMessageId?: string;
};

export type ListManualOutreachLogsDeps = {
  manualOutreachLogRepo: ManualOutreachLogRepository;
};

export async function listManualOutreachLogs(
  input: ListManualOutreachLogsInput,
  deps: ListManualOutreachLogsDeps,
): Promise<ListManualOutreachLogsResult> {
  if (!input.clinicId && !input.outreachMessageId) {
    return { ok: false, reason: "validation", message: "Provide --clinic-id or --outreach-message-id." };
  }

  if (input.outreachMessageId) {
    const result = await deps.manualOutreachLogRepo.listForOutreachMessage(input.outreachMessageId);
    if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
    return { ok: true, logs: result.value };
  }

  const result = await deps.manualOutreachLogRepo.listForClinic(input.clinicId!);
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return { ok: true, logs: result.value };
}
