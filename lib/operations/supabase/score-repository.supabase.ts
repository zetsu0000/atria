import type { ScoreRepository } from "../repositories/score-repository";
import type { CreateScoreInput, RepoResult, ScoreRecord } from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbScore = {
  id: string;
  crawl_job_id: string | null;
  clinic_id: string | null;
  credibility: number;
  clarity: number;
  mobile: number;
  actionability: number;
  freshness: number;
  total: number;
  evidence: ScoreRecord["evidence"];
  disclaimer: string;
  review_status: ScoreRecord["reviewStatus"];
  scoring_version: string;
  created_at: string;
  updated_at: string;
};

export function mapScoreRow(row: DbScore): ScoreRecord {
  return {
    id: row.id,
    crawlJobId: row.crawl_job_id,
    clinicId: row.clinic_id,
    credibility: row.credibility,
    clarity: row.clarity,
    mobile: row.mobile,
    actionability: row.actionability,
    freshness: row.freshness,
    total: row.total,
    evidence: row.evidence ?? [],
    disclaimer: row.disclaimer,
    reviewStatus: row.review_status,
    scoringVersion: row.scoring_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Score persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Score persistence is temporarily unavailable.",
};

export function createSupabaseScoreRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): ScoreRepository {
  return {
    async saveScore(input: CreateScoreInput): Promise<RepoResult<ScoreRecord>> {
      if (!input.crawlJobId && !input.clinicId) {
        return { ok: false, reason: "validation", message: "Score requires a crawl job or clinic." };
      }
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("scores")
          .insert({
            crawl_job_id: input.crawlJobId ?? null,
            clinic_id: input.clinicId ?? null,
            credibility: input.score.credibility,
            clarity: input.score.clarity,
            mobile: input.score.mobile,
            actionability: input.score.actionability,
            freshness: input.score.freshness,
            total: input.score.total,
            evidence: input.score.evidence,
            disclaimer: input.score.disclaimer,
            // Never persisted as "approved" from this path — a score is
            // only marked approved/adjusted by a later, explicit review
            // action, never at creation time.
            review_status: input.score.reviewStatus === "approved" ? "pending_review" : input.score.reviewStatus,
            scoring_version: input.score.scoringVersion,
          })
          .select("*")
          .single<DbScore>();
        if (error || !data) {
          console.warn("[atria:operations] score_save_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapScoreRow(data) };
      } catch {
        console.warn("[atria:operations] score_save_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getLatestForClinic(clinicId: string): Promise<RepoResult<ScoreRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("scores")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<DbScore>();
        if (error) {
          console.warn("[atria:operations] score_get_for_clinic_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapScoreRow(data) : null };
      } catch {
        console.warn("[atria:operations] score_get_for_clinic_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getForCrawlJob(crawlJobId: string): Promise<RepoResult<ScoreRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("scores")
          .select("*")
          .eq("crawl_job_id", crawlJobId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<DbScore>();
        if (error) {
          console.warn("[atria:operations] score_get_for_crawl_job_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapScoreRow(data) : null };
      } catch {
        console.warn("[atria:operations] score_get_for_crawl_job_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
