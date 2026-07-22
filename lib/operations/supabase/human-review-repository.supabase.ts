import type { HumanReviewRepository } from "../repositories/human-review-repository";
import type {
  CreateHumanReviewDecisionInput,
  HumanReviewDecisionRecord,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbHumanReviewDecision = {
  id: string;
  clinic_id: string;
  crawl_job_id: string | null;
  score_id: string | null;
  outreach_message_id: string | null;
  decision: HumanReviewDecisionRecord["decision"];
  reviewer_notes: string | null;
  reviewer: string | null;
  reviewed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function mapHumanReviewDecisionRow(row: DbHumanReviewDecision): HumanReviewDecisionRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    crawlJobId: row.crawl_job_id,
    scoreId: row.score_id,
    outreachMessageId: row.outreach_message_id,
    decision: row.decision,
    reviewerNotes: row.reviewer_notes,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Human review decision persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Human review decision persistence is temporarily unavailable.",
};

export function createSupabaseHumanReviewRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): HumanReviewRepository {
  return {
    async recordDecision(input: CreateHumanReviewDecisionInput): Promise<RepoResult<HumanReviewDecisionRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("human_review_decisions")
          .insert({
            clinic_id: input.clinicId,
            crawl_job_id: input.crawlJobId ?? null,
            score_id: input.scoreId ?? null,
            outreach_message_id: input.outreachMessageId ?? null,
            decision: input.decision,
            reviewer_notes: input.reviewerNotes?.slice(0, 4000) ?? null,
            reviewer: input.reviewer?.slice(0, 160) ?? null,
            metadata: input.metadata ?? {},
          })
          .select("*")
          .single<DbHumanReviewDecision>();
        if (error || !data) {
          console.warn("[atria:operations] human_review_decision_record_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapHumanReviewDecisionRow(data) };
      } catch {
        console.warn("[atria:operations] human_review_decision_record_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getLatestDecisionForClinic(clinicId: string): Promise<RepoResult<HumanReviewDecisionRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("human_review_decisions")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("reviewed_at", { ascending: false })
          .limit(1)
          .maybeSingle<DbHumanReviewDecision>();
        if (error) {
          console.warn("[atria:operations] human_review_decision_get_latest_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapHumanReviewDecisionRow(data) : null };
      } catch {
        console.warn("[atria:operations] human_review_decision_get_latest_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listDecisionsForClinic(clinicId: string): Promise<RepoResult<HumanReviewDecisionRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("human_review_decisions")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("reviewed_at", { ascending: false })
          .returns<DbHumanReviewDecision[]>();
        if (error || !data) {
          console.warn("[atria:operations] human_review_decision_list_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data.map(mapHumanReviewDecisionRow) };
      } catch {
        console.warn("[atria:operations] human_review_decision_list_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
