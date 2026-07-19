export const CRAWL_ERROR_CODES = [
  "invalid_url",
  "blocked_host",
  "robots_denied",
  "dns_failed",
  "timeout",
  "redirect_blocked",
  "response_too_large",
  "unsupported_content_type",
  "http_error",
  "parse_failed",
  "persistence_failed",
  "page_limit_reached",
  "unexpected_error",
  "cancelled",
  "job_not_found",
  "job_not_pending",
  "configuration",
] as const;

export type CrawlErrorCode = (typeof CRAWL_ERROR_CODES)[number];

export const SAFE_ERROR_MESSAGES: Record<CrawlErrorCode, string> = {
  invalid_url: "The requested URL is invalid.",
  blocked_host: "The host is not allowed for crawling.",
  robots_denied: "robots.txt denies crawling this resource.",
  dns_failed: "DNS resolution failed for the host.",
  timeout: "The request timed out.",
  redirect_blocked: "A redirect target was blocked.",
  response_too_large: "The response exceeded the size limit.",
  unsupported_content_type: "The content type is not supported.",
  http_error: "The remote server returned an HTTP error.",
  parse_failed: "The page could not be parsed safely.",
  persistence_failed: "Crawl results could not be stored.",
  page_limit_reached: "The page limit for this job was reached.",
  unexpected_error: "An unexpected crawl error occurred.",
  cancelled: "The crawl job was cancelled.",
  job_not_found: "Crawl job not found.",
  job_not_pending: "Crawl job is not in a runnable state.",
  configuration: "Crawler persistence is not configured.",
};

export function safeErrorMessage(code: CrawlErrorCode): string {
  return SAFE_ERROR_MESSAGES[code];
}
