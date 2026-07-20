import type { ReviewStatus } from "./extraction-types";

/**
 * Screenshot/asset metadata only.
 * Actual browser capture is out of scope for this foundation (no live crawl UI).
 */
export type ScanAssetType = "screenshot_desktop" | "screenshot_mobile" | "other";

export type ScanAssetMetadata = {
  assetType: ScanAssetType;
  storagePath: string;
  contentType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  pageUrl: string | null;
  reviewStatus: ReviewStatus;
  metadata: Record<string, unknown>;
};

export function buildScreenshotAssetMetadata(input: {
  viewport: "desktop" | "mobile";
  storagePath: string;
  pageUrl: string;
  widthPx: number;
  heightPx: number;
}): ScanAssetMetadata {
  return {
    assetType:
      input.viewport === "desktop" ? "screenshot_desktop" : "screenshot_mobile",
    storagePath: input.storagePath,
    contentType: "image/png",
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    pageUrl: input.pageUrl,
    reviewStatus: "pending_review",
    metadata: {
      captured: false,
      note: "Metadata placeholder — real capture requires authorized local tooling.",
    },
  };
}
