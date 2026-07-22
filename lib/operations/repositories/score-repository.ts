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

  /**
   * Most recent scores, newest first, capped at `limit` — the pool of
   * "review-ready" clinics (a scored clinic is one a review pack can be
   * built for). Used only to discover candidates for the human review
   * queue; not a general-purpose listing API.
   */
  listRecent(limit: number): Promise<RepoResult<ScoreRecord[]>>;
}
