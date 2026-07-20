import type { CrawlErrorCode } from "@/lib/crawler/errors";
import { safeErrorMessage } from "@/lib/crawler/errors";
import type { CrawlRepository } from "../repositories/crawl-repository";
import type {
  CrawlFindingInput,
  CrawlJobRecord,
  CrawlPageInput,
  CreateCrawlJobInput,
  CreateScanAssetInput,
  RepoResult,
  ScanAssetRecord,
  UpdateCrawlJobCountersInput,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbCrawlJob = {
  id: string;
  lead_id: string | null;
  clinic_id: string | null;
  requested_url: string;
  normalized_origin: string;
  status: CrawlJobRecord["status"];
  max_pages: number;
  pages_discovered: number;
  pages_fetched: number;
  pages_failed: number;
  requires_human_review: boolean;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DbScanAsset = {
  id: string;
  crawl_job_id: string;
  asset_type: ScanAssetRecord["assetType"];
  storage_path: string;
  content_type: string | null;
  width_px: number | null;
  height_px: number | null;
  page_url: string | null;
  review_status: ScanAssetRecord["reviewStatus"];
  metadata: Record<string, unknown>;
  created_at: string;
};

export function mapCrawlJobRow(row: DbCrawlJob): CrawlJobRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    clinicId: row.clinic_id,
    requestedUrl: row.requested_url,
    normalizedOrigin: row.normalized_origin,
    status: row.status,
    maxPages: row.max_pages,
    pagesDiscovered: row.pages_discovered,
    pagesFetched: row.pages_fetched,
    pagesFailed: row.pages_failed,
    requiresHumanReview: row.requires_human_review,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScanAssetRow(row: DbScanAsset): ScanAssetRecord {
  return {
    id: row.id,
    crawlJobId: row.crawl_job_id,
    assetType: row.asset_type,
    storagePath: row.storage_path,
    contentType: row.content_type,
    widthPx: row.width_px,
    heightPx: row.height_px,
    pageUrl: row.page_url,
    reviewStatus: row.review_status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Crawler persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Crawler persistence is temporarily unavailable.",
};

export function createSupabaseCrawlRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): CrawlRepository {
  return {
    async createCrawlJob(input: CreateCrawlJobInput): Promise<RepoResult<CrawlJobRecord>> {
      if (!input.leadId && !input.clinicId) {
        return {
          ok: false,
          reason: "validation",
          message: "A crawl job requires at least a leadId or a clinicId.",
        };
      }
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("crawl_jobs")
          .insert({
            lead_id: input.leadId ?? null,
            clinic_id: input.clinicId ?? null,
            requested_url: input.requestedUrl.slice(0, 2048),
            normalized_origin: input.normalizedOrigin.slice(0, 2048),
            status: "pending",
            max_pages: input.maxPages ?? 8,
          })
          .select("*")
          .single<DbCrawlJob>();
        if (error || !data) {
          // 23514 = check_violation — defense in depth if the app-level
          // guard above is ever bypassed; the DB constraint
          // `crawl_jobs_requires_lead_or_clinic` is the last line of defense.
          if (error?.code === "23514") {
            return {
              ok: false,
              reason: "validation",
              message: "A crawl job requires at least a leadId or a clinicId.",
            };
          }
          console.warn("[atria:operations] crawl_job_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapCrawlJobRow(data) };
      } catch {
        console.warn("[atria:operations] crawl_job_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async claimCrawlJob(jobId: string): Promise<RepoResult<CrawlJobRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("crawl_jobs")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
            error_code: null,
            error_message: null,
          })
          .eq("id", jobId)
          .eq("status", "pending")
          .select("*")
          .maybeSingle<DbCrawlJob>();
        if (error) {
          console.warn("[atria:operations] crawl_job_claim_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) {
          const { data: existing } = await client
            .from("crawl_jobs")
            .select("*")
            .eq("id", jobId)
            .maybeSingle<DbCrawlJob>();
          if (!existing) return { ok: false, reason: "not_found", message: "Crawl job not found." };
          return { ok: false, reason: "conflict", message: "Crawl job is not pending." };
        }
        return { ok: true, value: mapCrawlJobRow(data) };
      } catch {
        console.warn("[atria:operations] crawl_job_claim_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getCrawlJob(jobId: string): Promise<RepoResult<CrawlJobRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("crawl_jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle<DbCrawlJob>();
        if (error) {
          console.warn("[atria:operations] crawl_job_get_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Crawl job not found." };
        return { ok: true, value: mapCrawlJobRow(data) };
      } catch {
        console.warn("[atria:operations] crawl_job_get_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async updateCrawlJobCounters(
      jobId: string,
      patch: UpdateCrawlJobCountersInput,
    ): Promise<RepoResult<CrawlJobRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      const row: Record<string, unknown> = {};
      if (patch.pagesDiscovered != null) row.pages_discovered = patch.pagesDiscovered;
      if (patch.pagesFetched != null) row.pages_fetched = patch.pagesFetched;
      if (patch.pagesFailed != null) row.pages_failed = patch.pagesFailed;
      if (patch.status != null) row.status = patch.status;
      if (patch.errorCode !== undefined) row.error_code = patch.errorCode;
      if (patch.errorMessage !== undefined) {
        // Never persist raw exception text — callers must pass safe messages
        // (see lib/crawler/errors.ts `safeErrorMessage`).
        row.error_message = patch.errorMessage?.slice(0, 500) ?? null;
      }
      if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;

      try {
        const { data, error } = await client
          .from("crawl_jobs")
          .update(row)
          .eq("id", jobId)
          .select("*")
          .maybeSingle<DbCrawlJob>();
        if (error) {
          console.warn("[atria:operations] crawl_job_update_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Crawl job not found." };
        return { ok: true, value: mapCrawlJobRow(data) };
      } catch {
        console.warn("[atria:operations] crawl_job_update_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async failCrawlJob(jobId: string, errorCode: CrawlErrorCode): Promise<RepoResult<CrawlJobRecord>> {
      return this.updateCrawlJobCounters(jobId, {
        status: "failed",
        errorCode,
        errorMessage: safeErrorMessage(errorCode),
        completedAt: new Date().toISOString(),
      });
    },

    async recordPage(jobId: string, page: CrawlPageInput): Promise<RepoResult<void>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { error } = await client.from("crawl_pages").upsert(
          {
            crawl_job_id: jobId,
            url: page.url.slice(0, 2048),
            normalized_url: page.normalizedUrl.slice(0, 2048),
            path: page.path.slice(0, 2048),
            status_code: page.statusCode,
            content_type: page.contentType?.slice(0, 160) ?? null,
            title: page.title?.slice(0, 500) ?? null,
            meta_description: page.metaDescription?.slice(0, 1000) ?? null,
            canonical_url: page.canonicalUrl?.slice(0, 2048) ?? null,
            headings: page.headings,
            main_text: page.mainText,
            links_internal: page.linksInternal,
            content_hash: page.contentHash,
            fetch_duration_ms: page.fetchDurationMs,
            fetched_at: page.fetchedAt,
            error_code: page.errorCode,
          },
          { onConflict: "crawl_job_id,normalized_url" },
        );
        if (error) {
          console.warn("[atria:operations] crawl_page_record_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: undefined };
      } catch {
        console.warn("[atria:operations] crawl_page_record_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async recordFinding(jobId: string, finding: CrawlFindingInput): Promise<RepoResult<void>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { error } = await client.from("crawl_findings").insert({
          crawl_job_id: jobId,
          category: finding.category,
          severity: finding.severity,
          code: finding.code.slice(0, 64),
          summary: finding.summary.slice(0, 500),
          details: finding.details ?? {},
          page_url: finding.pageUrl?.slice(0, 2048) ?? null,
        });
        if (error) {
          console.warn("[atria:operations] crawl_finding_record_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: undefined };
      } catch {
        console.warn("[atria:operations] crawl_finding_record_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async saveAsset(input: CreateScanAssetInput): Promise<RepoResult<ScanAssetRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("scan_assets")
          .insert({
            crawl_job_id: input.crawlJobId,
            asset_type: input.assetType,
            storage_path: input.storagePath.slice(0, 1024),
            content_type: input.contentType?.slice(0, 160) ?? null,
            width_px: input.widthPx,
            height_px: input.heightPx,
            page_url: input.pageUrl?.slice(0, 2048) ?? null,
            review_status: input.reviewStatus,
            metadata: input.metadata ?? {},
          })
          .select("*")
          .single<DbScanAsset>();
        if (error || !data) {
          console.warn("[atria:operations] scan_asset_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapScanAssetRow(data) };
      } catch {
        console.warn("[atria:operations] scan_asset_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
