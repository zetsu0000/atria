"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CrawlJobRecord } from "@/lib/crawler/types";
import type { LeadStatus } from "@/lib/leads/status";
import { leadStatusLabel } from "@/lib/ops/labels";
import {
  cancelCrawlJobAction,
  createCrawlJobAction,
  executeCrawlJobAction,
  updateLeadStatusAction,
} from "@/app/operacao/leads/actions";

type Props = {
  leadId: string;
  websiteUrl: string;
  allowedTransitions: LeadStatus[];
  jobs: CrawlJobRecord[];
  mutationsEnabled: boolean;
};

export function LeadActions({
  leadId,
  websiteUrl,
  allowedTransitions,
  jobs,
  mutationsEnabled,
}: Props) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "err";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendingJobs = jobs.filter((job) => job.status === "pending");

  function run(
    action: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({
        tone: result.ok ? "ok" : "err",
        message: result.message,
      });
      if (result.ok) {
        setPendingStatus("");
        router.refresh();
      }
    });
  }

  return (
    <div className="op-grid" style={{ gap: "1.25rem" }}>
      {feedback ? (
        <div
          className="op-feedback"
          data-tone={feedback.tone}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      {!mutationsEnabled ? (
        <p className="op-muted" role="note">
          Mutações desabilitadas no modo de revisão local.
        </p>
      ) : null}

      <section aria-labelledby="status-action-title">
        <h3 id="status-action-title" className="visually-hidden">
          Atualizar status
        </h3>
        <div className="op-field">
          <label htmlFor="to-status">Novo status</label>
          <select
            id="to-status"
            value={pendingStatus}
            disabled={!mutationsEnabled || isPending || allowedTransitions.length === 0}
            onChange={(event) => setPendingStatus(event.target.value)}
          >
            <option value="">
              {allowedTransitions.length === 0
                ? "Sem transições disponíveis"
                : "Escolher status permitido"}
            </option>
            {allowedTransitions.map((status) => (
              <option key={status} value={status}>
                {leadStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="op-actions" style={{ marginTop: "0.6rem" }}>
          <button
            type="button"
            className="op-btn op-btn-primary"
            disabled={!mutationsEnabled || isPending || !pendingStatus}
            onClick={() =>
              run(() =>
                updateLeadStatusAction({ leadId, toStatus: pendingStatus }),
              )
            }
          >
            {isPending ? "Salvando…" : "Salvar status"}
          </button>
        </div>
      </section>

      <section aria-labelledby="crawl-action-title">
        <h3 id="crawl-action-title" style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
          Crawl
        </h3>
        <p className="op-muted" style={{ marginBottom: "0.6rem" }}>
          Site: {websiteUrl}
        </p>
        <div className="op-actions">
          <button
            type="button"
            className="op-btn"
            disabled={!mutationsEnabled || isPending}
            onClick={() => run(() => createCrawlJobAction({ leadId }))}
          >
            Criar crawl
          </button>
          {pendingJobs.map((job) => (
            <span key={job.id} className="op-actions">
              <button
                type="button"
                className="op-btn op-btn-primary"
                disabled={!mutationsEnabled || isPending}
                onClick={() =>
                  run(() =>
                    executeCrawlJobAction({ leadId, jobId: job.id }),
                  )
                }
              >
                Executar pendente
              </button>
              <button
                type="button"
                className="op-btn op-btn-danger"
                disabled={!mutationsEnabled || isPending}
                onClick={() => {
                  const confirmed = window.confirm(
                    "Cancelar este crawl pendente?",
                  );
                  if (!confirmed) return;
                  run(() => cancelCrawlJobAction({ leadId, jobId: job.id }));
                }}
              >
                Cancelar pendente
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
