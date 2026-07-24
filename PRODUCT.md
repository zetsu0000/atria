# PRODUCT.md — Atria

> **Status:** Documento mestre de produto (versão congelável)
> **Uso:** Fonte de verdade para estratégia, escopo, contratos e validação
> **Versão:** MVP v1.3
> **Atualizado:** 2026-07-24
> **Idioma do produto:** Português do Brasil
> **Mercado inicial:** Clínicas médicas independentes no Brasil
> **Especialidade inicial recomendada:** Dermatologia
> **Modelo atual:** Serviço produtizado no processo, dirigido individualmente na aparência
> **Princípio central:** O cliente vê, aprova e só depois publica.
> **Promessa canônica:** Seu novo site, aprovado antes de ir ao ar.
> **Documento visual:** `DESIGN.md` — versão ativa declarada no próprio documento.
> **Higgsfield:** não faz parte do produto nem do pipeline visual.

Documentos satélites (não ampliam o MVP automaticamente):

| Documento | Conteúdo |
|---|---|
| `DESIGN.md` | Experiência e craft da landing |
| `AGENTS.md` | Regras de execução para agentes |
| `docs/product/commercial-hypotheses.md` | Preços, planos, garantias comerciais a validar |
| `docs/product/roadmap.md` | Fases futuras e DoD operacional amplo |
| `docs/product/future-architecture.md` | Stack e diretórios futuros |
| `docs/product/future-data-model.md` | Entidades ainda não migradas |
| `docs/product/future-ai.md` | Política de IA futura |
| `docs/product/future-workflows.md` | Onboarding, aprovação, publicação, templates, score detalhado |
| `docs/product/PRODUCT-v1.2-archive.md` | Arquivo histórico completo |

---

# 0. Instruções para o Cursor

Este documento é a fonte de verdade de **produto** da Atria.

| Documento | Responsabilidade |
|---|---|
| `PRODUCT.md` | Produto, posicionamento, princípios, MVP, escopo, contratos, validação |
| `DESIGN.md` | Experiência visual da landing pública |
| `AGENTS.md` | Como executar tarefas neste repositório |

Em conflito visual, `DESIGN.md` vence.
Em conflito de escopo, política ou veracidade, este `PRODUCT.md` vence.

A existência de uma funcionalidade aqui ou nos satélites **não autoriza** implementação imediata.

## 0.1 Ordem de prioridade

1. segurança, privacidade e veracidade;
2. fase ativa / escopo do MVP (§7);
3. princípios do produto (§6);
4. direção visual em `DESIGN.md` (quando a mudança for de UI);
5. documentos satélites e visão futura;
6. hipóteses comerciais.

## 0.2 Três estados (obrigatório para agentes)

Nunca misturar estes estados:

| Estado | Significado |
|---|---|
| **Implementado tecnicamente** | Existe no repositório / migrations |
| **Operacionalmente disponível** | Pode ser usado internamente (com credenciais / auth) |
| **Fluxo comercial ativo** | Faz parte do MVP de venda e validação pública |

Exemplo: o crawler está **implementado** e pode estar **operacionalmente disponível** para o operador. Isso **não** o torna fluxo comercial ativo nem autoriza aquisição em massa.

Antes de implementar, o agente deve perguntar: *isso já existe?* Se existir, endurecer ou integrar; não reconstruir.

## 0.3 Regras de implementação

1. Priorize a fase ativa.
2. Não implemente fases futuras sem instrução explícita.
3. Evite arquitetura excessivamente complexa.
4. TypeScript estrito; validação no servidor.
5. IA não gera nem publica HTML/CSS/código arbitrário; só JSON com schema, quando autorizado.
6. Não armazene dados de pacientes.
7. Não implemente prontuário, agenda médica, telemedicina ou área do paciente.
8. Separe leads, operação interna, preview, projeto vendido e site publicado.
9. Credenciais, CRM, RQE, endereço, equipe e serviços nunca podem ser inventados.
10. Não transformar hipótese comercial em promessa pública.
11. Não tratar roadmap como backlog autorizado.
12. Preferir rotas existentes (`/operacao`, `/previa/...`); não criar `/admin` ou `/preview` paralelos.
13. UI da landing: seguir `DESIGN.md`. Não usar Higgsfield.
14. Não inventar prova social, métricas ou clientes.

## 0.4 Contrato funcional congelado (redesign da landing)

O redesign visual de `/` **não pode** quebrar:

- formulário de solicitação de prévia;
- validação cliente/servidor;
- consentimento e versões legais;
- Turnstile;
- deduplicação de leads;
- persistência Supabase;
- notificação Resend;
- `/operacao` e autenticação de operador;
- backend e server actions de leads;
- crawler e crawl jobs;
- migrations.

Aparência do formulário pode mudar. Comportamento, campos, contratos e integrações **não**.

`/previa/clinica-aurora` está **fora do redesign** nesta fase (`DESIGN.md` §0.2). A landing pode linkar e usar screenshots dela; não redesenhar a rota.

## 0.5 Regra final de escopo

Somente a seção **7. Escopo do MVP** define o que deve ser construído ou endurecido agora.
Satélites descrevem futuro e hipóteses; não autorizam escopo.

---

# 1. Produto

A **Atria** moderniza o site da clínica, mostra uma versão concreta para avaliação e só substitui o site atual depois de aprovação explícita.

A clínica não precisa aprender uma ferramenta, coordenar vários fornecedores ou assumir a parte técnica da publicação.

## 1.1 Mensagens canônicas

| Papel | Texto |
|---|---|
| Promessa | Seu novo site, aprovado antes de ir ao ar. |
| Descritor | Modernização digital para clínicas. |
| Apoio | Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica. |
| Assinatura | Ver antes. Aprovar antes. Publicar sem precisar de TI. |
| CTA principal | Solicitar uma prévia do meu site. |
| CTA secundário | Ver exemplo de prévia. |

## 1.2 O que a Atria é

- modernização de sites para clínicas;
- serviço done-for-you;
- processo Preview-First;
- operação especializada com software interno;
- entrega com escopo controlado e supervisão humana.

## 1.3 O que a Atria não é

- clínica, hospital ou prestador médico;
- agência de marketing genérica;
- construtor self-service ou editor visual;
- SaaS completo na primeira fase;
- prontuário, telemedicina ou ferramenta para pacientes;
- gerador automático de sites sem supervisão humana.

## 1.4 Diferencial

O diferencial principal **não** é “modernizar sites”.

É **eliminar o risco da troca**.

O cliente vê. O cliente aprova. Só então publica.
O site atual permanece em funcionamento até a autorização explícita.

## 1.5 Serviço produtizado

A Atria é um serviço produtizado **no processo**, não na aparência.

**Padronizado:**

- diagnóstico;
- infraestrutura;
- publicação;
- manutenção;
- segurança.

**Dirigido individualmente:**

- composição;
- narrativa;
- tipografia;
- mídia;
- direção de arte.

## 1.6 Modelo de criação

Cada clínica recebe:

- direção de arte própria;
- composição própria;
- conteúdo próprio;
- tipografia própria;
- mídia própria;
- experiência responsiva própria.

O processo permanece padronizado para garantir qualidade, velocidade, manutenção e evolução.

## 1.7 Flagship

A landing institucional (`/`) demonstra o nível máximo de craft da empresa.

Ela **não** representa um template comercial.

Seu papel é demonstrar direção de arte, qualidade técnica, atenção ao detalhe, motion e experiência.

## 1.8 Experiência

Toda interação da Atria deve transmitir:

- confiança;
- precisão;
- calma;
- sofisticação;
- clareza;
- acabamento.

Esses atributos têm prioridade sobre tendências visuais.

---

# 2. Fase ativa e tese

## 2.1 Fase ativa

**MVP 0 — Validação comercial e operação manual assistida.**

Em paralelo: product design da landing conforme `DESIGN.md` (versão ativa no próprio arquivo). Isso não autoriza aquisição em massa, score público automático, IA de geração, pagamentos ou publicação automática.

Objetivo: validar interesse, pedido de prévia, utilidade do preview, entrega manual, preço, padronização e margem.

## 2.2 Tese

Muitas clínicas não têm sites antigos por falta de tecnologia.
Têm sites antigos porque trocar é trabalhoso, inseguro e exige vários fornecedores.

A oportunidade está em eliminar essa complexidade e o risco da publicação.

## 2.3 Visão (não-escopo)

Visão operacional completa e plataforma futura: `docs/product/roadmap.md`.
Não amplia o MVP automaticamente.

---

# 3. Política de prova e demonstração

## 3.1 Alegações

Na fase inicial há prova de **processo** e demonstração visual, não prova de resultado comercial.

**Não afirmar sem evidência real:** mais pacientes, agendamentos, conversão, receita, SEO, resultado médico, percentuais, depoimentos ou casos fictícios.

**Pode comunicar:** clareza visual, contato mais visível, melhor organização mobile, navegação mais clara, aprovação antes da publicação, site atual mantido, suporte técnico no processo.

## 3.2 Demonstração fictícia

Clínica Aurora Dermatologia é fictícia.

Rota: `/previa/clinica-aurora` (congelada no redesign da landing).

Aviso obrigatório:

> **Demonstração fictícia. Nenhuma clínica real está sendo representada.**

Regras: sem CRM/RQE reais, sem telefone funcional, sem depoimentos, sem fotos de pacientes, sem contato real, sem resultados, sem sugerir cliente real. Aurora nunca controla navegação, logo ou identidade da Atria.

---

# 4. Público-alvo

## 4.1 Avatar principal

Médico proprietário ou gestor; clínica com 1–10 médicos; particular ou misto; site antigo; Instagram ou Google Business ativo; sem TI interna; valoriza credibilidade; quer processo simples; tem capacidade de investimento.

## 4.2 Segmento inicial

Dermatologia: imagem e credibilidade têm alto peso; clínicas independentes; serviços particulares; capacidade de pagamento; sites frequentemente defasados; estrutura de páginas padronizável.

## 4.3 Não ideais

Hospitais, grandes redes, portais, telemedicina, área do paciente, prontuário, muitas integrações, design 100% custom sem playbook, branding completo, quem não valoriza presença digital.

---

# 5. Garantia permanente

> **Aprova Antes** é permanente. Prazos e limites comerciais vivem em `docs/product/commercial-hypotheses.md` até validação.

O site novo só substitui o atual depois da aprovação formal da clínica.
O domínio deve permanecer sob controle da clínica.

---

# 6. Princípios do produto

1. **Preview antes da publicação.**
2. **Done-for-you.**
3. **Sem necessidade de equipe de TI.**
4. **Padronizamos o processo. Não o resultado.**
5. **Aprovação humana obrigatória.**
6. **Informação médica nunca inventada.**
7. **Escopo fechado por entrega.**
8. **Poucas decisões para o cliente.**
9. **Operação interna simples.**
10. **Sem dados de pacientes.**
11. **Segurança de domínio e e-mail acima de velocidade.**
12. **O MVP deve vender antes de automatizar tudo.**
13. **Crawler apoia o operador; nunca substitui revisão humana.**
14. **Eliminar o risco da troca é o diferencial.**

---

# 7. Escopo do MVP

## 7.1 Três camadas do estado atual

### Implementado tecnicamente

- landing pública `/`;
- formulário de solicitação de prévia;
- persistência de leads (Supabase, service-role);
- deduplicação, consentimento, Turnstile, Resend (quando configurados);
- `/operacao` com autenticação de operador;
- lista e detalhe de leads;
- histórico de status (`lead_status_history`);
- mudança de status pelo operador;
- crawler interno: jobs, pages, findings;
- execução e cancelamento manuais de crawl;
- demonstração `/previa/clinica-aurora`;
- comparação Atual / Proposta na demo;
- `/privacidade`, `/termos`.

### Operacionalmente disponível

Depende de credenciais e allow-list de operador:

- receber e persistir leads reais;
- operar `/operacao`;
- executar crawls manuais e revisar evidências;
- notificar operadores (Resend).

### Fluxo comercial ativo (MVP 0)

- landing que explica Preview-First e captura interesse;
- demo fictícia como prova de processo;
- operação interna para qualificar e preparar conversa;
- product design da landing (`DESIGN.md`) sem quebrar o contrato §0.4.

## 7.2 Fundação operacional já implementada

Estas capacidades **existem**. Existência ≠ automação comercial.

- persistência de leads;
- histórico de status;
- autenticação de operador;
- crawler;
- crawl jobs;
- crawl pages;
- findings;
- execução manual;
- cancelamento;
- operações internas em `/operacao`.

**Continuam fora do fluxo comercial ativo:**

- aquisição em massa;
- score automático publicado;
- geração automática de sites;
- publicação automática;
- contato automatizado (e-mail/WhatsApp em massa).

## 7.3 Pendente no MVP 0 (comercial)

- preview privado `/previa/[token]` para clínicas reais;
- cadastro completo de clínicas no painel;
- screenshots/assets Atual/Proposta associados ao preview;
- fluxo comercial completo até venda e publicação reais (operação pode ser manual fora do software).

## 7.4 Fora da fase ativa

Não implementar sem instrução explícita:

- crawling em lote / aquisição automatizada;
- score automático como feature pública;
- geração de copy/site por IA em produção;
- onboarding completo self-serve;
- aprovação jurídica / assinatura digital;
- automação de domínio e deployment;
- pagamentos automáticos;
- manutenção automatizada;
- CRM avançado / dashboard do cliente;
- multi-tenancy;
- editor visual;
- automação de WhatsApp;
- pipeline Higgsfield.

Detalhe de fases futuras: `docs/product/roadmap.md`.

## 7.5 Critério de encerramento da fase ativa

1. receber solicitação real;
2. registrar o lead;
3. criar preview (manual ou assistido);
4. enviar URL privada;
5. mostrar Atual e Proposta;
6. registrar evolução do lead;
7. converter pelo menos um lead em projeto;
8. documentar tempo e custo do processo.

---

# 8. Diagnóstico de primeira impressão

O crawler e o score **não** pertencem à mesma camada.

## 8.1 O que o crawler coleta

- páginas públicas;
- screenshots (quando o pipeline de captura estiver ligado ao job);
- metadados;
- conteúdo normalizado;
- achados técnicos (`crawl_findings`);
- evidências visuais/operacionais para o operador.

Essas evidências **apoiam o operador**.

## 8.2 Score

O score **nunca** é publicado automaticamente.

Antes de qualquer envio externo de diagnóstico:

1. revisar evidências;
2. validar critérios;
3. ajustar score (quando existir);
4. registrar oportunidades;
5. aprovar o diagnóstico.

O crawler apoia a decisão. Nunca substitui revisão humana.

Critérios detalhados de score (futuro): `docs/product/future-workflows.md`.

---

# 9. Perfis

## 9.1 Operador atual

Pode:

- visualizar leads;
- alterar status;
- consultar histórico;
- executar crawler;
- cancelar crawl;
- revisar evidências (pages/findings);
- usar a fundação operacional interna.

Não precisa, nesta fase, de painel de projetos/publicação.

## 9.2 Operador futuro

Pode (satélites / fases posteriores):

- cadastrar clínicas completas;
- criar projetos;
- onboarding;
- aprovação;
- publicação;
- deployments.

## 9.3 Prospect

Pode: ver preview privado, comparar Atual/Proposta, solicitar contato.
Não precisa criar conta.

## 9.4 Cliente aprovador (futuro)

Onboarding, materiais, aprovar direção e publicação — ver `docs/product/future-workflows.md`.

---

# 10. Jornadas (MVP)

## 10.1 Lead (operação atual)

```text
Solicitação na landing
→ Lead persistido
→ Operador revisa
→ (opcional) Crawl manual
→ Evidências
→ Contato humano
→ Preview / proposta
→ Ganho ou perda
```

Qualificar para homepage completa só com resposta, negócio ativo, oportunidade clara, decisor, capacidade de compra e interesse real.

## 10.2 Cliente (visão; entrega pode ser manual)

```text
Venda → Onboarding → Homepage → Aprovação → Páginas → Aprovação final
→ Domínio → Publicação → Garantia → Manutenção
```

Detalhe futuro: `docs/product/future-workflows.md`.

---

# 11. Preview

Convenção única:

| Tipo | URL |
|---|---|
| Demo fictícia (pública) | `/previa/clinica-aurora` |
| Preview privado (alvo MVP 0) | `/previa/[token]` |

Não usar `/preview/[token]`.

## 11.1 Segurança do preview privado

- token de alta entropia;
- armazenar só `token_hash`;
- rate limiting;
- revogação possível;
- `noindex` / `nofollow`;
- expiração opcional;
- sem listagem pública.

## 11.2 Conteúdo

Aviso adequado; Atual; Proposta; desktop/mobile; até três observações; CTA.
Score só se existir e tiver revisão humana.

CTAs:

- Antes da reunião: `Quero entender como publicar esta versão.`
- Depois da proposta: `Quero publicar esta versão.`

---

# 12. Stack e estrutura (ativo)

## 12.1 Stack em uso

- Next.js App Router + TypeScript;
- CSS da landing conforme `DESIGN.md` (Modules + `.landing-shell`; sem Tailwind nesta fase);
- Supabase (Postgres, service-role);
- Playwright (dependência; suíte ainda a consolidar);
- Figma + skills de craft para a landing.

Hospedagem alvo: Vercel (app) + Supabase (dados).

## 12.2 Estrutura relevante

```text
atria/
├── PRODUCT.md
├── DESIGN.md
├── AGENTS.md
├── app/
│   ├── page.tsx                 # landing
│   ├── previa/clinica-aurora/   # demo congelada no redesign
│   ├── operacao/                # painel do operador
│   ├── privacidade/
│   └── termos/
├── components/landing|preview|clinic|operacao|legal/
├── lib/leads|ops|operations|crawler|supabase|security/
├── supabase/migrations/
└── docs/product/
```

Expansões futuras: `docs/product/future-architecture.md`.

---

# 13. Modelo de dados implementado

> Reflete as migrations atuais. Modelo futuro: `docs/product/future-data-model.md`.

Migrations:

- `20260718120000_create_leads.sql`
- `20260719180000_crawler_data_foundation.sql`

Acesso: **service-role only**. Sem policies para `anon` / `authenticated`.

## 13.1 `leads`

Campos principais: contato, clínica, papel, website, e-mail, telefone, cidade, problema opcional, consentimento + versão do texto, source, status, dedup_hash, notification_status, timestamps.

Statuses (inclui legados):

`new`, `contacted`, `qualified`, `crawl_pending`, `crawling`, `crawl_complete`, `preview_in_progress`, `preview_ready`, `approved`, `published`, `lost`, `archived`, e legados `replied`, `meeting`, `proposal`, `won`, `do_not_contact`.

## 13.2 `lead_status_history`

Auditoria: `from_status`, `to_status`, `reason`, `actor_type` (`system` | `operator` | `crawler` | `automation`), `actor_identifier`, `created_at`.

## 13.3 `crawl_jobs`

`lead_id`, URL pedida/origem, status (`pending` | `running` | `completed` | `partial` | `failed` | `cancelled`), limites e contadores de páginas, erros seguros, timestamps.

## 13.4 `crawl_pages`

Extratos normalizados por job: URL, path, status_code, title, meta, headings, main_text, links internos, hash, erros. Sem HTML bruto, cookies ou headers.

## 13.5 `crawl_findings`

Achados operacionais: category (`security` | `robots` | `fetch` | `parse` | `content` | `ops`), severity, code, summary, details jsonb.

## 13.6 Ainda não no banco

`clinics`, `scans`, `scores`, `templates`, `previews`, `projects`, `approvals`, `deployments`, etc. → `docs/product/future-data-model.md`.

---

# 14. Segurança e privacidade

1. Não coletar dados de pacientes, sintomas, exames ou prontuário.
2. Service-role only nas tabelas sensíveis; não expor service role no cliente.
3. Proteger tokens; nunca logar tokens ou segredos.
4. Sanitizar URLs; proteção SSRF no crawler.
5. Validar uploads quando existirem.
6. Previews privados não indexados.
7. Consentimento versionado; respeitar `do_not_contact` / remoção.
8. Separar ambientes; limitar acesso administrativo.
9. Retenção e auditoria definidas operacionalmente.

---

# 15. Requisitos funcionais do MVP 0

## FR-001 — Criar lead

Registrar solicitação de prévia com validação, consentimento, status `new`, erros honestos.

## FR-002 — Listar e detalhar leads

Operador autenticado vê dados essenciais, status, datas; sem exposição pública.

## FR-003 — Atualizar status

Com histórico, ator, motivo opcional; transições validadas no servidor.

## FR-004 — Crawl manual

Criar job, executar, cancelar; persistir pages e findings; erros seguros.

## FR-005 — Demo fictícia

`/previa/clinica-aurora` com aviso; Atual/Proposta; sem contato real.

## FR-006 — Preview privado (pendente)

`/previa/[token]`; noindex; Atual/Proposta; aviso; site atual intacto.

## FR-007 — Clínica / assets de preview (pendente)

Cadastro operacional de clínica e screenshots associados ao preview.

## Requisitos futuros

FR de projeto, onboarding, aprovação, deployment, score público e IA: satélites.

---

# 16. Requisitos não funcionais (ativos)

- TypeScript estrito.
- WCAG 2.2 AA; AAA para texto essencial quando viável.
- Teclado, foco visível, reduced motion, reflow 200%.
- Sem overflow horizontal indevido.
- Logs estruturados sem dados sensíveis.
- Validação de schema / Zod nas entradas.
- Sem alegações enganosas.
- Landing: contrato §0.4 preservado em qualquer redesign.

---

# 17. Validação e Definition of Done

## 17.1 DoD técnico do MVP 0

1. acessar a landing;
2. solicitar uma prévia;
3. persistir o lead (com credenciais);
4. autenticar operador;
5. visualizar lead e histórico;
6. executar crawl manual e ver evidências;
7. acessar demo Aurora;
8. (pendente) preview privado com token;
9. documentar o fluxo operacional.

## 17.2 Validação comercial mínima (metas operacionais)

- clínicas avaliadas manualmente;
- previews enviados;
- abordagens qualificadas;
- uma venda;
- um site publicado;
- processo documentado.

Números detalhados históricos: archive / roadmap. Não são promessas públicas.

## 17.3 Critérios para continuar

Continuar se houver respostas, reuniões, vendas, preço aceito, entrega padronizável, margem positiva.
Reavaliar se ninguém se importar com o site, todos pedirem só tráfego, preço inviável, cada projeto for único demais, ou suporte consumir a margem.

---

# 18. Decisões explícitas

- Não criar SaaS completo no MVP.
- Não criar editor visual.
- Não gerar layout livre automaticamente.
- Não armazenar pacientes.
- Não prometer resultados financeiros ou SEO.
- Não publicar sem aprovação.
- Não controlar domínio do cliente indevidamente.
- Não depender de IA para fatos.
- Não tratar crawler interno como aquisição comercial.
- Não publicar score sem revisão humana.
- Não usar demo fictícia como prova real.
- Não usar Higgsfield.
- Não redesenhar `/previa/clinica-aurora` no redesign da landing.
- Convenção de preview: `/previa/...` apenas.
- Modelo futuro de dados fora deste arquivo.
- Padronizamos o processo, não o resultado.
- Diferencial = eliminar o risco da troca.

---

# 19. Pitch

Atria moderniza sites de clínicas sem exigir equipe de TI. Primeiro mostramos como o novo site ficará e mantemos o site atual ativo. Depois da aprovação, cuidamos de conteúdo, domínio, hospedagem e publicação.

---

# 20. Critério final de simplicidade

Antes de adicionar funcionalidade:

1. Ajuda a vender?
2. Reduz tempo de entrega?
3. Reduz esforço do cliente?
4. Reduz risco?
5. Aumenta margem?
6. É necessário para os primeiros clientes?
7. Pertence à fase ativa?
8. Já está implementado e só precisa ser usado?
9. Existe evidência de que precisa ser automatizado agora?

Se a maioria for “não”, deixar para depois.

## Regra final

Somente a seção **7** define o escopo obrigatório atual.
Skills, testes e satélites não autorizam declarar o produto pronto sem decisão humana quando a mudança for estrutural ou comercial.
