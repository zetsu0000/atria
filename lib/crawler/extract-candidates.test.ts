import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPageCandidates } from "./extract-candidates";

const FIXTURE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <title>Clínica Fixture</title>
  <meta name="description" content="Dermatologia em SP" />
</head>
<body>
  <main>
    <h1>Clínica Fixture</h1>
    <h2>Nossos Serviços</h2>
    <h2>Dr. Exemplo Equipe</h2>
    <p>Fale conosco: contato@fixture.example phone (11) 91234-5678</p>
    <p>Rua das Flores 100, São Paulo</p>
    <a href="mailto:hello@fixture.example">Email</a>
    <a href="tel:+5511912345678">Ligar</a>
    <a href="https://wa.me/5511912345678">WhatsApp</a>
    <a href="https://instagram.com/fixture">Instagram</a>
    <a href="/contato">Contato</a>
    <img src="/logo.png" alt="Logo" />
  </main>
</body>
</html>`;

describe("extract-candidates", () => {
  it("extracts contacts with provenance fields", () => {
    const candidates = extractPageCandidates({
      pageUrl: "https://fixture.example/",
      html: FIXTURE_HTML,
      title: "Clínica Fixture",
      metaDescription: "Dermatologia em SP",
      headings: ["Clínica Fixture", "Nossos Serviços", "Dr. Exemplo Equipe"],
      mainText:
        "Fale conosco: contato@fixture.example phone (11) 91234-5678 Rua das Flores 100",
      linksInternal: ["https://fixture.example/contato"],
    });

    const emails = candidates.filter((c) => c.kind === "email");
    const phones = candidates.filter((c) => c.kind === "phone");
    const whatsapp = candidates.filter((c) => c.kind === "whatsapp");

    assert.ok(emails.length >= 1);
    assert.ok(phones.length >= 1);
    assert.ok(whatsapp.length >= 1);

    for (const c of candidates) {
      assert.ok(c.value);
      assert.equal(c.sourcePage, "https://fixture.example/");
      assert.ok(c.sourceUrl);
      assert.ok(c.extractionMethod);
      assert.ok(["low", "medium", "high"].includes(c.confidence));
      assert.equal(c.reviewStatus, "pending_review");
    }

    assert.ok(candidates.some((c) => c.kind === "service_candidate"));
    assert.ok(candidates.some((c) => c.kind === "social_link"));
    assert.ok(candidates.some((c) => c.kind === "image_candidate"));
  });

  it("does not invent CRM or RQE values", () => {
    const candidates = extractPageCandidates({
      pageUrl: "https://fixture.example/",
      html: "<html><body><p>Olá</p></body></html>",
      title: null,
      metaDescription: null,
      headings: [],
      mainText: "Olá",
      linksInternal: [],
    });
    assert.equal(
      candidates.some((c) => /crm|rqe/i.test(c.value) && c.kind !== "visible_text"),
      false,
    );
  });
});
