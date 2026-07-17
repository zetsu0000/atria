# Plano de paridade Atria × Konpo

Status: plano de implementação da rota `/`  
Fase: protótipo interno de paridade; não aprovado para publicação

## Cena de uso e decisão visual

Um gestor de clínica abre a página durante o expediente, em uma tela clara, buscando reduzir o risco de trocar um site que já funciona. A superfície precisa ser luminosa e legível, enquanto preto e um accent quente marcam decisões, limites e passagem de estado.

Estratégia cromática: base fria quase neutra, ink muito escuro, superfícies pretas e um accent vermelhão/terracota usado somente no Threshold. A função e a frequência seguem a referência; os valores e a identidade pertencem à Atria.

## Princípios de tradução

- Preservar arquitetura, escala, ocupação de viewport, ritmo e transformação responsiva.
- Substituir projetos por estados e capítulos reais da proposta Atria.
- Conter Clínica Aurora somente na demonstração, sempre com o aviso obrigatório.
- Usar prova de processo no lugar de clientes, logos, depoimentos ou métricas.
- Manter a página estática no servidor e hidratar apenas menu, comparison, método opcional, formulário e reveals.
- Implementar motion com CSS e APIs nativas; não instalar uma pilha equivalente à referência quando não houver ganho de paridade.

## Mapeamento região a região

### 1. Header e trilho

**Referência:** wordmark, status, CTA e menu em trilho lateral.  
**Atria:** marca Atria, status “Prévia antes da publicação”, CTA “Solicitar prévia” e acionador de menu no trilho.

- Desktop: trilho de ~66 px, header de ~66 px, marca à esquerda, status e CTA à direita.
- Mobile: header de ~62 px; Atria continua visível por clareza de marca, mesmo que a referência esconda o wordmark.
- Menu: diálogo de viewport inteiro abaixo do header, com navegação e três mundos `Atual`, `Proposta`, `Aprovado`.
- Acessibilidade: `aria-expanded`, `aria-controls`, foco preso, Escape, restauração de foco e scroll do fundo bloqueado.
- Implementação: `AtriaHeader` + `FullscreenMenu` em Client Component.

### 2. Opening / hero

**Referência:** display central, apoio compacto e três projetos entrando na dobra.  
**Atria:** promessa canônica e três capítulos do mecanismo Preview-First.

- Título: “Seu novo site, aprovado antes de ir ao ar.”
- Accent Threshold em “aprovado antes”, sem texto em gradiente.
- Apoio canônico completo abaixo do título.
- CTA principal e secundário persistem, mas não transformam o hero em uma composição SaaS.
- Três capítulos: `Atual`, `Proposta`, `Aprovado`.
- Desktop: três mídias simultâneas; mobile: faixa horizontal com o próximo capítulo parcialmente visível.
- Motion: reveal por máscara/clip no load; mídia já visível como fallback.
- Acessibilidade: conteúdo essencial fora da mídia e reduced motion sem clip.
- Implementação: Server Component `HeroSequence`; pequenos handlers de âncora no cliente.

### 3. Manifesto / tese

**Referência:** statement enorme e texto editorial deslocado para a direita.  
**Atria:** explicar que a troca é arriscada, abstrata e tecnicamente fragmentada.

- Statement: “Trocar um site parece simples. Até envolver conteúdo, domínio, hospedagem e a reputação da clínica.”
- Corpo: Atria prepara uma proposta paralela, a clínica revisa e o site atual permanece ativo.
- Três oportunidades aparecem como linhas editoriais, não cards: primeira impressão, clareza e experiência mobile.
- Desktop: declaração full-width; corpo e oportunidades deslocados para a metade direita.
- Mobile: uma coluna com escala forte, sem perda de conteúdo.
- Implementação: `EditorialStatement` + `OpportunityIndex` server-rendered.

### 4. Services / método

**Referência:** título extremo, quatro painéis sticky com conteúdo e mídia.  
**Atria:** cinco capítulos do processo: Análise, Proposta, Revisão, Aprovação, Publicação.

- Cada capítulo informa o que acontece, o que a clínica faz, o que a Atria assume e qual risco é reduzido.
- Desktop: capítulos longos com sticky stacking e pequenos artefatos de estado.
- Mobile: todos os capítulos em fluxo; nenhuma informação depende de hover.
- O quinto capítulo só fica visualmente disponível depois do checkpoint de aprovação.
- Implementação: `MethodIndex` sem dependência externa; CSS sticky e estados de hover/focus.

### 5. Selected Work / Atual e Proposta

**Referência:** maior região da página, display monumental, lista extensa e mídia contextual.  
**Atria:** prova central da oferta usando a demonstração fictícia.

- Título: `Atual / Proposta`.
- Subtítulo: “Uma decisão concreta, não uma promessa abstrata.”
- Stage de quadro inteiro, não duas janelas pequenas.
- Desktop: troca full-frame entre versões com máscara Threshold; controles visíveis e estado anunciado.
- Mobile: uma versão por vez, tabs grandes, setas/Home/End, sem drag obrigatório.
- A altura do stage permanece constante para evitar salto e preservar scroll.
- Aviso obrigatório anexado ao artefato: “Demonstração fictícia — nenhuma clínica real está sendo representada.”
- Três linhas de análise com mídia própria: Primeira impressão, Clareza e Experiência mobile.
- Implementação: `CurrentProposalStage` em Client Component; representações completas da Clínica Aurora como DOM/SVG local, não imagem da referência.

### 6. Partners / confiança

**Referência:** grande declaração, testemunhos e logos.  
**Atria:** prova de processo verdadeira, sem social proof inventada.

- Declaração: “O site atual continua no ar. A decisão continua com a clínica.”
- Evidências: ambiente separado, aprovação obrigatória, domínio sob controle da clínica, execução técnica pela Atria, validação humana de informação profissional e demo identificada.
- Desktop: manifesto à direita e índice contínuo de garantias; sem cápsulas de logos.
- Mobile: linhas em ordem de risco, com labels e descrições completas.
- Implementação: `TrustNarrative` server-rendered.

### 7. Contact / solicitação

**Referência:** overlay preto imersivo em duas colunas.  
**Atria:** região preta de solicitação integrada ao fluxo e acessível por âncora.

- Campos seguem PRODUCT/shape: nome, clínica, função, cidade/estado, URL, WhatsApp, e-mail, incômodo opcional e consentimento.
- Desktop: introdução e etapas à esquerda, campos à direita; grandes divisórias e labels persistentes.
- Mobile: uma coluna, touch targets ≥ 44 px, resumo de erros no topo.
- Sem backend: sucesso informa claramente que o preenchimento foi validado e nenhum dado foi enviado.
- O CTA do header e hero rola para a região e foca o título.
- Implementação: `PreviewRequestFlow` em Client Component, preservando valores e foco.

### 8. Closing / footer

**Referência:** headline e CTA enormes, marca abstrata e grade profunda de links.  
**Atria:** assinatura de processo, CTA e mapa de navegação.

- Display: “Ver antes. Aprovar antes. Publicar sem precisar de TI.”
- CTA principal retorna ao formulário.
- Grade inferior: Processo, Exemplo, Segurança, Solicitação, Demonstração e contexto legal.
- Nota: protótipo interno de paridade, não versão pública aprovada.
- Implementação: `AtriaFooter` server-rendered.

## Componentes

```text
app/page.tsx (Server Component)
├── AtriaHeader / FullscreenMenu (Client)
├── HeroSequence (Server)
│   └── MediaChapter × 3 (Server)
├── EditorialStatement (Server)
├── OpportunityIndex (Server)
├── MethodIndex (Server/CSS)
├── CurrentProposalStage (Client)
│   ├── CurrentClinicSite
│   └── ProposalClinicSite
├── TrustNarrative (Server)
├── PreviewRequestFlow (Client)
└── AtriaFooter (Server)
```

Os Client Components ficam isolados em `components/landing/`; as composições estáticas permanecem em `app/page.tsx`. O arquivo legado `app/landing-interactions.tsx` foi removido depois da migração para evitar duas implementações concorrentes.

## Stack e dependências

- Next.js 16.2 App Router e React 19.2 existentes.
- CSS global com tokens e media queries explícitas.
- Hanken Grotesk variável existente via `next/font` e fallback do sistema.
- `IntersectionObserver` para estado de seção e pequenos reveals.
- CSS `position: sticky`, `clip-path`, `transform`, `opacity` e scroll snapping para mídia.
- Nenhuma dependência de produção nova.

## Breakpoints e art direction

- `≥ 1180 px`: trilho, grid amplo, três capítulos e stage full-frame.
- `820–1179 px`: escala reduzida, grid de 8 colunas, mídia preservada.
- `600–819 px`: tablet portrait, hero central e método simplificado.
- `< 600 px`: header compacto, hero alinhado à esquerda, carrossel horizontal, stage de uma versão e form em uma coluna.
- `≤ 340 px`: escala e labels ajustadas sem ocultar controles.
- Reflow 200%: validar com 640 CSS px e 320 CSS px, além de zoom nativo manual pendente.

## Motion

- Load: headline em máscara com duração aproximada de 850 ms e stagger curto.
- Menu: clip/translate entre 600 e 800 ms; itens entram em 60–90 ms de stagger.
- Capítulos: hover com escala ≤ 1,02 e clip discreto.
- Manifesto: progressão de contraste por IntersectionObserver, sem gate de visibilidade.
- Method: sticky e mudanças de accent por estado de foco/hover.
- Comparison: crossfade + máscara de 450–650 ms, sem mudar altura.
- Reduced motion: todos os conteúdos aparecem imediatamente; smooth scroll, sticky animado, clip e transforms não essenciais são removidos.

## Acessibilidade

- Um único `h1`, landmarks semânticos, skip link e hierarquia coerente.
- Menu modal com foco preso, Escape, restauração e scroll lock.
- Tabs com setas, Home/End, `aria-selected`, `aria-controls` e live region.
- Formulário com labels persistentes, `aria-describedby`, resumo de erros e foco no primeiro inválido.
- Foco visível em superfícies claras, escuras e sobre accent.
- Conteúdo de vídeo/artefato nunca é a única fonte da mensagem.
- Contraste medido via cores computadas; alvo AAA para texto essencial e crítico.
- Touch targets ≥ 44 × 44 px.
- Sem horizontal overflow da página; apenas faixas deliberadas com controle/descrição.

## Riscos e critérios de rejeição

- Rejeitar se hero virar duas colunas SaaS, se mídia parecer decorativa ou se Atual/Proposta virar widget.
- Rejeitar se mobile for apenas desktop empilhado.
- Rejeitar se o menu for um overlay simples com lista central.
- Rejeitar se cards repetidos substituírem tese, método ou confiança.
- Rejeitar se Clínica Aurora disputar a marca Atria.
- Rejeitar qualquer estado que oculte o aviso fictício ou sugira publicação real.
