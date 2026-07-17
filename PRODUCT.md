# PRODUCT.md — Atria

> **Status:** Documento mestre de produto  
> **Uso:** Fonte de verdade para estratégia, escopo e implementação  
> **Versão:** MVP v1.1  
> **Idioma do produto:** Português do Brasil  
> **Mercado inicial:** Clínicas médicas independentes no Brasil  
> **Especialidade inicial recomendada:** Dermatologia  
> **Modelo atual:** Serviço produtizado apoiado por software interno  
> **Evolução prevista:** Plataforma operacional especializada  
> **Princípio central:** O cliente vê, aprova e só depois publica.  
> **Promessa canônica:** Seu novo site, aprovado antes de ir ao ar.

---

# 0. Instruções para o Cursor

Este documento é a principal fonte de verdade de produto da Atria.

Ele contém a fase ativa, a visão futura, as políticas de segurança, as hipóteses comerciais e a direção técnica. A existência de uma funcionalidade neste documento não autoriza sua implementação imediata.

## 0.1 Ordem de prioridade

Em caso de conflito, seguir esta ordem:

1. fase ativa de implementação;
2. segurança, privacidade e veracidade;
3. escopo explícito do MVP ativo;
4. princípios do produto;
5. visão futura;
6. hipóteses comerciais.

## 0.2 Regras de implementação

Ao implementar:

1. Priorize sempre a fase ativa.
2. Não implemente funcionalidades de fases futuras sem instrução explícita.
3. Evite arquitetura excessivamente complexa.
4. Use TypeScript estrito.
5. Valide entradas no servidor.
6. Não permita que IA gere e publique código, HTML ou CSS arbitrário.
7. IA pode preencher somente estruturas JSON validadas por schema.
8. Não armazene dados de pacientes.
9. Não implemente prontuário, agenda médica, telemedicina ou área do paciente.
10. Mantenha separação clara entre geração de leads, operação interna, preview, projeto vendido e site publicado.
11. Toda informação profissional sensível à reputação da clínica deve exigir aprovação humana.
12. Credenciais, especialidades, CRM, RQE, endereço, equipe e serviços nunca podem ser inventados.
13. O produto começa semiautomático e operado internamente.
14. Não construir editor drag-and-drop.
15. Não construir multi-tenancy avançado antes dos primeiros clientes pagantes.
16. Não transformar hipótese comercial em promessa pública sem validação.
17. Não criar alegações de resultado comercial, financeiro, médico ou de SEO sem evidência real.
18. Não tratar o roadmap como backlog automaticamente autorizado.
19. Não publicar conteúdo com status `draft`.
20. Registrar decisões que alterem escopo, política ou modelo de negócio.

## 0.3 Regra final de escopo

Somente a seção **7. Escopo do MVP** define o que deve ser construído agora. As demais seções descrevem a visão completa do produto e podem pertencer a fases posteriores.

# 1. Resumo executivo

A **Atria** é um serviço produtizado de modernização digital para clínicas, apoiado por uma aplicação interna.

A Atria moderniza o site da clínica, apresenta uma versão concreta para avaliação e só substitui o site atual depois de aprovação explícita.

A clínica não precisa aprender uma ferramenta, coordenar vários fornecedores ou assumir a parte técnica da publicação.

## 1.1 Promessa canônica

> **Seu novo site, aprovado antes de ir ao ar.**

## 1.2 Descritor

> **Modernização digital para clínicas.**

## 1.3 Mensagem de apoio

> Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica.

## 1.4 Assinatura de processo

> Ver antes. Aprovar antes. Publicar sem precisar de TI.

## 1.5 Conversões principais

CTA principal:

> Solicitar uma prévia do meu site.

CTA secundário:

> Ver exemplo de prévia.

## 1.6 O que a Atria é

- modernização de sites para clínicas;
- serviço done-for-you;
- operação especializada;
- processo Preview-First;
- sistema interno para organizar leads, previews, aprovações e projetos;
- entrega com escopo controlado;
- serviço técnico com supervisão humana.

## 1.7 O que a Atria não é

- clínica, hospital ou instituição de saúde;
- prestador de serviços médicos;
- agência de marketing genérica;
- construtor de sites self-service;
- editor visual;
- SaaS completo na primeira fase;
- sistema médico;
- ferramenta para pacientes;
- plataforma de prontuário ou telemedicina;
- gerador automático de sites sem supervisão humana.

## 1.8 Formulação operacional

A Atria começa como:

> Um serviço produtizado de modernização de sites, operado com apoio de software interno.

A plataforma é uma evolução possível, não uma exigência da primeira versão.

# 2. Visão do produto

## 2.0 Fase ativa

A fase ativa é **MVP 0 — Validação comercial e operação manual assistida**.

O objetivo atual é validar se:

- a proposta gera interesse;
- clínicas solicitam uma prévia;
- o preview ajuda a iniciar conversas;
- o processo pode ser entregue manualmente;
- o preço é aceitável;
- a entrega pode ser padronizada;
- existe margem operacional.

A visão de curto e longo prazo abaixo não amplia automaticamente o escopo ativo.


## 2.1 Visão do produto operacional completo

Em uma fase posterior ao MVP 0, criar uma operação semiautomática capaz de:

1. identificar clínicas com sites fracos;
2. analisar o site público;
3. gerar score e screenshot;
4. produzir um redesign do primeiro bloco;
5. criar um preview privado;
6. registrar o lead;
7. converter o lead em projeto;
8. coletar materiais;
9. gerar o site completo;
10. aprovar;
11. publicar;
12. manter.

## 2.2 Visão de longo prazo

Evoluir de serviço produtizado para uma plataforma de presença digital que:

- monitora clínicas;
- compara concorrentes locais;
- detecta defasagem digital;
- recomenda atualizações;
- gera páginas;
- mantém sites atualizados;
- oferece benchmark por especialidade, cidade e região;
- pode ser utilizada por clínicas e agências especializadas.

## 2.3 Tese

Muitas clínicas não possuem sites antigos por falta de acesso a tecnologia.

Elas possuem sites antigos porque trocar um site é trabalhoso, inseguro e exige coordenação de vários fornecedores.

A oportunidade está em eliminar essa complexidade.

---

# 2A. Política de prova e alegações

Na fase inicial, a Atria possui prova de processo e demonstração visual, não prova de resultado comercial.

Não afirmar sem evidência real:

- mais pacientes;
- mais agendamentos;
- aumento de conversão;
- aumento de receita;
- melhora de SEO;
- resultado médico;
- percentuais de crescimento;
- depoimentos ou estudos de caso fictícios.

Pode-se comunicar:

- maior clareza visual;
- contato mais visível;
- melhor organização mobile;
- navegação mais clara;
- processo de aprovação antes da publicação;
- site atual mantido durante a revisão;
- suporte técnico no processo.

# 2B. Demonstração fictícia

Clínica Aurora Dermatologia é uma demonstração fictícia.

Aviso obrigatório:

> **Demonstração fictícia — nenhuma clínica real está sendo representada.**

Regras:

- não usar CRM ou RQE real;
- não usar endereço ou telefone funcional;
- não usar depoimentos;
- não usar fotos de pacientes;
- não permitir contato real com a clínica fictícia;
- não sugerir que representa cliente real;
- não apresentar resultados;
- não apresentar a proposta como publicada ou aprovada.

---

# 3. Oferta comercial

> **Status desta seção:** Hipóteses comerciais a validar. Valores, escopos e formatos não devem ser publicados como definitivos sem aprovação comercial.


## 3.1 Produto gratuito

### Raio-X da Primeira Impressão Digital

Entrega:

- screenshot desktop;
- screenshot mobile;
- score de 0 a 100;
- cinco dimensões;
- três oportunidades de melhoria;
- redesign do primeiro bloco;
- link para visualizar a demonstração.

Objetivo:

- gerar interesse;
- tornar a dor visual;
- iniciar conversa comercial;
- qualificar o lead.

## 3.2 Produto principal

### Site Atria

Preço recomendado:

- **R$ 3.490 de implantação**
- **R$ 149 por mês**

Alternativa:

- **R$ 4.790 pelo primeiro ano completo**

Inclui:

- até cinco páginas;
- site responsivo;
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
- backups;
- publicação;
- uma rodada de ajustes;
- 30 dias de correção técnica;
- manutenção mensal.

## 3.3 Downsell

### Presença Essencial

- R$ 1.690 de implantação;
- R$ 99 por mês;
- página única;
- até seis seções;
- adequado a médico individual.

## 3.4 Plano premium futuro

### Autoridade Local

- R$ 6.490 de implantação;
- R$ 299 por mês;
- até dez páginas;
- múltiplas unidades;
- páginas individuais de serviços;
- benchmark competitivo trimestral;
- suporte prioritário.

## 3.5 Oferta para clientes fundadores

Primeiras cinco clínicas:

- R$ 2.490 de implantação;
- R$ 149 por mês;
- preço de manutenção congelado por 12 meses;
- bônus incluídos.

Contrapartida:

- feedback;
- autorização para documentar antes e depois;
- depoimento verdadeiro;
- permissão para estudo de caso.

---

# 4. Garantias

> **Status desta seção:** Hipóteses comerciais e operacionais. A regra “aprova antes” é permanente; prazos, janelas e limites devem ser validados antes de se tornarem promessa pública.


## 4.1 Garantia Aprova Antes

O site novo só substitui o atual depois da aprovação formal da clínica.

## 4.2 Garantia de direção visual

A homepage é apresentada antes da construção das páginas internas.

Caso a direção não esteja de acordo com o briefing:

- uma nova direção dentro do mesmo playbook será apresentada;
- sem custo adicional;
- antes da construção das páginas restantes.

## 4.3 Garantia de prazo

Hipótese operacional após onboarding completo:

- meta de apresentar a versão final para aprovação em até 10 dias úteis.

Esse prazo deve ser validado com entregas reais antes de se tornar promessa pública definitiva.

A contagem não começa enquanto faltarem:

- materiais;
- textos;
- fotos;
- informações profissionais;
- aprovação;
- acessos.

## 4.4 Garantia técnica

Durante 30 dias após a publicação:

- links quebrados;
- erros técnicos;
- problemas de responsividade;
- divergências entre conteúdo aprovado e publicado

devem ser corrigidos sem custo.

## 4.5 Garantia de propriedade

O domínio deve permanecer sob controle da clínica.

---

# 5. Público-alvo

## 5.1 Avatar principal

- médico proprietário;
- gestor de clínica;
- clínica com um a dez médicos;
- atendimento particular ou misto;
- site antigo;
- Instagram ou Google Business ativo;
- sem equipe interna de TI;
- interessado em credibilidade;
- deseja processo simples;
- possui capacidade de investimento.

## 5.2 Segmento inicial

### Dermatologia

Razões:

- imagem e credibilidade possuem alto peso;
- grande presença de clínicas independentes;
- serviços particulares;
- boa capacidade de pagamento;
- sites frequentemente defasados;
- estrutura de páginas relativamente padronizável.

## 5.3 Clientes não ideais

- hospitais;
- grandes redes;
- portais;
- telemedicina;
- clínicas que exigem área do paciente;
- projetos com prontuário;
- projetos com múltiplas integrações;
- clientes que exigem design totalmente customizado;
- clientes que desejam branding completo;
- clientes que não reconhecem valor em presença digital.

---

# 6. Princípios do produto

1. **Preview antes da publicação.**
2. **Done-for-you.**
3. **Sem necessidade de equipe de TI.**
4. **Templates especializados, não layouts livres.**
5. **Aprovação humana obrigatória.**
6. **Informação médica nunca inventada.**
7. **Escopo fechado.**
8. **Poucas decisões para o cliente.**
9. **Operação interna simples.**
10. **Sem dados de pacientes.**
11. **Segurança de domínio e e-mail acima de velocidade.**
12. **O MVP deve vender antes de automatizar tudo.**

---

# 7. Escopo do MVP

## 7.1 MVP 0 — Fase ativa

Incluído agora:

- landing pública;
- formulário de solicitação de prévia;
- persistência de leads;
- autenticação de um administrador interno;
- lista simples de leads;
- cadastro manual de clínicas;
- upload ou registro manual de screenshots;
- criação manual de preview;
- URL privada de preview;
- comparação entre Atual e Proposta;
- atualização manual de status;
- notas internas;
- demonstração fictícia;
- fluxo mockado antes da conexão com banco real, quando apropriado.

## 7.2 Fora da fase ativa

Não implementar sem instrução explícita:

- crawler;
- score automático;
- extração automática de conteúdo;
- geração de copy por IA;
- geração automática de site;
- onboarding completo;
- aprovação jurídica ou assinatura digital;
- automação de domínio;
- deployment automático;
- pagamentos automáticos;
- manutenção automatizada;
- analytics avançado;
- crawling em lote;
- benchmark competitivo;
- CRM avançado;
- dashboard do cliente;
- multi-tenancy;
- editor visual;
- disparo de e-mails;
- automação de WhatsApp.

## 7.3 MVP 1 — Operação assistida

Fase posterior:

- Supabase;
- autenticação admin;
- onboarding;
- aprovação;
- projetos;
- histórico;
- storage;
- publicação manual assistida.

## 7.4 MVP 2 — Automação operacional

Fase posterior:

- crawler;
- screenshots automáticos;
- extração;
- score;
- IA estruturada;
- templates;
- geração assistida.

## 7.5 MVP 3 — Aquisição e recorrência

Fase posterior:

- crawling em lote;
- priorização;
- benchmark;
- monitoramento;
- alertas;
- manutenção estruturada.

## 7.6 Plataforma futura

Possibilidades:

- white-label;
- agências;
- multi-tenancy;
- editor limitado;
- automação de domínio;
- múltiplos nichos.

## 7.7 Critério de encerramento da fase ativa

A fase ativa está validada quando for possível:

1. receber uma solicitação real;
2. registrar o lead;
3. criar uma clínica manualmente;
4. criar um preview manual;
5. enviar uma URL privada;
6. mostrar Atual e Proposta;
7. registrar a evolução do lead;
8. converter pelo menos um lead em projeto;
9. documentar o tempo e o custo do processo.

# 8. Perfis de usuário

## 8.1 Administrador interno

Pode:

- cadastrar clínica;
- executar scan;
- revisar dados;
- editar score;
- gerar preview;
- enviar preview;
- registrar contato;
- converter lead;
- criar projeto;
- revisar onboarding;
- gerar site;
- publicar;
- manter.

## 8.2 Prospect

Pode:

- visualizar preview privado;
- ver score;
- comparar antes e depois;
- solicitar contato;
- aceitar receber proposta.

Não precisa criar conta.

## 8.3 Cliente aprovador

Pode:

- preencher onboarding;
- enviar materiais;
- visualizar homepage;
- solicitar ajustes;
- aprovar;
- visualizar site final;
- aprovar publicação.

Não precisa de painel completo no MVP.

---

# 9. Jornada do lead

```text
Clínica encontrada
→ Cadastro
→ Scan
→ Score
→ Revisão
→ Redesign do hero
→ Preview
→ Contato
→ Resposta
→ Reunião
→ Proposta
→ Venda
```

## 9.1 Critério de qualificação

Só gerar homepage completa quando:

- o lead responder;
- o negócio estiver ativo;
- o site tiver oportunidade clara;
- houver pessoa decisora;
- houver capacidade de compra;
- houver interesse real.

---

# 10. Jornada do cliente

```text
Venda
→ Pagamento inicial
→ Onboarding
→ Materiais completos
→ Homepage
→ Aprovação de direção
→ Páginas internas
→ Ajustes
→ Aprovação final
→ Pagamento final
→ Backup
→ Domínio
→ Publicação
→ Garantia
→ Manutenção
```

---

# 11. Arquitetura recomendada

> Esta seção descreve a direção técnica completa. Ela não autoriza a implementação imediata de componentes pertencentes a fases futuras.


## 11.1 Stack

### Frontend

- Next.js;
- App Router;
- TypeScript;
- CSS ou sistema de estilos coerente com o projeto;
- Tailwind CSS somente se já adotado ou tecnicamente justificado;
- componentes acessíveis;
- server components quando apropriado.

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

## 12.1 Estrutura recomendada para o MVP 0

```text
atria/
├── app/
│   ├── page.tsx
│   ├── preview/[token]/
│   ├── admin/
│   │   ├── leads/
│   │   ├── clinics/
│   │   └── previews/
│   └── api/
│
├── components/
│   ├── preview/
│   ├── forms/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   └── validation/
│
├── docs/
│   ├── product/
│   ├── technical/
│   └── references/
│
├── public/
├── scripts/
└── PRODUCT.md
```

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

# 13. Modelo de dados

## 13.0 Convenções

- usar UUID;
- usar timestamps;
- aplicar RLS;
- usar enums ou check constraints;
- registrar `created_at` e `updated_at`;
- usar `deleted_at` quando remoção lógica for necessária;
- armazenar hashes de tokens, não tokens públicos em texto puro;
- versionar estruturas JSON;
- validar JSON por schema antes de persistir e renderizar;
- não armazenar dados de pacientes.


## 13.1 clinics

```text
id uuid pk
public_name text
legal_name text nullable
website_url text nullable
specialty text
city text
state text
phone text nullable
whatsapp text nullable
email text nullable
address text nullable
instagram_url text nullable
google_business_url text nullable
status enum
created_at timestamptz
updated_at timestamptz
```

Status:

- prospect;
- qualified;
- previewing;
- client;
- inactive;
- archived.

## 13.2 scans

```text
id uuid pk
clinic_id uuid fk
status enum
source_url text
desktop_screenshot_url text nullable
mobile_screenshot_url text nullable
scanned_pages jsonb
schema_version integer
error_message text nullable
started_at timestamptz
completed_at timestamptz nullable
created_at timestamptz
```

Status:

- queued;
- running;
- completed;
- failed;
- requires_review.

## 13.3 extracted_content

```text
id uuid pk
scan_id uuid fk
clinic_name text nullable
page_title text nullable
meta_description text nullable
services jsonb
team jsonb
contacts jsonb
addresses jsonb
social_links jsonb
detected_pages jsonb
images jsonb
raw_summary text nullable
schema_version integer
created_at timestamptz
```

## 13.4 scores

```text
id uuid pk
scan_id uuid fk
credibility integer
clarity integer
mobile integer
actionability integer
freshness integer
total integer
auto_notes jsonb
manual_notes jsonb
manual_reviewed boolean
reviewed_by uuid nullable
reviewed_at timestamptz nullable
created_at timestamptz
```

## 13.5 templates

```text
id uuid pk
name text
slug text unique
specialty text
audience_type enum
version integer
schema jsonb
active boolean
created_at timestamptz
updated_at timestamptz
```

Audience type:

- doctor;
- clinic.

## 13.6 previews

```text
id uuid pk
clinic_id uuid fk
scan_id uuid nullable fk
template_id uuid nullable fk
token_hash text unique
slug text
status enum
content_json jsonb
theme_json jsonb
schema_version integer
preview_url text nullable
expires_at timestamptz nullable
sent_at timestamptz nullable
view_count integer default 0
last_viewed_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Status:

- draft;
- internal_review;
- ready;
- sent;
- viewed;
- converted;
- archived.

## 13.6.1 preview_assets

```text
id uuid pk
preview_id uuid fk
asset_type enum
storage_path text
mime_type text
width integer nullable
height integer nullable
size_bytes bigint nullable
created_at timestamptz
```

Asset type:

- current_desktop;
- current_mobile;
- proposal_desktop;
- proposal_mobile;
- supporting_image;
- document.

## 13.6.2 status_history

```text
id uuid pk
entity_type enum
entity_id uuid
from_status text nullable
to_status text
changed_by uuid nullable
change_source text
notes text nullable
created_at timestamptz
```

## 13.7 leads

```text
id uuid pk
clinic_id uuid nullable fk
preview_id uuid nullable fk
contact_name text nullable
contact_role text nullable
contact_email text nullable
contact_phone text nullable
source text
channel text
stage enum
first_contact_at timestamptz nullable
last_contact_at timestamptz nullable
next_action_at timestamptz nullable
do_not_contact boolean default false
contact_consent boolean default false
contact_consent_at timestamptz nullable
consent_text_version text nullable
privacy_notice_version text nullable
notes text nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz nullable
```

Stage:

- new;
- qualified;
- contacted;
- replied;
- meeting;
- proposal;
- won;
- lost;
- do_not_contact.

## 13.8 projects

```text
id uuid pk
clinic_id uuid fk
lead_id uuid nullable fk
preview_id uuid nullable fk
plan enum
status enum
deposit_status enum
final_payment_status enum
domain text nullable
deployment_url text nullable
maintenance_active boolean default false
onboarding_completed_at timestamptz nullable
direction_approved_at timestamptz nullable
final_approved_at timestamptz nullable
published_at timestamptz nullable
warranty_ends_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Plan:

- essential;
- standard;
- premium;
- custom.

Payment status:

- not_required;
- pending;
- paid;
- overdue;
- refunded;
- cancelled.

Status:

- pending_payment;
- onboarding;
- content_review;
- homepage_review;
- production;
- final_review;
- ready_to_publish;
- published;
- warranty;
- maintenance;
- cancelled.

## 13.9 onboarding_submissions

```text
id uuid pk
project_id uuid fk
token_hash text unique
clinic_data jsonb
team_data jsonb
services_data jsonb
contact_data jsonb
social_data jsonb
asset_urls jsonb
approval_contact jsonb
schema_version integer
submitted_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

## 13.10 approvals

```text
id uuid pk
project_id uuid fk
token_hash text unique
type enum
status enum
artifact_version integer
preview_version_id uuid nullable
content_snapshot_hash text nullable
requested_changes jsonb nullable
approved_by_name text nullable
approved_by_email text nullable
approved_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Type:

- homepage;
- final;
- publication.

Status:

- pending;
- changes_requested;
- approved;
- expired.

## 13.11 deployments

```text
id uuid pk
project_id uuid fk
provider text
provider_project_id text nullable
preview_url text nullable
production_url text nullable
domain text nullable
status enum
dns_snapshot jsonb nullable
rollback_snapshot jsonb nullable
deployed_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Status:

- draft;
- preparing;
- preview_ready;
- awaiting_approval;
- deploying;
- active;
- failed;
- rolled_back;
- archived.

---

# 14. Score de primeira impressão — fase futura

> Não pertence ao MVP 0 e não deve bloquear a validação comercial.


Total: 100 pontos.

## 14.1 Credibilidade — 20

- identificação clara: 3;
- equipe apresentada: 4;
- registros profissionais encontrados: 4;
- endereço e contato: 3;
- fotos coerentes: 3;
- informações institucionais: 3.

## 14.2 Clareza — 20

- atividade compreensível no hero: 5;
- cidade ou região: 3;
- serviços organizados: 4;
- navegação clara: 4;
- textos legíveis: 4.

## 14.3 Mobile — 20

- sem rolagem horizontal: 5;
- texto legível: 4;
- botões utilizáveis: 4;
- menu funcional: 3;
- imagens dimensionadas: 4.

## 14.4 Contato e ação — 20

- CTA principal: 5;
- telefone ou WhatsApp: 4;
- página de contato: 3;
- localização: 3;
- caminho para agendamento ou contato: 5.

Esta dimensão mede facilidade de ação, não conversão real.

## 14.5 Atualização — 20

- links funcionais: 4;
- sem sinais evidentes de abandono: 4;
- consistência visual: 4;
- informações atuais: 4;
- experiência mobile contemporânea: 4.

## 14.6 Regras

- score deve ser explicável;
- cada nota deve possuir evidência;
- administrador pode editar;
- não declarar perda de pacientes;
- não estimar conversão;
- não tratar esta dimensão como previsão de resultado comercial;
- não avaliar qualidade médica;
- exibir aviso:

> Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.

Constraints recomendadas:

```text
credibility between 0 and 20
clarity between 0 and 20
mobile between 0 and 20
actionability between 0 and 20
freshness between 0 and 20
total between 0 and 100
```

---

# 15. Crawler — fase futura

> Não pertence ao MVP 0.


## 15.1 Entrada

```json
{
  "url": "https://clinica-exemplo.com.br"
}
```

## 15.2 Proteções

- aceitar apenas HTTP e HTTPS;
- bloquear localhost;
- bloquear IP privado;
- bloquear metadata endpoints;
- limitar redirecionamentos;
- timeout;
- user-agent identificado;
- limitar tamanho da resposta;
- limitar páginas;
- não autenticar;
- não acessar área restrita;
- não ignorar mecanismos de segurança.

## 15.3 Páginas prioritárias

- home;
- sobre;
- equipe;
- serviços;
- contato;
- FAQ.

Máximo inicial:

- 8 páginas.

## 15.4 Extração

- title;
- description;
- headings;
- texto visível;
- links;
- telefone;
- WhatsApp;
- e-mail;
- endereço;
- equipe;
- serviços;
- redes sociais;
- imagens principais.

## 15.5 Screenshots

Desktop:

- 1440x900.

Mobile:

- 390x844.

Capturar:

- viewport;
- página inteira quando possível.

## 15.6 Resultado normalizado

```json
{
  "schemaVersion": 1,
  "clinicName": null,
  "specialty": null,
  "city": null,
  "state": null,
  "team": [],
  "services": [],
  "contact": {
    "phone": null,
    "whatsapp": null,
    "email": null
  },
  "addresses": [],
  "socialLinks": [],
  "existingPages": [],
  "images": []
}
```

---

# 16. Sistema de IA — fase futura

> Não pertence ao MVP 0. Toda saída deve passar por schema e revisão humana.


## 16.1 Usos permitidos

- classificar conteúdo;
- resumir páginas;
- detectar serviços;
- sugerir sitemap;
- gerar copy institucional preliminar;
- gerar FAQ preliminar;
- sugerir títulos;
- sugerir CTAs;
- adaptar tom;
- organizar conteúdo em template.

## 16.2 Usos proibidos

A IA não pode inventar:

- CRM;
- RQE;
- formação;
- certificação;
- especialidade;
- endereço;
- telefone;
- serviços;
- convênios;
- experiência;
- número de pacientes;
- resultados;
- depoimentos;
- taxas de sucesso;
- claims médicos.

## 16.3 Campos bloqueados

Devem vir do site ou do cliente:

- nome;
- CRM;
- RQE;
- equipe;
- endereço;
- telefone;
- serviços;
- convênios;
- formação;
- redes sociais.

## 16.4 Campos geráveis

- headline;
- subheadline;
- texto institucional;
- ordem dos serviços;
- CTAs;
- FAQ;
- descrições gerais;
- textos de transição.

## 16.5 Status de conteúdo

- draft;
- internal_review;
- client_review;
- approved;
- published.

Nada com status `draft` pode ser publicado.

## 16.6 Formato de resposta

A IA deve retornar JSON validado.

Exemplo:

```json
{
  "schemaVersion": 1,
  "hero": {
    "headline": "",
    "subheadline": "",
    "primaryCta": "",
    "secondaryCta": ""
  },
  "about": {
    "title": "",
    "body": ""
  },
  "services": [
    {
      "sourceName": "",
      "displayName": "",
      "summary": ""
    }
  ],
  "faq": [
    {
      "question": "",
      "answer": ""
    }
  ]
}
```

---

# 17. Templates — fase futura

> Não pertence ao MVP 0.


## 17.1 Template A — Médico individual

Seções:

1. hero;
2. apresentação;
3. áreas de atuação;
4. formação;
5. estrutura;
6. FAQ;
7. localização;
8. contato.

## 17.2 Template B — Clínica com equipe

Seções:

1. hero;
2. diferenciais;
3. serviços;
4. equipe;
5. estrutura;
6. FAQ;
7. localização;
8. contato.

## 17.3 Regras

- estrutura controlada;
- conteúdo via JSON;
- sem HTML gerado pela IA;
- sem componentes arbitrários;
- cores limitadas;
- tipografia limitada;
- WCAG 2.2 AA como requisito integral;
- AAA para texto essencial e estados críticos;
- teclado, foco visível, redução de movimento e reflow a 200%;
- mobile-first;
- carregamento rápido.

---

# 18. Preview

## 18.1 URL

```text
/preview/[token]
```

## 18.2 Segurança

- token aleatório de alta entropia;
- armazenar apenas `token_hash`;
- rate limiting;
- possibilidade de revogação;
- `noindex`;
- `nofollow`;
- expiração opcional;
- sem listagem pública;
- sem autenticação obrigatória.

## 18.3 Conteúdo

- aviso de demonstração;
- screenshot atual;
- score opcional, quando existir e tiver revisão humana;
- até três observações;
- redesign;
- desktop;
- mobile;
- CTA.

## 18.4 CTA

Antes da reunião:

> Quero entender como publicar esta versão.

Depois da proposta:

> Quero publicar esta versão.

---

# 19. Onboarding — fase futura

> Não pertence ao MVP 0.


## 19.1 Dados

- nome da clínica;
- responsável;
- endereço;
- telefone;
- WhatsApp;
- e-mail;
- horários;
- equipe;
- CRM;
- RQE;
- serviços;
- convênios;
- logotipo;
- fotos;
- redes sociais;
- domínio;
- responsável pela aprovação.

## 19.2 Confirmações

O cliente confirma:

- direito de uso das imagens;
- exatidão dos dados;
- autorização de publicação;
- revisão de textos;
- validade das credenciais;
- responsabilidade pela aprovação.

---

# 20. Aprovação — fase futura

> Não pertence ao MVP 0, mas a regra de aprovação antes da publicação é permanente.


## 20.1 Homepage

Opções:

- Aprovar direção.
- Solicitar ajustes.

## 20.2 Ajustes

Categorias:

- texto;
- imagem;
- cor;
- serviço;
- equipe;
- contato;
- outro.

## 20.3 Regra

Uma rodada de ajustes:

- um único envio;
- todas as mudanças consolidadas;
- dentro do escopo.

## 20.4 Aprovação final

Deve registrar:

- nome;
- e-mail;
- data;
- versão;
- aceite.

---

# 21. Publicação — fase futura

> Não pertence ao MVP 0.


## 21.1 Estratégia inicial

Um deployment por cliente.

## 21.2 Processo

1. gerar site;
2. publicar em URL temporária;
3. aprovar;
4. receber pagamento final;
5. registrar DNS atual;
6. confirmar e-mail;
7. configurar domínio;
8. verificar SSL;
9. testar;
10. publicar;
11. monitorar;
12. encerrar janela de risco.

## 21.3 Checklist

- domínio;
- www;
- SSL;
- telefone;
- WhatsApp;
- formulário;
- mapa;
- links;
- imagens;
- mobile;
- e-mail;
- robots;
- favicon;
- metadata;
- 404.

## 21.4 Rollback

Guardar:

- DNS anterior;
- registros;
- provider;
- data;
- responsável;
- backup;
- instruções.

---

# 22. Manutenção

## 22.1 Incluído

- hospedagem;
- SSL;
- backup;
- monitoramento;
- atualização técnica;
- suporte;
- uma pequena alteração mensal.

## 22.2 Pequena alteração

- horário;
- telefone;
- texto;
- foto;
- profissional em estrutura existente.

## 22.3 Não incluído

- nova página;
- redesign;
- integração;
- nova unidade;
- nova estrutura;
- copy completa;
- campanha.

---

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

# 24. Segurança e privacidade

1. Não coletar dados de pacientes.
2. Não solicitar sintomas.
3. Não armazenar exames.
4. Não armazenar prontuário.
5. Aplicar RLS.
6. Proteger tokens.
7. Rotacionar secrets.
8. Sanitizar URLs.
9. Validar uploads.
10. Limitar tipos de arquivo.
11. Registrar auditoria.
12. Utilizar URLs assinadas.
13. Previews não indexados.
14. Não expor service role.
15. Não registrar conteúdo sensível em logs.
16. Permitir remoção de lead.
17. Respeitar `do_not_contact`.
18. Registrar consentimento de contato.
19. Versionar texto de consentimento e aviso de privacidade.
20. Definir retenção de dados.
21. Revisar permissões de Storage.
22. Separar ambientes de desenvolvimento e produção.
23. Limitar acesso administrativo.
24. Não expor tokens em logs, analytics ou URLs internas.

---

# 25. Estados principais

## 25.1 Lead

```text
new
→ qualified
→ contacted
→ replied
→ meeting
→ proposal
→ won | lost | do_not_contact
```

## 25.2 Project

```text
pending_payment
→ onboarding
→ content_review
→ homepage_review
→ production
→ final_review
→ ready_to_publish
→ published
→ warranty
→ maintenance
```

## 25.3 Approval

```text
pending
→ changes_requested
→ pending
→ approved
```

---

# 26. Requisitos funcionais

## 26.1 MVP 0 — requisitos obrigatórios atuais

## FR-001 — Criar lead

O sistema deve registrar uma solicitação de prévia.

### Aceite

- validação no cliente e no servidor;
- consentimento explícito;
- armazenamento;
- data e origem;
- status inicial `new`;
- mensagem de erro honesta;
- nenhum dado apresentado como enviado quando não houver persistência real.

## FR-002 — Listar leads

O administrador deve visualizar leads.

### Aceite

- autenticação;
- dados essenciais;
- status;
- data;
- contato;
- ordenação ou busca simples;
- nenhuma exposição pública.

## FR-003 — Cadastrar clínica

Administrador deve cadastrar:

- nome;
- URL;
- especialidade;
- cidade;
- estado.

### Aceite

- validação;
- associação opcional a lead;
- registro criado;
- histórico mínimo.

## FR-004 — Criar preview manual

Administrador seleciona uma clínica e cria um preview.

### Aceite

- conteúdo Atual;
- conteúdo Proposta;
- URL privada;
- `noindex` e `nofollow`;
- aviso de demonstração;
- aviso de que nenhuma alteração foi feita no site atual;
- responsividade;
- acessibilidade.

## FR-005 — Armazenar screenshots

Administrador registra screenshots atuais e propostos.

### Aceite

- desktop;
- mobile;
- tipo do asset;
- armazenamento seguro;
- associação ao preview;
- validação de formato e tamanho.

## FR-006 — Atualizar status

Administrador altera estágio de lead, clínica ou preview.

### Aceite

- histórico;
- data;
- usuário;
- origem da mudança;
- observação opcional.

## 26.2 MVP 1 — requisitos posteriores

## FR-007 — Converter lead

Lead vira projeto.

### Aceite

- dados herdados;
- plano;
- valor;
- status inicial;
- onboarding criado.

## FR-008 — Onboarding público

Cliente preenche formulário por token.

### Aceite

- salvar rascunho;
- upload;
- validação;
- confirmação;
- submissão;
- consentimento.

## FR-009 — Aprovar homepage

Cliente aprova ou solicita ajustes.

### Aceite

- versão;
- snapshot ou hash;
- nome e e-mail;
- alterações estruturadas;
- status atualizado.

## FR-010 — Aprovar site final

### Aceite

- confirmação;
- versão;
- bloqueio de edição da versão aprovada;
- `ready_to_publish`.

## FR-011 — Registrar deployment

### Aceite

- URL;
- domínio;
- status;
- DNS snapshot;
- rollback snapshot.

## FR-012 — Registrar publicação

### Aceite

- data;
- garantia;
- manutenção;
- checklist concluído.

## 26.3 MVP 2 — automação posterior

## FR-013 — Executar scan

### Aceite

- status visível;
- screenshots;
- conteúdo;
- erro tratável;
- retry;
- segurança contra SSRF.

## FR-014 — Calcular score

### Aceite

- total correto;
- evidências;
- edição manual;
- histórico;
- nenhuma alegação de conversão real.

## FR-015 — Gerar conteúdo assistido

### Aceite

- JSON válido;
- schema versionado;
- origem de fatos;
- revisão humana;
- nenhuma publicação automática.

# 27. Requisitos não funcionais

- TypeScript estrito.
- Responsividade.
- WCAG 2.2 AA integral.
- AAA para texto essencial e estados críticos.
- Navegação por teclado.
- Foco visível.
- Redução de movimento.
- Reflow a 200%.
- Sem rolagem horizontal indevida.
- Logs estruturados.
- Retry em jobs.
- Idempotência.
- Tempo de resposta adequado no painel.
- Preview carregando em poucos segundos em conexão comum.
- Segurança contra SSRF.
- Validação de schema.
- Sem exposição de segredos.
- Backups.
- Migrations versionadas.
- Testes de funções críticas.
- Sem dependência desnecessária.
- Sem automação antes da validação.
- Sem alegações enganosas.

# 28. Roadmap

## Fase 0 — validação manual — fase ativa

- dois templates;
- planilha ou Supabase;
- previews manuais;
- abordagem individual;
- primeira venda.

## Fase 1 — operação assistida

- painel;
- crawler;
- score;
- preview;
- leads;
- onboarding;
- aprovação;
- deployment manual.

## Fase 2 — serviço produtizado

- geração assistida;
- templates adicionais;
- pagamentos;
- manutenção;
- automação de publicação parcial.

## Fase 3 — aquisição

- crawling em lote;
- priorização;
- score automático;
- geração de hero;
- CRM interno.

## Fase 4 — recorrência

- benchmark;
- monitoramento;
- mudanças de concorrentes;
- recomendações;
- alertas.

## Fase 5 — plataforma

- white-label;
- agências;
- multi-tenant;
- editor limitado;
- automação de domínio;
- múltiplos nichos.

---

# 29. Métricas de validação

Após 100 abordagens, medir:

- taxa de resposta;
- previews visualizados;
- reuniões;
- propostas;
- vendas;
- ticket;
- mensalidade aceita;
- tempo de entrega;
- margem;
- ajustes;
- objeções;
- atrasos;
- domínio recuperado;
- satisfação.

Não definir benchmarks artificiais antes de dados reais.

---

# 30. Critérios para continuar

Continuar se:

- houver respostas;
- houver reuniões;
- houver vendas;
- o cliente aceitar preço;
- a entrega for padronizável;
- a margem for positiva;
- o processo não depender de customização total.

Reavaliar se:

- ninguém se importar com o site;
- todos pedirem tráfego;
- preço aceito for baixo;
- cada projeto for único;
- domínio impedir publicação;
- suporte consumir margem.

---

# 31. Definition of Done do MVP

## 31.1 Definition of Done do MVP 0

O MVP 0 está pronto quando for possível:

1. acessar a landing;
2. solicitar uma prévia;
3. persistir o lead;
4. autenticar um administrador;
5. visualizar o lead;
6. cadastrar uma clínica;
7. criar um preview manual;
8. adicionar screenshots;
9. gerar URL privada;
10. visualizar Atual e Proposta;
11. registrar status;
12. documentar o fluxo.

## 31.2 Validação comercial mínima

A validação inicial deve buscar:

- dez clínicas avaliadas manualmente;
- cinco previews;
- cinquenta contatos ou abordagens qualificadas;
- uma venda;
- um site publicado;
- processo documentado.

Esses números são metas operacionais, não promessas públicas.

## 31.3 Definition of Done do MVP operacional completo

Em uma fase posterior, o fluxo completo estará pronto quando for possível:

1. cadastrar clínica;
2. escanear;
3. gerar screenshots;
4. extrair conteúdo;
5. calcular score;
6. revisar;
7. gerar preview;
8. enviar;
9. registrar lead;
10. converter;
11. receber onboarding;
12. criar homepage;
13. aprovar;
14. gerar páginas;
15. aprovar final;
16. conectar domínio;
17. publicar;
18. registrar garantia;
19. iniciar manutenção.

Essa definição não pertence ao escopo obrigatório do MVP 0.

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

# 33. Seed data

Criar:

- clínica fictícia individual;
- clínica fictícia com equipe;
- template A;
- template B;
- scan completo;
- score;
- preview;
- lead;
- projeto em homepage_review;
- projeto em ready_to_publish.

---

# 34. Testes mínimos

## 34.1 MVP 0

### Unitários

- validação de formulário;
- validação de URL;
- transformação de status;
- schema de preview.

### Integração

- criação de lead;
- criação de clínica;
- criação de preview;
- armazenamento de asset;
- atualização de status.

### E2E

- visitante envia formulário;
- admin visualiza lead;
- admin cria clínica;
- admin cria preview;
- prospect acessa URL privada;
- prospect alterna Atual e Proposta.

## 34.2 Fases futuras

### Unitários

- score;
- normalização;
- schemas de IA;
- estados;
- token hashing.

### Integração

- scan;
- onboarding;
- aprovação;
- projeto;
- deployment.

### E2E

- scan;
- geração;
- onboarding;
- aprovação;
- publicação;
- rollback.

# 35. Decisões explícitas

- Não criar SaaS completo no MVP.
- Não criar editor visual.
- Não gerar layout livre automaticamente.
- Não armazenar pacientes.
- Não integrar anúncios.
- Não automatizar cold email em massa.
- Não prometer resultados financeiros.
- Não prometer SEO.
- Não permitir publicação sem aprovação.
- Não controlar domínio do cliente indevidamente.
- Não depender de IA para dados factuais.
- Não construir crawler antes da validação comercial.
- Não construir multi-tenancy avançado.
- Não apresentar hipótese comercial como fato.
- Não usar demonstração fictícia como prova real.
- Não permitir que o roadmap se torne escopo automático.
- Não publicar conteúdo `draft`.
- Não armazenar token público em texto puro.
- Não tratar “Contato e ação” como conversão real.
- Não usar “acessibilidade mínima”.

# 36. Mensagem central do produto

> **Seu novo site, aprovado antes de ir ao ar.**

Mensagem de apoio:

> Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica.

Assinatura:

> Ver antes. Aprovar antes. Publicar sem precisar de TI.

# 37. Pitch resumido

Atria moderniza sites de clínicas sem exigir equipe de TI. Primeiro mostramos como o novo site ficará e mantemos o site atual ativo durante a revisão. Depois da aprovação, cuidamos de conteúdo, domínio, hospedagem e publicação. O site atual permanece funcionando até o lançamento.

---

# 38. Critério final de simplicidade

Antes de adicionar qualquer funcionalidade, perguntar:

1. Isso ajuda a vender?
2. Isso reduz tempo de entrega?
3. Isso reduz esforço do cliente?
4. Isso reduz risco?
5. Isso aumenta margem?
6. Isso é necessário para os primeiros clientes?
7. Isso pertence à fase ativa?
8. Existe evidência de que precisa ser automatizado agora?

Se a resposta for “não” para a maioria, deixar para depois.

## Regra final

A existência de uma funcionalidade neste documento não significa que ela deve ser implementada agora. Somente a seção **7. Escopo do MVP** define o escopo obrigatório atual. Qualquer mudança de fase deve ser explícita, registrada e aprovada.
