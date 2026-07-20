import type {
  CompleteDiscoveryJobInput,
  CreateDiscoveryJobInput,
  DiscoveryJobRecord,
  ProspectCandidateRecord,
  RecordCandidateInput,
  RepoResult,
} from "./types";

/**
 * Persistence for `discovery_jobs` and `prospect_candidates`.
 * Never writes directly to `clinics` — promotion is coordinated by
 * lib/operations/promote-candidate.ts across DiscoveryRepository and
 * ClinicRepository.
 */
export interface DiscoveryRepository {
  createDiscoveryJob(
    input: CreateDiscoveryJobInput,
  ): Promise<RepoResult<DiscoveryJobRecord>>;

  completeDiscoveryJob(
    jobId: string,
    patch: CompleteDiscoveryJobInput,
  ): Promise<RepoResult<DiscoveryJobRecord>>;

  /** Records one raw candidate, preserving source attribution and dedupe key. */
  recordCandidate(
    input: RecordCandidateInput,
  ): Promise<RepoResult<ProspectCandidateRecord>>;

  markCandidateDuplicate(
    candidateId: string,
    reason?: string | null,
  ): Promise<RepoResult<ProspectCandidateRecord>>;

  markCandidateRejected(
    candidateId: string,
    reason?: string | null,
  ): Promise<RepoResult<ProspectCandidateRecord>>;

  /** Marks a candidate promoted and links it to the created clinic. */
  markCandidatePromoted(
    candidateId: string,
    clinicId: string,
  ): Promise<RepoResult<ProspectCandidateRecord>>;

  getCandidate(candidateId: string): Promise<RepoResult<ProspectCandidateRecord>>;

  findCandidateByDedupeKey(
    dedupeKey: string,
  ): Promise<RepoResult<ProspectCandidateRecord | null>>;
}
