#!/usr/bin/env npx tsx
/**
 * Operator preflight checklist — step 1 of
 * docs/operations/crawler-operator-runbook.md. Purely read-only: checks
 * only *presence* of required env vars (never prints or logs a value),
 * and confirms --target/SUPABASE_URL don't resolve to production. No
 * Supabase query, no network call, no mutation.
 *
 * Usage:
 *   npx tsx scripts/crawler/operator-preflight.ts --target staging
 *   npx tsx scripts/crawler/operator-preflight.ts --target local
 *
 * Exit code is non-zero when overallStatus is "blocked".
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readGooglePlacesEnv,
  readLeadCaptureEnv,
  readScreenshotStorageEnv,
} from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { runOperatorPreflight } from "@/lib/operations/pipeline/operator-preflight";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;

  loadDotEnvLocalIfPresent(root);
  const leadCaptureEnv = readLeadCaptureEnv();
  const googlePlacesEnv = readGooglePlacesEnv();
  const screenshotStorageEnv = readScreenshotStorageEnv();

  const result = runOperatorPreflight({
    target,
    supabaseUrl: leadCaptureEnv.supabaseUrl,
    hasSupabaseServiceRoleKey: Boolean(leadCaptureEnv.supabaseServiceRoleKey),
    hasLeadHashSecret: Boolean(leadCaptureEnv.leadHashSecret),
    hasGooglePlacesApiKey: Boolean(googlePlacesEnv.googlePlacesApiKey),
    hasScreenshotStorageBucket: Boolean(screenshotStorageEnv.screenshotStorageBucket),
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.overallStatus === "blocked") {
    process.exit(1);
  }
}

main();
