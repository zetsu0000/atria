import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionLeadStatus,
  isLeadStatus,
  listAllowedTransitions,
} from "./status";

describe("lead status model", () => {
  it("accepts known statuses including new", () => {
    assert.equal(isLeadStatus("new"), true);
    assert.equal(isLeadStatus("crawl_pending"), true);
    assert.equal(isLeadStatus("bogus"), false);
  });

  it("allows valid transitions", () => {
    assert.equal(canTransitionLeadStatus("new", "crawl_pending"), true);
    assert.equal(canTransitionLeadStatus("crawl_pending", "crawling"), true);
    assert.equal(canTransitionLeadStatus("crawling", "crawl_complete"), true);
  });

  it("rejects invalid transitions", () => {
    assert.equal(canTransitionLeadStatus("new", "published"), false);
    assert.equal(canTransitionLeadStatus("archived", "new"), false);
    assert.equal(canTransitionLeadStatus("new", "new"), false);
  });

  it("lists allowed transitions", () => {
    const allowed = listAllowedTransitions("new");
    assert.ok(allowed.includes("contacted"));
    assert.ok(!allowed.includes("published"));
  });
});
