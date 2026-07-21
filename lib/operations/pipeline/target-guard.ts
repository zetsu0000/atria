/**
 * Safety gate for the controlled-automation pipeline.
 *
 * These are public Supabase *project refs* (part of the project URL, not
 * secrets) used only to make sure this pipeline can never point at the
 * production project, and — when a non-local target is claimed — that it
 * actually resolves to the known staging project rather than something
 * unexpected. Never store credentials here.
 */
export type PipelineTarget = "local" | "staging";

export const KNOWN_PROJECT_REFS = {
  /** Atria — the production project. This pipeline must never target it. */
  production: "cskodsnvghavkcjwmafr",
  /** atria-staging — the only real remote project this pipeline may target. */
  staging: "lfkyiztuwptmddsraucg",
} as const;

export type TargetGuardResult = { ok: true } | { ok: false; reason: string };

function extractProjectRef(supabaseUrl: string | null): string | null {
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1]!.toLowerCase() : null;
}

function isLoopbackUrl(supabaseUrl: string): boolean {
  try {
    const parsed = new URL(supabaseUrl);
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Validates that `target` and the resolved `SUPABASE_URL` agree, and that
 * neither ever points at production — regardless of which target the
 * caller claims. This is the primary safety gate for the controlled
 * pipeline's non-dry-run modes.
 */
export function assertSafeTarget(target: PipelineTarget, supabaseUrl: string | null): TargetGuardResult {
  const ref = extractProjectRef(supabaseUrl);

  // Hard block, independent of the requested target: never production.
  if (ref === KNOWN_PROJECT_REFS.production) {
    return {
      ok: false,
      reason: `Refusing: SUPABASE_URL resolves to the production project (ref ${KNOWN_PROJECT_REFS.production}). This pipeline must never target production.`,
    };
  }

  if (target === "local") {
    if (supabaseUrl && !isLoopbackUrl(supabaseUrl)) {
      return {
        ok: false,
        reason: "Refusing: --target local requires SUPABASE_URL to be a loopback address (127.0.0.1/localhost) — got a non-local URL.",
      };
    }
    return { ok: true };
  }

  if (target === "staging") {
    if (ref !== KNOWN_PROJECT_REFS.staging) {
      return {
        ok: false,
        reason: `Refusing: --target staging requires SUPABASE_URL to resolve to the known staging project (ref ${KNOWN_PROJECT_REFS.staging}), got ref=${ref ?? "none"}.`,
      };
    }
    return { ok: true };
  }

  return { ok: false, reason: `Refusing: unknown target "${target}". Only "local" and "staging" are allowed.` };
}
