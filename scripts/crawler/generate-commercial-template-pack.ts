#!/usr/bin/env npx tsx
/**
 * Generates tier-aware, review-only commercial template packs — never
 * sends anything, never crawls, never calls an external API, never
 * mutates any row. Given either a single --clinic-id/--candidate-id, or
 * --tier/--limit to sweep the current prioritization ranking, prints a
 * CommercialTemplatePack per prospect. See
 * docs/technical/crawler-commercial-templates-by-tier.md.
 *
 * Usage:
 *   npx tsx scripts/crawler/generate-commercial-template-pack.ts --target staging --clinic-id <id>
 *   npx tsx scripts/crawler/generate-commercial-template-pack.ts --target staging --candidate-id <id> --output json
 *   npx tsx scripts/crawler/generate-commercial-template-pack.ts --target staging --tier high --limit 5 --output markdown --write-artifact
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>        Generate for exactly this clinic.
 *   --candidate-id <id>     Generate for exactly this candidate.
 *   --tier high|medium|low|blocked  Sweep mode: generate for every prospect at this tier (per the current prioritization ranking).
 *   --limit <n>             Sweep mode only. Default 20.
 *   --output json|markdown  Default markdown.
 *   --write-artifact        Also write to artifacts/commercial-templates/ (gitignored, local only).
 *
 * Exactly one of --clinic-id / --candidate-id / --tier is required.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { buildCommercialTemplatePack } from "@/lib/operations/commercial-templates/build-commercial-template-pack";
import { renderCommercialTemplatePackMarkdown } from "@/lib/operations/commercial-templates/render-commercial-template-pack-markdown";
import { prioritizeProspects } from "@/lib/operations/prioritization/prioritize-prospects";
import type { PriorityTier } from "@/lib/operations/prioritization/types";
import { getIntValue, getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const VALID_TIERS = ["high", "medium", "low", "blocked"];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const candidateId = getValue(args, "candidate-id");
  const tier = getValue(args, "tier") as PriorityTier | undefined;
  const limit = getIntValue(args, "limit", 20);
  const output = (getValue(args, "output", "markdown") as "json" | "markdown")!;
  const writeArtifact = args.flags.has("write-artifact");

  const modeCount = [Boolean(clinicId), Boolean(candidateId), Boolean(tier)].filter(Boolean).length;
  if (modeCount !== 1) {
    console.error("[generate-commercial-template-pack] REFUSED: pass exactly one of --clinic-id, --candidate-id, or --tier.");
    process.exit(1);
  }
  if (tier && !VALID_TIERS.includes(tier)) {
    console.error(`[generate-commercial-template-pack] REFUSED: --tier must be one of: ${VALID_TIERS.join(", ")}.`);
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[generate-commercial-template-pack] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;
  const deps = {
    clinicRepo: repos.clinicRepo,
    discoveryRepo: repos.discoveryRepo,
    crawlRepo: repos.crawlRepo,
    scoreRepo: repos.scoreRepo,
    humanReviewRepo: repos.humanReviewRepo,
    manualOutreachLogRepo: repos.manualOutreachLogRepo,
  };

  const ids: Array<{ clinicId?: string; candidateId?: string }> = [];
  if (clinicId) ids.push({ clinicId });
  else if (candidateId) ids.push({ candidateId });
  else {
    const ranked = await prioritizeProspects({ tier, limit }, deps);
    for (const item of ranked.items) {
      if (item.kind === "clinic") ids.push({ clinicId: item.id });
      else ids.push({ candidateId: item.id });
    }
  }

  const rendered: string[] = [];
  for (const idInput of ids) {
    const result = await buildCommercialTemplatePack(idInput, deps);
    if (!result.ok) {
      console.error(`[generate-commercial-template-pack] FAILED for ${JSON.stringify(idInput)} (${result.reason}): ${result.message}`);
      continue;
    }
    rendered.push(output === "json" ? JSON.stringify(result.pack, null, 2) : renderCommercialTemplatePackMarkdown(result.pack));
  }

  const combined = output === "json" ? `[${rendered.join(",\n")}]` : rendered.join("\n---\n\n");
  console.log(combined);

  if (writeArtifact) {
    const outDir = join(root, "artifacts/commercial-templates");
    mkdirSync(outDir, { recursive: true });
    const ext = output === "json" ? "json" : "md";
    const label = clinicId ?? candidateId ?? `tier-${tier}`;
    const outPath = join(outDir, `${label}.${ext}`);
    writeFileSync(outPath, combined, "utf8");
    console.error(`[generate-commercial-template-pack] wrote artifact: ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
