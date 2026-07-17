# Preflight — Polimento da landing aprovada e página /previa/clinica-aurora

Status: inspeção e execução concluídas nesta tarefa
Data: 2026-07-17
Branch: `feature/landing-polish-clinica-aurora` (baseline `23995d8`, tag `atria-landing-approved-v1`)

## Estrutura de rotas atual

- `/` — landing aprovada (App Router, `app/page.tsx`), rota estática.
- Nenhuma outra rota de produto existe ainda. `/previa/clinica-aurora` será criada nesta tarefa.

## Componentes reutilizáveis existentes

- `components/landing/atria-header.tsx` — header fixo + trilho + menu de tela cheia (dialog acessível com trap, `inert`, Escape).
- `components/landing/current-proposal-stage.tsx` — comparador Atual/Proposta com tabs acessíveis e os dois sites demonstrativos da Clínica Aurora em DOM/CSS.
- `components/landing/request-form.tsx` — formulário local honesto com validação e resumo de erros.
- `components/landing/request-preview-link.tsx` — CTA que rola até `#solicitar` e gerencia foco.
- CSS único em `app/globals.css` (~3.000 linhas, custom properties, sem Tailwind em uso real).

## Problemas visuais encontrados (browser real, Chromium headless)

1. **Capítulo "Proposta" do hero**: o título branco cruza o painel branco (`chapter-proposal__field`) e fica ilegível. O scrim de leitura (`.media-chapter::after`) está com `z-index: -1`, atrás dos visuais, portanto nunca protege o texto em nenhum capítulo. No capítulo "Atual" o título encosta na imagem bege com contraste fraco (desktop e mobile).
2. **Selo "Aprovado" do threshold de segurança** fora do eixo: o círculo não fica centrado na linha vertical (grid de 1px empurra o span para a direita).
3. **Menu mobile**: o link "Solicitar uma prévia do meu site" é cortado pelo `overflow: hidden` do painel (linhas de grid fixas em 11,2rem); sobra área morta abaixo do grid.
4. **Knob do comparador** (círculo no threshold) invade o conteúdo demonstrado, cobrindo texto no estado Atual em mobile.
5. **Zonas mortas acidentais**: paddings duplicados entre `thesis` → `method-heading` e `comparison-proof` → `assurance` somam ~500–550 px de vazio sem função editorial clara.
6. **Mobile excessivamente longo** (~20,9 mil px): `min-height` de linhas de índice (oportunidades 29rem, diagnóstico 24rem, compromissos 17rem) esticam as seções com vazio, sem adicionar conteúdo.
7. **Marcador ↗ das linhas de compromisso** órfão no mobile (posicionamento de grid o solta abaixo do texto, longe do título).

## Riscos responsivos

- Sem overflow horizontal em 1440/1280/1024/768/640/390/320 (verificado por script).
- Proxy de 200% de zoom (640 px) sem overflow.
- O hero de 768 px mantém a proporção de dobra da referência (título ≈ 372 px) — preservar.
- O comparador 3:4 no mobile depende de alturas percentuais; qualquer mudança de conteúdo interno precisa ser re-verificada nos dois estados.

## Riscos de acessibilidade

- Verificado: nenhum elemento focalizável fica atrás do header fixo (script de tab completo).
- Trap de foco, `inert`, Escape e restauração de foco do menu funcionam; preservar ao mexer no CSS do menu.
- Tabs do comparador com setas/Home/End e live region; preservar.
- `prefers-reduced-motion` zera animações; hero legível imediatamente.
- Contrastes registrados na revisão de paridade continuam válidos; os ajustes de capítulo devem melhorar (não reduzir) contraste de texto sobre mídia.

## Assets hoje ausentes

- `public/atria-media/` está vazio; toda a mídia é DOM/CSS (decisão registrada no plano de mídia — sem Higgsfield, 0 créditos).
- Faltam para a página de prévia: representações completas Antes/Proposta da Clínica Aurora reutilizáveis fora do stage, diagrama editorial de "o que mudou", e uma assinatura visual do checkpoint de aprovação.
- Estratégia: Prioridade 1 (DOM/CSS) para os sites demonstrativos; Prioridade 2 (SVG local em `public/images/atria/diagrams/`) para diagramas editoriais; nenhum raster necessário até aqui.

## Estratégia de implementação

1. **Polish da landing** sem trocar a direção: corrigir stacking do scrim dos capítulos, recompor o campo do capítulo Proposta, centralizar o selo Aprovado, recompor o menu mobile (linhas auto + conteúdo sem corte), conter o knob do comparador, aparar paddings duplicados entre seções e reduzir `min-height` móveis das linhas de índice.
2. **Ligações**: "Ver exemplo de prévia" passa a apontar para `/previa/clinica-aurora` (era âncora `#comparacao`).
3. **Nova rota `/previa/clinica-aurora`**: superfície de produto Atria com aviso fictício persistente, visões Antes/Proposta completas (reutilizando os sites DOM da Clínica Aurora extraídos para componentes compartilháveis), capítulo "O que mudou e por quê" com três mudanças (primeira impressão, clareza, mobile), reasseguramento de aprovação e CTA comercial "Solicitar uma prévia como esta" levando ao formulário da landing.
4. **Assets**: SVGs originais em `public/images/atria/diagrams/` somente onde DOM/CSS não resolver melhor.
5. **Validação**: script de auditoria em 6 viewports + proxy de zoom, teclado (tab completo), reduced motion, `npm run lint`, `npm run build`.

## Resultado da execução

Todos os defeitos listados acima foram corrigidos:

1. Scrim dos capítulos elevado para `z-index: 1` (acima dos visuais, abaixo do texto) e campo do capítulo Proposta recomposto (`inset` termina acima da zona de texto). Títulos legíveis nos três capítulos em todos os viewports.
2. Selo "Aprovado" centralizado na linha via posicionamento absoluto com `translate(-50%, -50%)`.
3. Menu mobile com linhas `minmax(11.2rem, auto)`: o link de solicitação não é mais cortado.
4. Knob do comparador reduzido para 1,6rem no mobile; não cobre mais o texto demonstrado.
5. Paddings duplicados aparados (`method-heading` topo 17rem→10rem máx.; `assurance` topo 17rem→11rem máx.), preservando as pausas editoriais.
6. `min-height` móveis reduzidos (oportunidades 29→22rem, diagnóstico 24→19rem, compromissos 17→13rem); página mobile passou de ~20.856 px para ~20.104 px sem esconder conteúdo.
7. Marcador ↗ dos compromissos ancorado em `grid-row: 1 / grid-column: 3` no mobile.

Entregas adicionais:

- `Ver exemplo de prévia` e um link pós-comparador agora levam a `/previa/clinica-aurora`.
- Sites demonstrativos da Clínica Aurora extraídos para `components/clinic/aurora-sites.tsx` (reuso entre landing e prévia).
- Nova rota estática `/previa/clinica-aurora` com header próprio (`components/preview/preview-header.tsx`), aviso fictício persistente (sticky), comparador reutilizado, capítulo "O que mudou e por quê" com três mudanças e diagramas SVG originais, bloco de aprovação e CTA "Solicitar uma prévia como esta" → `/#solicitar`.
- SVGs locais em `public/images/atria/diagrams/` (ASCII puro; um primeiro export quebrou como Latin-1 e foi corrigido).

Validação final:

- Sem overflow horizontal em 1440/1280/1024/768/640/390/320 nas duas rotas.
- Tab completo sem foco escondido pelo header fixo nas duas rotas; skip link é o primeiro foco.
- Tabs do comparador funcionam na prévia; navegação cruzada landing↔prévia↔`/#solicitar` verificada em browser.
- Reduced motion sem conteúdo oculto.
- `npm run lint` limpo; `npm run build` gera `/`, `/previa/clinica-aurora` e `/_not-found` estáticos.
- Evidências em `artifacts/landing-polish/` e `artifacts/previa/`.
