import type { ClinicRepository } from "../repositories/clinic-repository";
import type {
  ClinicContactRecord,
  ClinicRecord,
  CreateClinicContactInput,
  CreateClinicInput,
  RepoResult,
} from "../repositories/types";
import { getOperationsServiceClient, type LeadCaptureEnv, readLeadCaptureEnv } from "./server-client";

export type DbClinic = {
  id: string;
  display_name: string;
  normalized_name: string;
  website_url: string | null;
  normalized_website_origin: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  status: ClinicRecord["status"];
  lead_id: string | null;
  source_type: ClinicRecord["sourceType"];
  source_attribution: Record<string, unknown>;
  dedupe_key: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbContact = {
  id: string;
  clinic_id: string;
  contact_type: ClinicContactRecord["contactType"];
  value: string;
  normalized_value: string;
  source_url: string | null;
  extraction_method: ClinicContactRecord["extractionMethod"];
  confidence: ClinicContactRecord["confidence"];
  review_status: ClinicContactRecord["reviewStatus"];
  provenance: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function mapClinicRow(row: DbClinic): ClinicRecord {
  const sourceAttribution = row.source_attribution ?? {};
  return {
    id: row.id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    websiteUrl: row.website_url,
    normalizedWebsiteOrigin: row.normalized_website_origin,
    city: row.city,
    state: row.state,
    specialty: row.specialty,
    status: row.status,
    leadId: row.lead_id,
    sourceType: row.source_type,
    sourceAttribution,
    dedupeKey: row.dedupe_key,
    notes: row.notes,
    doNotContact: sourceAttribution.doNotContact === true,
    doNotContactReason:
      typeof sourceAttribution.doNotContactReason === "string" ? sourceAttribution.doNotContactReason : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapContactRow(row: DbContact): ClinicContactRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    contactType: row.contact_type,
    value: row.value,
    normalizedValue: row.normalized_value,
    sourceUrl: row.source_url,
    extractionMethod: row.extraction_method,
    confidence: row.confidence,
    reviewStatus: row.review_status,
    provenance: row.provenance ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CONFIGURATION_ERROR = {
  ok: false as const,
  reason: "configuration" as const,
  message: "Clinic persistence is not configured.",
};

const UNAVAILABLE_ERROR = {
  ok: false as const,
  reason: "unavailable" as const,
  message: "Clinic persistence is temporarily unavailable.",
};

export function createSupabaseClinicRepository(
  env: LeadCaptureEnv = readLeadCaptureEnv(),
): ClinicRepository {
  return {
    async createClinic(input: CreateClinicInput): Promise<RepoResult<ClinicRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinics")
          .insert({
            display_name: input.displayName.slice(0, 200),
            normalized_name: input.normalizedName.slice(0, 200),
            website_url: input.websiteUrl?.slice(0, 2048) ?? null,
            normalized_website_origin: input.normalizedWebsiteOrigin?.slice(0, 2048) ?? null,
            city: input.city?.slice(0, 120) ?? null,
            state: input.state?.slice(0, 80) ?? null,
            specialty: input.specialty?.slice(0, 120) ?? null,
            status: input.status,
            lead_id: input.leadId ?? null,
            source_type: input.sourceType,
            source_attribution: input.sourceAttribution,
            dedupe_key: input.dedupeKey.slice(0, 512),
          })
          .select("*")
          .single<DbClinic>();
        if (error || !data) {
          if (error?.code === "23505") {
            return { ok: false, reason: "conflict", message: "Clinic dedupe key already exists." };
          }
          console.warn("[atria:operations] clinic_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapClinicRow(data) };
      } catch {
        console.warn("[atria:operations] clinic_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async getClinic(clinicId: string): Promise<RepoResult<ClinicRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinics")
          .select("*")
          .eq("id", clinicId)
          .maybeSingle<DbClinic>();
        if (error) {
          console.warn("[atria:operations] clinic_get_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Clinic not found." };
        return { ok: true, value: mapClinicRow(data) };
      } catch {
        console.warn("[atria:operations] clinic_get_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listClinics(limit: number): Promise<RepoResult<ClinicRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinics")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit)
          .returns<DbClinic[]>();
        if (error || !data) {
          console.warn("[atria:operations] clinic_list_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data.map(mapClinicRow) };
      } catch {
        console.warn("[atria:operations] clinic_list_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async findClinicByDedupeKey(dedupeKey: string): Promise<RepoResult<ClinicRecord | null>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinics")
          .select("*")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle<DbClinic>();
        if (error) {
          console.warn("[atria:operations] clinic_lookup_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: data ? mapClinicRow(data) : null };
      } catch {
        console.warn("[atria:operations] clinic_lookup_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async updateNormalizedWebsiteHost(
      clinicId: string,
      input: { websiteUrl: string | null; normalizedWebsiteOrigin: string | null },
    ): Promise<RepoResult<ClinicRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinics")
          .update({
            website_url: input.websiteUrl?.slice(0, 2048) ?? null,
            normalized_website_origin: input.normalizedWebsiteOrigin?.slice(0, 2048) ?? null,
          })
          .eq("id", clinicId)
          .select("*")
          .maybeSingle<DbClinic>();
        if (error) {
          console.warn("[atria:operations] clinic_website_update_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Clinic not found." };
        return { ok: true, value: mapClinicRow(data) };
      } catch {
        console.warn("[atria:operations] clinic_website_update_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async setDoNotContact(
      clinicId: string,
      blocked: boolean,
      reason?: string | null,
    ): Promise<RepoResult<ClinicRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data: existing, error: fetchError } = await client
          .from("clinics")
          .select("*")
          .eq("id", clinicId)
          .maybeSingle<DbClinic>();
        if (fetchError) {
          console.warn("[atria:operations] clinic_do_not_contact_lookup_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!existing) return { ok: false, reason: "not_found", message: "Clinic not found." };

        const sourceAttribution = {
          ...(existing.source_attribution ?? {}),
          doNotContact: blocked,
          doNotContactReason: blocked ? (reason?.slice(0, 500) ?? null) : null,
        };

        const { data, error } = await client
          .from("clinics")
          .update({ source_attribution: sourceAttribution })
          .eq("id", clinicId)
          .select("*")
          .maybeSingle<DbClinic>();
        if (error) {
          console.warn("[atria:operations] clinic_do_not_contact_update_failed");
          return UNAVAILABLE_ERROR;
        }
        if (!data) return { ok: false, reason: "not_found", message: "Clinic not found." };
        return { ok: true, value: mapClinicRow(data) };
      } catch {
        console.warn("[atria:operations] clinic_do_not_contact_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async addContact(input: CreateClinicContactInput): Promise<RepoResult<ClinicContactRecord>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinic_contacts")
          .insert({
            clinic_id: input.clinicId,
            contact_type: input.contactType,
            value: input.value.slice(0, 500),
            normalized_value: input.normalizedValue.slice(0, 500),
            source_url: input.sourceUrl?.slice(0, 2048) ?? null,
            extraction_method: input.extractionMethod ?? "manual",
            confidence: input.confidence ?? "medium",
            review_status: "pending_review",
            provenance: input.provenance ?? {},
          })
          .select("*")
          .single<DbContact>();
        if (error || !data) {
          console.warn("[atria:operations] clinic_contact_create_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: mapContactRow(data) };
      } catch {
        console.warn("[atria:operations] clinic_contact_create_exception");
        return UNAVAILABLE_ERROR;
      }
    },

    async listContacts(clinicId: string): Promise<RepoResult<ClinicContactRecord[]>> {
      const client = getOperationsServiceClient(env);
      if (!client) return CONFIGURATION_ERROR;
      try {
        const { data, error } = await client
          .from("clinic_contacts")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false });
        if (error) {
          console.warn("[atria:operations] clinic_contact_list_failed");
          return UNAVAILABLE_ERROR;
        }
        return { ok: true, value: (data as DbContact[] | null)?.map(mapContactRow) ?? [] };
      } catch {
        console.warn("[atria:operations] clinic_contact_list_exception");
        return UNAVAILABLE_ERROR;
      }
    },
  };
}
