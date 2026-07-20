# PROJECT_CRAWLER.md — Atria

> **Status:** Fonte de verdade da trilha técnica de banco, crawler, discovery e apoio comercial  
> **Idioma:** Português do Brasil  
> **Produto:** Atria (mesmo repositório; não é um segundo produto)  
> **Fonte de produto:** `PRODUCT.md`  
> **Uso:** Orientar agentes e engenharia nesta trilha operacional, sem redesenhar a landing nem a prévia aprovada

---

## 1. Nome do projeto

**Atria — Banco, Crawler, Discovery e Motor Comercial**

Esta trilha é o motor operacional interno da Atria: descobrir clínicas candidatas, analisar sites públicos com segurança, calcular score de primeira impressão digital, preparar diagnósticos e mensagens com apoio de IA, e alimentar o funil comercial — sempre com revisão humana.

Não é um produto separado. Não substitui a landing, a captura de leads inbound nem a demonstração Clínica Aurora.

---

## 2. Relação com o repositório principal

Este trabalho vive no **mesmo repositório** da Atria:

- landing Atria aprovada;
- prévia fictícia Clínica Aurora Dermatologia;
- fundação de captura de leads inbound (Supabase / Resend / Turnstile);
- páginas legais (`/privacidade`, `/termos`);
- UI operacional futura e operações internas.

### Por que o mesmo repositório é intencional

- tipos TypeScript compartilhados;
- migrations Supabase compartilhadas e evolutivas;
- verdade de produto compartilhada (`PRODUCT.md`, `DESIGN.md`, `AGENTS.md`);
- registros de lead e, depois, de prévia no mesmo modelo de dados;
- desenvolvimento de MVP mais simples;
- evita microserviços prematuros antes dos primeiros clientes pagantes.

### Isolamento de desenvolvimento

Para reduzir conflito com trabalho de landing/backend, o desenvolvimento desta trilha deve ocorrer em **Git worktree / branch separados**.

| Item | Recomendação |
| --- | --- |
| Branch | `feature/database-crawler-foundation` |
| Worktree | `/Users/marcelollin/Modernizacao digital dermato/atria-crawler-foundation` |

Repositório principal: https://github.com/zetsu0000/atria.git

### Fronteiras rígidas desta trilha

- **não** redesenhar a landing;
- **não** alterar a UI aprovada da prévia Clínica Aurora;
- **não** automatizar outreach em massa sem revisão humana;
- **não** tratar esta trilha como segundo produto ou marca.

---

## 3. Oferta comercial da Atria

Fonte: `PRODUCT.md` (hipóteses comerciais a validar; valores não devem ser publicados como definitivos sem aprovação comercial).

### Promessa principal

> Seu novo site, aprovado antes de ir ao ar.

### Promessa comercial expandida

Atria moderniza sites de clínicas sem exigir equipe de TI. Primeiro mostramos como o novo site ficará. Depois da aprovação, cuidamos de conteúdo, domínio, hospedagem e publicação. O site atual permanece funcionando até o lançamento.

### O que a Atria é / não é

- É serviço done-for-you de modernização de sites para clínicas.
- Não é clínica, hospital, construtor SaaS self-service, gerador automático de sites por IA, nem agência genérica.

### Produto gratuito — Raio-X da Primeira Impressão Digital

Inclui:

- screenshot desktop;
- screenshot mobile;
- score de 0 a 100;
- cinco dimensões de avaliação;
- três oportunidades de melhoria;
- diagnóstico preliminar;
- quando houver interesse, uma demonstração antes/depois do primeiro bloco;
- link privado de visualização.

Objetivo:

- tornar a dor digital visível;
- criar motivo comercial para conversar;
- qualificar clínicas;
- iniciar reunião.

### Produto principal — Site Atria

Preços em `PRODUCT.md`:

- **R$ 3.490** de implantação;
- **R$ 149** por mês;
- alternativa: **R$ 4.790** pelo primeiro ano completo.

Inclui:

- implantação paga;
- manutenção mensal;
- site responsivo;
- até cinco páginas no MVP;
- conteúdo organizado;
- equipe;
- serviços;
- contato;
- FAQ;
- WhatsApp;
- telefone;
- mapa;
- formulário simples;
- domínio;
- hospedagem;
- SSL;
- backup;
- publicação assistida;
- uma rodada de ajustes;
- manutenção mensal;
- 30 dias de correção técnica (conforme oferta em `PRODUCT.md`).

Downsell e planos futuros (Presença Essencial, Autoridade Local, fundadores) existem em `PRODUCT.md` e não fazem parte do núcleo desta trilha até instrução explícita.

### Regras comerciais permanentes

- o cliente vê e aprova antes de qualquer publicação;
- não coletar dados de pacientes;
- não inventar CRM, RQE, credenciais, endereço, serviços, equipe ou alegações médicas;
- IA pode apoiar rascunhos estruturados; revisão humana é obrigatória;
- MVP permanece semiautomático e operacionalmente simples;
- não construir SaaS completo antes dos primeiros clientes pagantes.

---

## 4. O que este projeto faz

Esta trilha técnica existe para:

1. encontrar clínicas potenciais;
2. validar e deduplicar URLs candidatas;
3. varrer sites públicos com segurança;
4. extrair informações públicas;
5. capturar screenshots;
6. calcular um score de primeira impressão;
7. preparar diagnóstico assistido por IA;
8. preparar rascunho de mensagem comercial;
9. exigir revisão humana;
10. apoiar reunião e criação de prévia.

---

## 5. O que este projeto não faz

Explicitamente **não**:

- redesenhar a landing;
- enviar e-mails em massa automaticamente;
- enviar WhatsApp automaticamente;
- fazer scraping de sistemas protegidos;
- acessar áreas com login;
- coletar dados de pacientes;
- avaliar qualidade médica;
- inventar informações profissionais;
- publicar qualquer coisa automaticamente;
- gerar HTML/CSS/código arbitrário via IA para publicação;
- substituir revisão humana;
- construir CRM completo ou dashboard SaaS na primeira versão.

---

## 6. Fluxo operacional completo

```text
Discovery
→ prospect candidate
→ deduplication
→ clinic record
→ scan
→ pages
→ screenshots
→ extracted content
→ score
→ AI diagnosis draft
→ human review
→ outbound message
→ reply
→ lead stage
→ preview before/after
→ meeting
→ proposal
→ project
→ onboarding
→ approval
→ deployment
→ maintenance
```

### Quando criar o antes/depois

| Momento | Entrega |
| --- | --- |
| Antes do primeiro contato | Diagnóstico leve (score + evidências + oportunidades) |
| Após interesse, ou para alvos de altíssima qualidade | Antes/depois mais forte do primeiro bloco |
| Após interesse qualificado | Prévia completa da homepage (link privado) |

A demonstração pública Clínica Aurora é fictícia e **não** representa clínica real. Pré-vias de clínicas reais são privadas, versionadas e só avançam com processo comercial controlado.

---

## 7. Discovery: como achar clínicas

Fontes seguras (nesta ordem de prioridade para o MVP):

### Importação manual / CSV

Melhor opção para o MVP: lista curada, controle humano, baixo risco jurídico e operacional.

### Google Places API

Usar API oficial — não scraping agressivo.

Dimensões possíveis de busca:

- especialidade;
- cidade;
- estado;
- categoria;
- possui website;
- possui telefone;
- possui perfil Google Business.

### Search API / SERP API

Usar APIs oficiais ou pagas. Não contornar mecanismos de busca.

### Diretórios

Usar com cuidado, respeitando termos e evitando scraping agressivo.

**Regra:** tudo encontrado entra primeiro em tabela de **candidatos**, nunca direto em outreach.

---

## 8. Site crawler: como analisar um site

Com uma URL de clínica validada, o crawler pode:

- validar a URL;
- bloquear SSRF;
- respeitar `robots.txt`;
- rastrear apenas same-origin;
- visitar até 8 páginas no início (limites concretos podem ser configuráveis; o MVP deve permanecer limitado);
- priorizar home, sobre, equipe, serviços, contato, FAQ;
- extrair título, descrição, headings, texto visível, links, telefones, WhatsApp, e-mail, endereço, candidatos a equipe, candidatos a serviços, redes sociais, imagens;
- capturar screenshots desktop e mobile;
- devolver resultado normalizado e versionado;
- **sempre** exigir revisão humana antes de uso comercial.

O crawler analisa apenas superfície pública. Não segue autenticação, não baixa documentos protegidos e não armazena HTML bruto com cookies/headers sensíveis.

---

## 9. Score

Cinco dimensões (total 100), alinhadas a `PRODUCT.md`:

| Dimensão | Pontos | Nota de nomenclatura |
| --- | ---: | --- |
| Credibilidade | 20 | |
| Clareza | 20 | |
| Mobile | 20 | |
| Conversão | 20 | Em `PRODUCT.md`: **Contato e ação** (`actionability`). Mede facilidade de contato/ação, **não** conversão comercial real. |
| Atualização | 20 | |

Regras:

- o score avalia apenas apresentação digital e facilidade de encontrar informações;
- o score **não** avalia qualidade médica;
- o score deve incluir evidência;
- toda nota baixa precisa de motivo;
- screenshots e páginas-fonte devem sustentar o score;
- admin/revisão humana pode ajustar.

Aviso obrigatório:

> Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.

---

## 10. IA

### Uso permitido

- resumir conteúdo público extraído;
- classificar conteúdo;
- sugerir oportunidades;
- gerar rascunho de diagnóstico;
- gerar rascunho de mensagem outbound;
- sugerir copy de prévia;
- estruturar informação em JSON.

### Uso proibido

- inventar CRM;
- inventar RQE;
- inventar credenciais;
- inventar serviços;
- inventar endereço;
- inventar telefone;
- inventar alegações médicas;
- inventar depoimentos;
- enviar mensagens sem aprovação humana;
- gerar HTML/CSS/código arbitrário para publicação.

### Contrato de saída

Todo output de IA deve ser:

- JSON estruturado;
- validado por schema;
- marcado como `draft`;
- revisado por humano antes do uso.

---

## 11. Banco de dados proposto

Modelo-alvo desta trilha (proposto). Migrations devem ser **aditivas** e compatíveis com a captura inbound já existente.

### `discovery_jobs`

Jobs de busca/importação (CSV, Places, SERP, etc.).

### `prospect_candidates`

Clínicas candidatas brutas, antes da promoção.

### `clinics`

Registro canônico de clínica/prospect.

### `clinic_contacts`

E-mails, WhatsApp, telefone, Instagram, formulários — com proveniência e status de revisão.

### `scans`

Uma tentativa de scan.

### `scan_pages`

Cada página visitada.

### `scan_assets`

Screenshots e artefatos como paths de storage privado.

### `extracted_content`

Extração normalizada versionada, com proveniência.

### `scores`

Score de primeira impressão digital com evidências.

### `outreach_messages`

Mensagens comerciais assistidas por IA e revisadas por humano.

### `leads`

Pipeline comercial.

### `previews`

Prévia privada antes/depois quando houver interesse.

### `projects`

Trabalho vendido / cliente.

### Compatibilidade com o que já existe

A captura inbound já possui (ou pode possuir em produção) a tabela `public.leads` e a fundação de crawler operacional pode já ter introduzido tabelas como `lead_status_history`, `crawl_jobs`, `crawl_pages`, `crawl_findings`.

**Regra:** não destruir nem recriar de forma destrutiva. Preferir:

- renomeações só com plano explícito;
- views/aliases se necessário;
- expansão de enums com valores legados preservados;
- chaves estrangeiras e histórico auditável.

O estado factual atual do repositório está na seção **18**.

---

## 12. Estados principais

### Candidatos (`prospect_candidates`)

`new` · `needs_review` · `duplicate` · `rejected` · `promoted_to_clinic`

### Clínicas (`clinics`)

`prospect` · `qualified` · `previewing` · `client` · `inactive` · `archived`

### Scans

`queued` · `running` · `completed` · `failed` · `requires_review` · `cancelled`

### Outreach

`draft` · `approved` · `sent` · `replied` · `ignored` · `rejected`

### Lead stages

`new` · `qualified` · `contacted` · `replied` · `meeting` · `proposal` · `won` · `lost` · `do_not_contact`

> Implementações existentes podem já usar um conjunto expandido de status operacionais (ex.: `crawl_pending`, `preview_ready`). Qualquer evolução deve permanecer compatível com os valores legados da captura inbound.

### Previews

`draft` · `internal_review` · `ready` · `sent` · `viewed` · `converted` · `archived`

---

## 13. Segurança e privacidade

Regras estritas:

- sem dados de pacientes;
- sem sintomas;
- sem prontuários;
- sem páginas de login;
- sem portais de agendamento que exijam autenticação;
- sem documentos protegidos;
- sem cookies de sessões autenticadas;
- sem headers completos de request em logs;
- sem secrets em logs;
- sem dados privados brutos em eventos;
- RLS habilitado;
- service-role apenas para operações de crawler;
- bucket privado para screenshots;
- prévias com `noindex`/`nofollow`;
- `do_not_contact` respeitado.

---

## 14. SSRF e crawler safety

A validação de URL deve bloquear:

- localhost;
- IPs privados;
- endpoints de metadata;
- portas inseguras;
- credenciais embutidas na URL;
- protocolos não-HTTP(S);
- redirects para destinos bloqueados;
- DNS rebinding.

**Todo redirect deve ser revalidado.**

---

## 15. Envio comercial

Política recomendada:

- a IA cria o rascunho;
- humano revisa;
- humano aprova;
- o sistema pode enviar mensagens individuais **somente** após aprovação;
- sem outreach automático em massa no MVP;
- WhatsApp preferencialmente manual / click-to-chat no início;
- `do_not_contact` deve ser respeitado;
- toda mensagem deve referir apenas observações públicas e sustentadas por evidência.

---

## 16. MVP phases

### Phase 1 — Manual list + site scan

- importação CSV/manual;
- validação de URL;
- crawl de um site;
- screenshots;
- extração;
- score;
- revisão.

### Phase 2 — Discovery assist

- busca via Google Places/API;
- tabela de candidatos;
- deduplicação;
- promoção para clinic.

### Phase 3 — Sales assist

- rascunho de diagnóstico por IA;
- rascunho de mensagem outbound;
- aprovação humana;
- rastreamento de resposta.

### Phase 4 — Preview generation

- prévia privada antes/depois;
- tracking de visualização;
- apoio a reunião.

### Phase 5 — Project operation

- onboarding;
- aprovações;
- tracking de deployment;
- manutenção.

---

## 17. Definition of Done for this technical track

A fundação do MVP desta trilha está pronta quando for possível:

1. importar ou registrar uma clínica;
2. validar sua URL com segurança;
3. executar um scan limitado;
4. capturar screenshots;
5. extrair contatos públicos e dados de páginas;
6. calcular score com evidência;
7. persistir tudo no Supabase;
8. gerar rascunho de diagnóstico revisado;
9. criar rascunho de outreach revisado;
10. converter clínica interessada em lead;
11. conectar depois à geração de prévia.

---

## 18. Current implementation status

Status factual por inspeção do repositório em `/Users/marcelollin/Modernizacao digital dermato/atria` (branch observada no momento da redação: `feature/mobile-landing-hardening`; a branch recomendada `feature/database-crawler-foundation` e o worktree `atria-crawler-foundation` **não** estavam presentes).

| Área | Status factual |
| --- | --- |
| Landing Atria | **Existe** — `app/page.tsx`, componentes em `components/landing/` |
| Prévia Clínica Aurora | **Existe** — `app/previa/clinica-aurora/page.tsx`, `components/preview/`, `components/clinic/` |
| Captura de leads inbound | **Existe** — Server Action + core (`lib/leads/*`), formulário, Turnstile, Resend, dedup HMAC |
| Páginas legais | **Existem** — `app/privacidade/`, `app/termos/` |
| Docs de lead capture | **Existem** — `docs/references/lead-capture-architecture.md`, `lead-capture-setup.md` e correlatos |
| Migration Supabase de leads | **Existe** — `supabase/migrations/20260718120000_create_leads.sql` (`public.leads`, RLS, service-role only) |
| Fundação de dados do crawler | **Existe (código + migration no repo)** — `supabase/migrations/20260719180000_crawler_data_foundation.sql` com `lead_status_history`, `crawl_jobs`, `crawl_pages`, `crawl_findings`; módulos em `lib/crawler/*` e `lib/operations/*` |
| Política SSRF / URL / robots | **Existe** — `lib/crawler/url-policy.ts`, `robots.ts`, testes associados |
| Runner de crawl limitado | **Existe** — `lib/crawler/run-crawl.ts` (in-process; não é worker durável) |
| Screenshots automatizados de site | **Não encontrado** como módulo de captura de screenshot de sites de clínicas |
| Discovery (Places/CSV/candidatos) | **Não encontrado** como pipeline de discovery comercial |
| Score persistido / calculate-score | **Não encontrado** como implementação de score de produto |
| Outreach / mensagens IA | **Não encontrado** |
| Admin SaaS completo | **Não existe** `app/admin` |
| UI operacional `/operacao` | **Existe** — listagem/detalhe de leads e ações internas (`app/operacao/*`, `lib/ops/*`); não é o dashboard SaaS completo da visão futura |
| Docs técnicos do crawler | **Existem** — `docs/references/crawler-*.md` |
| Preparação env | **Existe** — `.env.example` com Supabase, Resend, Turnstile, hash de leads e nota de reuso para crawler |

Observações:

- `AGENTS.md` ainda descreve prioridades antigas do MVP visual (“No crawler yet / No Supabase yet”); o código e as migrations atuais **já avançaram** além desse trecho — preferir este arquivo + inspeção do código.
- Nomes de tabelas atuais (`crawl_jobs`, etc.) diferem do modelo proposto na seção 11; convergência futura deve ser planejada sem migrations destrutivas.
- Aplicação das migrations em ambiente remoto **não** foi verificada neste documento; presença no repo ≠ aplicada em produção.

---

## 19. Instructions for future agents

1. Ler este arquivo **antes** de qualquer trabalho de crawler/banco/discovery/sales-assist.
2. Ler `PRODUCT.md` como verdade de produto; em conflito de escopo, seguir a fase ativa e as regras de segurança/veracidade.
3. **Não** redesenhar UI da landing.
4. **Não** alterar a landing salvo instrução explícita.
5. **Não** alterar a UI aprovada da prévia Clínica Aurora.
6. Preservar a funcionalidade existente de lead capture.
7. Escrever migrations de forma **aditiva** e compatível.
8. Nunca executar crawls ao vivo sem autorização explícita.
9. Nunca aplicar migrations ao vivo sem autorização explícita.
10. Nunca fazer commit automático sem pedido explícito.
11. Sempre testar proteções SSRF.
12. Sempre preservar proveniência dos dados.
13. Sempre exigir revisão humana antes de outreach, diagnóstico comercial ou publicação.
14. Não inventar CRM, RQE, credenciais, endereço, serviços, equipe, depoimentos ou alegações médicas.
15. Não coletar dados de pacientes.
16. Não construir SaaS completo antes da validação comercial e dos primeiros clientes pagantes.

---

## Apêndice — leitura mínima recomendada

1. `PRODUCT.md`
2. `DESIGN.md` (somente se tocar UI; esta trilha normalmente não toca)
3. `AGENTS.md`
4. `docs/references/lead-capture-architecture.md`
5. `docs/references/lead-capture-setup.md`
6. `docs/references/crawler-data-architecture.md`
7. `docs/references/crawler-security-policy.md`
8. `supabase/migrations/*.sql`
9. `.env.example`
10. Este arquivo (`PROJECT_CRAWLER.md`)
