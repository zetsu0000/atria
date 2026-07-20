import type {
  ClinicContactRecord,
  ClinicRecord,
  CreateClinicContactInput,
  CreateClinicInput,
  RepoResult,
} from "./types";

/**
 * Persistence for `clinics` and `clinic_contacts`.
 *
 * `do_not_contact` has no dedicated column yet (see docs/technical/
 * crawler-next-steps.md) and is tracked inside `clinics.source_attribution`
 * as `{ doNotContact: boolean, doNotContactReason: string | null }`.
 */
export interface ClinicRepository {
  createClinic(input: CreateClinicInput): Promise<RepoResult<ClinicRecord>>;

  getClinic(clinicId: string): Promise<RepoResult<ClinicRecord>>;

  findClinicByDedupeKey(
    dedupeKey: string,
  ): Promise<RepoResult<ClinicRecord | null>>;

  /** Updates the normalized website host after a crawl confirms/changes it. */
  updateNormalizedWebsiteHost(
    clinicId: string,
    input: { websiteUrl: string | null; normalizedWebsiteOrigin: string | null },
  ): Promise<RepoResult<ClinicRecord>>;

  /** Blocks or flags a clinic for do_not_contact. Never deletes existing contacts. */
  setDoNotContact(
    clinicId: string,
    blocked: boolean,
    reason?: string | null,
  ): Promise<RepoResult<ClinicRecord>>;

  /** Attaches a contact, preserving source URL and review status. */
  addContact(
    input: CreateClinicContactInput,
  ): Promise<RepoResult<ClinicContactRecord>>;

  listContacts(clinicId: string): Promise<RepoResult<ClinicContactRecord[]>>;
}
