import type { CreateScoreInput, RepoResult, ScoreRecord } from "./types";

/**
 * Persistence for `scores`. The five dimensions, total, evidence, and
 * disclaimer are validated by `lib/score/calculate.ts` (`digitalScoreSchema`)
 * before an implementation ever writes a row.
 */
export interface ScoreRepository {
  saveScore(input: CreateScoreInput): Promise<RepoResult<ScoreRecord>>;

  getLatestForClinic(clinicId: string): Promise<RepoResult<ScoreRecord | null>>;

  getForCrawlJob(crawlJobId: string): Promise<RepoResult<ScoreRecord | null>>;
}
