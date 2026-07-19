import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conservativeRobotsPolicy,
  parseRobotsTxt,
} from "./robots";

describe("robots", () => {
  it("allows paths when robots allow", () => {
    const policy = parseRobotsTxt(
      `
User-agent: *
Allow: /
Disallow: /private
`,
      "AtriaPreviewBot/1.0",
    );
    assert.equal(policy.isPathAllowed("/"), true);
    assert.equal(policy.isPathAllowed("/about"), true);
    assert.equal(policy.isPathAllowed("/private"), false);
  });

  it("denies when robots disallow root for crawler", () => {
    const policy = parseRobotsTxt(
      `
User-agent: AtriaPreviewBot
Disallow: /
`,
      "AtriaPreviewBot/1.0",
    );
    assert.equal(policy.isPathAllowed("/"), false);
    assert.equal(policy.isPathAllowed("/about"), false);
  });

  it("uses specific user-agent group over wildcard", () => {
    const policy = parseRobotsTxt(
      `
User-agent: *
Disallow: /

User-agent: AtriaPreviewBot
Allow: /
Disallow: /secret
`,
      "AtriaPreviewBot/1.0",
    );
    assert.equal(policy.isPathAllowed("/"), true);
    assert.equal(policy.isPathAllowed("/secret"), false);
  });

  it("conservative fallback only allows home", () => {
    const policy = conservativeRobotsPolicy();
    assert.equal(policy.conservativeFallback, true);
    assert.equal(policy.isPathAllowed("/"), true);
    assert.equal(policy.isPathAllowed("/about"), false);
  });
});
