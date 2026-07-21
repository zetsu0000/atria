#!/usr/bin/env npx tsx
/**
 * Google Places discovery CLI — the first external discovery adapter for
 * Atria. Discovers candidate clinics via the official Places API (New) and
 * persists them as `prospect_candidates` only.
 *
 * This command never crawls a discovered clinic's website, never sends
 * outreach, never scrapes or drives a browser against Google, and never
 * promotes a candidate to a full clinic record unless `--promote` is passed
 * explicitly. Promotion, crawling, and outreach are separate, later,
 * explicitly-invoked pipeline commands.
 *
 * Usage:
 *   npx tsx scripts/crawler/discover-google-places.ts --dry-run --query "dermatologia" --location "São Paulo, SP"
 *   npx tsx scripts/crawler/discover-google-places.ts --target staging --query "dermatologia" --location "São Paulo, SP"
 *   npx tsx scripts/crawler/discover-google-places.ts --target staging --query "dermatologia" --location "Curitiba, PR" --max-results 5 --promote
 *
 * Flags:
 *   --dry-run          Use canned in-memory fixture places and in-memory
 *                       fake repositories. No GOOGLE_PLACES_API_KEY needed,
 *                       no network call, no Supabase write. No --target needed.
 *   --target local|staging  Required unless --dry-run. Refused if it (or the
 *                       resolved SUPABASE_URL) would touch production — see
 *                       lib/operations/pipeline/target-guard.ts.
 *   --query <text>     Required. e.g. "dermatologia" or "clínica dermatológica".
 *   --location <text>  Required. e.g. "São Paulo, SP, Brazil".
 *   --max-results <n>  Default 10. Hard bound on total candidates returned/persisted.
 *   --max-pages <n>    Default 1. Hard bound on Places API pages requested.
 *   --promote          Default off. When set, every newly-recorded candidate
 *                       is immediately promoted to a clinic. Without it,
 *                       this command only ever writes prospect_candidates —
 *                       no clinic, no crawl job, no outreach draft.
 *
 * This command never crawls, never contacts anyone, and never sends
 * outreach — see lib/discovery/providers/google-places.ts for the adapter
 * and orchestration this CLI wires up.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv, readGooglePlacesEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import {
  createFixtureGooglePlacesProvider,
  createGooglePlacesProvider,
  runGooglePlacesDiscovery,
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_RESULTS,
} from "@/lib/discovery/providers/google-places";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has("dry-run");
  const promote = args.flags.has("promote");
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const query = getValue(args, "query");
  const location = getValue(args, "location");
  const maxResults = getIntValue(args, "max-results", DEFAULT_MAX_RESULTS);
  const maxPages = getIntValue(args, "max-pages", DEFAULT_MAX_PAGES);

  if (!query || !query.trim()) {
    console.error("[discover-google-places] REFUSED: --query is required (e.g. --query \"dermatologia\").");
    process.exit(1);
  }
  if (!location || !location.trim()) {
    console.error("[discover-google-places] REFUSED: --location is required (e.g. --location \"São Paulo, SP\").");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun, target, env });
  if (!repoSelection.ok) {
    console.error(`[discover-google-places] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  if (promote && dryRun) {
    // Still safe (fake ClinicRepository, in-memory only) — allowed so
    // --dry-run can rehearse the full promote path without touching Supabase.
    console.error("[discover-google-places] note: --promote with --dry-run only promotes in-memory fake records.");
  }

  let provider;
  if (dryRun) {
    provider = createFixtureGooglePlacesProvider();
  } else {
    const placesEnv = readGooglePlacesEnv();
    if (!placesEnv.googlePlacesApiKey) {
      console.error(
        "[discover-google-places] REFUSED: GOOGLE_PLACES_API_KEY is not set. Set it as an environment variable (never commit it) or use --dry-run.",
      );
      process.exit(1);
    }
    provider = createGooglePlacesProvider({ apiKey: placesEnv.googlePlacesApiKey });
  }

  console.log(
    `[discover-google-places] mode=${dryRun ? "dry-run" : `target=${target}`} query=${JSON.stringify(query)} location=${JSON.stringify(location)} maxResults=${maxResults} maxPages=${maxPages} promote=${promote}`,
  );

  const result = await runGooglePlacesDiscovery(
    { query, location, maxResults, maxPages, promote },
    { provider, discoveryRepo: repos.discoveryRepo, clinicRepo: repos.clinicRepo },
  );

  if (!result.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          discoveryJobId: result.discoveryJobId,
          reason: result.reason,
          message: result.message,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        discoveryJobId: result.discoveryJobId,
        query: result.query,
        location: result.location,
        pagesFetched: result.pagesFetched,
        truncatedByMaxResults: result.truncatedByMaxResults,
        totalFoundByProvider: result.totalFoundByProvider,
        importedCount: result.imported.length,
        imported: result.imported.map((c) => ({
          id: c.id,
          rawName: c.rawName,
          status: c.status,
          websiteUrl: c.websiteUrl,
          city: c.city,
          state: c.state,
        })),
        duplicateCount: result.duplicates.length,
        rejectedCount: result.rejected.length,
        promotions: result.promotions.map((p) => ({
          candidateId: p.candidateId,
          rawName: p.rawName,
          ok: p.result.ok,
          clinicId: p.result.ok ? p.result.clinic.id : null,
        })),
        note: "No crawl. No outreach. No scraping or browser automation against Google. Promotion only occurred if --promote was passed. Human review required before any commercial use.",
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
