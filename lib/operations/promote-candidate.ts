import type { DiscoveryRepository } from "./repositories/discovery-repository";
import type { ClinicRepository } from "./repositories/clinic-repository";
import type { ClinicRecord, ProspectCandidateRecord, RepoErrorReason } from "./repositories/types";

export type PromoteCandidateDeps = {
  discoveryRepo: DiscoveryRepository;
  clinicRepo: ClinicRepository;
};

export type PromoteCandidateResult =
  | { ok: true; clinic: ClinicRecord; candidate: ProspectCandidateRecord }
  | {
      ok: false;
      reason: RepoErrorReason | "already_promoted" | "not_eligible";
      message: string;
    };

/**
 * Promotes a prospect_candidate to a canonical clinic record.
 *
 * Supabase's JS client has no cross-table transaction primitive, so this is
 * a two-step coordination (create clinic, then mark candidate promoted)
 * rather than a single DB transaction:
 *
 *  1. Reject candidates that are duplicate/rejected/already promoted.
 *  2. If a clinic with the same dedupe key already exists, promotion is
 *     idempotent: link the candidate to the existing clinic instead of
 *     creating a duplicate.
 *  3. Otherwise create the clinic, preserving source attribution and
 *     dedupe key, then mark the candidate promoted with the new clinic id.
 *  4. If step 3's second write fails after the clinic was created, the
 *     failure is reported explicitly rather than silently dropped — the
 *     clinic exists but the candidate row is stale and needs reconciliation.
 */
export async function promoteCandidateToClinic(
  candidateId: string,
  deps: PromoteCandidateDeps,
): Promise<PromoteCandidateResult> {
  const candidateResult = await deps.discoveryRepo.getCandidate(candidateId);
  if (!candidateResult.ok) {
    return { ok: false, reason: candidateResult.reason, message: candidateResult.message };
  }
  const candidate = candidateResult.value;

  if (candidate.status === "promoted_to_clinic") {
    return { ok: false, reason: "already_promoted", message: "Candidate is already promoted." };
  }
  if (candidate.status === "duplicate" || candidate.status === "rejected") {
    return { ok: false, reason: "not_eligible", message: "Candidate is not eligible for promotion." };
  }

  const existingClinic = await deps.clinicRepo.findClinicByDedupeKey(candidate.dedupeKey);
  if (!existingClinic.ok) {
    return { ok: false, reason: existingClinic.reason, message: existingClinic.message };
  }

  if (existingClinic.value) {
    const marked = await deps.discoveryRepo.markCandidatePromoted(candidateId, existingClinic.value.id);
    if (!marked.ok) return { ok: false, reason: marked.reason, message: marked.message };
    return { ok: true, clinic: existingClinic.value, candidate: marked.value };
  }

  const created = await deps.clinicRepo.createClinic({
    displayName: candidate.rawName,
    normalizedName: candidate.normalizedName,
    websiteUrl: candidate.websiteUrl,
    normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
    city: candidate.city,
    state: candidate.state,
    specialty: candidate.specialty,
    status: "prospect",
    sourceType: candidate.sourceType,
    sourceAttribution: {
      ...candidate.sourceAttribution,
      promotedFrom: "prospect_candidate",
      candidateDedupeKey: candidate.dedupeKey,
    },
    dedupeKey: candidate.dedupeKey,
  });
  if (!created.ok) {
    return { ok: false, reason: created.reason, message: created.message };
  }

  const marked = await deps.discoveryRepo.markCandidatePromoted(candidateId, created.value.id);
  if (!marked.ok) {
    return {
      ok: false,
      reason: marked.reason,
      message:
        "Clinic was created but the candidate could not be marked promoted; manual reconciliation required.",
    };
  }

  return { ok: true, clinic: created.value, candidate: marked.value };
}
