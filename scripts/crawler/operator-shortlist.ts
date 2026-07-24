#!/usr/bin/env npx tsx
/**
 * Turns one discovery job's already-persisted candidates into a ranked,
 * decision-ready shortlist for a human operator — read-only, never
 * crawls, never calls an external API (Google Places, SERP, or
 * otherwise), never promotes, mutates, or sends anything. Wraps
 * `listCandidatesForReview` (lib/operations/discovery/list-candidates.ts)
 * — every classification decision comes from there; this command only
 * ranks and relabels. See docs/technical/crawler-operator-shortlist-cli.md.
 *
 * Usage:
 *   npx tsx scripts/crawler/operator-shortlist.ts --target staging --discovery-job-id <id> --limit 5 --output markdown
 *   npx tsx scripts/crawler/operator-shortlist.ts --target staging --discovery-job-id <id> --include-existing --only-actionable
 *
 * Flags:
 *   --target local|staging   Required. Refused if it (or the resolved
 *                             SUPABASE_URL) would touch production — see
 *                             lib/operations/pipeline/target-guard.ts.
 *   --discovery-job-id <id>  Required — a shortlist is always scoped to one discovery job.
 *   --include-existing        Default off. Runs the extra read-only dedupe
 *                              lookup against already-existing clinics.
 *   --only-actionable         Default off. Only display promote_next/manual_review items.
 *   --max-candidates <n>      Default 20. How many raw candidates to consider before ranking.
 *   --limit <n>               Default 5. How many top-ranked items to display.
 *   --output table|json|markdown  Default table.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import {
  buildOperatorShortlist,
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_SHORTLIST_LIMIT,
} from "@/lib/operations/operator-shortlist/build-operator-shortlist";
import { renderOperatorShortlistMarkdown } from "@/lib/operations/operator-shortlist/render-operator-shortlist-markdown";
import type { OperatorShortlistItem } from "@/lib/operations/operator-shortlist/types";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

function renderTable(rows: OperatorShortlistItem[]): string {
  const header = ["rank", "recommendation", "icp_fit", "website_class", "name", "website", "id"];
  const cells = rows.map((r) => [
    String(r.rank),
    r.operatorRecommendation,
    r.icpFit,
    r.websiteClassification,
    r.rawName.slice(0, 32),
    (r.websiteUrl ?? "—").slice(0, 32),
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
  const includeExisting = args.flags.has("include-existing");
  const onlyActionable = args.flags.has("only-actionable");
  const maxCandidates = getIntValue(args, "max-candidates", DEFAULT_MAX_CANDIDATES);
  const limit = getIntValue(args, "limit", DEFAULT_SHORTLIST_LIMIT);
  const output = (getValue(args, "output", "table") as "table" | "json" | "markdown")!;

  if (!discoveryJobId) {
    console.error("[operator-shortlist] REFUSED: --discovery-job-id is required — a shortlist is always scoped to one discovery job.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false — this reads existing persisted data, so it
  // needs a real (non-production) target. Production is still refused by
  // selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[operator-shortlist] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const shortlistResult = await buildOperatorShortlist(
    { discoveryJobId, includeExisting, onlyActionable, maxCandidates, limit },
    { discoveryRepo: repos.discoveryRepo, clinicRepo: repos.clinicRepo },
  );

  if (!shortlistResult.ok) {
    console.error(`[operator-shortlist] FAILED (${shortlistResult.reason}): ${shortlistResult.message}`);
    process.exit(1);
  }

  const { result } = shortlistResult;

  if (result.items.length === 0) {
    console.log(
      JSON.stringify(
        {
          count: 0,
          stopReason: result.stopReason,
          note: "Nenhum candidato exibido para este discovery_job_id/filtro. Veja stopReason.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (output === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else if (output === "markdown") {
    console.log(renderOperatorShortlistMarkdown(result));
  } else {
    console.log(renderTable(result.items));
    if (result.recommendedCandidateId) {
      console.log(`\nRecomendado: ${result.recommendedCandidateId}`);
    } else if (result.stopReason) {
      console.log(`\nMotivo de parada: ${result.stopReason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
