"use server";

import { revalidatePath } from "next/cache";
import {
  canUseReviewFixtures,
  requireOperator,
} from "@/lib/ops/operator-auth";
import {
  mutateCancelCrawlJob,
  mutateCreateCrawlJob,
  mutateExecuteCrawlJob,
  mutateUpdateLeadStatus,
  type MutationResult,
} from "@/lib/ops/mutations";
import {
  opCancelCrawlJob,
  opCreateCrawlJob,
  opExecuteCrawlJob,
  opGetCrawlJob,
} from "@/lib/operations/crawl-operations";
import { opGetLead, opUpdateLeadStatus } from "@/lib/operations/lead-operations";

export type { MutationResult };

function liveDeps() {
  return {
    requireOperator,
    reviewFixturesEnabled: canUseReviewFixtures(),
    getLead: opGetLead,
    updateLeadStatus: opUpdateLeadStatus,
    createCrawlJob: opCreateCrawlJob,
    getCrawlJob: opGetCrawlJob,
    executeCrawlJob: async (jobId: string) => opExecuteCrawlJob({ jobId }),
    cancelCrawlJob: opCancelCrawlJob,
  };
}

function revalidateLeadPaths(leadId: string) {
  revalidatePath("/operacao/leads");
  revalidatePath(`/operacao/leads/${leadId}`);
}

export async function updateLeadStatusAction(input: {
  leadId: string;
  toStatus: string;
}): Promise<MutationResult> {
  const result = await mutateUpdateLeadStatus(input, liveDeps());
  if (result.ok) revalidateLeadPaths(input.leadId);
  return result;
}

export async function createCrawlJobAction(input: {
  leadId: string;
}): Promise<MutationResult> {
  const result = await mutateCreateCrawlJob(input, liveDeps());
  if (result.ok) revalidateLeadPaths(input.leadId);
  return result;
}

export async function executeCrawlJobAction(input: {
  leadId: string;
  jobId: string;
}): Promise<MutationResult> {
  const result = await mutateExecuteCrawlJob(input, liveDeps());
  if (result.ok) revalidateLeadPaths(input.leadId);
  return result;
}

export async function cancelCrawlJobAction(input: {
  leadId: string;
  jobId: string;
}): Promise<MutationResult> {
  const result = await mutateCancelCrawlJob(input, liveDeps());
  if (result.ok) revalidateLeadPaths(input.leadId);
  return result;
}
