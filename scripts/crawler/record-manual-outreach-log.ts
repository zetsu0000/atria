#!/usr/bin/env npx tsx
/**
 * Records a manual outreach log event — append-only, never sends
 * anything. This is how a human operator tells the system what they did
 * *outside* it (manually sent the approved copy, got a response, needs a
 * follow-up, or is rehearsing the pipeline) after using the Manual
 * Outreach Pack (npm run crawler:manual-outreach-pack).
 *
 * SAFE BY DEFAULT: without `--dry-run false`, this command only validates
 * the request and prints what WOULD be recorded — it never inserts a row.
 * Pass `--dry-run false` to actually record the event. This is
 * deliberate: `manual_send_logged` is a claim that a human already sent
 * something outside this system, and that claim should never be written
 * by accident.
 *
 * Usage:
 *   npx tsx scripts/crawler/record-manual-outreach-log.ts --target staging --clinic-id <id> \
 *     --outreach-message-id <id> --event-type rehearsal_logged --channel whatsapp \
 *     --operator-name "AB" --occurred-at 2026-07-22T18:00:00Z
 *
 *   npx tsx scripts/crawler/record-manual-outreach-log.ts --target staging --clinic-id <id> \
 *     --outreach-message-id <id> --event-type manual_send_logged --channel whatsapp \
 *     --operator-name "AB" --occurred-at 2026-07-22T18:00:00Z --dry-run false
 *
 * Flags:
 *   --target local|staging       Required. Refused if it (or the resolved
 *                                 SUPABASE_URL) would touch production — see
 *                                 lib/operations/pipeline/target-guard.ts.
 *   --clinic-id <id>              Required.
 *   --outreach-message-id <id>   Required.
 *   --event-type <type>           Required. One of: manual_send_logged, response_logged,
 *                                 follow_up_logged, no_response_logged, do_not_contact_logged, rehearsal_logged.
 *   --channel <channel>           Required. One of: whatsapp, email, phone, other.
 *   --operator-name <name>        Required.
 *   --occurred-at <iso>            Required.
 *   --notes <text>                 Optional.
 *   --response-received true|false  Optional.
 *   --follow-up-needed true|false   Optional.
 *   --follow-up-at <iso>           Optional.
 *   --metadata-json <json>         Optional — must parse as a JSON object.
 *   --dry-run true|false           Default true (safe). Pass "false" to actually insert.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLeadCaptureEnv } from "@/lib/security/env";
import { loadDotEnvLocalIfPresent } from "@/lib/operations/pipeline/load-dotenv-local";
import { selectRepositories } from "@/lib/operations/pipeline/select-repositories";
import type { PipelineTarget } from "@/lib/operations/pipeline/target-guard";
import { recordManualOutreachLog } from "@/lib/operations/manual-outreach-logging/record-manual-outreach-log";
import type {
  ManualOutreachLogChannel,
  ManualOutreachLogEventType,
} from "@/lib/operations/repositories/types";
import { getValue, parseArgs } from "./cli-args";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

function parseOptionalBoolean(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = getValue(args, "target") as PipelineTarget | undefined;
  const clinicId = getValue(args, "clinic-id");
  const outreachMessageId = getValue(args, "outreach-message-id");
  const eventType = getValue(args, "event-type") as ManualOutreachLogEventType | undefined;
  const channel = getValue(args, "channel") as ManualOutreachLogChannel | undefined;
  const operatorName = getValue(args, "operator-name");
  const occurredAt = getValue(args, "occurred-at");
  const notes = getValue(args, "notes");
  const responseReceived = parseOptionalBoolean(getValue(args, "response-received"));
  const followUpNeeded = parseOptionalBoolean(getValue(args, "follow-up-needed"));
  const followUpAt = getValue(args, "follow-up-at");
  const metadataJson = getValue(args, "metadata-json");
  // Safe by default: dry-run unless explicitly disabled with "--dry-run false".
  const dryRun = parseOptionalBoolean(getValue(args, "dry-run")) ?? true;

  if (!clinicId || !outreachMessageId || !eventType || !channel || !operatorName || !occurredAt) {
    console.error(
      "[record-manual-outreach-log] REFUSED: --clinic-id, --outreach-message-id, --event-type, --channel, --operator-name, and --occurred-at are all required.",
    );
    process.exit(1);
  }

  let metadata: Record<string, unknown> | undefined;
  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      metadata = parsed as Record<string, unknown>;
    } catch {
      console.error("[record-manual-outreach-log] REFUSED: --metadata-json must parse as a JSON object.");
      process.exit(1);
    }
  }

  const input = {
    clinicId,
    outreachMessageId,
    eventType,
    channel,
    operatorName,
    occurredAt,
    notes: notes ?? null,
    responseReceived: responseReceived ?? null,
    followUpNeeded: followUpNeeded ?? null,
    followUpAt: followUpAt ?? null,
    metadata,
  };

  // Dry-run (the default) never touches env/Supabase config at all — it is
  // a pure, always-available preview of what would be recorded.
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          wouldRecord: input,
          note: "Nothing was inserted. Pass --dry-run false to actually record this event. Recording is never the same as sending — no message is ever sent by this command.",
        },
        null,
        2,
      ),
    );
    return;
  }

  loadDotEnvLocalIfPresent(root);
  const env = readLeadCaptureEnv();

  const repoSelection = selectRepositories({ dryRun: false, target, env });
  if (!repoSelection.ok) {
    console.error(`[record-manual-outreach-log] REFUSED: ${repoSelection.reason}`);
    process.exit(1);
  }
  const repos = repoSelection.value;

  const result = await recordManualOutreachLog(input, {
    clinicRepo: repos.clinicRepo,
    outreachRepo: repos.outreachRepo,
    humanReviewRepo: repos.humanReviewRepo,
    manualOutreachLogRepo: repos.manualOutreachLogRepo,
  });

  if (!result.ok) {
    console.error(`[record-manual-outreach-log] BLOCKED (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        log: result.log,
        sideEffects: result.sideEffects,
        note: "Log recorded. Nothing was sent by this command — recording is not sending.",
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
