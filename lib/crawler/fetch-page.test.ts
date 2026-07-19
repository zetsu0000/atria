import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchHtmlPage } from "./fetch-page";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

describe("fetch-page", () => {
  it("fetches HTML successfully", async () => {
    const result = await fetchHtmlPage({
      url: "https://clinic.example.com/",
      allowedOrigin: "https://clinic.example.com",
      lookupImpl: publicLookup,
      fetchImpl: async () => htmlResponse("<html><body>ok</body></html>"),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.page.statusCode, 200);
      assert.match(result.page.bodyText, /ok/);
    }
  });

  it("times out", async () => {
    const result = await fetchHtmlPage({
      url: "https://clinic.example.com/",
      allowedOrigin: "https://clinic.example.com",
      lookupImpl: publicLookup,
      timeoutMs: 20,
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "timeout");
  });

  it("rejects oversized responses", async () => {
    const big = "x".repeat(2 * 1024 * 1024 + 100);
    const result = await fetchHtmlPage({
      url: "https://clinic.example.com/",
      allowedOrigin: "https://clinic.example.com",
      lookupImpl: publicLookup,
      maxBytes: 1024,
      fetchImpl: async () => htmlResponse(big),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "response_too_large");
  });

  it("rejects unsupported content type", async () => {
    const result = await fetchHtmlPage({
      url: "https://clinic.example.com/file.pdf",
      allowedOrigin: "https://clinic.example.com",
      lookupImpl: publicLookup,
      fetchImpl: async () =>
        new Response("%PDF", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_content_type");
  });

  it("blocks external redirects", async () => {
    let calls = 0;
    const result = await fetchHtmlPage({
      url: "https://clinic.example.com/",
      allowedOrigin: "https://clinic.example.com",
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        calls += 1;
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/" },
        });
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "redirect_blocked");
    assert.equal(calls, 1);
  });
});
