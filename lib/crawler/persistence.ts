import {
  hasPersistenceConfig,
  logConfigWarning,
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";
import { createServiceClient } from "@/lib/supabase/service-client";
import type { CrawlErrorCode } from "./errors";
import { safeErrorMessage } from "./errors";
import type {
  CrawlFindingInput,
  CrawlJobRecord,
  CrawlJobStatus,
  CrawlPageRecord,
  CreateCrawlJobInput,
} from "./types";
import { DEFAULT_MAX_PAGES, HARD_MAX_PAGES } from "./types";
import { parseCreateCrawlJobInput } from "./schema";
import { resolveAndValidatePublicUrl } from "./url-policy";

type DbJob = {
  id: string;
  lead_id: string;
  requested_url: string;
  normalized_origin: string;
  status: CrawlJobStatus;
  max_pages: number;
  pages_discovered: number;
  pages_fetched: number;
  pages_failed: number;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapJob(row: DbJob): CrawlJobRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    requestedUrl: row.requested_url,
    normalizedOrigin: row.normalized_origin,
    status: row.status,
    maxPages: row.max_pages,
    pagesDiscovered: row.pages_discovered,
    pagesFetched: row.pages_fetched,
    pagesFailed: row.pages_failed,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreateJobResult =
  | { ok: true; job: CrawlJobRecord }
  | {
      ok: false;
      reason:
        | "validation"
        | "invalid_url"
        | "blocked_host"
        | "dns_failed"
        | "not_found"
        | "configuration"
        | "unavailable";
      message: string;
      code?: CrawlErrorCode;
    };

export async function createCrawlJob(
  input: CreateCrawlJobInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<CreateJobResult> {
  const parsed = parseCreateCrawlJobInput({
    leadId: input.leadId,
    requestedUrl: input.requestedUrl,
    maxPages: input.maxPages ?? DEFAULT_MAX_PAGES,
  });
  if (!parsed.ok) {
    return { ok: false, reason: "validation", message: parsed.message };
  }

  const maxPages = Math.min(
    Math.max(parsed.data.maxPages, 1),
    HARD_MAX_PAGES,
  );

  const validated = await resolveAndValidatePublicUrl(parsed.data.requestedUrl);
  if (!validated.ok) {
    return {
      ok: false,
      reason:
        validated.code === "dns_failed"
          ? "dns_failed"
          : validated.code === "blocked_host"
            ? "blocked_host"
            : "invalid_url",
      message: validated.message,
      code: validated.code,
    };
  }

  if (!hasPersistenceConfig(env)) {
    logConfigWarning("crawl_create_missing_persistence");
    return {
      ok: false,
      reason: "configuration",
      message: safeErrorMessage("configuration"),
    };
  }

  const client = createServiceClient(env);
  if (!client) {
    return {
      ok: false,
      reason: "configuration",
      message: safeErrorMessage("configuration"),
    };
  }

  try {
    const { data: lead, error: leadError } = await client
      .from("leads")
      .select("id")
      .eq("id", parsed.data.leadId)
      .maybeSingle();

    if (leadError) {
      console.warn("[atria:crawler] lead_lookup_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Unable to create crawl job.",
      };
    }
    if (!lead) {
      return {
        ok: false,
        reason: "not_found",
        message: "Lead not found.",
      };
    }

    const { data, error } = await client
      .from("crawl_jobs")
      .insert({
        lead_id: parsed.data.leadId,
        requested_url: validated.url.href,
        normalized_origin: validated.url.origin,
        status: "pending",
        max_pages: maxPages,
      })
      .select("*")
      .single<DbJob>();

    if (error || !data) {
      console.warn("[atria:crawler] job_create_failed");
      return {
        ok: false,
        reason: "unavailable",
        message: "Unable to create crawl job.",
      };
    }

    return { ok: true, job: mapJob(data) };
  } catch {
    console.warn("[atria:crawler] job_create_exception");
    return {
      ok: false,
      reason: "unavailable",
      message: "Unable to create crawl job.",
    };
  }
}

export async function getCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | { ok: true; job: CrawlJobRecord }
  | { ok: false; reason: "not_found" | "configuration" | "unavailable" }
> {
  if (!hasPersistenceConfig(env)) return { ok: false, reason: "configuration" };
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  try {
    const { data, error } = await client
      .from("crawl_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle<DbJob>();

    if (error) return { ok: false, reason: "unavailable" };
    if (!data) return { ok: false, reason: "not_found" };
    return { ok: true, job: mapJob(data) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function listCrawlJobsForLead(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | { ok: true; jobs: CrawlJobRecord[] }
  | { ok: false; reason: "configuration" | "unavailable" }
> {
  if (!hasPersistenceConfig(env)) return { ok: false, reason: "configuration" };
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  try {
    const { data, error } = await client
      .from("crawl_jobs")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { ok: false, reason: "unavailable" };
    return { ok: true, jobs: (data as DbJob[] | null)?.map(mapJob) ?? [] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function claimCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | { ok: true; job: CrawlJobRecord }
  | {
      ok: false;
      reason: "not_found" | "job_not_pending" | "configuration" | "unavailable";
    }
> {
  if (!hasPersistenceConfig(env)) return { ok: false, reason: "configuration" };
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  const now = new Date().toISOString();
  try {
    const { data, error } = await client
      .from("crawl_jobs")
      .update({ status: "running", started_at: now, error_code: null, error_message: null })
      .eq("id", jobId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle<DbJob>();

    if (error) return { ok: false, reason: "unavailable" };
    if (!data) {
      const existing = await getCrawlJob(jobId, env);
      if (!existing.ok) return existing;
      return { ok: false, reason: "job_not_pending" };
    }
    return { ok: true, job: mapJob(data) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function updateCrawlJobCounters(
  jobId: string,
  patch: {
    pagesDiscovered?: number;
    pagesFetched?: number;
    pagesFailed?: number;
    status?: CrawlJobStatus;
    errorCode?: CrawlErrorCode | null;
    errorMessage?: string | null;
    completedAt?: string | null;
  },
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<boolean> {
  if (!hasPersistenceConfig(env)) return false;
  const client = createServiceClient(env);
  if (!client) return false;

  const row: Record<string, unknown> = {};
  if (patch.pagesDiscovered != null) row.pages_discovered = patch.pagesDiscovered;
  if (patch.pagesFetched != null) row.pages_fetched = patch.pagesFetched;
  if (patch.pagesFailed != null) row.pages_failed = patch.pagesFailed;
  if (patch.status != null) row.status = patch.status;
  if (patch.errorCode !== undefined) row.error_code = patch.errorCode;
  if (patch.errorMessage !== undefined) {
    row.error_message = patch.errorMessage?.slice(0, 500) ?? null;
  }
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;

  try {
    const { error } = await client.from("crawl_jobs").update(row).eq("id", jobId);
    return !error;
  } catch {
    return false;
  }
}

export async function cancelPendingCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | { ok: true; job: CrawlJobRecord }
  | {
      ok: false;
      reason: "not_found" | "job_not_pending" | "configuration" | "unavailable";
    }
> {
  if (!hasPersistenceConfig(env)) return { ok: false, reason: "configuration" };
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  const now = new Date().toISOString();
  try {
    const { data, error } = await client
      .from("crawl_jobs")
      .update({
        status: "cancelled",
        completed_at: now,
        error_code: "cancelled",
        error_message: safeErrorMessage("cancelled"),
      })
      .eq("id", jobId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle<DbJob>();

    if (error) return { ok: false, reason: "unavailable" };
    if (!data) {
      const existing = await getCrawlJob(jobId, env);
      if (!existing.ok) return existing;
      return { ok: false, reason: "job_not_pending" };
    }
    return { ok: true, job: mapJob(data) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function persistCrawlPage(
  jobId: string,
  page: CrawlPageRecord,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<boolean> {
  if (!hasPersistenceConfig(env)) return false;
  const client = createServiceClient(env);
  if (!client) return false;

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
    return !error;
  } catch {
    return false;
  }
}

export async function persistCrawlFinding(
  jobId: string,
  finding: CrawlFindingInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<boolean> {
  if (!hasPersistenceConfig(env)) return false;
  const client = createServiceClient(env);
  if (!client) return false;

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
    return !error;
  } catch {
    return false;
  }
}

export async function listCrawlPages(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<
  | {
      ok: true;
      pages: Array<{
        id: string;
        normalizedUrl: string;
        path: string;
        statusCode: number | null;
        title: string | null;
        errorCode: string | null;
        fetchedAt: string | null;
      }>;
    }
  | { ok: false; reason: "configuration" | "unavailable" }
> {
  if (!hasPersistenceConfig(env)) return { ok: false, reason: "configuration" };
  const client = createServiceClient(env);
  if (!client) return { ok: false, reason: "configuration" };

  try {
    const { data, error } = await client
      .from("crawl_pages")
      .select(
        "id, normalized_url, path, status_code, title, error_code, fetched_at",
      )
      .eq("crawl_job_id", jobId)
      .order("fetched_at", { ascending: true })
      .limit(50);

    if (error) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      pages: (data ?? []).map((row) => ({
        id: row.id as string,
        normalizedUrl: row.normalized_url as string,
        path: row.path as string,
        statusCode: (row.status_code as number | null) ?? null,
        title: (row.title as string | null) ?? null,
        errorCode: (row.error_code as string | null) ?? null,
        fetchedAt: (row.fetched_at as string | null) ?? null,
      })),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Deletes one crawl job and cascaded pages/findings. Does not delete the lead. */
export async function deleteCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<boolean> {
  if (!hasPersistenceConfig(env)) return false;
  const client = createServiceClient(env);
  if (!client) return false;
  try {
    const { error } = await client.from("crawl_jobs").delete().eq("id", jobId);
    return !error;
  } catch {
    return false;
  }
}

/** Deletes all crawl jobs (and cascaded data) for a lead. */
export async function deleteCrawlDataForLead(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): Promise<boolean> {
  if (!hasPersistenceConfig(env)) return false;
  const client = createServiceClient(env);
  if (!client) return false;
  try {
    const { error } = await client
      .from("crawl_jobs")
      .delete()
      .eq("lead_id", leadId);
    return !error;
  } catch {
    return false;
  }
}
