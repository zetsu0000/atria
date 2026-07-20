import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_LEADS, getFixtureLead } from "./fixtures";
import { leadStatusLabel } from "./labels";

function renderLeadListRows(leads: typeof FIXTURE_LEADS): string {
  if (leads.length === 0) {
    return "Nenhum lead encontrado. Quando houver solicitações, elas aparecerão aqui.";
  }
  return leads
    .map(
      (lead) =>
        `${lead.contactName}|${lead.clinicName}|${lead.email}|${lead.websiteUrl}|${leadStatusLabel(lead.status)}|${lead.createdAt}`,
    )
    .join("\n");
}

function renderLeadDetail(id: string): string {
  const lead = getFixtureLead(id);
  if (!lead) return "Lead não encontrado";
  return [
    lead.contactName,
    lead.clinicName,
    lead.email,
    lead.websiteUrl,
    lead.source,
    lead.consent ? "Consentimento registrado" : "Ausente",
    leadStatusLabel(lead.status),
  ].join("|");
}

describe("ops view model", () => {
  it("renders a lead list for authorized fixture data", () => {
    const html = renderLeadListRows(FIXTURE_LEADS);
    assert.match(html, /Helena Prado/);
    assert.match(html, /Clínica Vertente/);
    assert.doesNotMatch(html, /dedup|turnstile|service.role/i);
  });

  it("renders an empty state", () => {
    assert.match(renderLeadListRows([]), /Nenhum lead encontrado/);
  });

  it("renders lead detail without sensitive fields", () => {
    const detail = renderLeadDetail(FIXTURE_LEADS[0].id);
    assert.match(detail, /Consentimento registrado/);
    assert.doesNotMatch(detail, /dedup|turnstile|service.role|stack/i);
  });

  it("reports lead not found", () => {
    assert.equal(renderLeadDetail("missing-id"), "Lead não encontrado");
  });
});
