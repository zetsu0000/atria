import type { CrawlJobRecord } from "@/lib/crawler/types";
import type { OperationalLead } from "@/lib/leads/query";
import type { LeadStatus } from "@/lib/leads/status";

function lead(
  partial: Omit<OperationalLead, "consent" | "consentAt" | "updatedAt"> & {
    status: LeadStatus;
  },
): OperationalLead {
  return {
    ...partial,
    consent: true,
    consentAt: partial.createdAt,
    updatedAt: partial.createdAt,
  };
}

export const FIXTURE_LEADS: OperationalLead[] = [
  lead({
    id: "11111111-1111-4111-8111-111111111111",
    contactName: "Helena Prado",
    clinicName: "Clínica Vertente",
    contactRole: "Médico proprietário",
    websiteUrl: "https://clinicavertente.example",
    email: "helena@clinicavertente.example",
    phone: "11987654321",
    city: "São Paulo, SP",
    websiteProblem: "Site antigo no mobile",
    source: "landing-solicitar",
    status: "new",
    createdAt: "2026-07-18T14:20:00.000Z",
  }),
  lead({
    id: "22222222-2222-4222-8222-222222222222",
    contactName: "Rafael Moura",
    clinicName: "Dermato Horizonte",
    contactRole: "Sócio",
    websiteUrl: "https://dermatohorizonte.example",
    email: "rafael@dermatohorizonte.example",
    phone: "21988776655",
    city: "Rio de Janeiro, RJ",
    websiteProblem: null,
    source: "landing-solicitar",
    status: "crawl_pending",
    createdAt: "2026-07-17T11:05:00.000Z",
  }),
  lead({
    id: "33333333-3333-4333-8333-333333333333",
    contactName: "Camila Nogueira",
    clinicName: "Espaço Pele Clara",
    contactRole: "Gestor",
    websiteUrl: "https://peleclara.example",
    email: "camila@peleclara.example",
    phone: "31999887766",
    city: "Belo Horizonte, MG",
    websiteProblem: "Pouca clareza sobre tratamentos",
    source: "landing-solicitar",
    status: "crawl_complete",
    createdAt: "2026-07-16T16:10:00.000Z",
  }),
];

export const FIXTURE_CRAWL_JOBS: CrawlJobRecord[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leadId: "22222222-2222-4222-8222-222222222222",
    requestedUrl: "https://dermatohorizonte.example",
    normalizedOrigin: "https://dermatohorizonte.example",
    status: "pending",
    maxPages: 10,
    pagesDiscovered: 0,
    pagesFetched: 0,
    pagesFailed: 0,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-07-17T12:00:00.000Z",
    updatedAt: "2026-07-17T12:00:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    leadId: "33333333-3333-4333-8333-333333333333",
    requestedUrl: "https://peleclara.example",
    normalizedOrigin: "https://peleclara.example",
    status: "completed",
    maxPages: 10,
    pagesDiscovered: 8,
    pagesFetched: 8,
    pagesFailed: 0,
    startedAt: "2026-07-16T17:00:00.000Z",
    completedAt: "2026-07-16T17:02:00.000Z",
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-07-16T16:50:00.000Z",
    updatedAt: "2026-07-16T17:02:00.000Z",
  },
];

export function getFixtureLead(id: string): OperationalLead | null {
  return FIXTURE_LEADS.find((item) => item.id === id) ?? null;
}

export function getFixtureJobsForLead(leadId: string): CrawlJobRecord[] {
  return FIXTURE_CRAWL_JOBS.filter((job) => job.leadId === leadId);
}
