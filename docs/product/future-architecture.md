# Arquitetura futura — Atria

> Direção técnica completa. Não autoriza implementação imediata.
> Fonte histórica: `PRODUCT-v1.2-archive.md`.


<!-- linhas 687-836 do archive v1.2 -->
# 11. Arquitetura recomendada

> Esta seção descreve a direção técnica completa. Ela não autoriza a implementação imediata de componentes pertencentes a fases futuras.


## 11.1 Stack

### Frontend

- Next.js;
- App Router;
- TypeScript;
- CSS próprio do projeto (`app/globals.css` e CSS de superfície);
- Tailwind CSS somente se já adotado ou tecnicamente justificado (hoje: não é o sistema visual da landing);
- componentes acessíveis;
- server components quando apropriado;
- Playwright para QA visual e E2E;
- Figma para composição antes de mudanças estruturais de UI;
- skills: taste-skill, emilkowalski/skills, Impeccable.

### Backend

- Next.js server actions ou route handlers;
- Supabase;
- PostgreSQL;
- Supabase Storage;
- Supabase Auth apenas para administração.

### Crawler

- Playwright;
- Cheerio;
- execução em worker ou job separado;
- limite de páginas;
- timeout;
- proteção contra SSRF.

### IA

- API de LLM;
- resposta estruturada em JSON;
- validação por schema;
- sem código gerado;
- sem publicação automática.

### Hospedagem

- Vercel para aplicação;
- Supabase para dados;
- sites de clientes inicialmente em deployments separados.

### Observabilidade

- logs estruturados;
- captura de erros;
- auditoria de alterações;
- monitoramento de jobs.

---

# 12. Estrutura de diretórios

A estrutura deve crescer conforme a fase. Não criar diretórios vazios ou abstrações futuras sem necessidade.

## 12.1 Estrutura real alinhada ao MVP 0

A estrutura abaixo reflete o repositório atual. Não recriar `/admin` paralela sem motivo.

```text
atria/
├── PRODUCT.md
├── DESIGN.md
├── AGENTS.md
├── app/
│   ├── page.tsx                    # landing
│   ├── previa/clinica-aurora/      # demonstração fictícia
│   ├── operacao/                   # painel interno do operador
│   │   ├── page.tsx
│   │   ├── acesso-bloqueado/
│   │   └── leads/
│   ├── privacidade/
│   ├── termos/
│   └── api/                        # se necessário
│
├── components/
│   ├── landing/
│   ├── preview/
│   ├── clinic/
│   ├── operacao/
│   └── legal/
│
├── lib/
│   ├── leads/
│   ├── ops/
│   ├── operations/
│   ├── supabase/
│   ├── security/
│   └── crawler/                    # fundação; não ampliar sem escopo
│
├── docs/
│   └── references/
│
├── public/
└── scripts/
```

Preview privado por token: convenção ativa em `PRODUCT.md` v1.3 é `/previa/[token]` (não `/preview/[token]`).

## 12.2 Expansões futuras possíveis

```text
app/
├── onboarding/[token]/
├── aprovar/[token]/
└── admin/
    ├── scans/
    ├── projects/
    └── deployments/

crawler/
├── validate-url.ts
├── crawl-site.ts
├── discover-pages.ts
├── extract-content.ts
├── screenshots.ts
├── normalize.ts
└── security.ts

scoring/
├── credibility.ts
├── clarity.ts
├── mobile.ts
├── actionability.ts
├── freshness.ts
└── calculate-score.ts

ai/
├── schemas.ts
├── classify-content.ts
├── generate-copy.ts
├── generate-faq.ts
├── prompts/
└── safety.ts

templates/
├── dermatology-doctor/
└── dermatology-clinic/
```

Essas expansões não devem ser criadas no MVP 0 apenas para antecipar o roadmap.

<!-- linhas 1765-1813 do archive v1.2 -->
# 23. Analytics

## 23.1 Funil comercial

- clínicas cadastradas;
- scans;
- previews;
- contatos;
- respostas;
- reuniões;
- propostas;
- vendas;
- publicações.

## 23.2 Operação

- tempo por scan;
- tempo por preview;
- tempo por site;
- número de ajustes;
- prazo;
- falhas;
- custo de IA;
- margem.

## 23.3 Eventos

```text
scan_started
scan_completed
scan_failed
preview_created
preview_sent
preview_viewed
lead_replied
meeting_booked
proposal_sent
project_won
onboarding_completed
homepage_approved
changes_requested
final_approved
deployment_started
deployment_completed
site_published
maintenance_started
```

---

<!-- linhas 2259-2284 do archive v1.2 -->
# 32. Variáveis de ambiente

Fase ativa e MVP 1:

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PREVIEW_TOKEN_SECRET=
APPROVAL_TOKEN_SECRET=
ONBOARDING_TOKEN_SECRET=
ERROR_TRACKING_DSN=
```

Fases futuras:

```text
LLM_API_KEY=
CRAWLER_SECRET=
EMAIL_API_KEY=
VERCEL_TOKEN=
VERCEL_TEAM_ID=
```

Nunca expor chaves privadas no cliente.
