import type { DiscoveryRepository } from "../repositories/discovery-repository";
import type {
  CompleteDiscoveryJobInput,
  CreateDiscoveryJobInput,
  DiscoveryJobRecord,
  ProspectCandidateRecord,
  RecordCandidateInput,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbDiscoveryJob = {
  id: string;
  source_type: DiscoveryJobRecord["sourceType"];
  status: DiscoveryJobRecord["status"];
  query: Record<string, unknown>;
  notes: string | null;
  candidates_created: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type DbCandidate = {
  id: string;
  discovery_job_id: string | null;
  source_type: ProspectCandidateRecord["sourceType"];
  status: ProspectCandidateRecord["status"];
  raw_name: string;
  normalized_name: string;
  website_url: string | null;
  normalized_website_origin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  source_attribution: Record<string, unknown>;
  dedupe_key: string;
  promoted_clinic_id: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapDiscoveryJobRow(row: DbDiscoveryJob): DiscoveryJobRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    status: row.status,
    query: row.query ?? {},
    notes: row.notes,
    candidatesCreated: row.candidates_created,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function mapCandidateRow(row: DbCandidate): ProspectCandidateRecord {
  return {
    id: row.id,
    discoveryJobId: row.discovery_job_id,
    sourceType: row.source_type,
    status: row.status,
    rawName: row.raw_name,
    normalizedName: row.normalized_name,
    websiteUrl: row.website_url,
    normalizedWebsiteOrigin: row.normalized_website_origin,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    specialty: row.specialty,
    sourceAttribution: row.source_attribution ?? {},
    dedupeKey: row.dedupe_key,
    promotedClinicId: row.promoted_clinic_id,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Discovery persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Discovery persistence is temporarily unavailable.",
};

export function createSupabaseDiscoveryRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): DiscoveryRepository {
  return {
    async createDiscoveryJob(input: CreateDiscoveryJobInput): Promise<RepoResult<DiscoveryJobRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("discovery_jobs")
          .insert({
            source_type: input.sourceType,
            status: "queued",
            query: input.query ?? {},
            notes: input.notes?.slice(0, 2000) ?? null,
          })
          .select("*")
          .single<DbDiscoveryJob>();
        if (error || !data) {
          console.warn("[atria:operations] discovery_job_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapDiscoveryJobRow(data) };
      } catch {
        console.warn("[atria:operations] discovery_job_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async completeDiscoveryJob(
      jobId: string,
      patch: CompleteDiscoveryJobInput,
    ): Promise<RepoResult<DiscoveryJobRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("discovery_jobs")
          .update({
            status: patch.status,
            candidates_created: patch.candidatesCreated,
            error_code: patch.errorCode ?? null,
            error_message: patch.errorMessage?.slice(0, 500) ?? null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .select("*")
          .maybeSingle<DbDiscoveryJob>();
        if (error) {
          console.warn("[atria:operations] discovery_job_complete_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Discovery job not found." };
        return { ok: true, value: mapDiscoveryJobRow(data) };
      } catch {
        console.warn("[atria:operations] discovery_job_complete_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async recordCandidate(input: RecordCandidateInput): Promise<RepoResult<ProspectCandidateRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("prospect_candidates")
          .insert({
            discovery_job_id: input.discoveryJobId ?? null,
            source_type: input.sourceType,
            status: input.status ?? "new",
            raw_name: input.rawName.slice(0, 200),
            normalized_name: input.normalizedName.slice(0, 200),
            website_url: input.websiteUrl?.slice(0, 2048) ?? null,
            normalized_website_origin: input.normalizedWebsiteOrigin?.slice(0, 2048) ?? null,
            phone: input.phone?.slice(0, 32) ?? null,
            email: input.email?.slice(0, 254) ?? null,
            city: input.city?.slice(0, 120) ?? null,
            state: input.state?.slice(0, 80) ?? null,
            specialty: input.specialty?.slice(0, 120) ?? null,
            source_attribution: input.sourceAttribution,
            dedupe_key: input.dedupeKey.slice(0, 512),
          })
          .select("*")
          .single<DbCandidate>();
        if (error || !data) {
          console.warn("[atria:operations] candidate_record_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapCandidateRow(data) };
      } catch {
        console.warn("[atria:operations] candidate_record_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async markCandidateDuplicate(candidateId, reason) {
      return updateCandidateStatus(env, candidateId, "duplicate", reason ?? null);
    },

    async markCandidateRejected(candidateId, reason) {
      return updateCandidateStatus(env, candidateId, "rejected", reason ?? null);
    },

    async markCandidatePromoted(candidateId, clinicId) {
      return updateCandidateStatus(env, candidateId, "promoted_to_clinic", null, clinicId);
    },

    async getCandidate(candidateId: string): Promise<RepoResult<ProspectCandidateRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("prospect_candidates")
          .select("*")
          .eq("id", candidateId)
          .maybeSingle<DbCandidate>();
        if (error) {
          console.warn("[atria:operations] candidate_get_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Candidate not found." };
        return { ok: true, value: mapCandidateRow(data) };
      } catch {
        console.warn("[atria:operations] candidate_get_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async findCandidateByDedupeKey(dedupeKey: string): Promise<RepoResult<ProspectCandidateRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("prospect_candidates")
          .select("*")
          .eq("dedupe_key", dedupeKey)
          .limit(1)
          .maybeSingle<DbCandidate>();
        if (error) {
          console.warn("[atria:operations] candidate_lookup_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapCandidateRow(data) : null };
      } catch {
        console.warn("[atria:operations] candidate_lookup_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}

async function updateCandidateStatus(
  env: LeadCaptureEnv,
  candidateId: string,
  status: ProspectCandidateRecord["status"],
  reviewNotes: string | null,
  promotedClinicId?: string,
): Promise<RepoResult<ProspectCandidateRecord>> {
  const client = getOperationsServiceClient(env);
  if (!client) return CONFIGURATION_ERROR;
  try {
    const patch: Record<string, unknown> = { status };
    if (reviewNotes !== null) patch.review_notes = reviewNotes.slice(0, 2000);
    if (promotedClinicId) patch.promoted_clinic_id = promotedClinicId;

    const { data, error } = await client
      .from("prospect_candidates")
      .update(patch)
      .eq("id", candidateId)
      .select("*")
      .maybeSingle<DbCandidate>();
    if (error) {
      console.warn("[atria:operations] candidate_status_update_failed");
      return UNAVAILABLE_ERROR;
    }
    if (!data) return { ok: false, reason: "not_found", message: "Candidate not found." };
    return { ok: true, value: mapCandidateRow(data) };
  } catch {
    console.warn("[atria:operations] candidate_status_update_exception");
    return UNAVAILABLE_ERROR;
  }
}
