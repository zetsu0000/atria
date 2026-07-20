import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadActions } from "@/components/operacao/lead-actions";
import { crawlTone, leadTone } from "@/components/operacao/status-tone";
import { requireOperacaoAccess } from "@/lib/ops/gate";
import { canUseReviewFixtures } from "@/lib/ops/operator-auth";
import { getFixtureJobsForLead, getFixtureLead } from "@/lib/ops/fixtures";
import {
  crawlStatusLabel,
  formatDateTime,
  leadStatusLabel,
  sanitizeOperatorError,
} from "@/lib/ops/labels";
import {
  opGetLead,
  opListAllowedLeadTransitions,
  opListLeadStatusHistory,
} from "@/lib/operations/lead-operations";
import {
  opListCrawlJobsForLead,
  opListCrawlPages,
} from "@/lib/operations/crawl-operations";
import { isLeadStatus } from "@/lib/leads/status";
import type { CrawlJobRecord } from "@/lib/crawler/types";

function statusLabelSafe(value: string | null): string {
  if (!value) return "—";
  return isLeadStatus(value) ? leadStatusLabel(value) : value;
}

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OperacaoLeadDetailPage({ params }: Props) {
  await requireOperacaoAccess();
  const { id } = await params;

  const usingFixtures = canUseReviewFixtures();
  let lead = usingFixtures ? getFixtureLead(id) : null;
  let jobs: CrawlJobRecord[] = usingFixtures ? getFixtureJobsForLead(id) : [];
  let history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorType: string;
    createdAt: string;
  }> = [];
  let latestSummary: string | null = null;
  let operationalError: string | null = null;

  if (!usingFixtures) {
    const leadResult = await opGetLead(id);
    if (!leadResult.ok) {
      if (leadResult.reason === "not_found") notFound();
      operationalError = sanitizeOperatorError(leadResult.message);
    } else {
      lead = leadResult.lead;
      const [historyResult, jobsResult] = await Promise.all([
        opListLeadStatusHistory(id),
        opListCrawlJobsForLead(id),
      ]);
      if (historyResult.ok) {
        history = historyResult.entries.map((entry) => ({
          id: entry.id,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          reason: entry.reason,
          actorType: entry.actorType,
          createdAt: entry.createdAt,
        }));
      }
      if (jobsResult.ok) {
        jobs = jobsResult.jobs;
        const latest = jobs[0];
        if (latest) {
          const pages = await opListCrawlPages(latest.id);
          const pageCount = pages.ok ? pages.pages.length : null;
          latestSummary = [
            `Status ${crawlStatusLabel(latest.status)}`,
            `${latest.pagesFetched}/${latest.maxPages} páginas obtidas`,
            pageCount != null ? `${pageCount} páginas registradas` : null,
            latest.errorMessage
              ? sanitizeOperatorError(latest.errorMessage)
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
        }
      }
    }
  } else {
    if (!lead) notFound();
    history = [
      {
        id: "hist-1",
        fromStatus: null,
        toStatus: lead.status,
        reason: "Fixture de revisão",
        actorType: "system",
        createdAt: lead.createdAt,
      },
    ];
    const latest = jobs[0];
    if (latest) {
      latestSummary = `Status ${crawlStatusLabel(latest.status)} · ${latest.pagesFetched}/${latest.maxPages} páginas obtidas`;
    }
  }

  if (!lead) {
    return (
      <div className="op-shell">
        <div className="op-feedback" data-tone="err" role="alert">
          {operationalError ?? "Não foi possível carregar o lead."}
        </div>
        <Link className="op-btn" href="/operacao/leads">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const allowed = opListAllowedLeadTransitions(lead.status);

  return (
    <div className="op-shell">
      <header className="op-top">
        <div>
          <p className="op-muted">
            <Link href="/operacao/leads">Leads</Link> / detalhe
          </p>
          <h1>{lead.clinicName}</h1>
          <p>
            {lead.contactName} · {lead.contactRole}
          </p>
        </div>
        <span className="op-badge" data-tone={leadTone(lead.status)}>
          {leadStatusLabel(lead.status)}
        </span>
      </header>

      <div className="op-grid op-grid-2">
        <section className="op-panel op-section" aria-labelledby="lead-data">
          <h2 id="lead-data">Dados do lead</h2>
          <dl className="op-dl">
            <div>
              <dt>Contato</dt>
              <dd>
                {lead.contactName}
                <br />
                {lead.email}
                <br />
                {lead.phone}
              </dd>
            </div>
            <div>
              <dt>Clínica</dt>
              <dd>
                {lead.clinicName}
                <br />
                {lead.city}
              </dd>
            </div>
            <div>
              <dt>Site atual</dt>
              <dd>
                <a href={lead.websiteUrl} target="_blank" rel="noreferrer">
                  {lead.websiteUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>{lead.source}</dd>
            </div>
            <div>
              <dt>Consentimento</dt>
              <dd>
                {lead.consent ? "Registrado" : "Ausente"} ·{" "}
                {formatDateTime(lead.consentAt)}
              </dd>
            </div>
            <div>
              <dt>Criado</dt>
              <dd>{formatDateTime(lead.createdAt)}</dd>
            </div>
            {lead.websiteProblem ? (
              <div>
                <dt>Observação</dt>
                <dd>{lead.websiteProblem}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="op-panel op-section" aria-labelledby="lead-actions">
          <h2 id="lead-actions">Ações</h2>
          <LeadActions
            leadId={lead.id}
            websiteUrl={lead.websiteUrl}
            allowedTransitions={allowed}
            jobs={jobs}
            mutationsEnabled={!usingFixtures}
          />
        </section>
      </div>

      <div className="op-grid op-grid-2" style={{ marginTop: "1rem" }}>
        <section className="op-panel op-section" aria-labelledby="history-title">
          <h2 id="history-title">Histórico de status</h2>
          {history.length === 0 ? (
            <p className="op-muted">Nenhuma alteração registrada.</p>
          ) : (
            <ol className="op-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    {entry.fromStatus
                      ? `${statusLabelSafe(entry.fromStatus)} → `
                      : ""}
                    {statusLabelSafe(entry.toStatus)}
                  </strong>
                  <div className="op-muted">
                    {formatDateTime(entry.createdAt)} · {entry.actorType}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="op-panel op-section" aria-labelledby="crawl-title">
          <h2 id="crawl-title">Crawls</h2>
          {latestSummary ? (
            <p className="op-muted" style={{ marginTop: 0 }}>
              Mais recente: {latestSummary}
            </p>
          ) : (
            <p className="op-muted" style={{ marginTop: 0 }}>
              Nenhum crawl registrado.
            </p>
          )}
          {jobs.length === 0 ? null : (
            <ul className="op-list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <span className="op-badge" data-tone={crawlTone(job.status)}>
                    {crawlStatusLabel(job.status)}
                  </span>
                  <div className="op-muted">
                    {formatDateTime(job.createdAt)} · {job.pagesFetched}/
                    {job.maxPages} páginas
                    {job.errorMessage
                      ? ` · ${sanitizeOperatorError(job.errorMessage)}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
