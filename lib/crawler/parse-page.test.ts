import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HARD_MAX_MAIN_TEXT_CHARS } from "./types";
import { parseHtmlPage } from "./parse-page";

describe("parse-page", () => {
  it("parses title, headings, and internal links", () => {
    const html = `
<!doctype html>
<html lang="pt-BR">
<head>
  <title> Clínica Exemplo </title>
  <meta name="description" content="Dermatologia em SP" />
  <link rel="canonical" href="https://clinic.example.com/" />
  <script>window.evil=1</script>
  <style>.x{color:red}</style>
</head>
<body>
  <nav><a href="/ignored-nav">Nav</a></nav>
  <main>
    <h1>Bem-vindo</h1>
    <h2>Serviços</h2>
    <p>Texto principal da clínica.</p>
    <a href="/servicos">Serviços</a>
    <a href="https://external.example/">Externo</a>
    <a href="mailto:a@b.com">Email</a>
  </main>
</body>
</html>`;

    const parsed = parseHtmlPage(
      html,
      "https://clinic.example.com/",
      "https://clinic.example.com",
    );

    assert.equal(parsed.title, "Clínica Exemplo");
    assert.equal(parsed.metaDescription, "Dermatologia em SP");
    assert.equal(parsed.canonicalUrl, "https://clinic.example.com/");
    assert.deepEqual(parsed.headings.slice(0, 2), ["Bem-vindo", "Serviços"]);
    assert.ok(parsed.mainText?.includes("Texto principal"));
    assert.ok(!parsed.mainText?.includes("window.evil"));
    assert.ok(!parsed.mainText?.includes(".x{color"));
    assert.ok(parsed.linksInternal.includes("https://clinic.example.com/servicos"));
    assert.ok(
      !parsed.linksInternal.some((l) => l.includes("external.example")),
    );
    assert.equal(parsed.language, "pt-BR");
  });

  it("bounds main text length", () => {
    const huge = "a".repeat(HARD_MAX_MAIN_TEXT_CHARS + 5000);
    const html = `<html><body><main><p>${huge}</p></main></body></html>`;
    const parsed = parseHtmlPage(
      html,
      "https://clinic.example.com/",
      "https://clinic.example.com",
    );
    assert.ok(parsed.mainText);
    assert.ok(parsed.mainText!.length <= HARD_MAX_MAIN_TEXT_CHARS);
  });

  it("does not keep script or style content", () => {
    const html = `<html><body><script>SECRET()</script><style>HIDE</style><main>OK</main></body></html>`;
    const parsed = parseHtmlPage(
      html,
      "https://clinic.example.com/",
      "https://clinic.example.com",
    );
    assert.equal(parsed.mainText, "OK");
  });
});
