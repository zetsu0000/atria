/**
 * Wires the seven repositories for the controlled pipeline: in-memory fakes
 * for --dry-run (never touches Supabase, never reads SUPABASE_* env beyond
 * what's already resolved), or real Supabase adapters gated by
 * lib/operations/pipeline/target-guard.ts for --target local/staging.
 */
import type { LeadCaptureEnv } from "@/lib/security/env";
import {
  FakeClinicRepository,
  FakeCrawlRepository,
  FakeDiscoveryRepository,
  FakeExtractionRepository,
  FakeHumanReviewRepository,
  FakeOutreachRepository,
  FakeScoreRepository,
} from "@/lib/operations/repositories/fakes";
import { createSupabaseDiscoveryRepository } from "@/lib/operations/supabase/discovery-repository.supabase";
import { createSupabaseClinicRepository } from "@/lib/operations/supabase/clinic-repository.supabase";
import { createSupabaseCrawlRepository } from "@/lib/operations/supabase/crawl-repository.supabase";
import { createSupabaseExtractionRepository } from "@/lib/operations/supabase/extraction-repository.supabase";
import { createSupabaseScoreRepository } from "@/lib/operations/supabase/score-repository.supabase";
import { createSupabaseOutreachRepository } from "@/lib/operations/supabase/outreach-repository.supabase";
import { createSupabaseHumanReviewRepository } from "@/lib/operations/supabase/human-review-repository.supabase";
import type { DiscoveryRepository } from "@/lib/operations/repositories/discovery-repository";
import type { ClinicRepository } from "@/lib/operations/repositories/clinic-repository";
import type { CrawlRepository } from "@/lib/operations/repositories/crawl-repository";
import type { ExtractionRepository } from "@/lib/operations/repositories/extraction-repository";
import type { ScoreRepository } from "@/lib/operations/repositories/score-repository";
import type { OutreachRepository } from "@/lib/operations/repositories/outreach-repository";
import type { HumanReviewRepository } from "@/lib/operations/repositories/human-review-repository";
import { assertSafeTarget, type PipelineTarget } from "./target-guard";

export type SelectRepositoriesOptions = {
  dryRun: boolean;
  /** Required when dryRun is false; ignored (but harmless) when dryRun is true. */
  target?: PipelineTarget;
  env: LeadCaptureEnv;
};

export type SelectedRepositories = {
  discoveryRepo: DiscoveryRepository;
  clinicRepo: ClinicRepository;
  crawlRepo: CrawlRepository;
  extractionRepo: ExtractionRepository;
  scoreRepo: ScoreRepository;
  outreachRepo: OutreachRepository;
  humanReviewRepo: HumanReviewRepository;
  usedFakes: boolean;
};

export type SelectRepositoriesResult = { ok: true; value: SelectedRepositories } | { ok: false; reason: string };

export function selectRepositories(options: SelectRepositoriesOptions): SelectRepositoriesResult {
  if (options.dryRun) {
    return {
      ok: true,
      value: {
        discoveryRepo: new FakeDiscoveryRepository(),
        clinicRepo: new FakeClinicRepository(),
        crawlRepo: new FakeCrawlRepository(),
        extractionRepo: new FakeExtractionRepository(),
        scoreRepo: new FakeScoreRepository(),
        outreachRepo: new FakeOutreachRepository(),
        humanReviewRepo: new FakeHumanReviewRepository(),
        usedFakes: true,
      },
    };
  }

  if (!options.target) {
    return { ok: false, reason: "Refusing: --target (local|staging) is required unless --dry-run is set." };
  }

  const guard = assertSafeTarget(options.target, options.env.supabaseUrl);
  if (!guard.ok) {
    return { ok: false, reason: guard.reason };
  }

  return {
    ok: true,
    value: {
      discoveryRepo: createSupabaseDiscoveryRepository(options.env),
      clinicRepo: createSupabaseClinicRepository(options.env),
      crawlRepo: createSupabaseCrawlRepository(options.env),
      extractionRepo: createSupabaseExtractionRepository(options.env),
      scoreRepo: createSupabaseScoreRepository(options.env),
      outreachRepo: createSupabaseOutreachRepository(options.env),
      humanReviewRepo: createSupabaseHumanReviewRepository(options.env),
      usedFakes: false,
    },
  };
}
