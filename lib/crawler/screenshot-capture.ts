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
 */
export type ScreenshotViewport = "desktop" | "mobile";

export const DESKTOP_VIEWPORT = { widthPx: 1440, heightPx: 1200 } as const;
export const MOBILE_VIEWPORT = { widthPx: 390, heightPx: 844 } as const;

export function viewportDimensions(viewport: ScreenshotViewport): { widthPx: number; heightPx: number } {
  return viewport === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
}

export type CaptureScreenshotOptions = {
  /** Already validated as a safe, public, allowlisted URL by the caller. */
  url: string;
  viewport: ScreenshotViewport;
  timeoutMs?: number;
};

export type CaptureScreenshotResult =
  | { ok: true; buffer: Buffer; contentType: "image/png"; widthPx: number; heightPx: number }
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
 * `acceptDownloads: false`), and takes a single full-page-off screenshot.
 * Always closes the browser, even on failure.
 */
export async function captureScreenshotWithPlaywright(
  options: CaptureScreenshotOptions,
): Promise<CaptureScreenshotResult> {
  const { widthPx, heightPx } = viewportDimensions(options.viewport);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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

    const buffer = await page.screenshot({ type: "png" });
    return { ok: true, buffer, contentType: "image/png", widthPx, heightPx };
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
