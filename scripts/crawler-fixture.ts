#!/usr/bin/env npx tsx
/**
 * Local fixture CLI for crawler foundation.
 * Does not crawl real clinic websites. Does not call external APIs.
 *
 * Usage:
 *   npx tsx scripts/crawler-fixture.ts validate --url https://clinic.example.com
 *   npx tsx scripts/crawler-fixture.ts scan-fixture
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPageCandidates } from "../lib/crawler/extract-candidates";
import { parseHtmlPage } from "../lib/crawler/parse-page";
import { buildScreenshotAssetMetadata } from "../lib/crawler/screenshot-metadata";
import { parseAndNormalizePublicUrl } from "../lib/crawler/url-policy";
import { normalizeProspectCandidate } from "../lib/discovery/normalize";
import { buildOutreachDraft } from "../lib/outreach/draft";
import { calculatePlaceholderScore } from "../lib/score/calculate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/crawler-fixture.ts validate --url <https-url>
  npx tsx scripts/crawler-fixture.ts scan-fixture [--out artifacts/crawler]
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage();

  if (command === "validate") {
    const urlIdx = rest.indexOf("--url");
    const url = urlIdx >= 0 ? rest[urlIdx + 1] : null;
    if (!url) usage();
    const result = parseAndNormalizePublicUrl(url);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 2);
  }

  if (command === "scan-fixture") {
    const outIdx = rest.indexOf("--out");
    const outDir = outIdx >= 0 ? rest[outIdx + 1]! : join(root, "artifacts/crawler");
    mkdirSync(outDir, { recursive: true });

    const html = readFileSync(
      join(root, "lib/crawler/fixtures/clinic-home.html"),
      "utf8",
    );
    const pageUrl = "https://fixture.invalid/";
    const origin = "https://fixture.invalid";
    const parsed = parseHtmlPage(html, pageUrl, origin);
    const candidates = extractPageCandidates({
      pageUrl,
      html,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      headings: parsed.headings,
      mainText: parsed.mainText,
      linksInternal: parsed.linksInternal,
    });
    const score = calculatePlaceholderScore({
      candidates,
      pageCount: 1,
      hasDesktopScreenshotMeta: true,
      hasMobileScreenshotMeta: true,
    });
    const assets = [
      buildScreenshotAssetMetadata({
        viewport: "desktop",
        storagePath: "private/fixtures/desktop.png",
        pageUrl,
        widthPx: 1440,
        heightPx: 900,
      }),
      buildScreenshotAssetMetadata({
        viewport: "mobile",
        storagePath: "private/fixtures/mobile.png",
        pageUrl,
        widthPx: 390,
        heightPx: 844,
      }),
    ];

    const clinic = normalizeProspectCandidate({
      rawName: "Clínica Fixture Dermato",
      websiteUrl: pageUrl,
      sourceType: "manual",
      sourceAttribution: { fixture: true },
    });

    const outreach =
      clinic.ok
        ? buildOutreachDraft({
            clinicDisplayName: clinic.candidate.rawName,
            channel: "email",
            observations: [
              {
                observation:
                  "Fixture local: score e extração gerados sem crawl real.",
                sourceUrl: pageUrl,
              },
            ],
          })
        : { ok: false as const, message: "clinic normalize failed" };

    const payload = {
      requiresHumanReview: true,
      parsed,
      candidates,
      score,
      assets,
      clinic: clinic.ok ? clinic.candidate : null,
      outreachDraft: outreach.ok ? outreach.draft : null,
      note: "Local fixture only. No live network crawl. No messages sent.",
    };

    const outPath = join(outDir, "fixture-scan.json");
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    // Placeholder screenshot markers (not real images)
    writeFileSync(join(outDir, "desktop.placeholder.txt"), "desktop screenshot placeholder\n");
    writeFileSync(join(outDir, "mobile.placeholder.txt"), "mobile screenshot placeholder\n");
    console.log(JSON.stringify({ ok: true, outPath, candidateCount: candidates.length, scoreTotal: score.total }, null, 2));
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
