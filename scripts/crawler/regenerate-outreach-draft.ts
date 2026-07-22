#!/usr/bin/env npx tsx
/**
 * Builds and persists a fresh outreach draft for an existing clinic from
 * its latest already-persisted score evidence — never crawls, never
 * calls an external API, never sends anything. Always persists with
 * `status: "draft"` (buildOutreachDraft/createDraft never produce
 * anything else).
 *
 * This is the explicit, human-triggered counterpart to the review pack's
 * own "fresh generation" fallback (lib/operations/review/build-human-review-pack.ts),
 * which deliberately never persists — this script exists for exactly the
 * moment a human reviewer has polished the draft template/copy and wants
 * the clinic's persisted draft to reflect it, without re-crawling.
 *
 * Usage:
 *   npx tsx scripts/crawler/regenerate-outreach-draft.ts --target staging --clinic-id <id> --channel email
 *   npx tsx scripts/crawler/regenerate-outreach-draft.ts --target staging --clinic-id <id> --channel whatsapp_manual --whatsapp-digits 5511900000000
 *
 * Flags:
 *   --target local|staging  Required. Refused if it (or the resolved
 *                           SUPABASE_URL) would touch production — see
 *                           lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>        Required.
 *   --channel email|whatsapp_manual  Required.
 *   --whatsapp-digits <n>   Optional — only used for channel=whatsapp_manual, to build a click-to-chat URL.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { buildOutreachDraft, type BuildOutreachDraftInput } from "@/lib/outreach/draft";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const channel = getValue(args, "channel") as BuildOutreachDraftInput["channel"] | undefined;
  const whatsappDigits = getValue(args, "whatsapp-digits");

  if (!clinicId || !clinicId.trim()) {
    console.error("[regenerate-outreach-draft] REFUSED: --clinic-id is required.");
    process.exit(1);
  }
  if (channel !== "email" && channel !== "whatsapp_manual") {
    console.error("[regenerate-outreach-draft] REFUSED: --channel must be email or whatsapp_manual.");
    process.exit(1);
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[regenerate-outreach-draft] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const { clinicRepo, scoreRepo, outreachRepo } = repoSelection.value;

  const clinicResult = await clinicRepo.getClinic(clinicId);
  if (!clinicResult.ok) {
    console.error(`[regenerate-outreach-draft] FAILED (${clinicResult.reason}): ${clinicResult.message}`);
    process.exit(1);
  }
  const clinic = clinicResult.value;

  const scoreResult = await scoreRepo.getLatestForClinic(clinicId);
  if (!scoreResult.ok || !scoreResult.value) {
    console.error("[regenerate-outreach-draft] FAILED: no score found for this clinic — nothing to base a draft on.");
    process.exit(1);
  }
  const observations = scoreResult.value.evidence.map((e) => ({ observation: e.reason, sourceUrl: e.sourceUrl ?? null }));

  const built = buildOutreachDraft({
    clinicDisplayName: clinic.displayName,
    channel,
    observations,
    whatsappDigits: channel === "whatsapp_manual" ? whatsappDigits : undefined,
    doNotContact: clinic.doNotContact,
  });
  if (!built.ok) {
    console.error(`[regenerate-outreach-draft] FAILED: ${built.message}`);
    process.exit(1);
  }

  const saved = await outreachRepo.createDraft({ clinicId, draft: built.draft, doNotContact: clinic.doNotContact });
  if (!saved.ok) {
    console.error(`[regenerate-outreach-draft] FAILED (${saved.reason}): ${saved.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        outreachMessageId: saved.value.id,
        clinicId,
        channel: saved.value.channel,
        status: saved.value.status,
        subject: saved.value.subject,
        body: saved.value.body,
        clickToChatUrl: saved.value.clickToChatUrl,
        note: "Persisted as status=draft only. Nothing was sent.",
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
