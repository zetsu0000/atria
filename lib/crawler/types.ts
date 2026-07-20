import type { CrawlErrorCode } from "./errors";

export const CRAWL_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;

export type CrawlJobStatus = (typeof CRAWL_JOB_STATUSES)[number];

/** PRODUCT / PROJECT_CRAWLER initial budget. */
export const DEFAULT_MAX_PAGES = 8;
export const HARD_MAX_PAGES = 20;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const HARD_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const HARD_MAX_REDIRECTS = 5;
export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_REQUEST_DELAY_MS = 250;
export const HARD_MAX_MAIN_TEXT_CHARS = 50_000;
export const CRAWLER_USER_AGENT = "AtriaPreviewBot/1.0";
export const CRAWLER_ACCEPT =
  "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1";

export type ValidatedPublicUrl = {
  href: string;
  origin: string;
  hostname: string;
  pathname: string;
  protocol: "http:" | "https:";
  port: string;
};

export type ParsedPageContent = {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  headings: string[];
  mainText: string | null;
  linksInternal: string[];
  language: string | null;
};

export type FetchedPage = {
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  bodyText: string;
  fetchDurationMs: number;
};

export type CrawlPageRecord = {
  url: string;
  normalizedUrl: string;
  path: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  headings: string[];
  mainText: string | null;
  linksInternal: string[];
  contentHash: string | null;
  fetchDurationMs: number | null;
  fetchedAt: string | null;
  errorCode: CrawlErrorCode | null;
};

export type CrawlFindingInput = {
  category: "security" | "robots" | "fetch" | "parse" | "content" | "ops";
  severity: "info" | "low" | "medium" | "high";
  code: string;
  summary: string;
  details?: Record<string, unknown>;
  pageUrl?: string | null;
};

export type CrawlJobRecord = {
  id: string;
  leadId: string;
  requestedUrl: string;
  normalizedOrigin: string;
  status: CrawlJobStatus;
  maxPages: number;
  pagesDiscovered: number;
  pagesFetched: number;
  pagesFailed: number;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrawlJobInput = {
  leadId: string;
  requestedUrl: string;
  maxPages?: number;
};

export type RunCrawlInput = {
  jobId: string;
  /** Injectable for tests */
  fetchImpl?: typeof fetch;
  lookupImpl?: (
    hostname: string,
  ) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
  delayMs?: number;
};
