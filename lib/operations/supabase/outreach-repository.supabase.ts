import type { OutreachRepository } from "../repositories/outreach-repository";
import type {
  CreateOutreachMessageInput,
  OutreachMessageRecord,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbOutreachMessage = {
  id: string;
  clinic_id: string;
  lead_id: string | null;
  channel: OutreachMessageRecord["channel"];
  status: OutreachMessageRecord["status"];
  subject: string | null;
  body: string;
  evidence: OutreachMessageRecord["evidence"];
  click_to_chat_url: string | null;
  human_reviewed: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  do_not_contact_blocked: boolean;
  created_at: string;
  updated_at: string;
};

export function mapOutreachMessageRow(row: DbOutreachMessage): OutreachMessageRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    leadId: row.lead_id,
    channel: row.channel,
    status: row.status,
    subject: row.subject,
    body: row.body,
    evidence: row.evidence ?? [],
    clickToChatUrl: row.click_to_chat_url,
    humanReviewed: row.human_reviewed,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    doNotContactBlocked: row.do_not_contact_blocked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Outreach persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Outreach persistence is temporarily unavailable.",
};

export function createSupabaseOutreachRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): OutreachRepository {
  return {
    async createDraft(input: CreateOutreachMessageInput): Promise<RepoResult<OutreachMessageRecord>> {
      // do_not_contact is enforced here (never sent to the DB as approved
      // to send) and again by the `outreach_messages_sent_requires_review`
      // check constraint — defense in depth, never bypassed by this adapter.
      if (input.doNotContact) {
        return { ok: false, reason: "blocked", message: "Clinic is marked do_not_contact." };
      }
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("outreach_messages")
          .insert({
            clinic_id: input.clinicId,
            lead_id: input.leadId ?? null,
            channel: input.draft.channel,
            status: "draft",
            subject: input.draft.subject?.slice(0, 200) ?? null,
            body: input.draft.body.slice(0, 10000),
            evidence: input.draft.evidence,
            click_to_chat_url: input.draft.clickToChatUrl?.slice(0, 2048) ?? null,
            human_reviewed: false,
            do_not_contact_blocked: false,
          })
          .select("*")
          .single<DbOutreachMessage>();
        if (error || !data) {
          console.warn("[atria:operations] outreach_draft_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapOutreachMessageRow(data) };
      } catch {
        console.warn("[atria:operations] outreach_draft_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async approve(messageId: string, reviewedBy: string): Promise<RepoResult<OutreachMessageRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data: existing, error: fetchError } = await client
          .from("outreach_messages")
          .select("*")
          .eq("id", messageId)
          .maybeSingle<DbOutreachMessage>();
        if (fetchError) {
          console.warn("[atria:operations] outreach_approve_lookup_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!existing) return { ok: false, reason: "not_found", message: "Outreach message not found." };
        if (existing.do_not_contact_blocked) {
          return { ok: false, reason: "blocked", message: "Cannot approve: do_not_contact blocked." };
        }

        const { data, error } = await client
          .from("outreach_messages")
          .update({
            status: "approved",
            human_reviewed: true,
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewedBy.slice(0, 160),
          })
          .eq("id", messageId)
          .select("*")
          .maybeSingle<DbOutreachMessage>();
        if (error) {
          console.warn("[atria:operations] outreach_approve_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Outreach message not found." };
        return { ok: true, value: mapOutreachMessageRow(data) };
      } catch {
        console.warn("[atria:operations] outreach_approve_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async reject(
      messageId: string,
      reviewedBy: string,
      reason?: string | null,
    ): Promise<RepoResult<OutreachMessageRecord>> {
      void reason;
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("outreach_messages")
          .update({
            status: "rejected",
            human_reviewed: true,
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewedBy.slice(0, 160),
          })
          .eq("id", messageId)
          .select("*")
          .maybeSingle<DbOutreachMessage>();
        if (error) {
          console.warn("[atria:operations] outreach_reject_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Outreach message not found." };
        return { ok: true, value: mapOutreachMessageRow(data) };
      } catch {
        console.warn("[atria:operations] outreach_reject_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async markSent(messageId: string): Promise<RepoResult<OutreachMessageRecord>> {
      // State transition only — this method never sends anything. The
      // physical `outreach_messages_sent_requires_review` check constraint
      // is a second line of defense against marking sent without review.
      return transitionStatus(env, messageId, "sent");
    },

    async markReplied(messageId: string): Promise<RepoResult<OutreachMessageRecord>> {
      return transitionStatus(env, messageId, "replied");
    },

    async markIgnored(messageId: string): Promise<RepoResult<OutreachMessageRecord>> {
      return transitionStatus(env, messageId, "ignored");
    },

    async getMessage(messageId: string): Promise<RepoResult<OutreachMessageRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("outreach_messages")
          .select("*")
          .eq("id", messageId)
          .maybeSingle<DbOutreachMessage>();
        if (error) {
          console.warn("[atria:operations] outreach_get_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Outreach message not found." };
        return { ok: true, value: mapOutreachMessageRow(data) };
      } catch {
        console.warn("[atria:operations] outreach_get_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listForClinic(clinicId: string): Promise<RepoResult<OutreachMessageRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("outreach_messages")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false });
        if (error) {
          console.warn("[atria:operations] outreach_list_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: (data as DbOutreachMessage[] | null)?.map(mapOutreachMessageRow) ?? [] };
      } catch {
        console.warn("[atria:operations] outreach_list_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}

async function transitionStatus(
  env: LeadCaptureEnv,
  messageId: string,
  status: OutreachMessageRecord["status"],
): Promise<RepoResult<OutreachMessageRecord>> {
  const client = getOperationsServiceClient(env);
  if (!client) return CONFIGURATION_ERROR;
  try {
    if (status === "sent") {
      const { data: existing, error: fetchError } = await client
        .from("outreach_messages")
        .select("*")
        .eq("id", messageId)
        .maybeSingle<DbOutreachMessage>();
      if (fetchError) {
        console.warn("[atria:operations] outreach_transition_lookup_failed");
        return UNAVAILABLE_ERROR;
      }
      if (!existing) return { ok: false, reason: "not_found", message: "Outreach message not found." };
      if (!existing.human_reviewed || existing.do_not_contact_blocked) {
        return {
          ok: false,
          reason: "blocked",
          message: "Outreach cannot be marked sent without human review and do_not_contact clearance.",
        };
      }
    }

    const { data, error } = await client
      .from("outreach_messages")
      .update({ status })
      .eq("id", messageId)
      .select("*")
      .maybeSingle<DbOutreachMessage>();
    if (error) {
      console.warn("[atria:operations] outreach_transition_failed");
      return UNAVAILABLE_ERROR;
    }
    if (!data) return { ok: false, reason: "not_found", message: "Outreach message not found." };
    return { ok: true, value: mapOutreachMessageRow(data) };
  } catch {
    console.warn("[atria:operations] outreach_transition_exception");
    return UNAVAILABLE_ERROR;
  }
}
