import { z } from "zod";
import { DEFAULT_MAX_PAGES, HARD_MAX_PAGES } from "./types";

export const createCrawlJobSchema = z.object({
  leadId: z.string().uuid(),
  requestedUrl: z.string().trim().min(1).max(2048),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(HARD_MAX_PAGES)
    .optional()
    .default(DEFAULT_MAX_PAGES),
});

export type CreateCrawlJobParsed = z.infer<typeof createCrawlJobSchema>;

export function parseCreateCrawlJobInput(input: unknown):
  | { ok: true; data: CreateCrawlJobParsed }
  | { ok: false; message: string } {
  const result = createCrawlJobSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, message: "Invalid crawl job input." };
  }
  return { ok: true, data: result.data };
}
