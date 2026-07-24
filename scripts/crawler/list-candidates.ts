#!/usr/bin/env npx tsx
/**
 * Lists already-persisted `prospect_candidates` for human review before
 * promotion — read-only, never crawls, never calls an external API
 * (Google Places or otherwise), never scrapes/automates a browser, and
 * never creates, mutates, or promotes anything. See
 * docs/technical/crawler-candidate-review-cli.md.
 *
 * Usage:
 *   npx tsx scripts/crawler/list-candidates.ts --target staging --limit 20
 *   npx tsx scripts/crawler/list-candidates.ts --target staging --discovery-job-id <id>
 *   npx tsx scripts/crawler/list-candidates.ts --target staging --status new --only-promotable
 *   npx tsx scripts/crawler/list-candidates.ts --target staging --query "dermatologia" --output markdown
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --discovery-job-id <id>  Optional — restrict to one discovery run.
 *   --status new|needs_review|duplicate|rejected|promoted_to_clinic|all  Default "all".
 *   --source manual|csv_import|google_places|web_search|directory|other  Optional.
 *   --query <text>          Optional — case-insensitive substring match against the candidate's raw name.
 *   --include-existing       Default off. Runs one extra read-only dedupe
 *                            lookup per not-yet-dispositioned candidate to
 *                            check whether a clinic already exists with
 *                            the same identity.
 *   --only-promotable        Default off. Restricts output to candidates
 *                            whose suggested action is "promote_candidate".
 *   --limit <n>              Default 20.
 *   --output table|json|markdown  Default table.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { listCandidatesForReview, DEFAULT_CANDIDATE_REVIEW_LIMIT } from "@/lib/operations/discovery/list-candidates";
import { renderCandidateListMarkdown } from "@/lib/operations/discovery/render-candidate-list-markdown";
import type { CandidateReviewItem, CandidateReviewStatusFilter } from "@/lib/operations/discovery/types";
import type { DiscoverySourceType } from "@/lib/discovery/types";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const VALID_STATUS_FILTERS = ["new", "needs_review", "duplicate", "rejected", "promoted_to_clinic", "all"];
const VALID_SOURCES = ["manual", "csv_import", "google_places", "web_search", "directory", "other"];

function renderTable(rows: CandidateReviewItem[]): string {
  const header = ["status", "action", "icp_fit", "org_type", "name", "website", "source", "id"];
  const cells = rows.map((r) => [
    r.status,
    r.suggestedAction,
    r.icpFit,
    r.organizationType,
    r.rawName.slice(0, 40),
    (r.websiteUrl ?? "—").slice(0, 40),
    r.sourceType,
    r.candidateId,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i]!.length)));
  const line = (values: string[]) => values.map((v, i) => v.padEnd(widths[i]!)).join("  ");
  const out = [line(header), line(widths.map((w) => "-".repeat(w)))];
  for (const row of cells) out.push(line(row));
  return out.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const discoveryJobId = getValue(args, "discovery-job-id");
  const status = getValue(args, "status", "all") as CandidateReviewStatusFilter;
  const source = getValue(args, "source") as DiscoverySourceType | undefined;
  const query = getValue(args, "query");
  const includeExisting = args.flags.has("include-existing");
  const onlyPromotable = args.flags.has("only-promotable");
  const limit = getIntValue(args, "limit", DEFAULT_CANDIDATE_REVIEW_LIMIT);
  const output = (getValue(args, "output", "table") as "table" | "json" | "markdown")!;

  if (!VALID_STATUS_FILTERS.includes(status)) {
    console.error(`[list-candidates] REFUSED: --status must be one of: ${VALID_STATUS_FILTERS.join(", ")}.`);
    process.exit(1);
  }
  if (source && !VALID_SOURCES.includes(source)) {
    console.error(`[list-candidates] REFUSED: --source must be one of: ${VALID_SOURCES.join(", ")}.`);
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false — this reads existing persisted data, so it
  // needs a real (non-production) target. Production is still refused by
  // selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[list-candidates] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await listCandidatesForReview(
    { discoveryJobId, status, source, query, includeExisting, onlyPromotable, limit },
    { discoveryRepo: repos.discoveryRepo, clinicRepo: repos.clinicRepo },
  );

  if (!result.ok) {
    console.error(`[list-candidates] FAILED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  if (result.result.count === 0) {
    console.log(
      JSON.stringify(
        {
          count: 0,
          note: "No candidates matched this filter. Nothing to promote from this query — see docs/operations/crawler-single-prospect-operator-run-v1.md for what to do next instead of broadening the search.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (output === "json") {
    console.log(JSON.stringify(result.result, null, 2));
  } else if (output === "markdown") {
    console.log(renderCandidateListMarkdown(result.result));
  } else {
    console.log(renderTable(result.result.items));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
