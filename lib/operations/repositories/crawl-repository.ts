import type { CrawlErrorCode } from "@/lib/crawler/errors";
import type {
  CrawlFindingInput,
  CrawlJobRecord,
  CrawlPageInput,
  CreateCrawlJobInput,
  CreateScanAssetInput,
  RepoResult,
  ScanAssetRecord,
  UpdateCrawlJobCountersInput,
} from "./types";

/**
 * Persistence for `crawl_jobs`, `crawl_pages`, `crawl_findings`, and
 * `scan_assets` (screenshot/asset metadata only — never binary bytes).
 *
 * `crawl_jobs` supports both the legacy/inbound flow (`leadId` present,
 * `clinicId` optional/derived later) and the discovery/outbound flow
 * (`clinicId` present, `leadId` null until a lead exists). Implementations
 * must reject `createCrawlJob` with a `validation` error when both are
 * missing/null — see the DB check constraint
 * `crawl_jobs_requires_lead_or_clinic` added in
 * `20260720150000_crawl_jobs_lead_or_clinic.sql`, which is the last line of
 * defense if application code ever forgets to check.
 *
 * Error messages returned to callers must always be safe, user-facing
 * strings (see lib/crawler/errors.ts `safeErrorMessage`). Implementations
 * must never surface raw exception messages or stack traces.
 */
export interface CrawlRepository {
  createCrawlJob(input: CreateCrawlJobInput): Promise<RepoResult<CrawlJobRecord>>;

  /** Atomically transitions a pending job to running (start/lock). */
  claimCrawlJob(jobId: string): Promise<RepoResult<CrawlJobRecord>>;

  getCrawlJob(jobId: string): Promise<RepoResult<CrawlJobRecord>>;

  updateCrawlJobCounters(
    jobId: string,
    patch: UpdateCrawlJobCountersInput,
  ): Promise<RepoResult<CrawlJobRecord>>;

  /** Terminal failure transition. `errorCode` is mapped to a safe message internally. */
  failCrawlJob(
    jobId: string,
    errorCode: CrawlErrorCode,
  ): Promise<RepoResult<CrawlJobRecord>>;

  recordPage(jobId: string, page: CrawlPageInput): Promise<RepoResult<void>>;

  recordFinding(
    jobId: string,
    finding: CrawlFindingInput,
  ): Promise<RepoResult<void>>;

  saveAsset(input: CreateScanAssetInput): Promise<RepoResult<ScanAssetRecord>>;
}
