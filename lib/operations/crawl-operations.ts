/**
 * Stable server-side contracts for a future internal UI.
 * Not exposed via public unauthenticated routes.
 */
import {
  cancelPendingCrawlJob,
  createCrawlJob,
  deleteCrawlDataForLead,
  deleteCrawlJob,
  getCrawlJob,
  listCrawlJobsForLead,
  listCrawlPages,
} from "@/lib/crawler/persistence";
import { runCrawlJob } from "@/lib/crawler/run-crawl";
import type { CreateCrawlJobInput, RunCrawlInput } from "@/lib/crawler/types";
import { updateLeadStatus } from "@/lib/leads/status-operations";
import {
  readLeadCaptureEnv,
  type LeadCaptureEnv,
} from "@/lib/security/env";

export async function opCreateCrawlJob(
  input: CreateCrawlJobInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  const created = await createCrawlJob(input, env);
  if (!created.ok) return created;

  // Best-effort: move lead toward crawl_pending when transition allows.
  await updateLeadStatus(
    {
      leadId: input.leadId,
      toStatus: "crawl_pending",
      actorType: "system",
      actorIdentifier: `crawl-job:${created.job.id}`,
      reason: "Crawl job created",
    },
    env,
  );

  return created;
}

export async function opGetCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return getCrawlJob(jobId, env);
}

export async function opListCrawlJobsForLead(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return listCrawlJobsForLead(leadId, env);
}

export async function opExecuteCrawlJob(
  input: RunCrawlInput,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return runCrawlJob(input, env);
}

export async function opCancelCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return cancelPendingCrawlJob(jobId, env);
}

export async function opListCrawlPages(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return listCrawlPages(jobId, env);
}

export async function opDeleteCrawlJob(
  jobId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return deleteCrawlJob(jobId, env);
}

export async function opDeleteCrawlDataForLead(
  leadId: string,
  env: LeadCaptureEnv = readLeadCaptureEnv(),
) {
  return deleteCrawlDataForLead(leadId, env);
}
