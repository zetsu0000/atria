/**
 * Maps a `crawl_jobs.error_code` to an operator-friendly, Portuguese
 * explanation and a suggested next action — pure, static, no network call,
 * no mutation. Shared by the operational report and human review pack
 * builders (`build-operational-report.ts`, `build-human-review-pack.ts`)
 * so an operator never has to query the database directly to understand
 * *why* a crawl failed. See docs/technical/crawler-error-code-report-surfacing.md.
 *
 * This module never changes crawl execution, redirect policy, TLS
 * handling, or approved-domain rules — it only explains, in plain
 * language, an error code the crawl-execution layer (`lib/crawler/errors.ts`)
 * already produced.
 */
import { CRAWL_ERROR_CODES, type CrawlErrorCode } from "@/lib/crawler/errors";

export type CrawlFailureExplanation = {
  explanation: string;
  suggestedNextAction: string;
};

const CRAWL_FAILURE_EXPLANATIONS: Record<CrawlErrorCode, CrawlFailureExplanation> = {
  redirect_blocked: {
    explanation: "O crawl foi bloqueado por redirecionamento fora do domínio aprovado.",
    suggestedNextAction: "Revisar manualmente o domínio de destino antes de aprovar novo domínio.",
  },
  robots_denied: {
    explanation: "robots.txt bloqueou o acesso automatizado.",
    suggestedNextAction: "Não insistir no crawl; revisar manualmente presença pública se necessário.",
  },
  dns_failed: {
    explanation: "Falha de DNS impediu a resolução do domínio.",
    suggestedNextAction: "Confirmar manualmente se o domínio está ativo antes de tentar novamente.",
  },
  timeout: {
    explanation: "O carregamento do site expirou (timeout) antes de completar.",
    suggestedNextAction: "Tentar novamente mais tarde; se persistir, revisar manualmente a disponibilidade do site.",
  },
  blocked_host: {
    explanation: "O host de destino não está na lista de domínios aprovados para este crawl.",
    suggestedNextAction: "Confirmar o domínio correto e adicioná-lo explicitamente via --approved-domains antes de tentar novamente.",
  },
  invalid_url: {
    explanation: "A URL informada para o crawl é inválida.",
    suggestedNextAction: "Corrigir a URL cadastrada da clínica antes de tentar novamente.",
  },
  response_too_large: {
    explanation: "A resposta do site excedeu o limite de tamanho permitido.",
    suggestedNextAction: "Revisar manualmente o site — pode ser uma página muito pesada ou um problema no servidor de origem.",
  },
  unsupported_content_type: {
    explanation: "O tipo de conteúdo retornado pelo site não é suportado pelo crawler.",
    suggestedNextAction: "Revisar manualmente o site — pode não ser uma página HTML padrão.",
  },
  http_error: {
    explanation: "O servidor de destino retornou um erro HTTP.",
    suggestedNextAction: "Revisar manualmente se o site está no ar e respondendo corretamente.",
  },
  parse_failed: {
    explanation: "A página não pôde ser processada com segurança pelo crawler.",
    suggestedNextAction: "Revisar manualmente o conteúdo da página.",
  },
  persistence_failed: {
    explanation: "Os resultados do crawl não puderam ser armazenados.",
    suggestedNextAction: "Repetir o crawl; se persistir, tratar como um problema operacional interno, não do site da clínica.",
  },
  page_limit_reached: {
    explanation: "O limite de páginas configurado para este job foi atingido.",
    suggestedNextAction: "Se necessário, repetir o crawl com um limite de páginas maior — o conteúdo já obtido permanece válido.",
  },
  unexpected_error: {
    explanation:
      "Falha genérica e não classificada durante o crawl — pode ser TLS/certificado, DNS, timeout ou outro erro de baixo nível não distinguido pelo sistema hoje.",
    suggestedNextAction: "Não presumir a causa; revisar manualmente o site antes de qualquer decisão comercial.",
  },
  cancelled: {
    explanation: "O job de crawl foi cancelado.",
    suggestedNextAction: "Repetir o crawl manualmente se ainda for relevante.",
  },
  job_not_found: {
    explanation: "Job de crawl não encontrado.",
    suggestedNextAction: "Confirmar o crawl_job_id informado.",
  },
  job_not_pending: {
    explanation: "O job de crawl não está em um estado executável.",
    suggestedNextAction: "Verificar o status atual do job antes de tentar novamente.",
  },
  configuration: {
    explanation: "A persistência do crawler não está configurada.",
    suggestedNextAction: "Verificar a configuração do ambiente (nunca imprimir valores de segredo) antes de tentar novamente.",
  },
};

/**
 * Codes named in this fix's original request that do not exist as
 * `CrawlErrorCode` values today — TLS/certificate failures currently
 * collapse into `unexpected_error` (see
 * docs/technical/crawler-job-error-reason-fix.md's documented
 * limitation). Kept here, checked as a fallback, so this mapping is ready
 * if/when the crawl-execution layer ever adds a distinct code for one of
 * these — without requiring a change to this file. No code path in this
 * repository produces any of these values today.
 */
const FUTURE_CODE_ALIASES: Record<string, CrawlFailureExplanation> = {
  tls_error: {
    explanation: "Falha de TLS/certificado impediu avaliação automatizada.",
    suggestedNextAction: "Não ignorar TLS; revisar manualmente.",
  },
  certificate: {
    explanation: "Falha de certificado impediu avaliação automatizada.",
    suggestedNextAction: "Não ignorar TLS; revisar manualmente.",
  },
  fetch_failed: {
    explanation: "Falha genérica de conexão impediu avaliação automatizada.",
    suggestedNextAction: "Revisar manualmente antes de qualquer decisão comercial.",
  },
};

function isKnownCrawlErrorCode(value: string): value is CrawlErrorCode {
  return (CRAWL_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Returns null when there is no error to explain (errorCode is null —
 * i.e. the crawl succeeded or hasn't failed). Never throws; an
 * unrecognized string still gets a safe, explicit "unclassified" fallback
 * rather than silently producing nothing.
 */
export function explainCrawlFailure(errorCode: string | null): CrawlFailureExplanation | null {
  if (!errorCode) return null;
  if (isKnownCrawlErrorCode(errorCode)) return CRAWL_FAILURE_EXPLANATIONS[errorCode];
  if (errorCode in FUTURE_CODE_ALIASES) return FUTURE_CODE_ALIASES[errorCode]!;
  return {
    explanation: `Falha de crawl não classificada (código: "${errorCode}") — motivo específico desconhecido pelo sistema.`,
    suggestedNextAction: "Revisar manualmente antes de qualquer decisão comercial.",
  };
}
