import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreateCrawlJobInput } from "./schema";
import { HARD_MAX_PAGES } from "./types";

describe("crawler schema", () => {
  it("accepts a valid create-job payload", () => {
    const result = parseCreateCrawlJobInput({
      leadId: "550e8400-e29b-41d4-a716-446655440000",
      requestedUrl: "https://clinic.example.com/",
      maxPages: 5,
    });
    assert.equal(result.ok, true);
  });

  it("rejects invalid lead id and oversized max pages", () => {
    assert.equal(
      parseCreateCrawlJobInput({
        leadId: "not-a-uuid",
        requestedUrl: "https://clinic.example.com/",
      }).ok,
      false,
    );
    assert.equal(
      parseCreateCrawlJobInput({
        leadId: "550e8400-e29b-41d4-a716-446655440000",
        requestedUrl: "https://clinic.example.com/",
        maxPages: HARD_MAX_PAGES + 1,
      }).ok,
      false,
    );
  });
});
