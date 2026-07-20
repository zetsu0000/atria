import Link from "next/link";
import { requireOperacaoAccess } from "@/lib/ops/gate";
import { canUseReviewFixtures } from "@/lib/ops/operator-auth";
import { FIXTURE_LEADS, FIXTURE_CRAWL_JOBS } from "@/lib/ops/fixtures";
import {
  crawlStatusLabel,
  formatDateTime,
  leadStatusLabel,
} from "@/lib/ops/labels";
import { opListLeads } from "@/lib/operations/lead-operations";
import { opListLatestCrawlJobsForLeads } from "@/lib/operations/crawl-operations";
import { isLeadStatus, LEAD_STATUSES, type LeadStatus } from "@/lib/leads/status";
import { crawlTone, leadTone } from "@/components/operacao/status-tone";
import type { CrawlJobRecord } from "@/lib/crawler/types";
import type { OperationalLead } from "@/lib/leads/query";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>;
};

function parsePage(value: string | undefined): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseStatus(value: string | undefined): LeadStatus | "all" {
  if (!value || value === "all") return "all";
  return isLeadStatus(value) ? value : "all";
}

export default async function OperacaoLeadsPage({ searchParams }: Props) {
  await requireOperacaoAccess();
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = parseStatus(params.status);
  const offset = (page - 1) * PAGE_SIZE;

  let leads: OperationalLead[] = [];
  let total = 0;
  let jobsByLeadId: Record<string, CrawlJobRecord | null> = {};
  let loadError: string | null = null;
  let usingFixtures = false;

  if (canUseReviewFixtures()) {
    usingFixtures = true;
    const filtered =
      status === "all"
        ? FIXTURE_LEADS
        : FIXTURE_LEADS.filter((lead) => lead.status === status);
    total = filtered.length;
    leads = filtered.slice(offset, offset + PAGE_SIZE);
    for (const lead of leads) {
      jobsByLeadId[lead.id] =
        FIXTURE_CRAWL_JOBS.find((job) => job.leadId === lead.id) ?? null;
    }
  } else {
    const listed = await opListLeads({ limit: PAGE_SIZE, offset, status });
    if (!listed.ok) {
      loadError = listed.message;
    } else {
      leads = listed.leads;
      total = listed.total;
      const latest = await opListLatestCrawlJobsForLeads(leads.map((l) => l.id));
      if (latest.ok) jobsByLeadId = latest.jobsByLeadId;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function hrefFor(nextPage: number, nextStatus: LeadStatus | "all") {
    const qs = new URLSearchParams();
    if (nextPage > 1) qs.set("page", String(nextPage));
    if (nextStatus !== "all") qs.set("status", nextStatus);
    const query = qs.toString();
    return query ? `/operacao/leads?${query}` : "/operacao/leads";
  }

  return (
    <div className="op-shell">
      <header className="op-top">
        <div>
          <h1>Leads</h1>
          <p>Fila operacional · mais recentes primeiro</p>
        </div>
        <p>
          {total} registro{total === 1 ? "" : "s"}
          {usingFixtures ? " · fixtures de revisão" : null}
        </p>
      </header>

      <form className="op-toolbar" method="get">
        <div className="op-field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="all">Todos</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {leadStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="op-btn">
          Filtrar
        </button>
      </form>

      {loadError ? (
        <div className="op-feedback" data-tone="err" role="alert">
          {loadError}
        </div>
      ) : null}

      <section className="op-panel" aria-label="Lista de leads">
        {leads.length === 0 && !loadError ? (
          <div className="op-empty">
            Nenhum lead encontrado. Quando houver solicitações, elas aparecerão
            aqui.
          </div>
        ) : null}

        {leads.length > 0 ? (
          <>
            <div className="op-table-wrap">
              <table className="op-table">
                <thead>
                  <tr>
                    <th scope="col">Contato</th>
                    <th scope="col">Clínica</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Site</th>
                    <th scope="col">Status</th>
                    <th scope="col">Crawl</th>
                    <th scope="col">Criado</th>
                    <th scope="col">
                      <span className="visually-hidden">Detalhe</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const crawl = jobsByLeadId[lead.id] ?? null;
                    return (
                      <tr key={lead.id}>
                        <td>{lead.contactName}</td>
                        <td>{lead.clinicName}</td>
                        <td>{lead.email}</td>
                        <td>
                          <a
                            href={lead.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {lead.websiteUrl.replace(/^https?:\/\//, "")}
                          </a>
                        </td>
                        <td>
                          <span
                            className="op-badge"
                            data-tone={leadTone(lead.status)}
                          >
                            {leadStatusLabel(lead.status)}
                          </span>
                        </td>
                        <td>
                          <span
                            className="op-badge"
                            data-tone={crawlTone(crawl?.status)}
                          >
                            {crawlStatusLabel(crawl?.status)}
                          </span>
                        </td>
                        <td>{formatDateTime(lead.createdAt)}</td>
                        <td>
                          <Link href={`/operacao/leads/${lead.id}`}>Abrir</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="op-mobile-list">
              {leads.map((lead) => {
                const crawl = jobsByLeadId[lead.id] ?? null;
                return (
                  <li key={lead.id}>
                    <Link href={`/operacao/leads/${lead.id}`}>
                      <strong>{lead.clinicName}</strong>
                      <span className="op-muted">{lead.contactName}</span>
                      <span className="op-badge" data-tone={leadTone(lead.status)}>
                        {leadStatusLabel(lead.status)}
                      </span>
                      <span className="op-muted">
                        Crawl: {crawlStatusLabel(crawl?.status)} ·{" "}
                        {formatDateTime(lead.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="op-pager">
              <p className="op-muted">
                Página {page} de {totalPages}
              </p>
              <div className="op-actions">
                {hasPrev ? (
                  <Link className="op-btn" href={hrefFor(page - 1, status)}>
                    Anterior
                  </Link>
                ) : (
                  <span className="op-btn" aria-disabled="true">
                    Anterior
                  </span>
                )}
                {hasNext ? (
                  <Link className="op-btn" href={hrefFor(page + 1, status)}>
                    Próxima
                  </Link>
                ) : (
                  <span className="op-btn" aria-disabled="true">
                    Próxima
                  </span>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
