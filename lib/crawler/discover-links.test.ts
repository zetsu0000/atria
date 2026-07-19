import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectInternalLinks, prioritizeUrls, scorePath } from "./discover-links";

describe("discover-links", () => {
  it("rejects external links and duplicates", () => {
    const seen = new Set<string>(["https://clinic.example.com/"]);
    const links = collectInternalLinks({
      hrefs: [
        "/servicos",
        "/servicos",
        "https://other.example/x",
        "mailto:a@b.com",
        "/servicos#topo",
      ],
      baseUrl: "https://clinic.example.com/",
      allowedOrigin: "https://clinic.example.com",
      alreadySeen: seen,
    });
    assert.deepEqual(links, ["https://clinic.example.com/servicos"]);
  });

  it("prioritizes useful paths", () => {
    const ranked = prioritizeUrls([
      "https://clinic.example.com/blog/post",
      "https://clinic.example.com/contato",
      "https://clinic.example.com/servicos",
      "https://clinic.example.com/",
    ]);
    assert.equal(ranked[0], "https://clinic.example.com/");
    assert.ok(scorePath("/servicos") > scorePath("/blog/post"));
  });
});
