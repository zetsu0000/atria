import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBlockedIpAddress,
  isSameOrigin,
  normalizeCrawlUrl,
  parseAndNormalizePublicUrl,
  resolveAndValidatePublicUrl,
  shouldSkipPath,
} from "./url-policy";

describe("url-policy", () => {
  it("accepts valid public HTTPS URL", () => {
    const result = parseAndNormalizePublicUrl("https://clinic.example.com/about");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url.protocol, "https:");
      assert.equal(result.url.hostname, "clinic.example.com");
    }
  });

  it("accepts valid public HTTP URL", () => {
    const result = parseAndNormalizePublicUrl("http://clinic.example.com/");
    assert.equal(result.ok, true);
  });

  it("blocks localhost", () => {
    const result = parseAndNormalizePublicUrl("http://localhost:3000/");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");
  });

  it("blocks loopback IPv4", () => {
    const result = parseAndNormalizePublicUrl("http://127.0.0.1/");
    assert.equal(result.ok, false);
  });

  it("blocks private IPv4 ranges", () => {
    for (const host of ["10.0.0.5", "172.16.1.1", "192.168.1.10"]) {
      const result = parseAndNormalizePublicUrl(`http://${host}/`);
      assert.equal(result.ok, false, host);
    }
  });

  it("blocks private and link-local IPv6", () => {
    assert.equal(isBlockedIpAddress("::1"), true);
    assert.equal(isBlockedIpAddress("fc00::1"), true);
    assert.equal(isBlockedIpAddress("fe80::1"), true);
  });

  it("blocks cloud metadata endpoint", () => {
    const result = parseAndNormalizePublicUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(result.ok, false);
  });

  it("blocks credentials in URL", () => {
    const result = parseAndNormalizePublicUrl(
      "https://user:pass@clinic.example.com/",
    );
    assert.equal(result.ok, false);
  });

  it("blocks unsupported schemes", () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com/",
      "data:text/html,hi",
      "javascript:alert(1)",
    ]) {
      const result = parseAndNormalizePublicUrl(url);
      assert.equal(result.ok, false, url);
    }
  });

  it("blocks protocol-relative URLs", () => {
    const result = parseAndNormalizePublicUrl("//evil.example/");
    assert.equal(result.ok, false);
  });

  it("blocks nonstandard dangerous ports", () => {
    const result = parseAndNormalizePublicUrl("https://clinic.example.com:22/");
    assert.equal(result.ok, false);
  });

  it("blocks DNS resolution to private IP", async () => {
    const result = await resolveAndValidatePublicUrl(
      "https://clinic.example.com/",
      async () => [{ address: "10.0.0.8", family: 4 }],
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "blocked_host");
  });

  it("allows DNS resolution to public IP", async () => {
    const result = await resolveAndValidatePublicUrl(
      "https://clinic.example.com/",
      async () => [{ address: "93.184.216.34", family: 4 }],
    );
    assert.equal(result.ok, true);
  });

  it("rejects external origin for same-site rule", () => {
    assert.equal(
      isSameOrigin("https://other.example/", "https://clinic.example.com"),
      false,
    );
    assert.equal(
      isSameOrigin("https://clinic.example.com/a", "https://clinic.example.com"),
      true,
    );
  });

  it("normalizes links and strips tracking params", () => {
    const normalized = normalizeCrawlUrl(
      "/services?utm_source=x&id=1#frag",
      "https://clinic.example.com/",
    );
    assert.equal(normalized, "https://clinic.example.com/services?id=1");
  });

  it("skips admin and binary paths", () => {
    assert.equal(shouldSkipPath("/admin/login"), true);
    assert.equal(shouldSkipPath("/photo.jpg"), true);
    assert.equal(shouldSkipPath("/servicos"), false);
  });
});
