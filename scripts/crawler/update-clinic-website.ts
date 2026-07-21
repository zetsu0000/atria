#!/usr/bin/env npx tsx
/**
 * Standalone CLI to correct a clinic's recorded website URL/origin.
 * Thin wrapper around ClinicRepository.updateNormalizedWebsiteHost, which
 * already exists ("Updates the normalized website host after a crawl
 * confirms/changes it" — lib/operations/repositories/clinic-repository.ts)
 * and is already exercised via the fake repository in
 * lib/operations/repositories-fakes.test.ts, but previously had no CLI
 * entry point.
 *
 * Does not crawl, does not fetch, does not validate reachability itself —
 * it only writes the URL/origin the caller supplies. Any TLS/reachability
 * checks belong to the caller (e.g. a read-only diagnostic curl run
 * separately, never via this script).
 *
 * Usage:
 *   npx tsx scripts/crawler/update-clinic-website.ts --dry-run --clinic-id c1 --website-url https://example.com/
 *   npx tsx scripts/crawler/update-clinic-website.ts --target staging --clinic-id c1 --website-url https://example.com/
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const websiteUrl = getValue(args, "website-url");

  if (!clinicId || !clinicId.trim()) {
    console.error("[update-clinic-website] REFUSED: --clinic-id is required.");
    process.exit(1);
  }
  if (!websiteUrl || !websiteUrl.trim()) {
    console.error("[update-clinic-website] REFUSED: --website-url is required.");
    process.exit(1);
  }
  let parsed: URL;
  try {
    parsed = new URL(websiteUrl);
  } catch {
    console.error("[update-clinic-website] REFUSED: --website-url is not a valid URL.");
    process.exit(1);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.error("[update-clinic-website] REFUSED: --website-url must be http or https.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[update-clinic-website] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const { clinicRepo } = repoSelection.value;

  const result = await clinicRepo.updateNormalizedWebsiteHost(clinicId, {
    websiteUrl: parsed.href,
    normalizedWebsiteOrigin: parsed.origin,
  });

  if (!result.ok) {
    console.error(`[update-clinic-website] FAILED: reason=${result.reason} message=${result.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        clinicId: result.value.id,
        clinicDisplayName: result.value.displayName,
        clinicWebsiteUrl: result.value.websiteUrl,
        normalizedWebsiteOrigin: result.value.normalizedWebsiteOrigin,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
