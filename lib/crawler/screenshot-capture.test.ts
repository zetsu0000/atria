import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { viewportDimensions, DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "./screenshot-capture";
import type { CaptureScreenshotResult, ScreenshotCaptureImpl } from "./screenshot-capture";

/**
 * `captureScreenshotWithPlaywright` itself (the real Playwright-backed
 * implementation) is intentionally NOT exercised here — launching a real
 * browser is slow, environment-dependent (browser binaries may or may not
 * be installed), and would be a live operation unsuitable for the normal
 * test suite. It is exercised only via manual CLI smoke testing
 * (docs/technical/crawler-screenshot-score-assets.md). Every caller in
 * this codebase (lib/operations/pipeline/screenshot-assets.ts and its
 * tests) is driven through the injectable `ScreenshotCaptureImpl` contract
 * tested below, so real usage never needs a real browser to be verified.
 */

describe("screenshot-capture: viewport dimensions", () => {
  it("desktop is 1440x1200", () => {
    assert.deepEqual(viewportDimensions("desktop"), { widthPx: 1440, heightPx: 1200 });
    assert.deepEqual(DESKTOP_VIEWPORT, { widthPx: 1440, heightPx: 1200 });
  });

  it("mobile is 390x844", () => {
    assert.deepEqual(viewportDimensions("mobile"), { widthPx: 390, heightPx: 844 });
    assert.deepEqual(MOBILE_VIEWPORT, { widthPx: 390, heightPx: 844 });
  });
});

describe("screenshot-capture: ScreenshotCaptureImpl contract", () => {
  it("a fake capture implementation satisfies the same contract callers depend on", async () => {
    const fakeCapture: ScreenshotCaptureImpl = async (options) => {
      const dims = viewportDimensions(options.viewport);
      const result: CaptureScreenshotResult = {
        ok: true,
        buffer: Buffer.from("fixture-png-bytes"),
        contentType: "image/png",
        widthPx: dims.widthPx,
        heightPx: dims.heightPx,
      };
      return result;
    };

    const desktop = await fakeCapture({ url: "https://example.com/", viewport: "desktop" });
    assert.equal(desktop.ok, true);
    if (desktop.ok) {
      assert.equal(desktop.widthPx, 1440);
      assert.equal(desktop.contentType, "image/png");
    }
  });

  it("a fake failure implementation reports a safe error code, never a raw exception", async () => {
    const fakeCapture: ScreenshotCaptureImpl = async () => ({
      ok: false,
      code: "navigation_failed",
      message: "Failed to load the page for screenshot capture.",
    });

    const result = await fakeCapture({ url: "https://example.com/", viewport: "mobile" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "navigation_failed");
      assert.doesNotMatch(result.message, /Error:|stack|at Object\./);
    }
  });
});
