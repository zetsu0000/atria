import type { ExtractionRepository } from "../repositories/extraction-repository";
import type {
  CreateExtractedContentInput,
  ExtractedContentRecord,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbExtractedContent = {
  id: string;
  crawl_job_id: string;
  clinic_id: string | null;
  version: number;
  payload: Record<string, unknown>;
  candidates: ExtractedContentRecord["candidates"];
  review_status: ExtractedContentRecord["reviewStatus"];
  created_at: string;
};

export function mapExtractedContentRow(row: DbExtractedContent): ExtractedContentRecord {
  const payload = row.payload ?? {};
  const schemaVersion = typeof payload.schemaVersion === "string" ? payload.schemaVersion : "unknown";
  return {
    id: row.id,
    crawlJobId: row.crawl_job_id,
    clinicId: row.clinic_id,
    version: row.version,
    schemaVersion,
    payload,
    candidates: row.candidates ?? [],
    // review_status is never written as "approved" by this adapter (see
    // saveExtractedContent); requiresHumanReview is derived, not stored.
    requiresHumanReview: row.review_status !== "approved",
    reviewStatus: row.review_status,
    createdAt: row.created_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Extraction persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Extraction persistence is temporarily unavailable.",
};

export function createSupabaseExtractionRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): ExtractionRepository {
  return {
    async saveExtractedContent(input: CreateExtractedContentInput): Promise<RepoResult<ExtractedContentRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        let version = input.version;
        if (version == null) {
          const { data: latest } = await client
            .from("extracted_content")
            .select("version")
            .eq("crawl_job_id", input.crawlJobId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle<{ version: number }>();
          version = (latest?.version ?? 0) + 1;
        }

        const { data, error } = await client
          .from("extracted_content")
          .insert({
            crawl_job_id: input.crawlJobId,
            clinic_id: input.clinicId ?? null,
            version,
            payload: { ...(input.payload ?? {}), schemaVersion: input.schemaVersion },
            candidates: input.candidates,
            // Extraction candidates are never facts — always persisted as
            // pending_review regardless of caller input. Approval is a
            // separate, explicit human-review action outside this adapter.
            review_status: "pending_review",
          })
          .select("*")
          .single<DbExtractedContent>();
        if (error || !data) {
          console.warn("[atria:operations] extracted_content_save_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapExtractedContentRow(data) };
      } catch {
        console.warn("[atria:operations] extracted_content_save_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getLatestForCrawlJob(crawlJobId: string): Promise<RepoResult<ExtractedContentRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("extracted_content")
          .select("*")
          .eq("crawl_job_id", crawlJobId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle<DbExtractedContent>();
        if (error) {
          console.warn("[atria:operations] extracted_content_get_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapExtractedContentRow(data) : null };
      } catch {
        console.warn("[atria:operations] extracted_content_get_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
