/**
 * Read-only operator preflight checklist — step 1 of
 * docs/operations/crawler-operator-runbook.md. Checks only *presence* of
 * required configuration (never prints or returns a secret value) and
 * reuses the existing production guard (`assertSafeTarget`,
 * ./target-guard.ts) rather than re-implementing it. Performs no network
 * call, no Supabase query, no mutation — pure function of its inputs.
 */
import { assertSafeTarget, type PipelineTarget } from "./target-guard";

export type OperatorPreflightCheckStatus = "ok" | "warning" | "blocked";

export type OperatorPreflightCheck = {
  id: string;
  label: string;
  status: OperatorPreflightCheckStatus;
  detail: string;
};

export type OperatorPreflightInput = {
  target: PipelineTarget | undefined;
  /** The resolved SUPABASE_URL itself — a public project URL, not a secret; used only to confirm it doesn't resolve to production. */
  supabaseUrl: string | null;
  hasSupabaseServiceRoleKey: boolean;
  hasLeadHashSecret: boolean;
  hasGooglePlacesApiKey: boolean;
  hasScreenshotStorageBucket: boolean;
};

export type OperatorPreflightResult = {
  overallStatus: "ready" | "blocked";
  checks: OperatorPreflightCheck[];
};

export function runOperatorPreflight(input: OperatorPreflightInput): OperatorPreflightResult {
  const checks: OperatorPreflightCheck[] = [];

  const targetValid = input.target === "local" || input.target === "staging";
  checks.push({
    id: "target",
    label: "--target is local or staging",
    status: targetValid ? "ok" : "blocked",
    detail: targetValid ? `target=${input.target}` : `Got "${input.target ?? "none"}" — must be "local" or "staging".`,
  });

  if (targetValid) {
    const guard = assertSafeTarget(input.target as PipelineTarget, input.supabaseUrl);
    checks.push({
      id: "production_guard",
      label: "SUPABASE_URL does not resolve to production and matches --target",
      status: guard.ok ? "ok" : "blocked",
      detail: guard.ok ? "Passed lib/operations/pipeline/target-guard.ts." : guard.reason,
    });
  } else {
    checks.push({
      id: "production_guard",
      label: "SUPABASE_URL does not resolve to production and matches --target",
      status: "blocked",
      detail: "Skipped — cannot check without a valid --target.",
    });
  }

  const hasPersistenceConfig = Boolean(input.supabaseUrl) && input.hasSupabaseServiceRoleKey && input.hasLeadHashSecret;
  checks.push({
    id: "persistence_config",
    label: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and LEAD_HASH_SECRET are all present",
    status: hasPersistenceConfig ? "ok" : "blocked",
    detail: hasPersistenceConfig
      ? "All three present (values never checked or printed)."
      : "At least one of SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / LEAD_HASH_SECRET is missing — every persistence-backed command will refuse to run.",
  });

  checks.push({
    id: "google_places_config",
    label: "GOOGLE_PLACES_API_KEY present (only required for the discovery step)",
    status: input.hasGooglePlacesApiKey ? "ok" : "warning",
    detail: input.hasGooglePlacesApiKey
      ? "Present."
      : "Missing — fine unless you're about to run crawler:discover:places without --dry-run.",
  });

  checks.push({
    id: "screenshot_storage_config",
    label: "SCREENSHOT_STORAGE_BUCKET present (optional — screenshots persist as pending_storage without it)",
    status: input.hasScreenshotStorageBucket ? "ok" : "warning",
    detail: input.hasScreenshotStorageBucket
      ? "Present."
      : "Missing — screenshot capture still runs, but uploads are skipped and metadata is recorded with status pending_storage.",
  });

  const overallStatus: OperatorPreflightResult["overallStatus"] = checks.some((c) => c.status === "blocked")
    ? "blocked"
    : "ready";

  return { overallStatus, checks };
}
