import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeHttpToHttpsIfSafe,
  isBlockedIpAddress,
  isSameOrigin,
  normalizeCrawlUrl,
  parseAndNormalizePublicUrl,
  resolveAndValidatePublicUrl,
  shouldSkipPath,
} from "./url-policy";
import type { LookupFn } from "./url-policy";

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

  it("skips login and appointment portal paths", () => {
    assert.equal(shouldSkipPath("/login"), true);
    assert.equal(shouldSkipPath("/paciente/area"), true);
    assert.equal(shouldSkipPath("/agendamento/novo"), true);
    assert.equal(shouldSkipPath("/portal/cliente"), true);
  });

  it("blocks CGNAT and IPv4-mapped IPv6", () => {
    assert.equal(isBlockedIpAddress("100.64.0.1"), true);
    assert.equal(isBlockedIpAddress("::ffff:127.0.0.1"), true);
  });

  it("simulates DNS rebinding to metadata IP", async () => {
    const result = await resolveAndValidatePublicUrl(
      "https://clinic.example.com/",
      async () => [{ address: "169.254.169.254", family: 4 }],
    );
    assert.equal(result.ok, false);
  });
});

describe("canonicalizeHttpToHttpsIfSafe", () => {
  const PUBLIC_LOOKUP: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

  function fetchReturning(status: number, headers: Record<string, string> = {}): typeof fetch {
    return (async () => new Response(null, { status, headers })) as unknown as typeof fetch;
  }

  it("1. an http:// URL whose https:// counterpart passes the SSRF guard and a healthy preflight is canonicalized to https:// on the identical host", async () => {
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/sobre", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(200),
    });
    assert.equal(result.upgraded, true);
    assert.equal(result.url, "https://clinic.example.com/sobre");
    assert.equal(result.reason, "http_to_https_preflight_ok");
  });

  it("2. an https:// input is returned unchanged, without ever calling lookupImpl or fetchImpl", async () => {
    let lookupCalled = false;
    let fetchCalled = false;
    const result = await canonicalizeHttpToHttpsIfSafe("https://clinic.example.com/", {
      lookupImpl: async () => {
        lookupCalled = true;
        return [{ address: "93.184.216.34", family: 4 }];
      },
      fetchImpl: (async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.url, "https://clinic.example.com/");
    assert.equal(result.reason, "not_http");
    assert.equal(lookupCalled, false);
    assert.equal(fetchCalled, false);
  });

  it("3+7. a host that the caller's lookupImpl rejects (simulating a non-allowlisted host) is never upgraded and never preflighted", async () => {
    let fetchCalled = false;
    const rejectingLookup: LookupFn = async (hostname) => {
      throw new Error(`blocked_host: ${hostname} is not in the controlled-automation allowlist`);
    };
    const result = await canonicalizeHttpToHttpsIfSafe("http://not-approved.example.org/", {
      lookupImpl: rejectingLookup,
      fetchImpl: (async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.url, "http://not-approved.example.org/");
    assert.match(result.reason, /^ssrf_guard_failed:/);
    assert.equal(fetchCalled, false);
  });

  it("4. a preflight redirect to a different host is refused, never upgraded", async () => {
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(302, { location: "https://totally-different.example.net/" }),
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.url, "http://clinic.example.com/");
    assert.equal(result.reason, "https_preflight_redirect_cross_host");
  });

  it("a preflight redirect that stays on the identical host is accepted as the canonical URL", async () => {
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(301, { location: "https://clinic.example.com/home" }),
    });
    assert.equal(result.upgraded, true);
    assert.equal(result.url, "https://clinic.example.com/home");
    assert.equal(result.reason, "http_to_https_same_host_redirect");
  });

  it("4b. a cross-host redirect (e.g. www -> apex) is accepted ONLY when the target host is explicitly in additionalApprovedHostnames, and is independently re-validated through the SSRF guard", async () => {
    // Real-world case found in staging: https://www.cepelle.com.br/ redirects to https://cepelle.com.br/ (apex, not just a scheme change).
    const result = await canonicalizeHttpToHttpsIfSafe("http://www.cepelle.com.br/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(301, { location: "https://cepelle.com.br/" }),
      additionalApprovedHostnames: ["cepelle.com.br", "www.cepelle.com.br"],
    });
    assert.equal(result.upgraded, true);
    assert.equal(result.url, "https://cepelle.com.br/");
    assert.equal(result.reason, "http_to_https_cross_host_redirect_approved");

    // Without the target host on the approved list, the exact same redirect is refused.
    const withoutApproval = await canonicalizeHttpToHttpsIfSafe("http://www.cepelle.com.br/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(301, { location: "https://cepelle.com.br/" }),
      additionalApprovedHostnames: ["www.cepelle.com.br"],
    });
    assert.equal(withoutApproval.upgraded, false);
    assert.equal(withoutApproval.reason, "https_preflight_redirect_cross_host");
  });

  it("4c. an approved-by-name cross-host redirect target is still refused if it independently fails the SSRF guard (e.g. resolves to a private IP)", async () => {
    const rebindingLookup: LookupFn = async (hostname) =>
      hostname === "cepelle.com.br" ? [{ address: "127.0.0.1", family: 4 }] : [{ address: "93.184.216.34", family: 4 }];
    const result = await canonicalizeHttpToHttpsIfSafe("http://www.cepelle.com.br/", {
      lookupImpl: rebindingLookup,
      fetchImpl: fetchReturning(301, { location: "https://cepelle.com.br/" }),
      additionalApprovedHostnames: ["cepelle.com.br", "www.cepelle.com.br"],
    });
    assert.equal(result.upgraded, false);
    assert.match(result.reason, /^ssrf_guard_failed_cross_host:/);
  });

  it("5. a private/loopback resolved address is blocked by the SSRF guard, never upgraded, never preflighted", async () => {
    let fetchCalled = false;
    const privateLookup: LookupFn = async () => [{ address: "127.0.0.1", family: 4 }];
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/", {
      lookupImpl: privateLookup,
      fetchImpl: (async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.reason, "ssrf_guard_failed:blocked_host");
    assert.equal(fetchCalled, false);
  });

  it("6. a connection/TLS-level failure during the preflight leaves the URL unchanged — no bypass", async () => {
    const throwingFetch: typeof fetch = (async () => {
      throw new Error("simulated TLS failure");
    }) as unknown as typeof fetch;
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: throwingFetch,
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.url, "http://clinic.example.com/");
    assert.equal(result.reason, "https_preflight_failed");
  });

  it("a non-2xx/3xx preflight response is not upgraded", async () => {
    const result = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/", {
      lookupImpl: PUBLIC_LOOKUP,
      fetchImpl: fetchReturning(500),
    });
    assert.equal(result.upgraded, false);
    assert.equal(result.reason, "https_preflight_status_500");
  });

  it("12. the result is deterministic — identical inputs produce an identical result object", async () => {
    const options = { lookupImpl: PUBLIC_LOOKUP, fetchImpl: fetchReturning(200) };
    const a = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/pagina", options);
    const b = await canonicalizeHttpToHttpsIfSafe("http://clinic.example.com/pagina", options);
    assert.deepEqual(a, b);
  });

  it("an invalid URL never crashes — returns upgraded: false", async () => {
    const result = await canonicalizeHttpToHttpsIfSafe("not a url", {});
    assert.equal(result.upgraded, false);
    assert.equal(result.reason, "invalid_url");
  });
});
