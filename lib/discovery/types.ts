import { z } from "zod";

export const DISCOVERY_SOURCE_TYPES = [
  "manual",
  "csv_import",
  "google_places",
  "web_search",
  "directory",
  "other",
] as const;

export type DiscoverySourceType = (typeof DISCOVERY_SOURCE_TYPES)[number];

export const CANDIDATE_STATUSES = [
  "new",
  "needs_review",
  "duplicate",
  "rejected",
  "promoted_to_clinic",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CLINIC_STATUSES = [
  "prospect",
  "qualified",
  "previewing",
  "client",
  "inactive",
  "archived",
] as const;

export type ClinicStatus = (typeof CLINIC_STATUSES)[number];

/** Fields that must never appear on discovery/clinic records. */
export const FORBIDDEN_PATIENT_DATA_KEYS = [
  "patientName",
  "patient_name",
  "symptom",
  "symptoms",
  "healthRecord",
  "health_record",
  "medicalRecord",
  "medical_record",
  "cpf",
  "prontuario",
  "prontuário",
] as const;

export const rawProspectCandidateSchema = z
  .object({
    rawName: z.string().trim().min(1).max(200),
    websiteUrl: z.string().trim().max(2048).optional().nullable(),
    phone: z.string().trim().max(32).optional().nullable(),
    email: z.string().trim().max(254).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    state: z.string().trim().max(80).optional().nullable(),
    specialty: z.string().trim().max(120).optional().nullable(),
    sourceType: z.enum(DISCOVERY_SOURCE_TYPES),
    sourceAttribution: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .strict();

export type RawProspectCandidateInput = z.infer<typeof rawProspectCandidateSchema>;

export type NormalizedProspectCandidate = {
  rawName: string;
  normalizedName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  sourceType: DiscoverySourceType;
  sourceAttribution: Record<string, unknown>;
  dedupeKey: string;
  status: CandidateStatus;
};

export type ClinicRecordShape = {
  displayName: string;
  normalizedName: string;
  websiteUrl: string | null;
  normalizedWebsiteOrigin: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  status: ClinicStatus;
  sourceType: DiscoverySourceType | "inbound_lead";
  sourceAttribution: Record<string, unknown>;
  dedupeKey: string;
};
