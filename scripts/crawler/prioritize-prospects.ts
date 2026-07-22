#!/usr/bin/env npx tsx
/**
 * Ranks already-persisted candidates/clinics for human review — read-only,
 * never crawls, never calls an external API, never sends anything, never
 * mutates a single row. See docs/technical/crawler-prospect-prioritization.md.
 *
 * Usage:
 *   npx tsx scripts/crawler/prioritize-prospects.ts --target staging --output table
 *   npx tsx scripts/crawler/prioritize-prospects.ts --target staging --tier high --output markdown --write-artifact
 *   npx tsx scripts/crawler/prioritize-prospects.ts --target staging --limit 5 --output json
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --limit <n>             Default 20.
 *   --tier high|medium|low|blocked|all  Default "all".
 *   --output table|json|markdown  Default table.
 *   --write-artifact        Also write to artifacts/prioritization/ (gitignored, local only).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { prioritizeProspects } from "@/lib/operations/prioritization/prioritize-prospects";
import { renderPrioritizationMarkdown } from "@/lib/operations/prioritization/render-prioritization-markdown";
import type { PriorityTier } from "@/lib/operations/prioritization/types";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const VALID_TIER_FILTERS = ["high", "medium", "low", "blocked", "all"];

function renderTable(rows: Array<{ tier: string; score: number; kind: string; name: string; action: string; id: string }>): string {
  const header = ["tier", "score", "kind", "name", "next_action", "id"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(Object.values(r)[i]).length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  const out = [line(header), line(widths.map((w) => "-".repeat(w)))];
  for (const r of rows) {
    out.push(line([r.tier, String(r.score), r.kind, r.name, r.action, r.id]));
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const limit = getIntValue(args, "limit", 20);
  const tier = getValue(args, "tier", "all") as PriorityTier | "all";
  const output = (getValue(args, "output", "table") as "table" | "json" | "markdown")!;
  const writeArtifact = args.flags.has("write-artifact");

  if (!VALID_TIER_FILTERS.includes(tier)) {
    console.error(`[prioritize-prospects] REFUSED: --tier must be one of: ${VALID_TIER_FILTERS.join(", ")}.`);
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false — prioritization reads existing persisted
  // data, so it needs a real (non-production) target. Production is
  // still refused by selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[prioritize-prospects] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await prioritizeProspects(
    { limit, tier },
    {
      clinicRepo: repos.clinicRepo,
      discoveryRepo: repos.discoveryRepo,
      crawlRepo: repos.crawlRepo,
      scoreRepo: repos.scoreRepo,
      humanReviewRepo: repos.humanReviewRepo,
      manualOutreachLogRepo: repos.manualOutreachLogRepo,
    },
  );

  let rendered: string;
  if (output === "json") {
    rendered = JSON.stringify(result, null, 2);
  } else if (output === "markdown") {
    rendered = renderPrioritizationMarkdown(result);
  } else {
    rendered = renderTable(
      result.items.map((item) => ({
        tier: item.priorityTier,
        score: item.priorityScore,
        kind: item.kind,
        name: item.displayName.slice(0, 48),
        action: item.suggestedNextAction,
        id: item.id,
      })),
    );
  }
  console.log(rendered);

  if (writeArtifact) {
    const outDir = join(root, "artifacts/prioritization");
    mkdirSync(outDir, { recursive: true });
    const ext = output === "json" ? "json" : output === "markdown" ? "md" : "txt";
    const outPath = join(outDir, `prioritization-${tier}.${ext}`);
    writeFileSync(outPath, rendered, "utf8");
    console.error(`[prioritize-prospects] wrote artifact: ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
