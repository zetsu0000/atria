#!/usr/bin/env npx tsx
/**
 * Generates the Manual Outreach Pack for an existing clinic — the final
 * operator-facing artifact used immediately before a human manually
 * contacts a clinic. Read-only: never crawls, never calls an external API,
 * never creates, mutates, or sends anything. Requires the clinic's
 * requested channel(s) to pass the outreach approval gate
 * (lib/operations/outreach/approval-gate.ts) — if every requested channel
 * is blocked, this command exits non-zero and prints nothing to send.
 *
 * Usage:
 *   npx tsx scripts/crawler/generate-manual-outreach-pack.ts --target staging --clinic-id <id>
 *   npx tsx scripts/crawler/generate-manual-outreach-pack.ts --target staging --clinic-id <id> --channel whatsapp --output json
 *   npx tsx scripts/crawler/generate-manual-outreach-pack.ts --target staging --clinic-id <id> --write-artifact
 *
 * Flags:
 *   --target local|staging       Required. Refused if it (or the resolved
 *                                 SUPABASE_URL) would touch production — see
 *                                 lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>              Required.
 *   --outreach-message-id <id>   Optional — only valid with a single --channel (whatsapp or email).
 *   --channel whatsapp|email|both  Default "both".
 *   --output markdown|json        Default markdown.
 *   --write-artifact              Also write the pack to artifacts/manual-outreach-packs/ (gitignored, local only — no public upload).
 *   --include-score-in-copy       Default off. Adds a pack-only annotation next to the copy; never rewrites the persisted message body.
 *   --include-screenshot-links    Default off. Surfaces the screenshot's private storage path (never a public/signed URL).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import {
  buildManualOutreachPack,
  type ManualOutreachChannelRequest,
} from "@/lib/operations/manual-outreach/build-manual-outreach-pack";
import { renderManualOutreachPackMarkdown } from "@/lib/operations/manual-outreach/render-manual-outreach-pack-markdown";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const outreachMessageId = getValue(args, "outreach-message-id");
  const channel = (getValue(args, "channel", "both") as ManualOutreachChannelRequest)!;
  const output = (getValue(args, "output", "markdown") as "markdown" | "json")!;
  const writeArtifact = args.flags.has("write-artifact");
  const includeScoreInCopy = args.flags.has("include-score-in-copy");
  const includeScreenshotLinks = args.flags.has("include-screenshot-links");

  if (!clinicId || !clinicId.trim()) {
    console.error("[generate-manual-outreach-pack] REFUSED: --clinic-id is required.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  // dryRun is always false here — the pack reads existing persisted data
  // and depends on the approval gate's real state, so it needs a real
  // (non-production) target. Production is still refused by
  // selectRepositories/assertSafeTarget regardless.
  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[generate-manual-outreach-pack] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await buildManualOutreachPack(
    { clinicId, outreachMessageId, channel, includeScoreInCopy, includeScreenshotLinks },
    {
      clinicRepo: repos.clinicRepo,
      crawlRepo: repos.crawlRepo,
      extractionRepo: repos.extractionRepo,
      scoreRepo: repos.scoreRepo,
      outreachRepo: repos.outreachRepo,
      humanReviewRepo: repos.humanReviewRepo,
    },
  );

  if (!result.ok) {
    console.error(`[generate-manual-outreach-pack] BLOCKED (${result.reason}): ${result.message}`);
    if (result.approvalGateResults.length > 0) {
      console.error(JSON.stringify(result.approvalGateResults, null, 2));
    }
    process.exit(1);
  }

  if (result.pack.status === "partial_blocked") {
    console.error(
      "[generate-manual-outreach-pack] WARNING: partial_blocked — at least one requested channel was blocked and has no copy in this pack.",
    );
  }

  const rendered = output === "json" ? JSON.stringify(result.pack, null, 2) : renderManualOutreachPackMarkdown(result.pack);
  console.log(rendered);

  if (writeArtifact) {
    const outDir = join(root, "artifacts/manual-outreach-packs");
    mkdirSync(outDir, { recursive: true });
    const ext = output === "json" ? "json" : "md";
    const outPath = join(outDir, `${clinicId}.${ext}`);
    writeFileSync(outPath, rendered, "utf8");
    console.error(`[generate-manual-outreach-pack] wrote artifact: ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
