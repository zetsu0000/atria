/**
 * Captures homepage desktop + mobile screenshots and persists their
 * metadata to `scan_assets` — metadata only, never binary bytes in
 * Postgres. Uploads to Supabase Storage only when a bucket is explicitly
 * configured; otherwise persists metadata with an empty `storage_path` and
 * `metadata.captureStatus: "pending_storage"`.
 *
 * `storage_path` is `not null` in the physical `scan_assets` schema (see
 * supabase/migrations/20260720120000_discovery_clinic_score_foundation.sql).
 * Rather than add a migration to make it nullable, "no path yet" is
 * represented as an empty string at the DB layer — conceptually null,
 * physically `""` — with the real state carried in `metadata.captureStatus`
 * and this module's own return type (`storagePath: string | null`).
 *
 * `asset_type` is constrained by the DB to `screenshot_desktop` /
 * `screenshot_mobile` / `other` — this module reuses those existing values
 * (adapting to the schema) rather than introducing new ones; `metadata.pageKind`
 * records that these are specifically homepage screenshots.
 *
 * Never throws: a capture or upload failure is persisted as a safe fallback
 * outcome and reported back, so the calling pipeline can continue as
 * `partial` rather than fail the whole job.
 *
 * Size-aware upload: `metadata.originalSizeBytes` / `optimizedSizeBytes` /
 * `optimizationStrategy` are always recorded for a successful capture (see
 * lib/crawler/screenshot-capture.ts for how the optional, bounded,
 * dependency-free height-reduction retry works). An upload is never even
 * attempted for a screenshot still over MAX_SCREENSHOT_UPLOAD_BYTES after
 * that — it goes straight to `storage_failed` with a specific reason,
 * never a wasted network call.
 */
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ScanAssetRecord } from "@/lib/operations/repositories/types";
import { getOperationsServiceClient } from "@/lib/operations/supabase/server-client";
import type { LeadCaptureEnv } from "@/lib/security/env";
import type { ScanAssetType } from "@/lib/crawler/screenshot-metadata";
import type { CaptureScreenshotResult, ScreenshotCaptureImpl, ScreenshotViewport } from "@/lib/crawler/screenshot-capture";
import { MAX_SCREENSHOT_UPLOAD_BYTES, viewportDimensions } from "@/lib/crawler/screenshot-capture";

/**
 * Expected private Supabase Storage bucket name for crawler screenshots.
 * Never created automatically by this module — see
 * supabase/migrations/*_crawler_screenshots_bucket.sql for the additive,
 * private (public: false) bucket-creation migration, and
 * docs/technical/crawler-screenshot-storage-bucket.md for manual setup.
 * Overridable via the SCREENSHOT_STORAGE_BUCKET env var
 * (lib/security/env.ts's readScreenshotStorageEnv) or the
 * --screenshot-storage-bucket CLI flag, which takes precedence.
 */
export const DEFAULT_SCREENSHOT_STORAGE_BUCKET = "crawler-screenshots";

export type ScreenshotUploadResult = { ok: true } | { ok: false; message: string };
export type ScreenshotUploadFn = (params: {
  path: string;
  buffer: Buffer;
  contentType: string;
}) => Promise<ScreenshotUploadResult>;

export type ScreenshotStorageConfig =
  | { configured: false }
  | { configured: true; bucketName: string; upload: ScreenshotUploadFn };

export type CaptureStatus = "captured" | "pending_storage" | "capture_failed" | "storage_failed";

export type ScreenshotAssetOutcome = {
  viewport: ScreenshotViewport;
  assetType: ScanAssetType;
  captureStatus: CaptureStatus;
  storagePath: string | null;
  asset: ScanAssetRecord | null;
  message?: string;
};

export type CaptureAndPersistScreenshotsInput = {
  clinicId: string | null;
  crawlJobId: string;
  sourceUrl: string;
  timeoutMs?: number;
  storage: ScreenshotStorageConfig;
};

export type CaptureAndPersistScreenshotsDeps = {
  crawlRepo: CrawlRepository;
  captureScreenshot: ScreenshotCaptureImpl;
};

const VIEWPORTS: ScreenshotViewport[] = ["desktop", "mobile"];

function assetTypeFor(viewport: ScreenshotViewport): ScanAssetType {
  return viewport === "desktop" ? "screenshot_desktop" : "screenshot_mobile";
}

function storagePathFor(crawlJobId: string, viewport: ScreenshotViewport): string {
  return `private/scan-assets/${crawlJobId}/${viewport}.png`;
}

/** Extracted once per successful capture and included in every metadata write below, regardless of outcome (pending_storage/storage_failed/captured). */
function optimizationMetadataFor(captured: Extract<CaptureScreenshotResult, { ok: true }>) {
  return {
    originalSizeBytes: captured.originalSizeBytes,
    optimizedSizeBytes: captured.optimizedSizeBytes,
    optimizationStrategy: captured.optimizationStrategy,
  };
}

export async function captureAndPersistScreenshots(
  input: CaptureAndPersistScreenshotsInput,
  deps: CaptureAndPersistScreenshotsDeps,
): Promise<ScreenshotAssetOutcome[]> {
  const outcomes: ScreenshotAssetOutcome[] = [];

  for (const viewport of VIEWPORTS) {
    const assetType = assetTypeFor(viewport);
    const dims = viewportDimensions(viewport);

    let captured: CaptureScreenshotResult;
    try {
      captured = await deps.captureScreenshot({ url: input.sourceUrl, viewport, timeoutMs: input.timeoutMs });
    } catch {
      captured = { ok: false, code: "capture_failed", message: "Screenshot capture threw an unexpected error." };
    }

    if (!captured.ok) {
      const saved = await deps.crawlRepo.saveAsset({
        crawlJobId: input.crawlJobId,
        assetType,
        storagePath: "",
        contentType: null,
        widthPx: dims.widthPx,
        heightPx: dims.heightPx,
        pageUrl: input.sourceUrl,
        reviewStatus: "pending_review",
        metadata: {
          pageKind: "homepage",
          clinicId: input.clinicId,
          captureStatus: "capture_failed",
          captureFailureCode: captured.code,
          capturedAt: null,
        },
      });
      outcomes.push({
        viewport,
        assetType,
        captureStatus: "capture_failed",
        storagePath: null,
        asset: saved.ok ? saved.value : null,
        message: captured.message,
      });
      continue;
    }

    const capturedAt = new Date().toISOString();

    if (!input.storage.configured) {
      const saved = await deps.crawlRepo.saveAsset({
        crawlJobId: input.crawlJobId,
        assetType,
        storagePath: "",
        contentType: captured.contentType,
        widthPx: captured.widthPx,
        heightPx: captured.heightPx,
        pageUrl: input.sourceUrl,
        reviewStatus: "pending_review",
        metadata: {
          pageKind: "homepage",
          clinicId: input.clinicId,
          captureStatus: "pending_storage",
          capturedAt,
          ...optimizationMetadataFor(captured),
        },
      });
      outcomes.push({
        viewport,
        assetType,
        captureStatus: "pending_storage",
        storagePath: null,
        asset: saved.ok ? saved.value : null,
      });
      continue;
    }

    // Never even attempt an upload over the bucket's own size limit — a
    // doomed request only wastes a network round trip and surfaces as a
    // vague provider-side error. This is checked after capture-time
    // optimization already had its one bounded attempt (see
    // lib/crawler/screenshot-capture.ts) — if it's still oversized here,
    // that attempt didn't get it under the limit, and this is where that
    // is turned into a specific, honest storage_failed reason.
    if (captured.buffer.length > MAX_SCREENSHOT_UPLOAD_BYTES) {
      const saved = await deps.crawlRepo.saveAsset({
        crawlJobId: input.crawlJobId,
        assetType,
        storagePath: "",
        contentType: captured.contentType,
        widthPx: captured.widthPx,
        heightPx: captured.heightPx,
        pageUrl: input.sourceUrl,
        reviewStatus: "pending_review",
        metadata: {
          pageKind: "homepage",
          clinicId: input.clinicId,
          captureStatus: "storage_failed",
          storageError: `Screenshot (${captured.buffer.length} bytes) exceeds the storage bucket's ${MAX_SCREENSHOT_UPLOAD_BYTES}-byte limit even after optimization; upload was not attempted.`,
          capturedAt,
          ...optimizationMetadataFor(captured),
        },
      });
      outcomes.push({
        viewport,
        assetType,
        captureStatus: "storage_failed",
        storagePath: null,
        asset: saved.ok ? saved.value : null,
        message: "Screenshot exceeds the storage bucket's size limit even after optimization.",
      });
      continue;
    }

    const path = storagePathFor(input.crawlJobId, viewport);
    const uploadResult = await input.storage.upload({ path, buffer: captured.buffer, contentType: captured.contentType });

    if (!uploadResult.ok) {
      const saved = await deps.crawlRepo.saveAsset({
        crawlJobId: input.crawlJobId,
        assetType,
        storagePath: "",
        contentType: captured.contentType,
        widthPx: captured.widthPx,
        heightPx: captured.heightPx,
        pageUrl: input.sourceUrl,
        reviewStatus: "pending_review",
        metadata: {
          pageKind: "homepage",
          clinicId: input.clinicId,
          captureStatus: "storage_failed",
          storageError: uploadResult.message,
          capturedAt,
          ...optimizationMetadataFor(captured),
        },
      });
      outcomes.push({
        viewport,
        assetType,
        captureStatus: "storage_failed",
        storagePath: null,
        asset: saved.ok ? saved.value : null,
        message: uploadResult.message,
      });
      continue;
    }

    const saved = await deps.crawlRepo.saveAsset({
      crawlJobId: input.crawlJobId,
      assetType,
      storagePath: path,
      contentType: captured.contentType,
      widthPx: captured.widthPx,
      heightPx: captured.heightPx,
      pageUrl: input.sourceUrl,
      reviewStatus: "pending_review",
      metadata: {
        pageKind: "homepage",
        clinicId: input.clinicId,
        captureStatus: "captured",
        bucketName: input.storage.bucketName,
        capturedAt,
        ...optimizationMetadataFor(captured),
      },
    });
    outcomes.push({
      viewport,
      assetType,
      captureStatus: "captured",
      storagePath: path,
      asset: saved.ok ? saved.value : null,
    });
  }

  return outcomes;
}

/**
 * Uploads to a private Supabase Storage bucket via the service-role client.
 * Never creates the bucket (must already exist and stay private — this
 * pipeline never makes screenshots publicly accessible). Any failure
 * (missing bucket, no client, network error) is reported as a safe
 * `{ ok: false }` result, never thrown.
 */
export function createSupabaseStorageUploader(env: LeadCaptureEnv, bucketName: string): ScreenshotUploadFn {
  return async ({ path, buffer, contentType }) => {
    const client = getOperationsServiceClient(env);
    if (!client) {
      return { ok: false, message: "Storage upload skipped: persistence is not configured." };
    }
    try {
      const { error } = await client.storage.from(bucketName).upload(path, buffer, { contentType, upsert: true });
      if (error) {
        return { ok: false, message: "Storage upload failed." };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Storage upload threw an unexpected error." };
    }
  };
}
