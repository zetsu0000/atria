# DESIGN.md — Atria

> **Status:** Documento mestre de direção visual e experiência
> **Uso:** Fonte de verdade para design, frontend, motion e revisão visual
> **Versão:** Product Design v3.1 (escopo landing, CSS Modules, Figma gate, 2026-07-24)
> **Idioma do produto:** Português do Brasil
> **Produto:** Atria
> **Estratégia:** Fase ativa = **product design próprio** da Atria, com barra de craft de nível Awwwards (§1.4)
> **Higgsfield:** **retirado**. Não usar.

> ### Referências de craft ativas (§1.3)
>
> Benchmark de **gramática visual**, nunca de marca, copy, fonte ou asset (§1.3.5).
>
> **Desktop:**
> - `upsense.sg` — contraste entre registros tipográficos
> - `www.slight-twist.co.nz` — mundo cromático saturado e integral
> - `studiomodular.be` — fundo quente, fotografia assimétrica, corpo grande
>
> **Mobile (§1.3.6):**
> - `heynesh.com` — **referência de craft mobile**; informa escala e ritmo, não estrutura; não usar como alvo de desktop
>
> **Konpo saiu.** Foi benchmark da Etapa 1, concluída. As seções que tratavam dela foram **removidas deste documento** e vivem em `docs/archive/design-v2-reference-parity.md`, sem autoridade normativa.

> ### Leitura obrigatória antes de qualquer mudança visual
>
> **§0.1** (quem manda) → **§0.2** (o que pode ser tocado) → **§0.3** (o que não pode quebrar) → **§0.6** (por que a landing está ruim) → **§1.3** (o que as referências provam e o que é só hipótese) → **§11.2** (processo) → **§11.3** (Figma).

> ### Toolchain obrigatório
>
> O processo é **proporcional ao tamanho da mudança** (§11.2) — não são cinco gates para todo diff.
>
> Listadas em ordem de **autoridade** (§0.1), não de invocação.
>
> | # | Ferramenta | Papel | Invocação |
> |---|---|---|---|
> | 1 | **Figma** | **Fonte de verdade visual** — só frames `APPROVED` (§11.3) | MCP `mcp__claude_ai_Figma__*` |
> | 2 | **Playwright** | Prova: implementação × frame aprovado | MCP `playwright` + `@playwright/test` |
> | 3 | **Emil skills** | Motion, aprovado no browser (§11.7) | `Skill: emil-design-eng` e derivadas |
> | 4 | **taste-skill** | Design Read e preflight — **consultiva** | `Skill: design-taste-frontend` |
> | 5 | **Impeccable** | Crítica e auditoria — **consultiva** | `Skill: impeccable` (Codex `$impeccable`) |
>
> **As camadas 3 a 5 não sobrescrevem um frame aprovado.** Divergência vira pergunta ao humano, não mudança direta no código.

---

# 0. Como usar este documento

Este documento define a direção visual da Atria.

Ele deve orientar:

- arquitetura da landing;
- composição;
- grid;
- espaçamento;
- tipografia;
- cores;
- contraste;
- mídia;
- movimento;
- interações;
- responsividade;
- acessibilidade;
- qualidade de implementação;
- revisão de craft (não cópia de marca);
- toolchain de product design (Figma, Playwright, skills).

Este documento complementa `PRODUCT.md`.

`PRODUCT.md` define:

- o que a Atria é;
- para quem vende;
- o mecanismo Preview-First;
- a fase ativa;
- o escopo funcional;
- as políticas de produto e veracidade.

`DESIGN.md` define:

- como a Atria deve parecer;
- como a experiência deve se comportar;
- o que preservamos do craft Konpo (escala, ritmo, coragem);
- o que já é identidade Atria e deve ser reforçado;
- quais decisões visuais são obrigatórias;
- como auditar e iterar com Figma + Playwright + skills.

## 0.1 Hierarquia de autoridade

Em caso de conflito, a decisão mais alta vence. Esta ordem substitui a "ordem de prioridade" anterior.

| # | Autoridade | Sobre o quê |
|---|---|---|
| 1 | **`PRODUCT.md`** | Verdade de produto, segurança, veracidade, escopo funcional |
| 2 | **Acessibilidade (§21)** | Piso não negociável; craft não compra exceção |
| 3 | **Decisão humana aprovada** | Direção conceitual escolhida por Marcelo |
| 4 | **Frames Figma `APPROVED`** (§11.3) | **Verdade visual**: composição, grid, escala, cor, estados |
| 5 | **Protótipo de motion aprovado no browser** (§11.7) | **Verdade de motion**: timing, física, scroll, sensação |
| 6 | **`DESIGN.md`** | Princípios, sistema, critérios, limites |
| 7 | Implementação existente | Precedente, não autoridade |
| 8 | Recomendações das skills | Consultivas (§11.6) |
| 9 | Conveniência técnica | Última |

Três consequências que valem escrever por extenso:

- **`PRODUCT.md` = verdade de produto.**
- **Decisão humana = autoridade de aprovação** (antes do Figma e depois da implementação).
- **Figma `APPROVED` = verdade visual.** Skills são consultivas; não sobrescrevem frame aprovado.
- **Browser aprovado = verdade de motion.**
- **`DESIGN.md` = sistema e princípios.**
- **Skills = crítica e apoio.**

O agente não declara a página pronta só porque skills e testes passaram. Falta aprovação humana final (§11.2).

O código atual não tem prioridade sobre a direção visual aprovada.

## 0.2 Escopo desta direção visual

### Escopo da reconstrução atual

A reconstrução visual aplica-se à landing pública `/` e aos componentes exclusivos da landing.

A rota `/previa/clinica-aurora` permanece funcional e visualmente congelada nesta etapa. A landing pode referenciá-la, capturá-la como mídia e ajustar links que apontam para ela, mas não deve alterar sua composição.

Qualquer redesign da prévia exige uma tarefa e aprovação separadas.

Isso impede que o agente transforme a reconstrução da landing em dois projetos simultâneos.

**Dentro do escopo:**

- `/` e `components/landing/*` exclusivos da landing;
- CSS da landing isolado (§0.2.1).

**Fora do escopo (congelado nesta fase):**

- `/previa/clinica-aurora` e seus componentes exclusivos de prévia;
- `/operacao` e qualquer componente operacional;
- backend, server actions, crawler, autenticação, banco, APIs;
- `lib/` em qualquer subdiretório;
- `/privacidade`, `/termos` (salvo correção técnica sem redesign).

A landing pode:

- criar links para a prévia;
- usar screenshots reais dela;
- usar trechos dela como mídia;
- alterar o contexto do link.

Mas **não** deve redesenhar a rota `/previa/clinica-aurora` durante a reconstrução da landing.

### 0.2.1 Estratégia de CSS (decidida)

**Decisão:** CSS custom properties escopadas em `.landing-shell` + **CSS Modules** por componente.

**Não migrar para Tailwind nesta fase.** Seria mudança de infraestrutura durante a reconstrução visual, com risco alto e benefício baixo.

Estrutura alvo:

```text
app/page.tsx
components/landing/landing-shell.tsx
components/landing/landing-tokens.css
components/landing/hero.module.css
components/landing/header.module.css
components/landing/request.module.css
```

Exemplo de escopo:

```css
.landingShell {
  --landing-page: …;
  --landing-ink: …;
  --landing-accent: …;
  --landing-type-display: …;
}
```

Regras:

- nenhum token novo da landing em `:root`;
- nenhuma alteração em `operacao.css`;
- estilos globais somente para reset realmente compartilhado;
- componentes da landing não dependem de seletores genéricos como `section`, `h2` ou `button`;
- remover gradualmente o CSS antigo da landing em `app/globals.css`, em vez de acumular outra camada sobre ele;
- as regras de escala e piso de §7.2 e §8.4 valem **dentro** da landing, não na aplicação inteira;
- a correção de paleta já aplicada em 2026-07-24 tocou o `:root` compartilhado de propósito, para tirar o violeta de toda a aplicação. **Foi a última mudança global autorizada por este documento.**

## 0.3 Contrato funcional congelado

O redesign pode mudar composição, tipografia, cor, espaçamento e motion do formulário de solicitação de prévia.

**Não pode mudar**, sem tarefa separada e revisão de segurança:

- nomes e tipos dos campos;
- regras de validação e mensagens sanitizadas;
- texto e mecânica do consentimento;
- integração e verificação do **Turnstile**;
- a server action, seu contrato de entrada e saída;
- deduplicação de leads;
- estados de erro, sucesso e loading em termos de **comportamento** (a aparência pode mudar);
- a honestidade da mensagem de sucesso (§19.4);
- qualquer coisa em `lib/leads`, `lib/security`, `lib/supabase`.

Antes de dar por concluída qualquer mudança que toque o formulário, verificar que um envio real ainda percorre o caminho completo até `/operacao/leads`.

O mesmo congelamento vale para os contratos de `/operacao`: a UI pode receber tokens novos, mas as ações, filtros e mutações não mudam aqui.

## 0.4 Regra central para Cursor e agentes

**Fase ativa = product design Atria**, não reconstrução Konpo.

A referência Konpo permanece como **benchmark de craft** (escala tipográfica, uso de viewport, coragem espacial, menu imersivo). Não é mais o alvo de cópia estrutural linha a linha.

Não suavizar o craft para torná-lo:

- mais convencional;
- mais “SaaS”;
- mais segura visualmente;
- mais parecida com um template médico;
- mais fácil de implementar.

Não prolongar a fase de paridade:

- trocando textos e mantendo a mesma página;
- dependendo de mídia gerada por ferramentas sem crédito/acesso;
- preenchendo `public/atria-media/` com placeholders eternos;
- numerando seções e eyebrows por reflexo de template.

Antes de qualquer alteração visual relevante, o agente deve:

1. declarar um **Design Read** (taste-skill §0);
2. ler `emil-design-eng` para motion/polish;
3. compor ou validar no **Figma** quando a mudança for estrutural;
4. validar no browser com **Playwright** (viewports + screenshots);
5. passar pelo preflight da taste-skill e, quando couber, `review-animations` / `improve-animations`.

## 0.5 Liberdade de execução

O modelo tem liberdade para:

- substituir a arquitetura atual de componentes;
- reescrever CSS;
- alterar a ordem das seções quando a narrativa Atria melhorar;
- criar novos componentes;
- remover componentes fracos e scaffolding de paridade;
- escolher técnicas de animação alinhadas a Emil Kowalski;
- adicionar dependências justificadas;
- criar SVGs e imagens originais;
- compor frames e sistemas no Figma;
- gerar assets via ferramenta de imagem do ambiente (não Higgsfield);
- criar fallbacks locais DOM/CSS/SVG;
- tomar decisões visuais sem pedir confirmação a cada etapa.

A liberdade não autoriza:

- inventar informações de produto;
- remover avisos de demonstração fictícia;
- comprometer acessibilidade;
- copiar assets, textos ou código da Konpo;
- usar marcas ou clientes da Konpo;
- reintroduzir Higgsfield;
- publicar o protótipo de paridade como versão final sem revisão de product design;
- fake screenshots em `<div>` como substituto permanente de mídia.

## 0.6 Auditoria 2026-07-24 — por que a landing está ruim

Auditoria feita sobre `app/page.tsx` (476 linhas), `app/globals.css` (4364 linhas), `app/layout.tsx` e `components/landing/*`, contra este documento.

O resultado não é "falta de talento visual". São **seis defeitos estruturais**, e cinco deles foram autorizados ou causados por este próprio documento.

### Causa raiz — este documento proibia o sistema de design

O antigo §7.2 ("Paridade antes de tokens") dizia: *"Não escolher arbitrariamente: container padrão, padding padrão, gap padrão, altura padrão de seção"*, e §8.4/§8.5 marcavam a escala tipográfica como *"não definitiva"*. A liberação viria depois de medir a Konpo — etapa que §1.1 declarou **concluída** sem nunca ter produzido tokens.

Resultado medido em `app/globals.css`:

- **0** tokens `--type-*` ou `--space-*` no `:root`;
- **119** valores distintos de `font-size` na folha;
- **21** declarações abaixo de 12px (menor: `0.58rem` = 9.3px);
- **16** `@media` reescrevendo os mesmos elementos com valores novos a cada breakpoint.

Sem escala, cada número foi escolhido à mão por componente. É isso que produz a sensação de amadorismo: **não existe ritmo, porque não existe sistema**. §7.2 foi reescrito nesta revisão para tornar os tokens obrigatórios.

### D1 — A paleta neutra inteira é roxa

`:root` define `--page`, `--page-strong`, `--ink`, `--ink-soft`, `--line`, `--inverse` todos em **hue 302 (violeta)**, e `themeColor: "#f5f2fa"`. O accent é hue 31 (terracota).

A página é lavanda com laranja. §9.3 e `AGENTS.md` proíbem "SaaS roxo" e "estética SaaS genérica". Este é o defeito mais visível e o mais barato de corrigir.

**Ação:** neutros em hue quente-neutro (20–60) ou croma ≤ 0.004. Roxo não é cor da Atria.

### D2 — Texto minúsculo como padrão

`body` usa `clamp(0.95rem, 0.93vw, 1rem)` — encolhe para 15.2px. Labels, eyebrows, metadados e navegação vivem entre `0.58rem` e `0.78rem`. §8.3 exige corpo *"maior que corpo SaaS comum"*; `AGENTS.md` proíbe "tiny gray text".

No hero, um `h1` de `clamp(3.7rem, 5.85vw, 5.25rem)` é seguido por texto de apoio em ~13px centralizado. A razão entre título e apoio passa de 6:1. Não lê como editorial, lê como descuido.

**Ação:** piso de 16px no corpo, 13px em qualquer label. Nada abaixo disso.

### D3 — A landing não tem mídia

`ChapterVisual` e `MethodDiagram` (`app/page.tsx:120-165`) constroem toda a mídia da página com `<span>` vazios estilizados. `public/` contém 3 SVGs de diagrama e 4 arquivos default do Next.js.

§0.5 e §30 proíbem explicitamente *"fake screenshots em `<div>` como substituto permanente de mídia"*. §10.1 exige que a mídia **estruture** a página. Hoje a mídia é decoração de CSS.

Uma landing cujo produto é *"mostramos o resultado antes da publicação"* e que **não mostra nenhum resultado** falha na própria tese.

**Ação:** mídia real de Atual/Proposta é o item de maior prioridade depois da paleta.

### D4 — Scaffolding de template ainda no ar

- Eyebrows numerados `01`, `02`, `04`, `05` — proibidos por §30 e §11.5. **O `03` não existe**: a numeração quebrou em uma edição anterior e ninguém percebeu, o que confirma que são decoração, não estrutura.
- Além dos eyebrows, `String(index + 1).padStart(2, "0")` aparece em mais **4** listas (`opportunity-row`, `method-panel`, `diagnostic-row`, `assurance-row`). Cinco sistemas de numeração na mesma página.
- Em-dash em copy de UI, proibido por §30, em 3 lugares: `app/page.tsx:36`, `app/page.tsx:254`, `components/landing/current-proposal-stage.tsx:125`.

### D5 — Composição sem eixo

O hero centraliza `h1` e apoio, enquanto o descritor está no topo-esquerdo e o rail lateral cria um terceiro eixo. §8.7 pede *"evitar títulos centralizados por padrão"*.

O gutter implementado é `clamp(1rem, 1.12vw, 1.25rem)`; §7.3 documenta `clamp(1rem, 2.1vw, 2.25rem)`. A implementação usa **metade** da margem que este documento especifica, e a página fica apertada nas bordas em desktop largo.

### D6 — Playwright é decorativo

`playwright` e `@playwright/test` estão em `package.json`, o MCP está em `.mcp.json`, §11.4 chama Playwright de *"prova visual oficial"* — e o repositório tem **zero** arquivos `.spec.ts` e nenhum `playwright.config`. Os screenshots em `docs/references/screenshots/atria/` foram gerados à mão e não regridem nada.

Sem suíte, toda regressão visual só é descoberta por inspeção humana. Foi assim que o `03` sumiu.

### Defeito de processo — este documento é grande demais para ser seguido

O arquivo tinha 3.190 linhas quando esta auditoria foi escrita. As §§2, 3, 4, 28 e 29 são instruções da **Etapa 1 de paridade Konpo**, que §1.1 declara concluída — mas continuam escritas em tom obrigatório ("obrigatório", "deve", "aprovado quando"). Um agente que lia o documento inteiro recebia ordens conflitantes: §0.4 mandava parar de imitar a Konpo, §4 mandava medir a Konpo antes de codificar.

**Corrigido em 2026-07-24:** essas seções foram fisicamente removidas para `docs/archive/design-v2-reference-parity.md`. Marcar como "não normativo" não bastava — um modelo continua lendo "deve" e "obrigatório" como instrução.

### Ordem de correção

Reordenada em §1.3 depois da medição das quatro referências de craft. Cada item tem alvo definido.

| # | Correção | Alvo | Defeito |
|---|---|---|---|
| 1 | Paleta quente; eliminar hue 302 | §9.3 | D1 |
| 2 | Tokens de tipografia e espaço | §7.2, §8.4 | causa raiz |
| 3 | Pisos de texto: corpo 17px, label 13px | §8.4 | D2 |
| 4 | Remover scaffolding numerado e em-dash | §30 | D4 |
| 5 | Isolar tokens/CSS da landing (`.landing-shell` + Modules) | §0.2.1 | — |
| 6 | Suíte Playwright da landing `/` | §11.4 | D6 |
| 7 | Decidir peso, alinhamento, eixo e header no Figma | §5.1, §8.5, §14.1 | D5 |
| 8 | Decidir sistema de fontes | §8.8 | — |
| 9 | Mídia real e camadas | §10, §5.1 | D3 |
| 10 | Momento memorável em Atual/Proposta | §16.1 | §1.4 |

Itens 1 a 6 são correções de sistema ou infraestrutura: impacto alto, sem nova direção estilística. Itens 7 a 10 exigem direção no Figma antes do código (§11.2). Peso 650 / `text-align: start` / eixo único **não** são correções automáticas; são hipóteses até o frame `APPROVED`.

---

# 1. Objetivo

Criar uma landing da Atria que um gestor de clínica reconheça em segundos como:

- produto B2B de modernização de sites;
- Preview-First (ver antes, publicar depois);
- experiência editorial de alto craft;
- identidade Atria (Threshold), não portfólio de estúdio genérico.

O visitante deve perceber:

- confiança visual sem estética hospitalar;
- domínio de espaço e tipografia;
- mídia que prova o mecanismo (Atual → Proposta → Aprovado);
- navegação editorial;
- ritmo de página não convencional;
- motion com propósito (Emil: só anima o que comunica);
- acabamento de product design, não de template.

## 1.1 Etapa 1 (concluída) — Paridade interna

Status: **aceita** em `docs/references/atria-konpo-parity-review.md`.

Não reabrir essa etapa salvo regressão grave de craft.

## 1.2 Etapa 2 (ativa) — Product design Atria

Objetivo desta versão do documento:

- dispositivos gráficos próprios;
- composições próprias (Figma → código);
- movimentos próprios auditados com Emil skills;
- sistema de mídia próprio **sem Higgsfield**;
- assinatura Threshold mais reconhecível;
- compressão narrativa mobile;
- remoção de tells de AI/paridade (eyebrows numerados, em-dashes, fake UI eterna);
- validação contínua com Playwright.

A etapa 2 não pode reduzir o nível de craft alcançado na etapa 1.

## 1.3 Referências de craft ativas

**A Konpo deixa de ser a referência.** As seções 2, 3, 4, 28 e 29 tratam dela e são arquivo histórico (§0.6).

A partir de 2026-07-24 o benchmark de craft é este conjunto, **dividido por viewport**:

### Desktop

| Site | O que se aprende dele |
|---|---|
| `upsense.sg` | Contraste entre registros tipográficos; elementos flutuantes sobre a composição |
| `www.slight-twist.co.nz` | Mundo cromático saturado e integral; display em `line-height: 1.0` |
| `studiomodular.be` | Fundo quente com formas orgânicas; fotografia real espalhada em assimetria; corpo de texto grande |

### Mobile

| Site | O que se aprende dele |
|---|---|
| `heynesh.com` | Wordmark sangrando as duas bordas; foto full-bleed com texto por cima; chips de vidro em assimetria; espinha vertical de timeline; corpo grande |

> **`heynesh.com` é referência de craft mobile (§1.3.6).** Serve para informar escala, presença, ritmo e recomposição. **Não determina estrutura, componentes nem identidade** — a decisão final pertence aos frames aprovados no Figma (§11.3). Não usar as medidas dela em 1440 como alvo de desktop.

Capturas em `docs/references/screenshots/craft/` (análise interna; ver `README.md` de lá).

### 1.3.1 Medição desktop — 1440 × 900, capturada em 2026-07-24

> **Estatuto: evidência medida, não norma de composição.**

Os valores desta seção são evidências medidas das referências.

Eles não determinam automaticamente a composição da Atria. Servem para informar a exploração e justificar decisões. Somente fundamentos de legibilidade explicitamente definidos neste documento e decisões aprovadas no Figma possuem caráter normativo.

Pisos de **17px** (corpo) e **13px** (absoluto) podem continuar obrigatórios. Alinhamento, peso, raio, chips e wordmark devem depender do conceito aprovado no Figma.

Valores lidos de `getComputedStyle` no navegador, não estimados.

| Site | Fundo | Tinta | Corpo | Display | Leading display | Peso | Alinhamento |
|---|---|---|---|---:|---:|---:|---|
| `upsense.sg` | `rgb(247,246,243)` creme | `rgb(29,29,29)` | **18px** serif | ~90px² | 1.10 | 400² | `start` |
| `slight-twist.co.nz` | `rgb(10,106,102)` teal | `rgb(255,248,181)` | **16px** | 88px | **1.00** | **700** | `start` |
| `studiomodular.be` | `#FFF7EF` creme | `rgb(11,19,17)` | **19.4px** | 74.9px | 1.10 | **600** | `start` |
| **Atria hoje** | creme (corrigido) | `oklch(.2 .016 62)` | **12.4px**¹ | 84px | 0.98 | **400** | **`center`** |

¹ `.hero-support p` resolve para 12.4px em 1440 (`clamp(0.78rem, 0.86vw, 0.92rem)`); o corpo global fica em 15.2px.

² O `h1` da `upsense` é a linha serif de abertura (36px, peso 400); o display grande em caixa alta é outro elemento, ~90px. A leitura de peso dela não é comparável às demais.

### 1.3.2 O diagnóstico que essa tabela revela

**A escala do display da Atria não é o problema.** 84px está dentro da faixa das referências (74.9–90px).

Leitura factual (informativa até aprovação no Figma):

1. **Peso 400 contra 600–700 nas referências medidas.** Um título grande e leve pode ler como hesitante; o peso final depende da família e do frame aprovado.
2. **`center` na Atria contra `start` nas três referências desktop.** Isso é um padrão observado, não uma obrigação automática de alinhar tudo à esquerda.
3. **Texto de apoio em 12.4px contra 16–19.4px.** A razão display/apoio da Atria é **6.8:1**; nas referências fica entre **3.9:1 e 5.5:1**. O segundo nível tipográfico colapsou. Os pisos de legibilidade (§1.3.3 A, §8.4) são o que permanece normativo aqui.

O hero da Atria não é grande demais. Ele é **grande, leve, frequentemente centralizado e sozinho** porque o nível abaixo dele desapareceu.

### 1.3.3 Fundamentos × hipóteses de direção

A versão anterior desta seção listava 12 padrões e exigia "12 de 12". Isso estava errado: misturava fundamentos de qualidade com escolhas estilísticas de quatro sites específicos. Exigir a receita completa trocaria um template por outro.

Os padrões observados dividem-se em dois grupos com **estatuto diferente**.

#### A. Fundamentos — obrigatórios, não negociáveis no Figma

Valem para qualquer direção. Uma composição que falhe aqui está errada, por mais bonita que seja.

| # | Fundamento | Estado na Atria |
|---|---|---|
| 1 | Corpo legível; nenhum texto abaixo do piso (§8.4) | ❌ 9.9px a 15.2px |
| 2 | Hierarquia tipográfica com mais de um nível vivo | ❌ segundo nível colapsado (6.8:1) |
| 3 | Mídia real e convincente | ❌ `<div>` vazios |
| 4 | Composição intencional, com profundidade | ❌ pilha plana |
| 5 | Nada que leia como template genérico | ❌ barra + cards + eyebrows numerados |
| 6 | Acessibilidade: contraste medido, teclado, reduced motion | ⚠️ parcial |
| 7 | Performance responsável (§22) | ⚠️ não medida |
| 8 | Mobile art-directed, não empilhado (§20.5) | ❌ empilhado e centralizado |
| 9 | Um momento memorável (§1.4) | ❌ nenhum |
| 10 | Mundo cromático decidido, não default | ✅ corrigido em 2026-07-24 |

#### B. Hipóteses de direção — o Figma decide

Estas são **boas possibilidades** extraídas das referências, não leis. Devem entrar na exploração do Figma como candidatas e ser aprovadas ou descartadas por decisão humana (§11.2).

- fundo creme/quente **ou** cor de marca saturada e integral;
- display em peso 600–700;
- `text-align: start` como hipótese candidata (não obrigação);
- wordmark em escala de composição, sangrando a borda;
- chips e pills em vez de cards com borda;
- fotografia espalhada em assimetria;
- raio generoso em superfícies;
- header em pill flutuante;
- CTA persistente no mobile;
- espinha vertical de continuidade.

Nenhum item de B pode ser tratado como requisito de entrega. Se a direção aprovada no Figma resolver o fundamento por outro caminho, o fundamento está atendido.

### 1.3.4 Baseline de partida

Valores derivados da medição, para **entrar na exploração do Figma** — não para congelar antes dela:

- corpo em **17px** como piso na landing (fundamento: legibilidade em português);
- razão display/apoio de no máximo **5:1** (fundamento: hierarquia);
- pelo menos uma região com sobreposição real de camadas (fundamento: profundidade);
- mídia real substituindo `ChapterVisual` e `MethodDiagram` (fundamento: mídia);
- header que não seja barra full-width com `border-bottom` (fundamento: não-genérico — a forma final é hipótese).

Os dois primeiros são fundamentos com número. Os demais descrevem o problema a resolver, não a solução.

### 1.3.5 O que **não** copiar das referências

Vale para as quatro exatamente como valia para a Konpo (§2.2, arquivada mas correta neste ponto):

- nome, logotipo, wordmark ou identidade de qualquer uma delas;
- copy, títulos, nomes de projeto ou de cliente;
- fotografia, vídeo, ilustração ou qualquer asset servido pelos domínios delas;
- fontes proprietárias: **PP Neue Montreal** (heynesh), **PolySans** (modular), **ivypresto-display** (upsense), **Nanjaune** (slight-twist) são licenciadas e não podem ser usadas;
- paletas literais: o teal `rgb(10,106,102)` da slight-twist e o areia `rgb(213,207,190)` da heynesh são identidade delas;
- a estrutura narrativa específica de cada uma.

Aprender a **gramática**: escala, peso, alinhamento, temperatura, camada, coragem. Não o vocabulário.

### 1.3.6 Mobile — `heynesh.com` como referência de craft

Medido em **390 × 844, DPR 2, iOS UA**, em 2026-07-24. Capturas `heynesh-m0..m5.png`.

| Elemento | `heynesh.com` | **Atria hoje** |
|---|---|---|
| Corpo de texto | **17.7px** / lh **1.60** / `start` | 15.2px / lh 1.50 / **`center`** |
| Display do hero | ~52px / peso **700** / `start` | 46.8px / peso **400** / **`center`** |
| Título de card | 25.0px / peso 500 / `start` | 20.5px / peso 400 / `start` |
| Descritor | — | **11.2px** ❌ abaixo do piso |
| Índice de seção | — | **9.9px** ❌ abaixo do piso |
| Raio | ~24px | 12px |
| Overflow horizontal | não | não ✅ |

#### O que a `heynesh` faz em mobile — observações, não obrigações

1. **Header não é barra.** São três pills flutuando com margem das bordas: chip do logo, CTA "Book a Call" sempre visível, botão de menu quadrado. A Atria usa barra fixa com `border-bottom` mais um rail lateral de 52px com label de 9.9px.
2. **CTA principal presente no header em todo scroll.** Não escondido atrás do hambúrguer.
3. **Wordmark sangra as duas bordas** e é cortado pela foto, criando profundidade dentro de 390px.
4. **Foto full-bleed com o display por cima**, em branco. O hero mobile não é o hero desktop empilhado — é uma composição própria.
5. **Chips de vidro em assimetria** sobre a foto (traços à esquerda, "7+ anos" à direita, "80+ projetos" abaixo). Informação secundária distribuída, não empilhada.
6. **Espinha vertical** com nós na borda esquerda atravessando o scroll, dando continuidade entre cards.
7. **Numerais gigantes com significado.** Os anos `'20`, `'21` em amarelo são conteúdo, não eyebrow decorativo. A Atria tem cinco sistemas de numeração e nenhum significa nada (§0.6 D4).
8. **Corpo em 17.7px com leading 1.60.** Confortável. A Atria centraliza 15.2px com leading 1.50.
9. **Tudo `start`.** A Atria centraliza hero, apoio e descritor.
10. **Raio generoso (~24px)** nos cards, contra 12px da Atria.

#### Fundamentos de mobile (obrigatórios)

- corpo **17px** de piso, leading 1.55–1.60;
- nenhum texto abaixo de 13px — hoje há 9.9px e 11.2px;
- hierarquia com segundo nível vivo;
- mobile é **recomposição**, não empilhamento (§20.1);
- contraste medido quando houver texto sobre mídia.

#### Hipóteses de mobile (o Figma decide)

Vindas da `heynesh`, para entrar na exploração — **não são requisitos**:

- display em peso 600–700 e `text-align: start`;
- header em pills, sem `border-bottom`, com CTA persistente;
- wordmark sangrando as bordas;
- foto full-bleed com display por cima;
- chips assimétricos;
- espinha vertical de continuidade;
- raio ≥ 20px.

## 1.4 A barra Awwwards, em termos operacionais

"Digno de Awwwards" não é um adjetivo. Na prática um site é aceito quando tem, ao mesmo tempo:

1. **Um momento memorável.** Uma coisa que a pessoa lembraria e descreveria depois. Na heynesh é o recorte sobre o wordmark; na modular é "Modular" sangrando a borda direita. **A Atria não tem nenhum.**

   Levar **três conceitos** à exploração do Figma, e escolher por decisão humana (§11.2):

   - **A.** Threshold: a passagem Atual → Proposta;
   - **B.** o site sendo revelado progressivamente;
   - **C.** a aprovação como transição de estado.

   O conceito A tem a vantagem de coincidir com o mecanismo do produto, mas **não é a resposta obrigatória**. Ele precisa vencer B e C na exploração.
2. **Um mundo cromático próprio**, decidido, não um cinza de default.
3. **Um sistema tipográfico com contraste real** entre pelo menos dois registros. A Atria hoje tem uma única fonte (Hanken Grotesk) em um único peso relevante.
4. **Craft consistente até o rodapé.** Um site é reprovado pelo trecho mais fraco, não pelo mais forte.
5. **Motion com propósito**, respeitando `prefers-reduced-motion` (§12).
6. **Acessibilidade real.** Contraste medido, teclado completo. Isso não é negociável nem para craft (§21).

O item 1 é o que separa "bem feito" de "premiado". Um site pode acertar 2 a 6 e continuar sendo esquecível.

Correspondência com a Atria: o produto **é** a passagem controlada entre dois estados. O momento memorável já está no conceito Threshold (§6.2) — falta executá-lo.

---

# 2, 3, 4 — Arquivadas

As seções **2 (Política de reconstrução)**, **3 (Referência primária)** e **4 (Processo obrigatório de análise)** tratavam da paridade com a Konpo, etapa concluída.

Foram removidas deste documento e vivem em:

`docs/archive/design-v2-reference-parity.md`

Elas **não têm autoridade normativa**. A direção ativa de referências está em §1.3.

---

# 5. Arquitetura da landing Atria

A landing precisa entregar seis **momentos**. Quantas regiões eles viram é decisão do Figma (§11.3), não deste documento.

| Momento | Objetivo |
|---|---|
| Impacto e proposta | Quem é a Atria e o que promete, em segundos |
| Prova de excelência | Demonstrar craft, não afirmar |
| Mecanismo Preview-First | Ver antes, publicar depois |
| Confiança | Prova de processo, sem inventar (§18) |
| Conversão | Solicitação de prévia |
| Fechamento | Marca e última chamada |

As oito regiões descritas abaixo são a **implementação atual** desses momentos e servem como referência de conteúdo. O Figma pode consolidá-las em quatro, cinco ou sete. Uma página longa e explicativa demais é um risco tão real quanto uma curta demais.

A ordem pode mudar quando a narrativa Atria melhorar (§0.5).

## 5.1 Região 01 — Abertura

Objetivo:

- estabelecer Atria imediatamente;
- comunicar a promessa;
- criar impacto equivalente aos heros de §1.3;
- evitar aparência de landing médica.

Conteúdo:

- marca Atria;
- descritor;
- promessa canônica;
- mensagem de apoio;
- CTA principal;
- CTA secundário;
- indicação visual do mecanismo Atual → Proposta → Aprovado.

Regras de composição:

**Normativas (legibilidade / produto):**

- texto de apoio nunca abaixo de 17px; label nunca abaixo de 13px; razão máxima display/apoio **5:1**;
- máximo 4 elementos de texto no hero (§11.5);
- a composição deve usar espaço, não caixas;
- o CTA não deve parecer um widget;
- sem mockup genérico de notebook, ilustração médica ou foto de médico sorrindo como elemento principal;
- o visitante deve compreender o mecanismo Preview-First em poucos segundos.

**Hipóteses até o Figma `APPROVED` (§1.3.1):**

- display em peso ~650 e leading ~1.02;
- `text-align: start` e remoção do bloco flutuante `margin: 0 auto`;
- eixo único entre descritor, display, apoio e CTAs;
- sobreposição real de camadas;
- wordmark em escala de composição;
- pills / assimetria no lugar de cards.

Motion da primeira dobra: controlado e aprovado no browser (§11.7), não inventado no CSS.

## 5.2 Região 02 — Demonstrações principais

Equivalente funcional às vitrines de trabalho das referências de §1.3.

A região deve apresentar três capítulos visuais, por exemplo:

1. **Atual** — o site que existe hoje;
2. **Proposta** — a versão modernizada;
3. **Aprovado** — publicação somente após decisão.

Outra interpretação permitida:

1. clareza;
2. experiência mobile;
3. controle da publicação.

Cada capítulo deve:

- ocupar grande área;
- ser guiado por mídia;
- possuir identidade cromática;
- ter título curto;
- ter uma frase editorial;
- permitir exploração;
- usar vídeo ou composição original;
- não parecer card.

## 5.3 Região 03 — Tese da Atria

Pausa editorial: o manifesto da Atria.

Objetivo:

- explicar que trocar um site é um problema de risco e coordenação;
- posicionar a Atria entre o atual e o aprovado;
- reforçar processo done-for-you;
- criar pausa tipográfica após mídia intensa.

Evitar:

- lista genérica de benefícios;
- ícones;
- cards;
- títulos como “Por que escolher a Atria?”;
- números inventados;
- claims comerciais.

## 5.4 Região 04 — Método

Equivalente à região de serviços.

Apresentar:

- análise;
- proposta;
- revisão;
- aprovação;
- publicação.

A interação deve ser editorial, não tabular:

- itens grandes;
- hover com mídia ou transição;
- divisórias;
- títulos dominantes;
- detalhes contextuais;
- CTA integrado;
- nenhuma grade de cinco cards iguais.

## 5.5 Região 05 — Atual / Proposta

Onde vive o momento memorável da página (§1.4, §16.1).

Esta é a região central da Atria.

Ela deve receber o maior investimento visual depois do hero.

Apresentar:

- Atual;
- Proposta;
- desktop;
- mobile;
- observações;
- estado selecionado;
- transição entre versões.

Regras:

- não usar dois cards pequenos;
- não parecer dashboard;
- não parecer editor de sites;
- não usar moldura de browser excessivamente decorativa;
- permitir comparação clara;
- manter contexto ao alternar;
- preservar posição de rolagem;
- anunciar estado para leitores de tela;
- mobile mostra uma versão por vez;
- desktop pode usar camadas, corte, wipe, split ou transição controlada.

## 5.6 Região 06 — Confiança e segurança

Substitui prova social inexistente por prova de processo verdadeira.

Comunicar:

- o site atual permanece ativo;
- nada é publicado sem aprovação;
- domínio permanece sob controle da clínica;
- Atria cuida da parte técnica;
- informações profissionais exigem validação;
- demonstrações fictícias são identificadas.

Não inventar:

- depoimentos;
- logos;
- métricas;
- clientes;
- prêmios;
- resultados.

A composição pode ter densidade editorial alta, desde que o conteúdo seja verdadeiro.

## 5.7 Região 07 — Solicitação de prévia

A região de contato, tratada como experiência e não como formulário anexado ao fim da página.

O formulário deve ser uma região visual, não apenas um bloco utilitário.

Campos conforme `PRODUCT.md`.

Regras:

- progressão clara;
- labels persistentes;
- estados de erro;
- consentimento;
- mensagem honesta de sucesso;
- nenhuma promessa de backend quando não existir;
- visual integrado à página;
- possibilidade de formulário em etapas se isso melhorar a paridade;
- teclado e leitor de tela completos.

## 5.8 Região 08 — Fechamento

Objetivo:

- finalizar com energia;
- repetir a promessa sem parecer repetição;
- convidar à solicitação;
- estabelecer a marca.

Pode incluir:

- headline grande;
- CTA;
- descriptor;
- contato;
- navegação;
- nota de demonstração;
- políticas.

O rodapé deve ter presença de composição, com o wordmark em escala (§1.3.4).

Não terminar com um rodapé mínimo genérico.

---

# 6. Identidade Atria

## 6.1 Personalidade

Atria deve parecer:

- confiante;
- editorial;
- ousada;
- inteligente;
- contemporânea;
- específica;
- controlada;
- humana;
- premium;
- confiável;
- tecnicamente competente.

Atria não deve parecer:

- hospital;
- consultório;
- template médico;
- software corporativo genérico;
- SaaS roxo;
- dashboard;
- agência tradicional;
- gerador de site;
- ferramenta de IA;
- wireframe polido;
- coleção de cards.

## 6.2 Conceito de identidade

A identidade parte do intervalo entre:

- atual;
- proposta;
- aprovação.

Conceito interno:

> **Threshold — a passagem controlada entre o atual e o aprovado.**

## 6.3 Assinatura Threshold

Threshold pode aparecer em:

- navegação ativa;
- relação Atual/Proposta;
- momento de aprovação;
- transições entre estados;
- cortes, intervalos ou interrupções;
- indicadores de progresso;
- máscaras de mídia.

Não usar Threshold:

- em todos os títulos;
- em todas as bordas;
- como decoração repetitiva;
- como padrão de fundo genérico;
- como substituto de composição.

## 6.4 Logotipo

O logotipo deve:

- manter legibilidade;
- funcionar em preto e branco;
- possuir versão clara e escura;
- poder aparecer em escala de composição (≥ 12vw), inclusive sangrando a borda (§1.3.4);
- não ser transformado em elemento médico;
- não usar cruz, coração, estetoscópio ou símbolo clínico genérico.

## 6.5 Marca em movimento

A marca pode:

- aparecer por recorte;
- atravessar um intervalo;
- mudar de estado;
- alternar entre atual e proposta;
- surgir por máscara;
- reagir ao menu.

A animação deve reforçar Threshold.

---

# 7. Sistema espacial

## 7.1 Princípio

O espaço deve ser tratado como material de design.

A página não deve ser montada a partir de uma escala mecânica de seções idênticas.

O ritmo deve alternar:

- expansão;
- compressão;
- mídia;
- pausa;
- texto;
- movimento;
- silêncio visual.

## 7.2 Tokens são obrigatórios

> **Revisado em 2026-07-24.** A versão anterior desta seção ("Paridade antes de tokens") adiava a definição de tokens até o fim da medição da Konpo. A medição terminou, os tokens nunca foram criados, e a folha de estilo acumulou 119 tamanhos de fonte distintos sem escala. Ver §0.6.

A escala não é mais opcional e não depende de mais nenhuma medição.

A landing deve declarar, **escopado em `.landing-shell` com namespace `--landing-*`** (§0.2, nunca no `:root` global), e todo componente da landing deve consumir:

```css
/* tipografia — nenhum font-size fora desta escala */
--type-display-1;
--type-display-2;
--type-heading-1;
--type-heading-2;
--type-heading-3;
--type-body-large;
--type-body;
--type-label;

/* espaço vertical entre regiões */
--space-section-tight;
--space-section-standard;
--space-section-large;
--space-section-cinematic;

/* espaço interno */
--space-1 … --space-8;
```

Regras de execução, **válidas dentro da landing** (§0.2), não na aplicação inteira:

- **nenhum `font-size` literal** em regra de componente da landing; apenas `var(--landing-type-*)`;
- **piso de 1rem** para corpo de texto e **0.8125rem (13px)** para qualquer label, em qualquer viewport;
- o responsivo mora no `clamp()` do token, não em `@media` por componente;
- um `@media` só pode alterar **layout** (grid, ordem, direção), não reescrever tipografia;
- ao introduzir um valor que não existe na escala, estender a escala — não fazer exceção local.

Um valor arbitrário é aceitável apenas em ajuste óptico pontual (§7.9), com comentário explicando o porquê.

## 7.3 Gutter

O gutter deve:

- parecer pequeno em áreas full-bleed;
- permitir alinhamentos editoriais;
- aumentar em viewports maiores;
- reduzir no mobile sem esmagar conteúdo;
- alinhar header, títulos e metadados quando observado;
- permitir exceções ópticas.

Implementação recomendada:

```css
--page-gutter: clamp(1rem, 2.1vw, 2.25rem);
```

O valor implementado hoje (`clamp(1rem, 1.12vw, 1.25rem)`) é metade deste e aperta a página em desktop largo (§0.6 D5). Corrigir.

## 7.4 Grid

Começar com uma grade flexível de 12 colunas no desktop.

Permitir:

- spans assimétricos;
- conteúdo atravessando colunas;
- mídia full-bleed;
- texto estreito sobre espaço amplo;
- elementos deslocados;
- alinhamentos fora do centro;
- sobreposição controlada.

Tablet pode usar:

- 8 colunas.

Mobile pode usar:

- 4 colunas;
- ou fluxo de uma coluna com alinhamentos internos.

## 7.5 Largura máxima

Não limitar toda a página a um container estreito.

O viewport é parte da composição; as quatro referências de §1.3 usam a largura inteira.

Regras:

- mídia pode tocar bordas;
- títulos podem ocupar quase toda a largura;
- textos longos devem manter medida legível;
- metadados podem ficar em colunas menores;
- regiões podem possuir containers distintos;
- evitar um único `max-width` global aplicado a tudo.

## 7.6 Altura das regiões

A altura deve responder ao conteúdo e ao viewport.

Usar `min-height: 100svh` apenas quando a região for de fato uma experiência de tela.

Não transformar todas as seções em `100vh`.

## 7.7 Espaçamento vertical

O espaçamento deve ser derivado por relação, e sempre a partir dos tokens de §7.2.

Exemplos de relações a preservar:

- header → título;
- título → subtítulo;
- subtítulo → CTA;
- texto → mídia;
- mídia → próxima região;
- título de seção → primeiro item;
- item → divisória;
- contato → rodapé.

Criar tokens depois da medição:

```css
--space-section-tight;
--space-section-standard;
--space-section-large;
--space-section-cinematic;
```

Os nomes representam função, não valores fixos.

## 7.8 Densidade

A landing deve ter:

- zonas densas;
- zonas silenciosas;
- mudanças claras de ritmo.

Não usar o mesmo padding em todas as seções.

## 7.9 Alinhamento óptico

Permitir ajustes específicos para:

- letras grandes;
- logotipo;
- números;
- ícones;
- vídeo;
- bordas;
- títulos quebrados;
- elementos circulares.

Não confiar apenas no alinhamento matemático.

---

# 8. Tipografia

## 8.1 Objetivo

A tipografia deve carregar grande parte da identidade.

Ela deve parecer:

- grande;
- precisa;
- editorial;
- confiante;
- contemporânea;
- controlada.

## 8.2 Estratégia de paridade

Não copiar fonte privada de nenhuma referência (§1.3.5).

Reproduzir:

- proporção;
- largura visual;
- contraste de pesos;
- altura de linha;
- quebras;
- densidade;
- comportamento responsivo.

Selecionar uma fonte:

- local já licenciada;
- open source permitida;
- variável quando útil;
- disponível sem dependência remota;
- com métricas compatíveis com a composição.

Não usar Google Fonts remoto.

## 8.3 Categorias

### Display principal

Uso:

- hero;
- títulos de regiões;
- fechamento.

Características:

- escala extrema;
- altura de linha apertada;
- peso regular ou médio;
- kerning refinado;
- quebras deliberadas;
- pouca largura de texto.

### Display secundário

Uso:

- método;
- demonstrações;
- itens grandes.

Características:

- alta presença;
- mais flexível;
- legível em interação;
- responsivo.

### Corpo editorial

Uso:

- tese;
- explicações;
- observações.

Características:

- medida controlada;
- contraste alto;
- ritmo confortável;
- tamanho maior que corpo SaaS comum.

### Interface

Uso:

- navegação;
- labels;
- estados;
- rótulos de cursor;
- formulário;
- metadados.

Características:

- compacta;
- clara;
- sem parecer dashboard;
- excelente em maiúsculas ou sentence case, conforme a função.

## 8.4 Escala definitiva

> **Baseline de exploração, não escala final.** Estes valores vêm da medição (§1.3.1) e servem para entrar no Figma. Pesos e métricas variam muito entre famílias tipográficas: `650` pode ser sólido numa variável e pesado ou inexistente noutra.
>
> **Tornam-se normativos apenas depois de validados no Figma com a fonte escolhida** (§8.8, §11.3). Até lá, são hipótese com número.
>
> O que **já** é normativo, independente de fonte: os pisos de legibilidade (17px de corpo, 13px absoluto) e a razão máxima de 5:1 — esses são fundamentos de acessibilidade (§1.3.3 A), não escolha estilística.

```css
:root {
  /* display */
  --type-display-1: clamp(3.25rem, 6.1vw, 5.5rem);      /* 52 → 88px */
  --type-display-2: clamp(2.5rem, 4.6vw, 4.125rem);     /* 40 → 66px */

  /* headings */
  --type-heading-1: clamp(2rem, 3.4vw, 3rem);           /* 32 → 49px */
  --type-heading-2: clamp(1.5rem, 2.2vw, 2rem);         /* 24 → 32px */
  --type-heading-3: clamp(1.25rem, 1.5vw, 1.5rem);      /* 20 → 24px */

  /* corpo */
  --type-body-large: clamp(1.125rem, 1.45vw, 1.375rem); /* 18 → 21px */
  --type-body: clamp(1.0625rem, 1.18vw, 1.1875rem);     /* 17 → 19px */

  /* interface */
  --type-label: clamp(0.8125rem, 0.9vw, 0.9375rem);     /* 13 → 15px */
}
```

Pisos absolutos, em qualquer viewport:

- corpo: **17px** — acima das referências `slight-twist` (16px) e `heynesh` (17px), porque o português tem palavras mais longas que o inglês;
- label: **13px**;
- nada abaixo de 13px existe no produto.

Razão máxima entre display e o texto de apoio adjacente: **5:1** — fundamento, não hipótese. Hoje é 6.8:1 (§1.3.2).

## 8.5 Altura de linha e peso

```css
:root {
  --leading-display: 1.02;   /* referências: 1.00 – 1.10 */
  --leading-heading: 1.08;
  --leading-body-large: 1.35;
  --leading-body: 1.55;
  --leading-label: 1.2;

  --weight-display: 650;     /* referências: 600 – 700 */
  --weight-heading: 600;
  --weight-body: 400;
  --weight-label: 500;
}
```

**O peso do display é o ajuste de maior impacto identificado.** As referências usam 600–700; a Atria usa 400 (`app/globals.css`, `.hero h1`). Um display de 88px em peso 400 lê como incerteza, não como calma.

Mas `650` é **hipótese**: só faz sentido depois de escolhida a fonte (§8.8). Validar no Figma com a família real antes de fixar.

`--leading-display: 0.88` da versão anterior era agressivo demais e colidia com acentos do português (`ã`, `Ç`, `é`). 1.02 preserva a densidade sem cortar diacrítico.

## 8.8 Sistema de duas fontes

Hoje o produto usa **uma** fonte, `Hanken_Grotesk` (`app/layout.tsx`), em um único peso relevante. As quatro referências usam faces com personalidade e, em `upsense.sg`, dois registros em contraste explícito no mesmo hero (serif italic + grotesk wide uppercase).

Uma grotesk neutra em peso único é a assinatura tipográfica do template. É preciso escolher entre:

**Rota A — duas faces em contraste.** Uma display com caráter (serif de alto contraste, ou grotesk larga) + uma interface neutra. Mais próximo de `upsense`. Maior risco, maior teto.

**Rota B — uma face variável com uso corajoso.** Uma única grotesk de qualidade, explorando 400 → 700 e largura óptica. Mais próximo de `heynesh` e `modular`. Menor risco, exige disciplina de peso e escala.

Restrições que valem nas duas rotas (§8.2 permanece):

- self-hosted via `next/font/local` ou `next/font/google`; nenhuma requisição remota em runtime;
- licença aberta ou já licenciada — **PP Neue Montreal, PolySans, ivypresto-display e Nanjaune estão fora** (§1.3.5);
- suporte completo a diacríticos do português;
- variável quando disponível, para não carregar múltiplos arquivos.

Decidir a rota antes de mexer no hero. Trocar fonte depois de ajustar a composição obriga a refazer a composição.

## 8.6 Quebras de linha

Quebras no desktop devem ser intencionais.

No mobile:

- não herdar `<br>` rígido sem revisão;
- permitir recomposição;
- evitar linhas de uma palavra;
- preservar energia;
- impedir overflow.

## 8.7 Regras de qualidade

- evitar títulos centralizados por padrão;
- evitar excesso de uppercase;
- evitar peso bold em tudo;
- evitar corpo pequeno;
- evitar grandes títulos com line-height genérico;
- revisar órfãs e viúvas;
- usar `text-wrap: balance` com cuidado;
- usar `text-wrap: pretty` no corpo quando suportado;
- testar acentos do português;
- testar nomes longos;
- testar zoom a 200%.

---

# 9. Cor

## 9.1 Princípio

A cor deve seguir esta lógica:

- base neutra;
- contraste forte;
- mudanças de mundo;
- regiões com identidade própria;
- mídia como fonte de cor;
- momentos claros e escuros;
- controle, não decoração.

## 9.2 Não copiar paleta literal

Não copiar hexadecimais de nenhuma referência (§1.3.5).

Reproduzir:

- frequência;
- função;
- contraste;
- ritmo;
- alternância;
- saturação relativa.

## 9.3 Paleta Atria v3

> **Substitui a paleta atual por inteiro.** A implementação em `app/globals.css` monta todos os neutros em **hue 302 (violeta)** e `themeColor: "#f5f2fa"`. Nenhuma das quatro referências usa neutro frio: `upsense` `rgb(247,246,243)`, `heynesh` `rgb(213,207,190)`, `modular` `#FFF7EF`, `slight-twist` teal saturado (§1.3.1). O roxo é o defeito mais visível da landing (§0.6 D1).

### Base clara — hue quente 62–78

```css
:root {
  --page:         oklch(0.970 0.014 76);  /* creme; substitui o lavanda */
  --page-strong:  oklch(0.935 0.022 74);  /* superfície secundária */
  --ink:          oklch(0.20  0.016 62);  /* preto quente, não neutro */
  --ink-soft:     oklch(0.44  0.020 62);
  --line:         oklch(0.62  0.022 62 / 0.45);
  --line-soft:    oklch(0.62  0.022 62 / 0.18);
}
```

### Mundo escuro

```css
:root {
  --inverse:      oklch(0.17  0.020 55);  /* carvão quente */
  --inverse-ink:  oklch(0.965 0.014 78);
}
```

### Accent

```css
:root {
  --accent:       oklch(0.62 0.205 34);   /* vermelho-terra */
  --accent-ink:   oklch(0.985 0.010 78);
  --accent-pale:  oklch(0.90 0.060 34);
  --focus:        oklch(0.55 0.20 34);
}
```

O accent atual (`oklch(0.64 0.2 31)`) já tem a energia certa — é a única decisão cromática boa da implementação. **O que muda não é o accent, é o chão embaixo dele.** Terracota sobre creme é um par histórico; terracota sobre lavanda é acidente.

### Regras

- **violeta não pode ser o neutro default** — foi o defeito de origem (§0.6 D1). A família 280–320 não está banida em absoluto: pode existir como cor deliberada de mídia ou de um mundo de seção, se for decisão registrada no Figma. O que não pode voltar é `--page`/`--ink`/`--line` em hue violeta por inércia;
- todo neutro carrega croma entre 0.014 e 0.022 — cinza puro (`C = 0`) é tão default quanto roxo;
- `themeColor` em `app/layout.tsx` acompanha `--page`;
- **um** accent na página inteira; um segundo accent precisa de justificativa escrita;
- contraste **medido**, não presumido (§9.5, §21.9) — `--ink-soft` sobre `--page` precisa ser verificado antes de ser usado em texto pequeno;
- a paleta precisa continuar legível em grayscale.

### Mundo cromático de seção

As referências mudam de mundo, não de tom. `slight-twist` compromete a página inteira com teal + amarelo pálido + rosa.

A Atria pode inverter **no máximo duas** regiões para `--inverse` — a comparação Atual/Proposta (§16) e o fechamento (§5.8) são as candidatas naturais, porque são os momentos de maior peso narrativo. Alternar mais que isso vira listra e destrói o ritmo (§7.8).

### Migração — executada em 2026-07-24

O violeta foi removido de `app/globals.css`, `app/operacao/operacao.css` e do `themeColor` em `app/layout.tsx`. Contraste medido e registrado em §9.5.

**Essa foi a última mudança autorizada no `:root` global** (§0.2). Daqui em diante os tokens da landing vivem em `.landing-shell` com namespace `--landing-*`, e mexer em tokens compartilhados exige tarefa e revisão próprias.

## 9.4 Funções de cor

Definir tokens semânticos:

```css
--color-page;
--color-ink;
--color-muted;
--color-line;
--color-inverse-page;
--color-inverse-ink;
--color-accent;
--color-accent-ink;
--color-focus;
--color-success;
--color-error;
```

Projetos ou capítulos podem possuir:

```css
--chapter-bg;
--chapter-ink;
--chapter-accent;
```

## 9.5 Contraste

Requisitos:

- texto essencial: alvo AAA;
- corpo principal: alvo AAA quando viável;
- interface crítica: AAA;
- textos grandes: no mínimo AA, preferencialmente AAA;
- foco: claramente visível;
- nenhum significado apenas por cor;
- estados desabilitados ainda legíveis;
- texto sobre vídeo deve possuir superfície ou overlay quando necessário.

Medir contraste.

Não declarar conformidade por aparência.

## 9.6 Transições de cor

Mudanças podem acontecer por:

- scroll;
- entrada de capítulo;
- hover;
- abertura de menu;
- Atual → Proposta;
- aprovação.

Regras:

- evitar flashes;
- evitar transições longas demais;
- manter texto legível durante a interpolação;
- respeitar redução de movimento;
- impedir fundo e texto de atravessarem estados de baixo contraste.

---

# 10. Sistema de mídia

## 10.1 Princípio

Mídia não é ilustração auxiliar.

Ela deve estruturar a página.

As quatro referências de §1.3 são fortemente orientadas por mídia real. A Atria hoje não tem nenhuma (§0.6 D3).

## 10.2 Tipos permitidos

- vídeo original (produzido fora do Higgsfield);
- loop abstrato;
- captura de interface real da prévia Atria;
- comparação Atual/Proposta;
- composição tipográfica;
- animação de transformação (CSS/Motion/SVG);
- fotografia original ou licenciada;
- SVG editorial;
- frames e sistemas exportados do Figma;
- imagens geradas pela ferramenta de imagem do ambiente Cursor (com art direction Atria);
- WebGL apenas quando justificado.

**Proibido como pipeline:** Higgsfield (retirado do produto e da documentação operacional).

## 10.3 Conteúdos prioritários

Criar mídia para:

1. Atual → Proposta;
2. passagem pelo Threshold;
3. aprovação antes da publicação;
4. desktop e mobile;
5. segurança do site atual;
6. processo done-for-you;
7. fechamento da marca.

## 10.4 Proporções

Variar proporções por região.

Possíveis famílias:

- 16:9;
- 4:3;
- 1:1;
- 3:4;
- full viewport;
- faixas horizontais.

Não aplicar uma proporção única em toda a página.

## 10.5 Vídeo

Regras:

- `muted`;
- `playsInline`;
- loop apenas quando apropriado;
- poster;
- fallback;
- sem autoplay com áudio;
- respeitar economia de dados quando possível;
- pausar fora do viewport;
- não carregar todos os vídeos em prioridade;
- controles acessíveis quando houver controle do usuário;
- não esconder informação essencial apenas em movimento.

## 10.6 Imagens

- usar formatos modernos;
- definir dimensões;
- evitar layout shift;
- criar crop próprio por região;
- criar art direction mobile;
- não depender de `object-fit: cover` sem revisar conteúdo;
- preservar foco visual.

---

# 11. Toolchain de product design

Higgsfield foi **retirado**. Não planejar, promptar nem documentar assets dependentes dele.

## 11.1 Stack e procedência

Estado verificado em 2026-07-24. As cinco camadas estão instaladas; nenhuma pode ser pulada.

| Camada | Ferramenta | Invocação | Papel |
|---|---|---|---|
| Auditoria de UI | **Impeccable** | `Skill: impeccable` · Codex `$impeccable` | `shape`, `critique`, `polish`, `audit`, `harden` |
| Anti-slop / briefing | **taste-skill** | `Skill: design-taste-frontend` | Design Read, dials, preflight, banimento de tells |
| Craft / motion | **emilkowalski/skills** | `Skill: emil-design-eng` e derivadas (§11.6) | Easing, frequência, propósito, estados |
| Design system / composição | **Figma** | MCP `mcp__claude_ai_Figma__*` | Frames, variantes, tokens, handoff |
| QA visual | **Playwright** | MCP `playwright` + `@playwright/test` | Viewports, regressão, teclado, reduced motion |
| Mídia local | SVG / imagem original | — | Assets originais em `public/images/atria/` |

Procedência:

| Ferramenta | Onde vive | Fixado em |
|---|---|---|
| `impeccable` | `~/.claude/skills/impeccable` | — (usuário) |
| `design-taste-frontend` | `~/.claude/skills/design-taste-frontend` | — (usuário) · https://github.com/leonxlnx/taste-skill |
| 7 skills Emil | `.claude/skills/` + `.agents/skills/` | `skills-lock.json` (projeto) |
| Figma MCP | conector Figma | — (conta) |
| Playwright MCP | `.mcp.json` | `package.json` (projeto) |

Reinstalação, se faltar:

```bash
npx skills@latest add emilkowalski/skills   # 7 skills, grava skills-lock.json
npx skills@latest add leonxlnx/taste-skill  # design-taste-frontend
```

Os principais achados de §0.6 (roxo na paleta, 119 tamanhos de fonte, mídia falsa em `<div>`, `03` ausente) são exatamente o que cada uma dessas camadas detecta. Eles chegaram à `main` porque a toolchain estava documentada como obrigatória mas nunca foi executada como gate.

## 11.2 Processo, proporcional ao tamanho da mudança

Exigir nove gates para ajustar um padding faz com que os gates sejam ignorados — e aí nenhum vale. O processo escala com a mudança.

| Tipo de mudança | Processo |
|---|---|
| **Novo conceito** | `PRODUCT.md` → Design Read → exploração Figma → **aprovação humana** (escolhe direção) |
| **Estrutural** (hero, comparação, método, request, footer, mobile) | Design Read → Figma `APPROVED` → `impeccable shape` → implementação → Emil no browser → Playwright → auditorias → **aprovação humana final** → commit |
| **Motion** | Emil → implementação → protótipo aprovado no browser (§11.7) → Playwright → `impeccable critique` → aprovação humana se mudar sensação |
| **Visual pequena** (espaçamento, cor de estado, ajuste óptico) | implementação → Playwright → aprovação humana se alterar percepção |
| **Correção técnica** (bug, a11y, performance, sem impacto visual estrutural) | testes relevantes |

### Ordem canônica de uma mudança estrutural

```text
Design Read
→ conceitos no Figma
→ escolha humana
→ frames APPROVED
→ Impeccable Shape
→ implementação
→ motion no browser
→ Playwright
→ auditorias
→ aprovação humana final
→ commit
```

1. **`PRODUCT.md` e escopo** — o que se vende; `/previa/clinica-aurora` fora do redesign (§0.2).
2. **Design Read** (`design-taste-frontend`) — define o campo de jogo, **não** o layout (§11.5).
3. **Exploração no Figma** — duas ou três direções candidatas. Ainda não há verdade aqui.
4. **Escolha humana** — Marcelo escolhe. Só então os frames viram `APPROVED` (§11.3).
5. **Especificação no Figma** — 1440, 1024, 768, 390, 320; estados, grid, tipografia, tokens, crops, anotações de motion.
6. **`impeccable shape`** — aplicado **sobre a direção aprovada**, não antes dela.
7. **Implementação** — segue os frames aprovados; não reinterpreta livremente; CSS Modules + `.landing-shell` (§0.2.1).
8. **Motion no browser** com as skills do Emil; aprovação de motion é no navegador (§11.7).
9. **Playwright** — contra os frames aprovados e contra o protótipo de motion (quando a suíte existir).
10. **taste preflight** → **`impeccable critique` / `audit` / `harden`**.
11. **Aprovação humana final.** Skills e testes passando **não** bastam para declarar a página pronta.
12. **Commit** — só após a aprovação humana final. Não fazer commit automático.

O passo 6 é onde a versão anterior deste documento errava: colocava `impeccable shape` **antes** do Figma, permitindo que as skills decidissem a direção e o Figma virasse confirmação do que já existia. Corrigido em 2026-07-24.

Antes de qualquer mudança estrutural, ler §0.6. Os seis defeitos listados lá são regressões conhecidas.

## 11.3 Figma — fonte de verdade visual

O Figma é a autoridade sobre **composição, grid, escala, cor, estados e comportamento responsivo** (§0.1, nível 4). Não é autoridade sobre motion (§11.7) nem sobre produto (`PRODUCT.md`).

### 11.3.1 Registro da fonte visual aprovada

> **A preencher antes da primeira implementação estrutural.** Enquanto este bloco estiver vazio, **não existe frame aprovado**.

```text
Arquivo Figma:   <link>
Página:          Landing v2
Frames aprovados:
  - Landing/Desktop/1440
  - Landing/Desktop/1024
  - Landing/Tablet/768
  - Landing/Mobile/390
  - Landing/Mobile/320
Status:          APPROVED FOR IMPLEMENTATION
Aprovado por:    Marcelo
Data:            YYYY-MM-DD
Versão:          <version id>
```

#### Enquanto o registro estiver vazio

**Permitido:**

- exploração no Figma;
- criação do arquivo e configuração de páginas;
- criação de conceitos;
- auditoria do código atual;
- documentação;
- correções técnicas sem impacto visual estrutural.

**Bloqueado:**

- implementação de nova arquitetura;
- reconstrução do hero;
- alteração estrutural de seções;
- implementação de nova direção visual.

O próximo passo correto com registro vazio é **preencher o Figma e explorar conceitos**, não começar pelo código.

Sem arquivo, página, frame e versão identificados, o agente não pode tratar nenhum frame experimental como direção.

### 11.3.2 Estados de frame

| Estado | Significado |
|---|---|
| `EXPLORATION` | Ideia em teste. **Não orienta código.** |
| `CANDIDATE` | Concorre à aprovação. **Não orienta código.** |
| `APPROVED` | Fonte de verdade visual. Só este orienta código. |
| `SUPERSEDED` | Substituído por um `APPROVED` mais novo. |
| `ARCHIVED` | Fora de uso. |

Implementar a partir de um frame que não esteja `APPROVED` é motivo de rejeição do diff.

### 11.3.3 O Figma não é fonte de código

- **não copiar código gerado automaticamente** pelo Figma;
- não reproduzir posicionamento absoluto de forma literal;
- traduzir a composição para HTML semântico, CSS responsivo e componentes acessíveis;
- o frame define **intenção visual e relações**, não a árvore de DOM;
- quando o frame e a acessibilidade colidirem, a acessibilidade vence (§0.1, nível 2) e o frame volta para revisão.

### 11.3.4 Higiene do arquivo

- arquivo Atria dedicado; não misturar com capturas de referência;
- nomes de frames consistentes e legíveis por agente;
- exportar apenas assets originais Atria;
- não importar assets de nenhuma referência (§1.3.5);
- tokens de cor alinhados às variáveis OKLCH da landing (§0.2).

## 11.4 Playwright

Playwright é a prova visual oficial.

> **Pendência crítica (§0.6 D6).** Hoje as dependências existem e o MCP está configurado, mas o repositório **não tem nenhum `.spec.ts` nem `playwright.config.ts`**. Os screenshots em `docs/references/screenshots/atria/` foram tirados à mão e não detectam regressão. Criar a suíte é pré-requisito para declarar qualquer etapa visual concluída.

Estrutura esperada:

```text
playwright.config.ts
e2e/landing.spec.ts        # viewports, overflow, âncoras
e2e/a11y.spec.ts           # teclado, foco, Escape, reduced motion
e2e/tokens.spec.ts         # nenhum texto renderizado abaixo dos pisos de §7.2
```

Cobrir no mínimo:

- viewports: 1440, 1280, 1024, 768, 390, 320;
- rota primária de redesign: `/`;
- `/previa/clinica-aurora` só como **smoke de regressão** (rota congelada, §0.2) — não como alvo de redesign nesta fase;
- estados: menu aberto, Atual, Proposta, formulário erro/sucesso;
- teclado: tab order, Escape no menu;
- `prefers-reduced-motion: reduce`;
- ausência de overflow horizontal;

Playwright só precisa rodar quando a suíte existir ou quando houver mudança visual implementada.
- screenshots full-page e por âncora (`#visao`, `#metodo`, `#comparacao`, `#solicitar`).

Dependências: `playwright` e `@playwright/test` em `package.json`.

Não depender de stitching com `scroll-behavior: smooth` ativo (já documentado como falha).

## 11.5 taste-skill (dials Atria)

**Design Read padrão desta fase:**

> Landing B2B Preview-First para gestores de clínicas no Brasil, vibe editorial-controlada / craft de estúdio, dials `VARIANCE 7 / MOTION 5 / DENSITY 3`, sem SaaS-purple e sem estética hospitalar.

Obrigações:

- zero em-dash (`—`) em copy de UI;
- máximo 1 eyebrow por 3 seções (retirar scaffolding `01 / 02 / 04`);
- hero ≤ 4 elementos de texto;
- sem fake screenshots eternos: evoluir DOM de capítulo para mídia real ou SVG editorial;
- um accent (vermelho-terra) em toda a página;
- theme lock (não inverter seções aleatoriamente).

## 11.6 Emil Kowalski skills

Aplicar em motion e polish:

> Todas **consultivas** (§0.1, nível 8). Não sobrescrevem frame aprovado nem protótipo de motion aprovado.

| Skill | Quando |
|---|---|
| `emil-design-eng` | decisão de UI, easing, estados `:active`, popovers |
| `review-animations` | auditoria estrita do que já anima |
| `improve-animations` | plano priorizado, auto-contido, para executar |
| `find-animation-opportunities` | só oportunidades motivadas; default é **não** animar |
| `animation-vocabulary` | briefing preciso de motion |
| `apple-design` | fluididade e hierarquia quando couber |
| `pick-ui-library` | se precisar de toast/dialog etc. (preferir Sonner etc.) |

Curvas padrão (alinhar tokens CSS):

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

Entrada/saída: ease-out. Hover de cor: ease. Motion constante: linear. Nunca `ease-in` em enter. Nunca `transition: all`.

## 11.7 Motion — fonte de verdade no browser

O Figma **não** decide motion. Um frame estático não carrega timing, física, interrupção, comportamento de scroll nem sensação.

O que o Figma pode especificar:

- o que se move e o que não se move;
- direção e ordem;
- duração aproximada;
- estado inicial e final.

O que só o browser decide:

- timing real e easing;
- física e sensação;
- comportamento sob scroll;
- interrupção e reversão;
- performance;
- degradação sob `prefers-reduced-motion`.

### Aprovação de motion

A verdade de motion é um **protótipo aprovado no navegador**, não um frame. Para considerar motion aprovado:

1. implementar no browser com as skills do Emil (§11.6);
2. gravar vídeo curto ou registrar as medidas de §12.3;
3. **aprovação humana** sobre o comportamento rodando;
4. registrar em `docs/references/` com data.

Só depois disso o Playwright passa a testar contra esse comportamento.

Se motion e frame discordarem, o frame descreve a intenção e o browser descreve o resultado. Quem decide é o humano, não o agente.

## 11.8 Produção de mídia (sem Higgsfield)

Ordem de preferência:

1. composição real no Figma + export otimizado;
2. image-gen do ambiente Cursor com art direction Atria;
3. SVG / DOM editorial local (já usado nos capítulos);
4. fotografia licenciada quando houver orçamento.

Para cada asset manter em `docs/references/atria-media-plan.md`:

| Asset | Região | Objetivo | Proporção | Duração | Ferramenta | Fallback | Status |
|---|---|---|---:|---:|---|---|---|
| Threshold loop | Hero | Passagem controlada | 16:9 | 6s | Figma + CSS/SVG | Poster | A planejar |
| Atual/Proposta | Showcase | Comparação | 4:3 | 8s | DOM prévia + Figma | Imagem | Implementado (DOM) |
| Aprovação | Closing | Controle | 16:9 | 5s | Figma + SVG | SVG | A planejar |

Não criar prompts Higgsfield. Se um prompt antigo existir no plano de mídia, tratar como **brief de art direction** para Figma/image-gen, não como job Higgsfield.

---

# 12. Movimento

## 12.1 Princípio

O movimento deve organizar atenção.

Ele deve:

- revelar hierarquia;
- ligar regiões;
- dar peso à mídia;
- comunicar mudança de estado;
- reforçar Threshold;
- tornar Atual → Proposta tangível;
- indicar interação.

Não animar apenas para decorar.

Antes de animar, aplicar o framework Emil (`emil-design-eng`):

1. com que frequência o usuário vê isso?
2. qual o propósito (espacial / estado / explicação / feedback / anti-jank)?
3. qual easing (enter = ease-out custom)?
4. `prefers-reduced-motion` está coberto?

Se a resposta a (2) for “fica bonito”, não animar.

## 12.2 Vocabulário de movimento

Repertório disponível, sempre sujeito ao filtro de §12.1:

- entrada inicial;
- carregamento;
- revelação de texto;
- deslocamento de mídia;
- mudança de escala;
- máscaras;
- clip-path;
- hover;
- cursor contextual;
- play/pause;
- preview/detail;
- drag;
- menu;
- transições de página;
- mudança de cor;
- movimentos ligados ao scroll;
- entrada do rodapé.

## 12.3 Protocolo de medição

Para cada efeito registrar:

- elemento;
- gatilho;
- propriedade;
- valor inicial;
- valor final;
- duração;
- delay;
- easing;
- stagger;
- distância;
- escala;
- opacidade;
- blur;
- máscara;
- comportamento reverso;
- mobile;
- reduced motion.

## 12.4 Faixas iniciais

Até a medição:

- microinteração: 120–240 ms;
- hover editorial: 220–450 ms;
- entrada de elemento: 500–900 ms;
- transição de região: 700–1400 ms;
- menu: 500–1000 ms;
- sequência de abertura: até 1800 ms sem bloquear o usuário.

Medir o resultado no browser antes de fixar (§11.4).

## 12.5 Easing

Usar curvas com:

- aceleração rápida;
- desaceleração sofisticada;
- ausência de bounce genérico;
- sensação física controlada.

Possíveis pontos de partida:

```css
--ease-out-expressive: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-editorial: cubic-bezier(0.65, 0, 0.35, 1);
--ease-quick: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Validar a sensação no browser antes de fixar.

## 12.6 Scroll

O scroll deve parecer:

- contínuo;
- responsivo;
- sem atraso excessivo;
- sem sequestrar entrada;
- sem impedir teclado;
- sem quebrar anchor links.

Smooth scrolling só deve ser usado quando:

- contribuir para paridade;
- funcionar com acessibilidade;
- não criar enjoo;
- não comprometer performance;
- respeitar reduced motion.

## 12.7 Scroll-linked animation

Preferir:

- transform;
- opacity;
- clip;
- scale controlado;
- CSS scroll-driven animations quando apropriado;
- GSAP ScrollTrigger quando necessário.

Evitar:

- animar layout;
- animar `top`/`left` continuamente;
- parallax excessivo;
- elementos que se movem em direções conflitantes;
- texto essencial que só aparece após scroll preciso.

## 12.8 Reduced motion

Com `prefers-reduced-motion: reduce`:

- remover smooth scroll;
- eliminar parallax;
- reduzir reveals;
- evitar clip paths complexos;
- mostrar conteúdo imediatamente;
- manter estados;
- preservar compreensão;
- fornecer poster para vídeo quando apropriado.

---

# 13. Cursor contextual

## 13.1 Objetivo

Sites de alto craft usam linguagem contextual de interação.

A Atria pode usar cursor customizado para:

- abrir;
- comparar;
- arrastar;
- ver proposta;
- pausar;
- continuar;
- fechar.

## 13.2 Regras

- desktop apenas;
- não substituir o ponteiro do sistema em formulários;
- não esconder o cursor nativo sem fallback;
- não usar em dispositivos touch;
- não bloquear foco;
- não depender do cursor para explicar a interação;
- manter rótulos acessíveis no DOM;
- respeitar reduced motion.

## 13.3 Vocabulário Atria

Rótulos possíveis:

- Ver;
- Comparar;
- Atual;
- Proposta;
- Arrastar;
- Abrir;
- Fechar;
- Pausar;
- Continuar;
- Aprovar;
- Detalhes.

Usar linguagem curta.

---

# 14. Navegação

## 14.1 Header

> **A implementação atual está reprovada.** `.site-header` é uma barra `position: fixed`, full-width, com `border-bottom: 1px solid var(--line)` — o padrão 1 de qualquer template. Nenhuma das quatro referências faz isso: `modular` e `upsense` usam pill flutuante destacada da borda; `heynesh` coloca a nav **abaixo** do wordmark, dentro da composição do hero.

O header deve ter:

- presença discreta sem ser genérico;
- **nenhuma barra full-width com `border-bottom`**;
- uma das três rotas: pill flutuante com respiro nas bordas · nav integrada à composição do hero · nav deslocada do topo;
- contraste adaptável sobre seções claras e escuras;
- alinhamento coerente com o eixo do hero (§5.1);
- acessibilidade preservada (§21.5): `aria-expanded`, foco, Escape.

O rail lateral de 52–67px com o label "Menu" em 9.3px também sai: viola o piso de 13px (§8.4) e cria um terceiro eixo no hero.

Elementos possíveis:

- Atria;
- Como funciona;
- Exemplo;
- Segurança;
- Solicitar prévia;
- Menu.

Não sobrecarregar.

## 14.2 Estado ativo

Usar Threshold de modo sutil.

O estado ativo deve:

- ser visível;
- funcionar sem cor apenas;
- responder a teclado;
- não parecer tab de dashboard.

## 14.3 Menu de tela cheia

O menu deve:

- abrir com transição de alta qualidade;
- cobrir o viewport;
- controlar foco;
- impedir scroll de fundo;
- fechar com Escape;
- restaurar foco;
- ter botão de fechar;
- possuir navegação grande;
- incluir CTA;
- responder a mobile;
- manter contraste.

## 14.4 Movimento do menu

Definir com intenção:

- sequência;
- direção;
- máscara;
- entrada de itens;
- movimento de background;
- atraso entre navegação e conteúdo.

Substituir conteúdo por Atria.

## 14.5 Sticky

Usar sticky apenas quando observado e útil.

Não manter header fixo se comprometer a composição.

---

# 15. Botões e links

## 15.1 Princípio

A página deve parecer editorial.

Botões não devem dominar tudo como componentes SaaS.

## 15.2 CTA principal

Deve:

- ser claramente acionável;
- manter presença;
- ter hover refinado;
- funcionar em teclado;
- possuir foco forte;
- usar texto aprovado;
- não competir com o hero.

## 15.3 CTA secundário

Pode funcionar como:

- link editorial;
- texto com seta;
- controle de preview;
- âncora;
- ação contextual.

## 15.4 Links

- underline ou mudança visual clara;
- estado hover;
- estado focus;
- área de toque suficiente;
- não depender apenas de movimento;
- links externos identificados quando necessário.

---

# 16. Atual / Proposta

## 16.1 Importância

Este é o mecanismo visual mais importante da Atria e o **conceito A** entre os três candidatos a momento memorável (§1.4).

Ele não é a resposta obrigatória: precisa vencer os conceitos B (revelação progressiva) e C (aprovação como transição de estado) na exploração do Figma.

É o único lugar da página onde o produto e o craft coincidem: a Atria vende a passagem controlada entre dois estados, e essa passagem é uma ideia visual antes de ser uma funcionalidade. `heynesh` é lembrada pelo recorte sobre o wordmark; `studiomodular` por "Modular" sangrando a borda. A Atria precisa ser lembrada **pela transição Atual → Proposta**.

Consequências práticas:

- esta região recebe o maior investimento de craft da página, à frente do hero;
- a transição precisa ser **contínua e reversível**, não uma troca de aba — o usuário deve sentir a passagem, não observar dois estados desconectados;
- precisa funcionar com conteúdo real, não com `<div>` estilizado (§0.6 D3);
- precisa sobreviver a `prefers-reduced-motion` mantendo a comparação compreensível (§12.8);
- se o conceito A for o escolhido, esta região carrega a página inteira; se outro vencer, esta região ainda precisa funcionar, mas deixa de ser o momento assinatura.

Critério de aceite: alguém que viu a página uma vez consegue **descrever em uma frase** o que acontece aqui. Se a descrição for "tem um antes e depois", ainda não está pronto.

## 16.2 Estados

Estados obrigatórios:

- Atual;
- Proposta.

Estados opcionais:

- Análise;
- Aprovado;
- Desktop;
- Mobile;
- Detalhes.

## 16.3 Desktop

Pode usar:

- corte vertical;
- wipe;
- slider;
- camadas;
- preview/detail;
- troca full-frame;
- deslocamento;
- zoom;
- máscara Threshold.

A solução deve:

- manter legibilidade;
- permitir comparação;
- evitar complexidade gratuita;
- parecer mídia, não ferramenta.

## 16.4 Mobile

Mobile deve:

- mostrar uma versão por vez;
- possuir controle claro;
- preservar posição da página;
- usar `role="tablist"` quando tabs forem a semântica correta;
- manter indicador selecionado;
- anunciar mudança;
- ter touch target adequado;
- evitar gestos obrigatórios;
- funcionar sem drag.

## 16.5 Conteúdo fictício

Clínica Aurora Dermatologia:

- deve ser marcada como fictícia;
- não pode parecer cliente real;
- não pode ter CTA funcional de clínica;
- não pode dominar marca Atria;
- não pode usar dados reais;
- não pode sugerir resultado.

Aviso:

> Demonstração fictícia — nenhuma clínica real está sendo representada.

## 16.6 Continuidade

Ao alternar:

- não pular scroll;
- não mudar altura drasticamente;
- não causar layout shift;
- não resetar mídia indevidamente;
- não perder foco;
- não remover contexto.

---

# 17. Serviços e método

## 17.1 Estrutura

Apresentar cinco passos:

1. análise;
2. proposta;
3. revisão;
4. aprovação;
5. publicação.

## 17.2 Composição

Não usar cinco cards iguais.

Explorar:

- linhas grandes;
- item ativo;
- mídia contextual;
- mudança de fundo;
- números editoriais;
- texto revelado;
- detalhes sob demanda;
- horizontal no desktop;
- vertical no mobile.

## 17.3 Conteúdo

Cada passo deve comunicar:

- o que acontece;
- o que o cliente precisa fazer;
- o que a Atria assume;
- qual risco é reduzido.

---

# 18. Confiança

## 18.1 Prova de processo

Enquanto não existirem clientes e resultados documentados, usar:

- transparência;
- processo;
- política de aprovação;
- segurança de domínio;
- revisão humana;
- demonstração identificada;
- escopo claro.

## 18.2 Proibido

- logos inventados;
- depoimentos inventados;
- ratings;
- selos falsos;
- números fictícios;
- “mais de X clínicas”;
- “líder”;
- “premiado”;
- estudos de caso inexistentes.

## 18.3 Evolução

Quando houver prova real:

- obter autorização;
- documentar fonte;
- manter texto fiel;
- diferenciar depoimento de resultado;
- evitar exagero;
- preservar consentimento.

---

# 19. Formulário

## 19.1 Campos

Seguir `PRODUCT.md`.

Campos ativos previstos:

- nome;
- clínica;
- função;
- cidade/estado;
- URL atual;
- WhatsApp;
- e-mail;
- incômodo opcional;
- consentimento.

## 19.2 Direção visual

O formulário deve ser uma região de composição, com a mesma ambição do resto da página.

Pode usar:

- etapas;
- perguntas grandes;
- seleções editoriais;
- progresso;
- transições;
- resumo antes de enviar.

## 19.3 Regras de interação

- label persistente;
- instrução;
- erro associado;
- `aria-describedby`;
- foco no primeiro erro quando apropriado;
- mensagem de sucesso;
- loading;
- prevenção de envio duplicado;
- consentimento explícito;
- sem dados de pacientes;
- sem pedir sintomas.

## 19.4 Honestidade

Se não houver backend real:

- não dizer que a solicitação foi recebida por equipe;
- informar comportamento local;
- não simular integração.

Quando houver persistência real:

- confirmar envio;
- explicar próximo passo sem prometer prazo não validado.

---

# 20. Responsividade

## 20.1 Princípio

Responsividade não é empilhar desktop.

Cada breakpoint deve possuir direção própria.

## 20.2 Desktop amplo

- aproveitar largura;
- manter grandes títulos;
- mídia expansiva;
- assimetria;
- cursor contextual;
- múltiplas colunas;
- navegação compacta.

## 20.3 Desktop menor

- preservar composição;
- reduzir escala com cuidado;
- controlar quebras;
- revisar overlaps;
- evitar compressão excessiva.

## 20.4 Tablet

- reorganizar grid;
- reduzir concorrência;
- manter mídia grande;
- simplificar movimentos;
- preservar sequência.

## 20.5 Mobile

> **Referência de craft: `heynesh.com`**, medida em 390 × 844 (§1.3.6). O desktop segue `upsense`, `slight-twist` e `studiomodular`. São alvos distintos e não devem ser misturados. A referência **informa**; o Figma **decide** (§11.3).

### Fundamentos (obrigatórios)

| Item | Alvo | Atria hoje |
|---|---|---|
| Corpo | **≥ 17px**, leading 1.55–1.60 | 15.2px / 1.50 |
| Piso absoluto de texto | **13px** | 9.9px ❌ |
| Hierarquia | segundo nível vivo | colapsado |
| Recomposição | estrutura própria, não empilhamento | empilhado |
| Contraste sobre mídia | medido (§9.5) | não aplicável |

### Hipóteses (o Figma decide)

Observadas na `heynesh`, boas candidatas — **não requisitos**:

- display 48–56px em peso 600–700;
- `text-align: start` como hipótese candidata (não obrigação);
- header em pills, sem `border-bottom`, CTA persistente;
- chips assimétricos para informação secundária;
- mídia full-bleed com texto por cima;
- espinha vertical de continuidade;
- raio ≥ 20px.

Uma regra que **não** é hipótese: numeração só quando tiver significado. Cinco sistemas decorativos são um defeito (§0.6 D4), independente da direção escolhida.

Herdado da versão anterior, ainda válido:

- uma experiência editorial própria;
- títulos ainda fortes;
- uma versão de comparação por vez;
- menu full-screen;
- mídia com crop específico;
- menos efeitos simultâneos;
- sem cursor customizado;
- controles visíveis;
- espaçamento adequado;
- rodapé completo.

## 20.6 320 px

Testar:

- navegação;
- títulos;
- CTAs;
- tabs;
- formulário;
- textos longos;
- vídeo;
- rodapé;
- consentimento.

Nenhum overflow horizontal.

## 20.7 200% de zoom

A experiência deve:

- reflow;
- não cortar conteúdo;
- não sobrepor controles;
- manter acesso ao menu;
- permitir formulário;
- preservar leitura;
- não depender de viewport fixa.

---

# 21. Acessibilidade

## 21.1 Meta

- WCAG 2.2 AA como requisito integral;
- AAA para textos essenciais e estados críticos;
- não alegar conformidade sem testes.

## 21.2 Estrutura

- `header`;
- `nav`;
- `main`;
- regiões nomeadas quando necessário;
- `footer`;
- um `h1`;
- hierarquia coerente;
- links e botões semanticamente corretos.

## 21.3 Teclado

Testar:

- Tab;
- Shift+Tab;
- Enter;
- Space;
- Escape;
- setas em tabs quando aplicável;
- abertura e fechamento de menu;
- formulário;
- Atual/Proposta;
- mídia;
- links.

## 21.4 Foco

- visível em superfícies claras e escuras;
- não removido;
- não coberto por sticky header;
- não baseado apenas em cor;
- consistente com a marca;
- contraste suficiente.

## 21.5 Menu

- focus trap;
- Escape;
- retorno de foco;
- `aria-expanded`;
- `aria-controls`;
- nome acessível;
- scroll de fundo bloqueado.

## 21.6 Vídeo

- não iniciar com áudio;
- controles nomeados;
- texto essencial fora do vídeo;
- poster;
- alternativa estática;
- pausa quando controlável.

## 21.7 Motion

- reduced motion;
- ausência de flashes;
- evitar deslocamento extremo;
- não depender de animação para compreender;
- não prender usuário em sequência.

## 21.8 Touch

- alvos adequados;
- spacing entre controles;
- nenhum hover obrigatório;
- nenhum drag obrigatório.

## 21.9 Contraste

Medir:

- texto;
- botão;
- focus;
- placeholder;
- mensagens;
- texto sobre mídia;
- estados de menu;
- transições de cor.

---

# 22. Performance

## 22.1 Princípio

A landing pode ser rica sem ser irresponsável.

## 22.2 Regras

- otimizar mídia;
- carregar apenas mídia necessária;
- lazy load abaixo da dobra;
- poster para vídeo;
- evitar bibliotecas duplicadas;
- limitar JavaScript;
- usar transform e opacity;
- impedir layout shift;
- usar dimensões conhecidas;
- dividir código;
- evitar hidratação global;
- server components quando apropriado.

## 22.3 Vídeos

- múltiplas resoluções;
- bitrate controlado;
- sem 4K obrigatório no mobile;
- poster AVIF/WebP;
- preload `metadata` ou `none` conforme contexto;
- pause fora de viewport;
- não tocar todos simultaneamente.

## 22.4 Fontes

- subset;
- `font-display`;
- preload apenas de pesos críticos;
- não incluir pesos inúteis;
- fallback com métricas ajustadas;
- não expor arquivos de fonte.

## 22.5 Qualidade

A otimização não deve:

- remover mídia essencial;
- achatar o design;
- substituir tudo por gradiente;
- impedir paridade.

Procurar melhor implementação, não menor ambição.

---

# 23. Stack de interação

## 23.1 Liberdade

O modelo pode escolher:

- CSS;
- Web Animations API;
- Motion;
- GSAP;
- ScrollTrigger;
- Lenis;
- Embla;
- View Transitions;
- IntersectionObserver;
- custom hooks.

## 23.2 Critério

Adicionar dependência apenas quando:

- melhora paridade;
- reduz complexidade;
- é mantida;
- funciona com React/Next.js;
- não compromete acessibilidade;
- possui custo aceitável;
- evita implementação frágil.

## 23.3 Escolha sugerida

Uma stack coerente pode ser:

- CSS para estados simples;
- Motion ou GSAP para timelines;
- GSAP ScrollTrigger para sequências complexas;
- Lenis somente se a referência exigir scroll interpolado;
- Embla para carrosséis acessíveis;
- vídeo nativo;
- custom cursor próprio.

Esta é sugestão, não obrigação.

## 23.4 Proibido

- instalar várias bibliotecas para a mesma função;
- adicionar plugin por moda;
- copiar script do site de referência;
- usar smooth scroll que quebra acessibilidade;
- deixar animações sem cleanup;
- provocar hydration mismatch.

---

# 24. Componentização

## 24.1 Princípio

Componentes devem servir à composição.

Não transformar toda seção em card reutilizável.

## 24.2 Primitivas possíveis

- `AtriaHeader`;
- `FullscreenMenu`;
- `HeroSequence`;
- `MediaChapter`;
- `EditorialStatement`;
- `MethodIndex`;
- `CurrentProposalStage`;
- `TrustNarrative`;
- `PreviewRequestFlow`;
- `AtriaFooter`;
- `ContextCursor`;
- `MotionText`;
- `MediaFrame`;
- `ThresholdTransition`.

## 24.3 Reutilização

Reutilizar:

- comportamento;
- motion primitives;
- mídia;
- layout helpers;
- acessibilidade;
- tokens.

Não forçar todas as regiões a compartilhar a mesma aparência.

---

# 25. Conteúdo

## 25.1 Hierarquia obrigatória

O visitante deve entender:

1. o site atual continua funcionando;
2. Atria cria uma proposta;
3. a clínica vê;
4. a clínica pede ajustes;
5. a clínica aprova;
6. Atria publica.

## 25.2 Mensagens aprovadas

Promessa:

> Seu novo site, aprovado antes de ir ao ar.

Descritor:

> Modernização digital para clínicas.

Apoio:

> Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica.

CTA:

> Solicitar uma prévia do meu site.

CTA secundário:

> Ver exemplo de prévia.

## 25.3 Tom

- direto;
- seguro;
- humano;
- sem jargão;
- sem exagero;
- não técnico;
- sem tom hospitalar;
- sem linguagem de agência.

## 25.4 Texto e referência

Não adaptar textos da Konpo palavra por palavra.

Preservar apenas:

- função;
- densidade;
- tamanho;
- ritmo;
- posição.

Criar copy própria da Atria.

---

# 26. Estados de interface

## 26.1 Obrigatórios

- default;
- hover;
- focus-visible;
- active;
- selected;
- loading;
- success;
- error;
- disabled;
- reduced motion;
- menu open;
- video playing;
- video paused;
- Atual;
- Proposta.

## 26.2 Qualidade

Cada estado deve:

- ser projetado;
- manter contraste;
- ser acessível;
- não causar salto;
- corresponder ao sistema.

---

# 27. Verificação

> O processo de trabalho vive em **§11.2** (processo proporcional) e **§11.3** (Figma). A versão anterior desta seção descrevia um segundo processo em paralelo, criando ordens concorrentes. Removida em 2026-07-24.

## 27.1 Antes de considerar a alteração documental ou de código fechada

```bash
npm run lint
npm run build
npm run typecheck
npm test
git diff --check
git status --short
```

Playwright (§11.4) só quando a suíte existir ou houver mudança visual implementada.

Skills e testes passando **não** autorizam declarar a landing pronta. Falta a **aprovação humana final** (§11.2).

## 27.2 Verificações de escopo

Além dos testes, confirmar:

- [ ] `:root` global não foi alterado (§0.2.1);
- [ ] `/previa/clinica-aurora` não foi redesenhada (§0.2);
- [ ] `/operacao`, `/privacidade`, `/termos` não foram tocados;
- [ ] contrato funcional do formulário intacto (§0.3);
- [ ] um envio real ainda chega em `/operacao/leads`;
- [ ] frames usados estavam em `APPROVED` (§11.3.2), ou a mudança era só exploração/técnica permitida com registro vazio;
- [ ] CSS da landing usa Modules + tokens em `.landing-shell`, sem Tailwind nesta fase (§0.2.1).

## 27.3 Commit

Só após **aprovação humana final** (§11.2). Não fazer commit automático. Relatar conforme `AGENTS.md`.

---

# 28, 29 — Arquivadas

As seções **28 (Critérios de paridade)** e **29 (Fase de divergência)** mediam a implementação contra a Konpo.

Foram removidas deste documento e vivem em:

`docs/archive/design-v2-reference-parity.md`

Os critérios ativos de craft estão em §1.3.3, §1.4 e §31.

> **Numeração:** lacunas (28, 29 e quaisquer outras) são **intencionais**. Não renumerar agora só para “ficar bonito”: o risco de quebrar referências cruzadas supera o benefício. Reorganização maior fica para quando o conteúdo histórico estiver estabilizado.

---

# 30. Proibições visuais

Não usar:

- mockup de laptop flutuando;
- mockup de celular inclinado;
- gradiente roxo-azul SaaS;
- vidro fosco por padrão;
- blobs;
- órbitas de ícones;
- cards com ícones genéricos;
- ilustração de médico;
- banco de imagem de recepção;
- cruz médica;
- estetoscópio;
- coração;
- checkmarks em excesso;
- carrossel de logos fictícios;
- números sem prova;
- estrelas;
- depoimentos falsos;
- dashboards decorativos;
- grid Bento genérico;
- excesso de bordas arredondadas;
- sombras SaaS;
- animação de partículas aleatória;
- texto em gradiente;
- glows sem função;
- Higgsfield (pipeline ou fallback “quando tiver crédito”);
- eyebrows numerados em toda seção (`01`, `02`, `04`…);
- em-dash (`—`) em copy de interface;
- fake UI de `<div>` como mídia final permanente.

Acrescentado pela auditoria de 2026-07-24 (§0.6):

- **violeta como neutro default** — `--page`, `--ink`, `--line`, `--inverse`, `themeColor` em hue 280–320 sem decisão registrada;
- **texto abaixo de 13px** em qualquer viewport, inclusive label, eyebrow, metadado e navegação;
- **`font-size` literal** em regra de componente da landing (usar `var(--landing-type-*)`, §7.2);
- **hero centralizado por inércia** (centralizar é permitido se for decisão aprovada no Figma, não default);
- **mais de um sistema de numeração** na mesma página;
- **`@media` que reescreve tipografia** em vez de layout;
- declarar uma etapa visual concluída **sem screenshot Playwright correspondente**.

---

# 31. Checklist final

## Processo (§11.2)

- [ ] Design Read declarado (`design-taste-frontend`).
- [ ] Frame Figma em estado `APPROVED`, registrado em §11.3.1.
- [ ] `impeccable shape` aplicado **sobre a direção aprovada**, não antes dela.
- [ ] Motion aprovado no browser (§11.7), não só no frame.
- [ ] `emil-design-eng` / `review-animations` aplicados ao motion novo.
- [ ] `impeccable critique` executado e achados registrados.
- [ ] Screenshots Playwright gerados nos viewports (quando a suíte existir).
- [ ] Preflight taste-skill aprovado.
- [ ] `impeccable audit` / `harden` quando couber.
- [ ] **Aprovação humana final** antes de declarar pronto e antes do commit.

## Sistema (§7.2, §0.6)

- [ ] Tokens escopados em `.landing-shell` + CSS Modules (§0.2.1); `:root` global intocado.
- [ ] Sem migração Tailwind nesta fase.
- [ ] Contrato funcional do formulário preservado (§0.3).
- [ ] `/previa/clinica-aurora` congelada (só links/mídia/contexto).
- [ ] `/operacao` e páginas legais não foram alteradas.
- [ ] Nenhum `font-size` literal em componente da landing.
- [ ] Nenhum texto abaixo de 13px renderizado.
- [ ] Nenhum neutro violeta por inércia.
- [ ] Um único sistema de numeração na página.
- [ ] Zero em-dash em copy de UI.
- [ ] Nenhuma mídia final feita de `<div>` vazio.
- [ ] Suíte Playwright existe e passa.

## Produto

- [ ] Atria é entendida como modernização de sites para clínicas.
- [ ] Não parece clínica.
- [ ] Não parece agência genérica.
- [ ] Preview-First é compreendido.
- [ ] Site atual permanece ativo.
- [ ] Aprovação vem antes da publicação.
- [ ] Demonstração fictícia está identificada.
- [ ] Product design próprio (não “Konpo com textos trocados”).

## Craft — fundamentos (§1.3.3 A)

Obrigatórios. Não são negociáveis no Figma.

- [ ] Nenhum texto abaixo de 13px; corpo ≥ 17px.
- [ ] Hierarquia com segundo nível vivo; razão display/apoio ≤ 5:1.
- [ ] Mídia real, não `<div>` estilizado.
- [ ] Composição intencional, com profundidade.
- [ ] Nada que leia como template genérico.
- [ ] Acessibilidade: contraste medido, teclado, reduced motion.
- [ ] Performance responsável (§22).
- [ ] Mobile art-directed, não empilhado (§20.5).
- [ ] Um momento memorável (§1.4).
- [ ] Mundo cromático decidido.

## Craft — hipóteses de direção (§1.3.3 B)

**Não são itens de entrega.** Registrar apenas o que a direção aprovada no Figma decidiu para cada um.

- [ ] Peso do display — decidido em: ______
- [ ] Alinhamento — decidido em: ______
- [ ] Wordmark em escala — decidido em: ______
- [ ] Chips/pills × cards — decidido em: ______
- [ ] Fotografia assimétrica — decidido em: ______
- [ ] Forma do header — decidido em: ______
- [ ] CTA persistente no mobile — decidido em: ______

## Barra Awwwards (§1.4)

- [ ] Existe **um momento memorável** — a transição Atual/Proposta (§16.1).
- [ ] Alguém descreve esse momento em uma frase depois de ver a página uma vez.
- [ ] Mundo cromático próprio e decidido.
- [ ] Contraste tipográfico real entre dois registros (§8.8).
- [ ] Craft consistente até o rodapé; nenhum trecho fraco.
- [ ] Motion com propósito e reduced motion coberto.
- [ ] Razão display/apoio ≤ 5:1.
- [ ] Eixo único no hero.
- [ ] Mobile é recomposição, não empilhamento.
- [ ] Screenshots Playwright atualizados nos 5 viewports.

## Identidade

- [ ] Conteúdo é Atria.
- [ ] Assets são originais (sem Higgsfield).
- [ ] Threshold aparece seletivamente.
- [ ] Paleta não é cópia literal.
- [ ] Tipografia não usa fonte privada.
- [ ] Nenhuma marca da Konpo aparece.
- [ ] Eyebrows numerados removidos ou rationados (taste-skill).
- [ ] Zero em-dash em copy de UI.

## Acessibilidade

- [ ] Teclado completo.
- [ ] Foco visível.
- [ ] Menu com focus trap.
- [ ] Escape funciona.
- [ ] Reduced motion.
- [ ] Contraste medido.
- [ ] Reflow a 200%.
- [ ] Sem overflow a 320 px.
- [ ] Tabs acessíveis.
- [ ] Formulário acessível.
- [ ] Vídeo possui fallback.

## Performance

- [ ] Sem layout shift relevante.
- [ ] Vídeos otimizados.
- [ ] Imagens dimensionadas.
- [ ] Fontes otimizadas.
- [ ] JavaScript controlado.
- [ ] Dependências justificadas.
- [ ] Build aprovado.

## Divergência

- [ ] Protótipo marcado como interno.
- [ ] Plano de divergência criado.
- [ ] Elementos próximos demais identificados.
- [ ] Nenhum asset proprietário reutilizado.
- [ ] Versão pública ainda não foi declarada pronta prematuramente.

---

# 32. Regra final

Quando houver conflito entre uma solução fácil e uma solução de craft elevado, escolher o craft elevado, desde que:

- seja acessível;
- seja performática de forma responsável;
- use conteúdo original da Atria;
- respeite `PRODUCT.md`;
- não copie ativos da Konpo;
- não reintroduza Higgsfield;
- não comprometa segurança.

A paridade interna já foi alcançada.

Agora a barra é **product design Atria**: identidade, mídia, motion e prova Playwright, sem cair em template SaaS nem em estética clínica.

A originalidade não é desculpa para entregar algo inferior ao nível de craft já conquistado.
