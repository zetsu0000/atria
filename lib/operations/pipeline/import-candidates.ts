/**
 * Step 1-2 of the controlled automation pipeline: import candidates from a
 * CSV/fixture and deduplicate them (in-memory + against existing DB rows)
 * before recording them. Never calls an external API — CSV/fixture input
 * only.
 */
import {
  classifyCandidateDuplicate,
  createEmptyDedupeLookup,
  parseManualCsvRows,
  rememberCandidateInLookup,
} from "@/lib/discovery/normalize";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { ProspectCandidateRecord } from "@/lib/operations/repositories/types";

export const DEFAULT_MAX_CANDIDATES = 5;

export type ImportCandidatesInput = {
  csvText: string;
  /** Hard bound on how many candidates this import will record. */
  maxCandidates?: number;
};

export type ImportCandidatesDeps = {
  discoveryRepo: DiscoveryRepository;
};

export type ImportCandidatesResult = {
  discoveryJobId: string;
  totalRowsInCsv: number;
  imported: ProspectCandidateRecord[];
  duplicates: Array<{ dedupeKey: string; reason: string; rawName: string }>;
  rejectedRows: Array<{ row: number; message: string }>;
  truncatedByMaxCandidates: boolean;
};

export async function importCandidatesFromCsv(
  input: ImportCandidatesInput,
  deps: ImportCandidatesDeps,
): Promise<ImportCandidatesResult> {
  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const parsedRows = parseManualCsvRows(input.csvText, "csv_import");

  const discoveryJob = await deps.discoveryRepo.createDiscoveryJob({
    sourceType: "csv_import",
    notes: `Controlled pipeline import (maxCandidates=${maxCandidates})`,
  });
  if (!discoveryJob.ok) {
    throw new Error(`Failed to create discovery job: ${discoveryJob.message}`);
  }

  const lookup = createEmptyDedupeLookup();
  const imported: ProspectCandidateRecord[] = [];
  const duplicates: ImportCandidatesResult["duplicates"] = [];
  const rejectedRows: ImportCandidatesResult["rejectedRows"] = [];
  let truncatedByMaxCandidates = false;

  for (const row of parsedRows) {
    if (imported.length >= maxCandidates) {
      truncatedByMaxCandidates = true;
      break;
    }
    if (!row.ok) {
      rejectedRows.push({ row: row.row, message: row.message });
      continue;
    }

    const candidate = row.candidate;
    const inBatchDup = classifyCandidateDuplicate(candidate, lookup);
    if (inBatchDup.isDuplicate) {
      duplicates.push({ dedupeKey: candidate.dedupeKey, reason: inBatchDup.reason ?? "duplicate", rawName: candidate.rawName });
      continue;
    }

    const existing = await deps.discoveryRepo.findCandidateByDedupeKey(candidate.dedupeKey);
    if (!existing.ok) {
      rejectedRows.push({ row: 0, message: `Dedupe lookup failed: ${existing.message}` });
      continue;
    }
    if (existing.value) {
      duplicates.push({ dedupeKey: candidate.dedupeKey, reason: "existing_in_db", rawName: candidate.rawName });
      continue;
    }

    const recorded = await deps.discoveryRepo.recordCandidate({
      discoveryJobId: discoveryJob.value.id,
      sourceType: candidate.sourceType,
      rawName: candidate.rawName,
      normalizedName: candidate.normalizedName,
      websiteUrl: candidate.websiteUrl,
      normalizedWebsiteOrigin: candidate.normalizedWebsiteOrigin,
      phone: candidate.phone,
      email: candidate.email,
      city: candidate.city,
      state: candidate.state,
      specialty: candidate.specialty,
      sourceAttribution: candidate.sourceAttribution,
      dedupeKey: candidate.dedupeKey,
    });
    if (!recorded.ok) {
      rejectedRows.push({ row: 0, message: `Record failed: ${recorded.message}` });
      continue;
    }
    imported.push(recorded.value);
    rememberCandidateInLookup(candidate, lookup);
  }

  await deps.discoveryRepo.completeDiscoveryJob(discoveryJob.value.id, {
    status: "completed",
    candidatesCreated: imported.length,
  });

  return {
    discoveryJobId: discoveryJob.value.id,
    totalRowsInCsv: parsedRows.length,
    imported,
    duplicates,
    rejectedRows,
    truncatedByMaxCandidates,
  };
}
