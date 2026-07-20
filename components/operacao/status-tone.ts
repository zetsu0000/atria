import type { CrawlJobStatus } from "@/lib/crawler/types";
import type { LeadStatus } from "@/lib/leads/status";

export function leadTone(status: LeadStatus): "ok" | "warn" | "err" | "neutral" {
  if (status === "published" || status === "approved" || status === "preview_ready") {
    return "ok";
  }
  if (status === "lost" || status === "do_not_contact") return "err";
  if (
    status === "crawl_pending" ||
    status === "crawling" ||
    status === "preview_in_progress"
  ) {
    return "warn";
  }
  return "neutral";
}

export function crawlTone(
  status: CrawlJobStatus | null | undefined,
): "ok" | "warn" | "err" | "neutral" {
  if (!status) return "neutral";
  if (status === "completed") return "ok";
  if (status === "failed") return "err";
  if (status === "pending" || status === "running" || status === "partial") {
    return "warn";
  }
  return "neutral";
}
