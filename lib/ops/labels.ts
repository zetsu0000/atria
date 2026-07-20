import type { CrawlJobStatus } from "@/lib/crawler/types";
import type { LeadStatus } from "@/lib/leads/status";

export function leadStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    new: "Novo",
    contacted: "Contatado",
    qualified: "Qualificado",
    crawl_pending: "Crawl pendente",
    crawling: "Em crawl",
    crawl_complete: "Crawl concluído",
    preview_in_progress: "Prévia em progresso",
    preview_ready: "Prévia pronta",
    approved: "Aprovado",
    published: "Publicado",
    lost: "Perdido",
    archived: "Arquivado",
    replied: "Respondeu",
    meeting: "Reunião",
    proposal: "Proposta",
    won: "Ganho",
    do_not_contact: "Não contatar",
  };
  return labels[status] ?? status;
}

export function crawlStatusLabel(status: CrawlJobStatus | null | undefined): string {
  if (!status) return "Sem crawl";
  const labels: Record<CrawlJobStatus, string> = {
    pending: "Pendente",
    running: "Em execução",
    completed: "Concluído",
    partial: "Parcial",
    failed: "Falhou",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Sanitize operator-facing errors — never leak provider internals. */
export function sanitizeOperatorError(message: string | null | undefined): string {
  if (!message) return "Não foi possível concluir a operação.";
  const trimmed = message.trim().replace(/\s+/g, " ").slice(0, 180);
  const lowered = trimmed.toLowerCase();
  if (
    lowered.includes("stack") ||
    lowered.includes("supabase") ||
    lowered.includes("postgres") ||
    lowered.includes("service role") ||
    lowered.includes("jwt") ||
    lowered.includes("api key")
  ) {
    return "Não foi possível concluir a operação. Tente novamente.";
  }
  return trimmed || "Não foi possível concluir a operação.";
}
