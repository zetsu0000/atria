import type { CrawlJobRecord } from "@/lib/crawler/types";
import type { OperationalLead } from "@/lib/leads/query";
import {
  canTransitionLeadStatus,
  isLeadStatus,
  listAllowedTransitions,
  type LeadStatus,
} from "@/lib/leads/status";
import { sanitizeOperatorError } from "@/lib/ops/labels";
import type { OperatorAuthResult } from "@/lib/ops/operator-auth";

export type MutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type MutationDeps = {
  requireOperator: () => Promise<OperatorAuthResult>;
  getLead: (
    leadId: string,
  ) => Promise<
    | { ok: true; lead: OperationalLead }
    | { ok: false; reason: string; message?: string }
  >;
  updateLeadStatus: (input: {
    leadId: string;
    toStatus: LeadStatus;
    actorType: "operator";
    actorIdentifier: string;
    reason: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  createCrawlJob: (input: {
    leadId: string;
    requestedUrl: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  getCrawlJob: (
    jobId: string,
  ) => Promise<
    | { ok: true; job: CrawlJobRecord }
    | { ok: false; reason: string }
  >;
  executeCrawlJob: (
    jobId: string,
  ) => Promise<{ ok: true } | { ok: false; message?: string }>;
  cancelCrawlJob: (
    jobId: string,
  ) => Promise<
    | { ok: true }
    | { ok: false; reason: string }
  >;
  reviewFixturesEnabled?: boolean;
};

async function authorize(
  deps: MutationDeps,
): Promise<MutationResult | { ok: true; email: string }> {
  if (deps.reviewFixturesEnabled) {
    return {
      ok: false,
      message:
        "Modo de revisão local: mutações estão desabilitadas. Use sessão real de operador.",
    };
  }
  const auth = await deps.requireOperator();
  if (!auth.ok) return { ok: false, message: auth.message };
  return { ok: true, email: auth.operator.email };
}

export async function mutateUpdateLeadStatus(
  input: { leadId: string; toStatus: string },
  deps: MutationDeps,
): Promise<MutationResult> {
  const auth = await authorize(deps);
  if (!auth.ok || !("email" in auth)) return auth;

  if (!isLeadStatus(input.toStatus)) {
    return { ok: false, message: "Status inválido." };
  }

  const leadResult = await deps.getLead(input.leadId);
  if (!leadResult.ok) {
    return {
      ok: false,
      message:
        leadResult.reason === "not_found"
          ? "Lead não encontrado."
          : "Não foi possível carregar o lead.",
    };
  }

  const allowed = listAllowedTransitions(leadResult.lead.status);
  if (
    !allowed.includes(input.toStatus) ||
    !canTransitionLeadStatus(leadResult.lead.status, input.toStatus)
  ) {
    return { ok: false, message: "Transição de status não permitida." };
  }

  const result = await deps.updateLeadStatus({
    leadId: input.leadId,
    toStatus: input.toStatus,
    actorType: "operator",
    actorIdentifier: auth.email.slice(0, 160),
    reason: "Atualização pela área operacional",
  });

  if (!result.ok) {
    return { ok: false, message: sanitizeOperatorError(result.message) };
  }
  return { ok: true, message: "Status atualizado." };
}

export async function mutateCreateCrawlJob(
  input: { leadId: string },
  deps: MutationDeps,
): Promise<MutationResult> {
  const auth = await authorize(deps);
  if (!auth.ok || !("email" in auth)) return auth;

  const leadResult = await deps.getLead(input.leadId);
  if (!leadResult.ok) {
    return {
      ok: false,
      message:
        leadResult.reason === "not_found"
          ? "Lead não encontrado."
          : "Não foi possível carregar o lead.",
    };
  }

  const created = await deps.createCrawlJob({
    leadId: leadResult.lead.id,
    requestedUrl: leadResult.lead.websiteUrl,
  });
  if (!created.ok) {
    return { ok: false, message: sanitizeOperatorError(created.message) };
  }
  return { ok: true, message: "Crawl criado e marcado como pendente." };
}

export async function mutateExecuteCrawlJob(
  input: { leadId: string; jobId: string },
  deps: MutationDeps,
): Promise<MutationResult> {
  const auth = await authorize(deps);
  if (!auth.ok || !("email" in auth)) return auth;

  const jobResult = await deps.getCrawlJob(input.jobId);
  if (!jobResult.ok) {
    return { ok: false, message: "Job de crawl não encontrado." };
  }
  if (jobResult.job.leadId !== input.leadId) {
    return { ok: false, message: "Job não pertence a este lead." };
  }
  if (jobResult.job.status !== "pending") {
    return { ok: false, message: "Somente jobs pendentes podem ser executados." };
  }

  const executed = await deps.executeCrawlJob(input.jobId);
  if (!executed.ok) {
    return {
      ok: false,
      message: sanitizeOperatorError(
        executed.message ?? "Falha ao executar crawl.",
      ),
    };
  }
  return { ok: true, message: "Crawl executado." };
}

export async function mutateCancelCrawlJob(
  input: { leadId: string; jobId: string },
  deps: MutationDeps,
): Promise<MutationResult> {
  const auth = await authorize(deps);
  if (!auth.ok || !("email" in auth)) return auth;

  const jobResult = await deps.getCrawlJob(input.jobId);
  if (!jobResult.ok) {
    return { ok: false, message: "Job de crawl não encontrado." };
  }
  if (jobResult.job.leadId !== input.leadId) {
    return { ok: false, message: "Job não pertence a este lead." };
  }

  const cancelled = await deps.cancelCrawlJob(input.jobId);
  if (!cancelled.ok) {
    const message =
      cancelled.reason === "job_not_pending"
        ? "Somente jobs pendentes podem ser cancelados."
        : "Não foi possível cancelar o crawl.";
    return { ok: false, message };
  }
  return { ok: true, message: "Crawl cancelado." };
}
