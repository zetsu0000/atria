import type { ManualOutreachLogRepository } from "../repositories/manual-outreach-log-repository";
import type {
  CreateManualOutreachLogInput,
  ManualOutreachLogRecord,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbManualOutreachLog = {
  id: string;
  clinic_id: string;
  outreach_message_id: string;
  human_review_decision_id: string | null;
  channel: ManualOutreachLogRecord["channel"];
  event_type: ManualOutreachLogRecord["eventType"];
  operator_name: string;
  occurred_at: string;
  notes: string | null;
  response_received: boolean | null;
  follow_up_needed: boolean | null;
  follow_up_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function mapManualOutreachLogRow(row: DbManualOutreachLog): ManualOutreachLogRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    outreachMessageId: row.outreach_message_id,
    humanReviewDecisionId: row.human_review_decision_id,
    channel: row.channel,
    eventType: row.event_type,
    operatorName: row.operator_name,
    occurredAt: row.occurred_at,
    notes: row.notes,
    responseReceived: row.response_received,
    followUpNeeded: row.follow_up_needed,
    followUpAt: row.follow_up_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Manual outreach log persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Manual outreach log persistence is temporarily unavailable.",
};

export function createSupabaseManualOutreachLogRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): ManualOutreachLogRepository {
  return {
    async recordLog(input: CreateManualOutreachLogInput): Promise<RepoResult<ManualOutreachLogRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("manual_outreach_logs")
          .insert({
            clinic_id: input.clinicId,
            outreach_message_id: input.outreachMessageId,
            human_review_decision_id: input.humanReviewDecisionId ?? null,
            channel: input.channel,
            event_type: input.eventType,
            operator_name: input.operatorName.slice(0, 160),
            occurred_at: input.occurredAt,
            notes: input.notes?.slice(0, 4000) ?? null,
            response_received: input.responseReceived ?? null,
            follow_up_needed: input.followUpNeeded ?? null,
            follow_up_at: input.followUpAt ?? null,
            metadata: input.metadata ?? {},
          })
          .select("*")
          .single<DbManualOutreachLog>();
        if (error || !data) {
          console.warn("[atria:operations] manual_outreach_log_record_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapManualOutreachLogRow(data) };
      } catch {
        console.warn("[atria:operations] manual_outreach_log_record_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listForClinic(clinicId: string): Promise<RepoResult<ManualOutreachLogRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("manual_outreach_logs")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("occurred_at", { ascending: false })
          .returns<DbManualOutreachLog[]>();
        if (error || !data) {
          console.warn("[atria:operations] manual_outreach_log_list_for_clinic_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data.map(mapManualOutreachLogRow) };
      } catch {
        console.warn("[atria:operations] manual_outreach_log_list_for_clinic_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listForOutreachMessage(outreachMessageId: string): Promise<RepoResult<ManualOutreachLogRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("manual_outreach_logs")
          .select("*")
          .eq("outreach_message_id", outreachMessageId)
          .order("occurred_at", { ascending: false })
          .returns<DbManualOutreachLog[]>();
        if (error || !data) {
          console.warn("[atria:operations] manual_outreach_log_list_for_message_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data.map(mapManualOutreachLogRow) };
      } catch {
        console.warn("[atria:operations] manual_outreach_log_list_for_message_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
