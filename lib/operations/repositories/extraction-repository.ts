import type {
  CreateExtractedContentInput,
  ExtractedContentRecord,
  RepoResult,
} from "./types";

/**
 * Persistence for `extracted_content`.
 *
 * Extraction candidates are never facts. Implementations must not accept a
 * create call that marks content `approved` — approval is a separate,
 * explicit human-review action outside this repository's write path.
 */
export interface ExtractionRepository {
  saveExtractedContent(
    input: CreateExtractedContentInput,
  ): Promise<RepoResult<ExtractedContentRecord>>;

  getLatestForCrawlJob(
    crawlJobId: string,
  ): Promise<RepoResult<ExtractedContentRecord | null>>;
}
