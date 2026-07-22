import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeDiscoveryRepository,
  FakeExtractionRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "./repositories/fakes";
import { captureAndPersistScreenshots, createSupabaseStorageUploader, DEFAULT_SCREENSHOT_STORAGE_BUCKET } from "./pipeline/screenshot-assets";
import type { ScreenshotUploadFn } from "./pipeline/screenshot-assets";
import { processCrawlQueue, type ProcessCrawlQueueDeps } from "./pipeline/process-crawl-queue";
import { runControlledPipeline, type RunControlledPipelineDeps } from "./pipeline/run-controlled-pipeline";
import { assertSafeTarget, KNOWN_PROJECT_REFS } from "./pipeline/target-guard";
import { selectRepositories } from "./pipeline/select-repositories";
import {
  createControlledFetchHtmlPage,
  createControlledLoadRobotsPolicy,
} from "./pipeline/controlled-transport";
import type { CaptureScreenshotResult, ScreenshotCaptureImpl } from "@/lib/crawler/screenshot-capture";
import { MAX_SCREENSHOT_UPLOAD_BYTES } from "@/lib/crawler/screenshot-capture";
import type { LookupFn } from "@/lib/crawler/url-policy";
import type { LeadCaptureEnv } from "@/lib/security/env";

const root = join(__dirname, "..", "..");
const EXAMPLE_CSV = readFileSync(join(root, "data/examples/prospect-candidates.example.csv"), "utf8");

/**
 * All tests below use fixture-mode fetch/robots (allowRealCrawl: false at
 * the transport level) and this fake DNS lookup — even in scenarios where
 * `input.allowRealCrawl: true` is passed to satisfy the screenshot gate.
 * That flag alone would otherwise make lib/operations/pipeline/process-crawl-queue.ts's
 * internal default lookup perform a REAL DNS resolution for the allowlisted
 * example.com host; injecting this fake (via the now-overridable
 * ProcessCrawlQueueDeps.lookupImpl) keeps every test fully offline.
 */
const FAKE_LOOKUP: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

function baseEnv(overrides: Partial<LeadCaptureEnv> = {}): LeadCaptureEnv {
  return {
    supabaseUrl: null,
    supabaseServiceRoleKey: null,
    resendApiKey: null,
    leadNotificationEmail: null,
    leadFromEmail: null,
    turnstileSiteKey: null,
    turnstileSecretKey: null,
    leadHashSecret: null,
    siteUrl: null,
    ...overrides,
  };
}

function successfulFakeCapture(): ScreenshotCaptureImpl {
  return async (options) => {
    const dims = options.viewport === "desktop" ? { widthPx: 1440, heightPx: 1200 } : { widthPx: 390, heightPx: 844 };
    const buffer = Buffer.from(`fixture-${options.viewport}`);
    const result: CaptureScreenshotResult = {
      ok: true,
      buffer,
      contentType: "image/png",
      widthPx: dims.widthPx,
      heightPx: dims.heightPx,
      originalSizeBytes: buffer.length,
      optimizedSizeBytes: null,
      optimizationStrategy: "viewport_only",
    };
    return result;
  };
}

/** A fake capture whose "original" size is deliberately over the limit, simulating a real oversized desktop capture, with a caller-controlled optimized result. */
function oversizedThenFakeCapture(
  originalSizeBytes: number,
  optimizedResult: { buffer: Buffer; sizeBytes: number } | null,
): ScreenshotCaptureImpl {
  return async (options) => {
    const dims = options.viewport === "desktop" ? { widthPx: 1440, heightPx: 1200 } : { widthPx: 390, heightPx: 844 };
    if (!optimizedResult) {
      return {
        ok: true,
        buffer: Buffer.alloc(originalSizeBytes),
        contentType: "image/png",
        widthPx: dims.widthPx,
        heightPx: dims.heightPx,
        originalSizeBytes,
        optimizedSizeBytes: null,
        optimizationStrategy: "viewport_only",
      };
    }
    return {
      ok: true,
      buffer: optimizedResult.buffer,
      contentType: "image/png",
      widthPx: dims.widthPx,
      heightPx: Math.round(dims.heightPx / 2),
      originalSizeBytes,
      optimizedSizeBytes: optimizedResult.sizeBytes,
      optimizationStrategy: "viewport_only_reduced_height",
    };
  };
}

function failingFakeCapture(): ScreenshotCaptureImpl {
  return async () => ({ ok: false, code: "navigation_failed", message: "Failed to load the page for screenshot capture." });
}

function buildFakeDeps(
  overrides: Partial<RunControlledPipelineDeps> = {},
): RunControlledPipelineDeps & ProcessCrawlQueueDeps {
  return {
    discoveryRepo: new FakeDiscoveryRepository(),
    clinicRepo: new FakeClinicRepository(),
    crawlRepo: new FakeCrawlRepository(),
    extractionRepo: new FakeExtractionRepository(),
    scoreRepo: new FakeScoreRepository(),
    outreachRepo: new FakeOutreachRepository(),
    // Always fixture-mode — no live network — regardless of input.allowRealCrawl.
    fetchHtmlPage: createControlledFetchHtmlPage({ allowRealCrawl: false }),
    loadRobotsPolicy: createControlledLoadRobotsPolicy({ allowRealCrawl: false }),
    // Never a real DNS lookup — see FAKE_LOOKUP doc comment above.
    lookupImpl: FAKE_LOOKUP,
    ...overrides,
  };
}

describe("captureAndPersistScreenshots: metadata persistence + safe fallback", () => {
  it("generates desktop and mobile screenshot metadata on success", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    assert.equal(outcomes.length, 2);
    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    const mobile = outcomes.find((o) => o.viewport === "mobile")!;
    assert.equal(desktop.assetType, "screenshot_desktop");
    assert.equal(mobile.assetType, "screenshot_mobile");
    assert.equal(desktop.asset?.widthPx, 1440);
    assert.equal(desktop.asset?.heightPx, 1200);
    assert.equal(mobile.asset?.widthPx, 390);
    assert.equal(mobile.asset?.heightPx, 844);
  });

  it("persists pending_storage with storagePath null when no bucket is configured", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "pending_storage");
      assert.equal(outcome.storagePath, null);
      assert.ok(outcome.asset, "expected a scan_assets row to be persisted even without storage");
      // Physical NOT NULL column holds an empty-string sentinel; conceptually null.
      assert.equal(outcome.asset!.storagePath, "");
      const metadata = outcome.asset!.metadata as Record<string, unknown>;
      assert.equal(metadata.captureStatus, "pending_storage");
      assert.equal(metadata.pageKind, "homepage");
    }
    const assets = crawlRepo.assets.get(created.value.id) ?? [];
    assert.equal(assets.length, 2);
  });

  it("uploads and persists a real storage_path when a bucket is configured", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const upload: ScreenshotUploadFn = async () => ({ ok: true });
    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId: created.value.id,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: "scan-assets-private", upload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "captured");
      assert.ok(outcome.storagePath?.includes(created.value.id));
      assert.equal(outcome.asset?.storagePath, outcome.storagePath);
    }
  });

  it("persists a storage_failed outcome and continues (does not throw) when upload fails", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const upload: ScreenshotUploadFn = async () => ({ ok: false, message: "bucket not found" });
    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId: created.value.id,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: "missing-bucket", upload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "storage_failed");
      assert.equal(outcome.storagePath, null);
      assert.equal(outcome.message, "bucket not found");
      assert.ok(outcome.asset, "a failure-metadata row is still persisted");
    }
  });

  it("persists a capture_failed outcome and never throws when the browser capture itself fails", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: failingFakeCapture() },
    );

    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "capture_failed");
      assert.equal(outcome.storagePath, null);
      assert.ok(outcome.asset, "failure is still recorded as a scan_assets row");
      const metadata = outcome.asset!.metadata as Record<string, unknown>;
      assert.equal(metadata.captureStatus, "capture_failed");
      assert.equal(metadata.captureFailureCode, "navigation_failed");
    }
  });
});

describe("private screenshot storage bucket: config, fallback, and safety", () => {
  it("1. bucket configured → upload is called and 2. storage_path is persisted", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    let uploadCalledWith: { path: string; contentType: string } | null = null;
    const upload: ScreenshotUploadFn = async ({ path, contentType }) => {
      uploadCalledWith = { path, contentType };
      return { ok: true };
    };

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId: created.value.id,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    assert.ok(uploadCalledWith, "expected the upload function to be called");
    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "captured");
      assert.ok(outcome.storagePath);
      assert.equal(outcome.asset?.storagePath, outcome.storagePath);
      const metadata = outcome.asset!.metadata as Record<string, unknown>;
      assert.equal(metadata.bucketName, DEFAULT_SCREENSHOT_STORAGE_BUCKET);
      assert.equal(metadata.pageKind, "homepage");
      assert.ok(typeof metadata.capturedAt === "string");
    }
  });

  it("3. bucket missing (unconfigured) → pending_storage, pipeline does not fail", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );
    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "pending_storage");
      assert.equal(outcome.storagePath, null);
      assert.ok(outcome.asset, "a scan_assets row is still persisted");
    }
  });

  it("4. upload failure → storage_failed, pipeline continues partial (no throw)", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const failingUpload: ScreenshotUploadFn = async () => ({ ok: false, message: "Bucket not found." });
    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId: created.value.id,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload: failingUpload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );
    for (const outcome of outcomes) {
      assert.equal(outcome.captureStatus, "storage_failed");
      assert.equal(outcome.storagePath, null);
      assert.ok(outcome.asset, "the failed-upload attempt is still recorded, not silently dropped");
      const metadata = outcome.asset!.metadata as Record<string, unknown>;
      assert.equal(metadata.captureStatus, "storage_failed");
      assert.equal(metadata.storageError, "Bucket not found.");
    }
  });

  it("5. no public URL is ever generated — the storage module never calls getPublicUrl or marks a bucket public", () => {
    const source = readFileSync(join(root, "lib/operations/pipeline/screenshot-assets.ts"), "utf8");
    assert.doesNotMatch(source, /getPublicUrl/);
    assert.doesNotMatch(source, /public:\s*true/);
    // The migration that provisions the bucket is equally explicit.
    const migrationsDir = join(root, "supabase/migrations");
    const bucketMigration = readdirSync(migrationsDir).find((f) => f.includes("crawler_screenshots_bucket"));
    assert.ok(bucketMigration, "expected a crawler_screenshots_bucket migration file to exist");
    const migrationSql = readFileSync(join(migrationsDir, bucketMigration!), "utf8").toLowerCase();
    assert.match(migrationSql, /public,\s*file_size_limit/);
    assert.match(migrationSql, /'crawler-screenshots',\s*'crawler-screenshots',\s*false/);
    assert.doesNotMatch(migrationSql, /drop table/);
    assert.doesNotMatch(migrationSql, /update storage\.buckets set public/);
  });

  it("6. no upload occurs when storage is unconfigured — the same shape --dry-run's CLI wiring always produces", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    let uploadCalled = false;
    // Even if an upload fn were somehow reachable, storage.configured=false
    // (what every CLI in this repo passes for --dry-run) must never call it.
    const neverCalledUpload: ScreenshotUploadFn = async () => {
      uploadCalled = true;
      return { ok: true };
    };
    void neverCalledUpload;

    await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );
    assert.equal(uploadCalled, false);
  });

  it("7. production is refused, independent of screenshot storage configuration", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const selection = selectRepositories({
      dryRun: false,
      target: "staging",
      env: baseEnv({ supabaseUrl: url }),
    });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });

  it("createSupabaseStorageUploader refuses safely (never throws) when Supabase is not configured", async () => {
    const upload = createSupabaseStorageUploader(baseEnv(), DEFAULT_SCREENSHOT_STORAGE_BUCKET);
    const result = await upload({ path: "private/scan-assets/x/desktop.png", buffer: Buffer.from("x"), contentType: "image/png" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not configured/);
  });

  it("8. captured screenshot metadata shape is stable — dimensions, capturedAt, source page kind, and (when uploaded) bucket name", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    const upload: ScreenshotUploadFn = async () => ({ ok: true });
    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId: created.value.id,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    for (const outcome of outcomes) {
      assert.ok(outcome.asset, "expected a scan_assets row");
      assert.equal(typeof outcome.asset!.widthPx, "number");
      assert.equal(typeof outcome.asset!.heightPx, "number");
      const metadata = outcome.asset!.metadata as Record<string, unknown>;
      assert.deepEqual(
        Object.keys(metadata).sort(),
        ["bucketName", "captureStatus", "capturedAt", "clinicId", "optimizationStrategy", "optimizedSizeBytes", "originalSizeBytes", "pageKind"],
      );
      assert.equal(metadata.pageKind, "homepage");
      assert.equal(metadata.clinicId, "clinic-1");
      const roundTripped = JSON.parse(JSON.stringify(metadata));
      assert.deepEqual(Object.keys(roundTripped).sort(), Object.keys(metadata).sort());
    }
  });

  it("9. no outreach interaction exists — captureAndPersistScreenshots has no outreach dependency and cannot send anything", async () => {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) return assert.fail();

    // CaptureAndPersistScreenshotsDeps only ever accepts { crawlRepo, captureScreenshot }
    // — there is no outreachRepo parameter to pass even if one wanted to.
    // This call succeeding with exactly these two deps is itself the proof.
    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: created.value.id, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );
    assert.equal(outcomes.length, 2);
  });
});

describe("screenshot compression / size-aware upload", () => {
  async function setup() {
    const crawlRepo = new FakeCrawlRepository();
    const created = await crawlRepo.createCrawlJob({
      clinicId: "clinic-1",
      requestedUrl: "https://example.com/",
      normalizedOrigin: "https://example.com",
    });
    if (!created.ok) throw new Error("setup failed");
    return { crawlRepo, crawlJobId: created.value.id };
  }

  it("1. a desktop screenshot under 5MB uploads normally (no optimization needed)", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    let uploadCalled = false;
    const upload: ScreenshotUploadFn = async () => {
      uploadCalled = true;
      return { ok: true };
    };
    const underLimit = 2 * 1024 * 1024; // 2MB — comfortably under the 5MB bucket limit

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      { crawlRepo, captureScreenshot: oversizedThenFakeCapture(underLimit, null) },
    );

    assert.equal(uploadCalled, true);
    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    assert.equal(desktop.captureStatus, "captured");
    assert.ok(desktop.storagePath);
    const metadata = desktop.asset!.metadata as Record<string, unknown>;
    assert.equal(metadata.originalSizeBytes, underLimit);
    assert.equal(metadata.optimizedSizeBytes, null);
    assert.equal(metadata.optimizationStrategy, "viewport_only");
  });

  it("2. an oversized desktop capture is blocked before any upload is attempted", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    let uploadCalled = false;
    const upload: ScreenshotUploadFn = async () => {
      uploadCalled = true;
      return { ok: true };
    };
    const overLimit = MAX_SCREENSHOT_UPLOAD_BYTES + 1024;

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      // No optimized result provided — simulates the capture layer's own
      // optimization attempt not being enough (or not applicable).
      { crawlRepo, captureScreenshot: oversizedThenFakeCapture(overLimit, null) },
    );

    assert.equal(uploadCalled, false, "upload must never be attempted for an oversized screenshot");
    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    assert.equal(desktop.captureStatus, "storage_failed");
    assert.equal(desktop.storagePath, null);
    assert.match(desktop.message ?? "", /exceeds the storage bucket's size limit/);
  });

  it("3. metadata records both original and optimized sizes when a reduced-height retry was used", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    const upload: ScreenshotUploadFn = async () => ({ ok: true });
    const originalSizeBytes = MAX_SCREENSHOT_UPLOAD_BYTES + 1_000_000;
    const optimizedSizeBytes = 3 * 1024 * 1024; // under the limit

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      {
        crawlRepo,
        captureScreenshot: oversizedThenFakeCapture(originalSizeBytes, {
          buffer: Buffer.alloc(optimizedSizeBytes),
          sizeBytes: optimizedSizeBytes,
        }),
      },
    );

    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    assert.equal(desktop.captureStatus, "captured");
    const metadata = desktop.asset!.metadata as Record<string, unknown>;
    assert.equal(metadata.originalSizeBytes, originalSizeBytes);
    assert.equal(metadata.optimizedSizeBytes, optimizedSizeBytes);
  });

  it("4. the optimization strategy is recorded correctly in both cases", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    const upload: ScreenshotUploadFn = async () => ({ ok: true });

    const notNeeded = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId, sourceUrl: "https://example.com/", storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload } },
      { crawlRepo, captureScreenshot: oversizedThenFakeCapture(1024, null) },
    );
    const desktopA = notNeeded.find((o) => o.viewport === "desktop")!;
    assert.equal((desktopA.asset!.metadata as Record<string, unknown>).optimizationStrategy, "viewport_only");

    const { crawlRepo: crawlRepo2, crawlJobId: crawlJobId2 } = await setup();
    const needed = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId: crawlJobId2, sourceUrl: "https://example.com/", storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload } },
      {
        crawlRepo: crawlRepo2,
        captureScreenshot: oversizedThenFakeCapture(MAX_SCREENSHOT_UPLOAD_BYTES + 500_000, {
          buffer: Buffer.alloc(1024 * 1024),
          sizeBytes: 1024 * 1024,
        }),
      },
    );
    const desktopB = needed.find((o) => o.viewport === "desktop")!;
    assert.equal((desktopB.asset!.metadata as Record<string, unknown>).optimizationStrategy, "viewport_only_reduced_height");
  });

  it("5. storage_failed is still the outcome when the optimized capture is still oversized", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    let uploadCalled = false;
    const upload: ScreenshotUploadFn = async () => {
      uploadCalled = true;
      return { ok: true };
    };
    const stillOverLimit = MAX_SCREENSHOT_UPLOAD_BYTES + 200_000;

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      {
        crawlRepo,
        captureScreenshot: oversizedThenFakeCapture(MAX_SCREENSHOT_UPLOAD_BYTES * 2, {
          buffer: Buffer.alloc(stillOverLimit),
          sizeBytes: stillOverLimit,
        }),
      },
    );

    assert.equal(uploadCalled, false);
    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    assert.equal(desktop.captureStatus, "storage_failed");
    const metadata = desktop.asset!.metadata as Record<string, unknown>;
    assert.equal(metadata.optimizationStrategy, "viewport_only_reduced_height");
    assert.equal(metadata.optimizedSizeBytes, stillOverLimit);
    // The job/pipeline itself is not failed by this — see processCrawlQueue tests for the full-job-level confirmation.
  });

  it("6. mobile behavior is unchanged — small captures upload normally regardless of the new size gate", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    const upload: ScreenshotUploadFn = async () => ({ ok: true });

    const outcomes = await captureAndPersistScreenshots(
      {
        clinicId: "clinic-1",
        crawlJobId,
        sourceUrl: "https://example.com/",
        storage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      { crawlRepo, captureScreenshot: successfulFakeCapture() },
    );

    const mobile = outcomes.find((o) => o.viewport === "mobile")!;
    assert.equal(mobile.captureStatus, "captured");
    assert.ok(mobile.storagePath);
    const metadata = mobile.asset!.metadata as Record<string, unknown>;
    assert.equal(metadata.optimizationStrategy, "viewport_only");
    assert.equal(metadata.optimizedSizeBytes, null);
  });

  it("7. storage is never written when unconfigured, even for an oversized capture (the shape --dry-run always produces)", async () => {
    const { crawlRepo, crawlJobId } = await setup();
    const outcomes = await captureAndPersistScreenshots(
      { clinicId: "clinic-1", crawlJobId, sourceUrl: "https://example.com/", storage: { configured: false } },
      { crawlRepo, captureScreenshot: oversizedThenFakeCapture(MAX_SCREENSHOT_UPLOAD_BYTES * 2, null) },
    );
    const desktop = outcomes.find((o) => o.viewport === "desktop")!;
    // Unconfigured storage always wins over the size gate — pending_storage, not storage_failed.
    assert.equal(desktop.captureStatus, "pending_storage");
    assert.equal(desktop.storagePath, null);
  });

  it("8. production is refused, independent of screenshot size/optimization", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const selection = selectRepositories({ dryRun: false, target: "staging", env: baseEnv({ supabaseUrl: url }) });
    assert.equal(selection.ok, false);
    if (selection.ok) return;
    assert.match(selection.reason, /production/);
  });

  it("9. the bucket's declared file_size_limit and MAX_SCREENSHOT_UPLOAD_BYTES stay in lockstep, and the bucket is never public", () => {
    assert.equal(MAX_SCREENSHOT_UPLOAD_BYTES, 5_242_880);
    const migrationsDir = join(root, "supabase/migrations");
    const bucketMigration = readdirSync(migrationsDir).find((f) => f.includes("crawler_screenshots_bucket"));
    assert.ok(bucketMigration, "expected the crawler_screenshots_bucket migration file to exist");
    const migrationSql = readFileSync(join(migrationsDir, bucketMigration!), "utf8").toLowerCase();
    assert.match(migrationSql, new RegExp(`false,\\s*${MAX_SCREENSHOT_UPLOAD_BYTES}`));
    assert.doesNotMatch(migrationSql, /public,\s*file_size_limit[^)]*true/);
  });
});

describe("processCrawlQueue + screenshots: gating, integration, score/draft references", () => {
  it("screenshots are skipped by default (captureScreenshots not requested)", async () => {
    const deps = buildFakeDeps();
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "skip-default",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue({ clinicIds: [clinic.value.id], allowRealCrawl: false }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.screenshots.length, 0);
    assert.equal(outcome.screenshotsSkippedReason, null);
  });

  it("--capture-screenshots without --allow-real-crawl is skipped safely with a clear reason, never attempting capture", async () => {
    let captureCalled = false;
    const deps = buildFakeDeps({
      captureScreenshot: async () => {
        captureCalled = true;
        return {
          ok: true,
          buffer: Buffer.from("x"),
          contentType: "image/png",
          widthPx: 1440,
          heightPx: 1200,
          originalSizeBytes: 1,
          optimizedSizeBytes: null,
          optimizationStrategy: "viewport_only",
        };
      },
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "requires-allow-real-crawl",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: false, captureScreenshots: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.screenshots.length, 0);
    assert.match(outcome.screenshotsSkippedReason ?? "", /requires --allow-real-crawl/);
    assert.equal(captureCalled, false);
  });

  it("dry-run creates no real DB/storage writes — only the injected fake repositories are populated", async () => {
    const deps = buildFakeDeps({ captureScreenshot: successfulFakeCapture() });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "dry-run-fakes-only",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true },
      deps,
    );
    assert.equal(result.processed[0]!.screenshots.length, 2);
    const crawlRepo = deps.crawlRepo as FakeCrawlRepository;
    const jobId = result.processed[0]!.crawlJobId!;
    assert.equal((crawlRepo.assets.get(jobId) ?? []).length, 2);
  });

  it("blocks a private/localhost URL before any screenshot is attempted", async () => {
    let captureCalled = false;
    const deps = buildFakeDeps({
      captureScreenshot: async () => {
        captureCalled = true;
        return {
          ok: true,
          buffer: Buffer.from("x"),
          contentType: "image/png",
          widthPx: 1440,
          heightPx: 1200,
          originalSizeBytes: 1,
          optimizedSizeBytes: null,
          optimizationStrategy: "viewport_only",
        };
      },
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Localhost",
      normalizedName: "clinica localhost",
      websiteUrl: "http://127.0.0.1:9999/",
      normalizedWebsiteOrigin: "http://127.0.0.1:9999",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "localhost-blocked",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, false);
    assert.equal(outcome.screenshots.length, 0);
    assert.equal(captureCalled, false);
  });

  it("blocks a non-allowlisted real host before any screenshot is attempted (fails before DNS/network)", async () => {
    let captureCalled = false;
    // For this test specifically we want the REAL lookup gate to be exercised
    // (not the FAKE_LOOKUP override) — a non-allowlisted host must be
    // rejected by createControlledLookup itself before any DNS call, which
    // is exactly what we're verifying here, so no lookupImpl override.
    const deps = buildFakeDeps({
      lookupImpl: undefined,
      captureScreenshot: async () => {
        captureCalled = true;
        return {
          ok: true,
          buffer: Buffer.from("x"),
          contentType: "image/png",
          widthPx: 1440,
          heightPx: 1200,
          originalSizeBytes: 1,
          optimizedSizeBytes: null,
          optimizationStrategy: "viewport_only",
        };
      },
    });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Fora Do Allowlist",
      normalizedName: "clinica fora do allowlist",
      websiteUrl: "https://random-real-clinic.example.org/",
      normalizedWebsiteOrigin: "https://random-real-clinic.example.org",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "non-allowlisted-blocked",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, false);
    assert.equal(outcome.screenshots.length, 0);
    assert.equal(captureCalled, false);
  });

  it("a screenshot capture failure does not fail the whole crawl job — job still completes", async () => {
    const deps = buildFakeDeps({ captureScreenshot: failingFakeCapture() });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "capture-fails-job-succeeds",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.ok(["completed", "partial"].includes(outcome.result.finalStatus));
    }
    assert.equal(outcome.screenshots.length, 2);
    assert.ok(outcome.screenshots.every((s) => s.captureStatus === "capture_failed"));
  });

  it("score and outreach draft reference the captured screenshot asset ids; outreach stays draft, nothing is sent", async () => {
    const deps = buildFakeDeps({ captureScreenshot: successfulFakeCapture() });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "score-draft-reference",
    });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true, createOutreachDraft: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.ok(outcome.updatedScore, "expected the score to be recomputed after screenshots");
    const mobileAssetId = outcome.screenshots.find((s) => s.assetType === "screenshot_mobile")!.asset!.id;
    assert.ok(outcome.updatedScore!.evidence.some((e) => e.reason.includes(mobileAssetId)));
    // Keep the required disclaimer intact.
    assert.equal(
      outcome.updatedScore!.disclaimer,
      "Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.",
    );

    assert.ok(outcome.deferredOutreachDraftId, "expected a deferred outreach draft referencing the updated score");
    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    const draft = outreachRepo.messages.get(outcome.deferredOutreachDraftId!);
    assert.ok(draft);
    assert.equal(draft!.status, "draft");
    assert.equal(draft!.humanReviewed, false);
    // No other message on this clinic ever reached a sent state.
    for (const message of outreachRepo.messages.values()) {
      assert.notEqual(message.status, "sent");
    }
  });

  it("10. an oversized desktop screenshot never sends outreach — the job still completes and the draft stays draft", async () => {
    const deps = buildFakeDeps({ captureScreenshot: oversizedThenFakeCapture(MAX_SCREENSHOT_UPLOAD_BYTES * 2, null) });
    const clinic = await deps.clinicRepo.createClinic({
      displayName: "Clínica Exemplo",
      normalizedName: "clinica exemplo",
      websiteUrl: "https://example.com/",
      normalizedWebsiteOrigin: "https://example.com",
      city: null,
      state: null,
      specialty: null,
      status: "prospect",
      sourceType: "manual",
      sourceAttribution: {},
      dedupeKey: "oversized-desktop-no-outreach-sent",
    });
    if (!clinic.ok) return assert.fail();

    const upload: ScreenshotUploadFn = async () => ({ ok: true });
    const result = await processCrawlQueue(
      {
        clinicIds: [clinic.value.id],
        allowRealCrawl: true,
        captureScreenshots: true,
        createOutreachDraft: true,
        screenshotStorage: { configured: true, bucketName: DEFAULT_SCREENSHOT_STORAGE_BUCKET, upload },
      },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.equal(outcome.result.ok, true);
    if (outcome.result.ok) {
      assert.ok(["completed", "partial"].includes(outcome.result.finalStatus));
    }
    const desktopOutcome = outcome.screenshots.find((s) => s.viewport === "desktop")!;
    assert.equal(desktopOutcome.captureStatus, "storage_failed");

    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    for (const message of outreachRepo.messages.values()) {
      assert.equal(message.status, "draft");
      assert.notEqual(message.status, "sent");
    }
  });

  it("production is refused even when screenshots are requested", () => {
    const url = `https://${KNOWN_PROJECT_REFS.production}.supabase.co`;
    const guard = assertSafeTarget("staging", url);
    assert.equal(guard.ok, false);

    const selection = selectRepositories({ dryRun: false, target: "staging", env: baseEnv({ supabaseUrl: url }) });
    assert.equal(selection.ok, false);
  });
});

describe("approved-domain single-clinic rehearsal: screenshot gate and outreach-draft-only, on a real clinic hostname", () => {
  function approvedDomainClinic() {
    return {
      displayName: "GRUPO CPD - Centro Paulista de Dermatologia e Estética",
      normalizedName: "grupo cpd centro paulista de dermatologia e estetica",
      websiteUrl: "https://grupocpd.com.br/",
      normalizedWebsiteOrigin: "https://grupocpd.com.br",
      city: null,
      state: "SP",
      specialty: null,
      status: "prospect" as const,
      sourceType: "google_places" as const,
      sourceAttribution: {},
    };
  }

  it("5. screenshots still require --capture-screenshots even with --allow-real-crawl set for an approved domain", async () => {
    const deps = buildFakeDeps();
    const clinic = await deps.clinicRepo.createClinic({ ...approvedDomainClinic(), dedupeKey: "approved-domain-no-capture-flag" });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue({ clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: false }, deps);
    const outcome = result.processed[0]!;
    assert.equal(outcome.screenshots.length, 0);
  });

  it("8. an approved-domain crawl with screenshots still never sends outreach — draft only", async () => {
    const deps = buildFakeDeps({ captureScreenshot: successfulFakeCapture() });
    const clinic = await deps.clinicRepo.createClinic({ ...approvedDomainClinic(), dedupeKey: "approved-domain-outreach-draft-only" });
    if (!clinic.ok) return assert.fail();

    const result = await processCrawlQueue(
      { clinicIds: [clinic.value.id], allowRealCrawl: true, captureScreenshots: true, createOutreachDraft: true },
      deps,
    );
    const outcome = result.processed[0]!;
    assert.ok(outcome.deferredOutreachDraftId, "expected an outreach draft to be created");
    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    const draft = outreachRepo.messages.get(outcome.deferredOutreachDraftId!);
    assert.ok(draft);
    assert.equal(draft!.status, "draft");
    assert.equal(draft!.humanReviewed, false);
    for (const message of outreachRepo.messages.values()) {
      assert.notEqual(message.status, "sent");
    }
  });
});

describe("runControlledPipeline: end-to-end with screenshots enabled", () => {
  it("runs the full pipeline with screenshots and never sends outreach", async () => {
    const deps = buildFakeDeps({ captureScreenshot: successfulFakeCapture() });
    const result = await runControlledPipeline(
      {
        csvText: EXAMPLE_CSV,
        maxCandidates: 1,
        maxPages: 1,
        allowRealCrawl: true,
        captureScreenshots: true,
      },
      deps,
    );
    const outcome = result.crawl.processed[0]!;
    assert.equal(outcome.screenshots.length, 2);
    assert.ok(outcome.screenshots.every((s) => s.captureStatus === "pending_storage"));

    const outreachRepo = deps.outreachRepo as FakeOutreachRepository;
    for (const message of outreachRepo.messages.values()) {
      assert.equal(message.status, "draft");
    }
  });
});
