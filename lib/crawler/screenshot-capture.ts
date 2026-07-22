/**
 * Homepage screenshot capture — desktop and mobile viewports only.
 *
 * This module never runs unless explicitly invoked by a caller that has
 * already validated the target URL through the SSRF/private-IP guard
 * (lib/crawler/url-policy.ts) and, for the controlled automation pipeline,
 * the real-crawl hostname allowlist
 * (lib/operations/pipeline/controlled-transport.ts).
 *
 * Never authenticates, never submits a form, never downloads a file —
 * only navigates to the given URL and takes a screenshot. Playwright is
 * imported lazily so modules/tests that never call `captureScreenshotWithPlaywright`
 * don't need the dependency loaded, and so tests can inject a fake
 * `ScreenshotCaptureImpl` instead of ever launching a real browser.
 *
 * Size-aware capture: every screenshot is already viewport-only (Playwright's
 * `page.screenshot()` never uses `fullPage`, so the pixel area is bounded
 * by the fixed viewport size below) — but a real, content/image-heavy page
 * can still produce a lossless PNG over the private Storage bucket's 5 MB
 * limit (`lib/operations/pipeline/screenshot-assets.ts`'s
 * DEFAULT_SCREENSHOT_STORAGE_BUCKET; confirmed empirically in
 * docs/technical/crawler-screenshot-storage-staging-validation.md, where a
 * real SkinLaser desktop capture exceeded 5 MB while the smaller mobile
 * capture did not). When the initial capture is oversized, exactly one
 * further, bounded attempt is made: a second screenshot, clipped to half
 * the viewport height, of the *same already-rendered page* — no
 * re-navigation, no new network request, same PNG format, same width.
 * If that is still oversized, capture still succeeds (returns real bytes)
 * but the caller (screenshot-assets.ts) is responsible for refusing to
 * upload anything over the limit — see MAX_SCREENSHOT_UPLOAD_BYTES.
 */
export type ScreenshotViewport = "desktop" | "mobile";

export const DESKTOP_VIEWPORT = { widthPx: 1440, heightPx: 1200 } as const;
export const MOBILE_VIEWPORT = { widthPx: 390, heightPx: 844 } as const;

/** Matches the private Storage bucket's file_size_limit exactly — see supabase/migrations/*_crawler_screenshots_bucket.sql. */
export const MAX_SCREENSHOT_UPLOAD_BYTES = 5_242_880;

export function viewportDimensions(viewport: ScreenshotViewport): { widthPx: number; heightPx: number } {
  return viewport === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
}

export type ScreenshotOptimizationStrategy = "viewport_only" | "viewport_only_reduced_height";

export type CaptureScreenshotOptions = {
  /** Already validated as a safe, public, allowlisted URL by the caller. */
  url: string;
  viewport: ScreenshotViewport;
  timeoutMs?: number;
  /** Overridable for tests; defaults to MAX_SCREENSHOT_UPLOAD_BYTES. */
  maxBytes?: number;
};

export type CaptureScreenshotResult =
  | {
      ok: true;
      buffer: Buffer;
      contentType: "image/png";
      widthPx: number;
      heightPx: number;
      /** Size of the first, full-viewport-height capture — always recorded, even when no optimization was needed. */
      originalSizeBytes: number;
      /** Size of the reduced-height retry, only when one was attempted (original exceeded maxBytes); null otherwise. */
      optimizedSizeBytes: number | null;
      optimizationStrategy: ScreenshotOptimizationStrategy;
    }
  | {
      ok: false;
      code: "timeout" | "navigation_failed" | "capture_failed" | "browser_unavailable";
      message: string;
    };

export type ScreenshotCaptureImpl = (options: CaptureScreenshotOptions) => Promise<CaptureScreenshotResult>;

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Real Playwright-based capture. Launches a headless Chromium instance,
 * navigates once (no interaction, no form submission, no downloads —
 * `acceptDownloads: false`), and takes a viewport-only screenshot (never
 * `fullPage`). If that screenshot exceeds `maxBytes`, takes exactly one
 * further screenshot — a `clip`'d region of the same already-loaded page,
 * half the viewport height — as a deterministic, dependency-free size
 * reduction; no second navigation, no external image-processing library.
 * Always closes the browser, even on failure.
 */
export async function captureScreenshotWithPlaywright(
  options: CaptureScreenshotOptions,
): Promise<CaptureScreenshotResult> {
  const { widthPx, heightPx } = viewportDimensions(options.viewport);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_SCREENSHOT_UPLOAD_BYTES;

  let browser: import("playwright").Browser | null = null;
  try {
    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return {
        ok: false,
        code: "browser_unavailable",
        message: "Playwright browser binaries are not available in this environment.",
      };
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: widthPx, height: heightPx },
      acceptDownloads: false,
      javaScriptEnabled: true,
    });
    const page = await context.newPage();

    const response = await page.goto(options.url, { waitUntil: "load", timeout: timeoutMs });
    if (!response || !response.ok()) {
      return {
        ok: false,
        code: "navigation_failed",
        message: "Failed to load the page for screenshot capture.",
      };
    }

    const original = await page.screenshot({ type: "png" });
    if (original.length <= maxBytes) {
      return {
        ok: true,
        buffer: original,
        contentType: "image/png",
        widthPx,
        heightPx,
        originalSizeBytes: original.length,
        optimizedSizeBytes: null,
        optimizationStrategy: "viewport_only",
      };
    }

    const reducedHeight = Math.max(1, Math.round(heightPx / 2));
    const optimized = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: widthPx, height: reducedHeight },
    });
    return {
      ok: true,
      buffer: optimized,
      contentType: "image/png",
      widthPx,
      heightPx: reducedHeight,
      originalSizeBytes: original.length,
      optimizedSizeBytes: optimized.length,
      optimizationStrategy: "viewport_only_reduced_height",
    };
  } catch (error) {
    const isTimeout = error instanceof Error && /timeout/i.test(error.message);
    return {
      ok: false,
      code: isTimeout ? "timeout" : "capture_failed",
      message: "Screenshot capture failed.",
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {
        /* never let a close failure surface as an unhandled rejection */
      });
    }
  }
}
