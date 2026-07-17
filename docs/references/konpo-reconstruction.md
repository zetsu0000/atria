# Reconstrução da referência Konpo

Status: análise interna para o protótipo Atria de paridade  
Referência observada: `https://www.konpo.studio/`  
Data da inspeção: 2026-07-17

## Limites da análise

Este documento descreve comportamento e relações visuais observados no site ao vivo. Nenhum asset, texto, vídeo, logo, fonte, classe, script ou código da referência será reutilizado no produto. Os screenshots abaixo são evidência interna de análise e não são assets da Atria.

Classificações usadas:

- **Medido:** valor extraído do navegador ou de `getBoundingClientRect`.
- **Observado:** comportamento verificado visualmente ou por interação.
- **Fortemente inferido:** conclusão sustentada por scripts, DOM e comportamento, sem acesso ao código-fonte de autoria.
- **Não verificado:** comportamento que não pôde ser reproduzido de forma confiável.

## Síntese da arquitetura

1. Header e trilho lateral persistentes.
2. Hero tipográfico central, com três projetos já entrando na primeira dobra.
3. Faixa horizontal de projetos/mídia, arrastável no mobile.
4. Manifesto editorial: declaração enorme seguida por texto longo deslocado para a metade direita.
5. Serviços: título em escala extrema e quatro painéis longos, sticky no desktop.
6. Selected Work: título em escala extrema, subtítulo central e uma sequência extensa de trabalhos com mídia.
7. Partners: declaração editorial, provas em mídia e longa região de parceiros.
8. Encerramento: “Let’s Jam”, CTA de grande escala, grade de links e créditos.
9. Menu: experiência de viewport inteiro em grade, com navegação principal e quatro mundos de serviço.
10. Contato: overlay de viewport inteiro, preto, em composição 2/3 + 1/3.

O ritmo alterna impacto, mídia, texto, painéis, pausa longa, prova e fechamento. Não há um container global estreito nem uma sequência de seções com o mesmo padding.

## Medidas principais

### Quadro responsivo

| Viewport | Altura da página | Hero: posição/tamanho | Primeiro capítulo | Services | Selected Work | Closing |
|---|---:|---|---|---|---|---|
| 1440 × 900 | 16.911 px | x 445, y 221, 617 × 167; 83,3/83,3 px | começa em y 681; três colunas | y 2.535; 166,7 px | y 5.070; 166,7 px | y 16.366; 100 px |
| 1280 × 800 | 15.034 px | x 395, y 197, 548 × 148; 74,1/74,1 px | começa em y 605 | y 2.253; 148,1 px | y 4.507; 148,1 px | y 14.550; 88,9 px |
| 1024 × 768 | 12.641 px | x 316, y 206, 439 × 119; 59,3/59,3 px | começa em y 581 | y 1.900; 118,5 px | y 3.704; 118,5 px | y 12.253; 71,1 px |
| 768 × 1024 | 9.926 px | x 149, y 372, 470 × 127; 63,5/63,5 px | começa em y 892 | y 2.168; 105,4 px | y 4.028; 105,4 px | y 9.528; 69,7 px |
| 390 × 844 | 10.345 px | x 33, y 166, 323 × 87; 43,7/43,7 px | x 21, y 450, 349 × 250 | y 2.210; 74,9 px | y 4.857; 74,9 px | y 9.572; 58,2 px |
| 320 × 700 | 8.497 px | x 27, y 137, 265 × 72; 35,8/35,8 px | x 17, y 369, 285 × 205 | y 1.814; 61,4 px | y 3.987; 61,4 px | y 7.863; 47,8 px |

Valores acima são **medidos** após o carregamento. A altura varia com o viewport porque grande parte da escala usa relações baseadas em largura.

### Gutter, trilho e grid

- Em 1440 px, o trilho lateral ocupa aproximadamente 67 px; o conteúdo principal começa em x ≈ 83 px: **medido/observado**.
- Em 390 px, o gutter de conteúdo é 21 px; em 320 px, 17 px: **medido**.
- O hero desktop usa título com largura próxima a 43% do viewport, centralizado no campo restante: **medido**.
- A mídia inicial desktop forma três colunas quase iguais com gaps estreitos. A mídia toca visualmente a borda inferior da primeira dobra: **observado**.
- No mobile, os capítulos viram uma faixa horizontal. O primeiro item ocupa quase toda a largura e o próximo permanece parcialmente visível como convite ao arraste: **observado**.
- Selected Work desloca a coluna textual para x ≈ 338 px em 1440, preservando uma faixa vazia larga à esquerda: **medido**.
- As regiões Partners e Closing voltam a alinhar títulos ao início do conteúdo, criando mudança de ritmo: **observado**.

### Alturas e ocupação

- Header visual: aproximadamente 67 px em 1440 e 61–62 px no mobile/tablet: **medido por screenshot**.
- Hero: aproximadamente 1,35 viewport no desktop contando a primeira faixa de projetos; no mobile, o primeiro capítulo termina em ~0,83 viewport: **observado**.
- Manifesto: aproximadamente 1,4 viewport no desktop; texto grande ocupa quase toda a largura e o texto de apoio começa abaixo da dobra: **observado**.
- Services: quatro painéis de ~528–577 px no desktop, com sticky stacking; no mobile, quatro painéis completos em fluxo vertical: **medido/observado**.
- Selected Work: a região mais longa, com aproximadamente 6.500 px no desktop e 3.500 px no mobile: **fortemente inferido pelas posições medidas**.
- Closing: quase um viewport no desktop; no mobile, CTA, marca e links são condensados sem desaparecer: **observado**.

## Tipografia

- Família computada da referência: `Neue Haas Display Pro`: **medido**. É uma fonte privada e não será copiada.
- Peso dominante: 400; labels e metadados usam 500: **medido**.
- Hero 1440: 83,3 px, line-height 83,3 px, peso 400, letter-spacing normal: **medido**.
- Títulos Services/Selected Work 1440: 166,7 px com line-height 124,2 px e letter-spacing 1,67 px: **medido**.
- Corpo base 1440: 13,3 px/18,7 px; manifesto e descrições sobem para escalas editoriais maiores: **medido**.
- Mobile 390: hero 43,7 px; títulos de seção 74,9 px; corpo base 16,64 px: **medido**.
- A escala desktop reduz fluidamente com a largura; no mobile, o corpo volta a um tamanho confortável e os títulos preservam autoridade: **observado**.
- O hero usa uma palavra cinza riscada como interrupção semântica e visual; o recurso é parte do ritmo, não texto em gradiente: **observado**.
- Quebras de linha são explícitas e recompostas no mobile; não há simples redução proporcional: **observado**.

Alternativa Atria: Hanken Grotesk variável já auto-hospedada pelo Next.js. Suas métricas largas e desenho neutro permitem aproximar escala e ritmo sem copiar a fonte privada.

## Cor

- Fundo principal: `rgb(242, 240, 248)`; ink: `rgb(29, 29, 29)`: **medido**.
- Acento estrutural recorrente: `rgb(150, 128, 255)`: **medido**.
- Superfícies de menu/contato: preto próximo a `rgb(25, 25, 25)` com branco e cinzas: **medido**.
- O fundo permanece quase constante; a maior parte da variação cromática vem da mídia e de overlays: **observado**.
- O accent aparece em pontos, estados e marcas de movimento, não como banho total: **observado**.

A Atria reproduzirá a função e frequência — base fria quase neutra, ink forte, superfícies pretas e um accent Threshold próprio — sem copiar os valores literais.

## Região por região

### Header

- Trilho vertical contém o acionador do menu e um marcador de posição no scroll.
- Linha superior separa header e página.
- Wordmark fica à esquerda no desktop e desaparece no mobile; status e CTA persistem.
- Header permanece visível sobre todas as regiões.
- O CTA abre o contato sem navegação de página.

### Hero e projetos destacados

- Título central aparece após grande área negativa.
- Linha de apoio compacta está próxima da mídia, não do título.
- Três capítulos possuem proporções e mundos visuais diferentes, com cantos moderados.
- Desktop mostra três simultaneamente; mobile mostra uma faixa com overflow controlado.
- O primeiro capítulo chega à dobra, impedindo um hero exclusivamente textual.

### Manifesto

- Frase em escala de display ocupa de três a quatro linhas.
- Uma parte da frase perde contraste para marcar transição semântica.
- Label curta e linha divisória antecedem o corpo editorial.
- Corpo longo começa na metade direita, deixando um grande campo vazio à esquerda.

### Services

- Título ocupa quase toda a largura e aparece sobre campo pontilhado.
- Cada serviço é um painel contínuo com título muito grande, linha, descrição, CTA e animação de apoio.
- No desktop, os painéis usam sticky e se empilham; no mobile, tornam-se blocos sequenciais completos.
- Embora exista borda e raio, não funciona como grade de cards: é uma sequência de capítulos.

### Selected Work

- Título de seção gigantesco e subtítulo editorial centralizado.
- A lista desloca conteúdo para a direita no desktop e intercala mídia ampla.
- No mobile, cada trabalho vira uma unidade vertical compacta com imagem, disciplina e metadado.
- Hover/detail revelam contexto e mídia; conteúdo essencial permanece no DOM.

### Partners

- A declaração substitui um título convencional.
- Prova aparece em painéis grandes com fotografia e texto.
- Logos ocupam cápsulas largas e criam uma faixa repetitiva próxima ao fechamento.
- A Atria não poderá copiar esse tipo de prova; a densidade será convertida em prova de processo verdadeira.

### Contato

- Overlay de viewport inteiro abaixo do header.
- Desktop: painel principal preto com perguntas à esquerda e escolhas à direita; coluna secundária com statement e prova humana.
- Mobile: sequência em uma coluna, com campos e escolhas grandes.
- O fechamento permanece no mesmo lugar do CTA do header.

### Footer

- “Let’s Jam” usa display grande e CTA igualmente forte.
- Uma marca abstrata ocupa o centro do campo.
- Links formam uma grade horizontal profunda, não um rodapé estreito.
- Créditos e legais ficam na última linha.

## Movimento e interação

| Efeito | Gatilho | Estado inicial → final | Faixa observada | Mobile | Reduced motion Atria |
|---|---|---|---|---|---|
| Entrada do hero | load | palavras recortadas/baixa presença → texto completo | ~700–1.200 ms, stagger curto | preservado e mais curto | conteúdo imediato, apenas crossfade opcional |
| Menu | click | grade fora/mascarada → painel completo | ~700–900 ms | duas colunas em fluxo | abertura imediata/crossfade |
| Capítulos hero | load/viewport | mídia parada/oculta → loop visível | ~600–900 ms | faixa arrastável | poster estático |
| Manifesto | scroll | palavras com contraste reduzido → ink | scroll-linked | simplificado | todo texto legível imediatamente |
| Services | scroll | painéis entram e se empilham sticky | ligado ao scroll | fluxo vertical | sem deslocamento sticky animado |
| Work | hover/scroll | mídia/preview ganha presença | ~250–500 ms | conteúdo sempre visível | transição instantânea |
| Partners | scroll | painéis se substituem sobre região sticky | ligado ao scroll | sequência simples | fluxo linear |
| Contato | click | overlay recortado → viewport completo | ~700–1.000 ms | uma coluna | abertura imediata |
| Footer | scroll | display e CTA entram por máscara | ~600–900 ms | escala reduzida | conteúdo imediato |

As durações são **observadas/estimadas** por captura e interação; não são valores extraídos das timelines proprietárias.

O teste com `prefers-reduced-motion: reduce` confirmou `scroll-behavior: auto`, mas o documento de referência ainda mantinha 11 animações ativas: **medido**. A Atria não herdará essa deficiência.

## Tecnologia

### Confirmado

- Webflow e assets em `website-files.com`.
- jQuery 3.5.1.
- GSAP 3.11.4 e ScrollTrigger.
- Lenis 1.0.27.
- Barba Core e Barba Prefetch.
- Swiper 8.
- Matter.js.
- dotLottie player e Lordicon.
- Vídeos servidos por `embed-ssl.wistia.com`, normalmente muted, loop e `preload="none"`.
- Google Tag Manager, Google Analytics e Hotjar.
- Um formulário Webflow com escolhas em etapas e campos de contato.

### Fortemente inferido

- SplitText/DrawSVG são usados para reveals de palavra e ilustrações vetoriais, pois os scripts estão carregados e o comportamento é compatível.
- Barba coordena transições entre home e projetos.
- Lenis fornece o scroll interpolado e ScrollTrigger coordena sticky/reveals.
- Swiper controla faixas horizontais e parte da mídia mobile.

### Não verificado

- Configuração exata das timelines, easings e breakpoints internos.
- CMS e endpoint final do formulário além da camada Webflow.
- Estratégia completa de pause/resume para todos os vídeos fora do viewport.
- Suporte real da referência a foco preso no menu e no contato.

## Evidências visuais

- `docs/references/screenshots/konpo/1440-fold.png`
- `docs/references/screenshots/konpo/1440-home.png`
- `docs/references/screenshots/konpo/1440-menu-open.png`
- `docs/references/screenshots/konpo/1440-contact-open.png`
- `docs/references/screenshots/konpo/1440-editorial.png`
- `docs/references/screenshots/konpo/1440-services.png`
- `docs/references/screenshots/konpo/1440-selected-work.png`
- `docs/references/screenshots/konpo/1440-partners.png`
- `docs/references/screenshots/konpo/1440-footer.png`
- `docs/references/screenshots/konpo/1280-fold.png`
- `docs/references/screenshots/konpo/1024-fold.png`
- `docs/references/screenshots/konpo/768-fold.png`
- `docs/references/screenshots/konpo/390-fold.png`
- `docs/references/screenshots/konpo/390-home.png`
- `docs/references/screenshots/konpo/390-menu-open.png`
- `docs/references/screenshots/konpo/320-fold.png`
- `docs/references/screenshots/konpo/320-home.png`
- `docs/references/screenshots/konpo/200-percent-reflow-proxy.png`

O Chromium headless não aplicou zoom de navegador via atalho. O último arquivo usa 640 × 400 CSS px como proxy de reflow para uma janela física de 1280 × 800 a 200%; essa limitação permanece registrada, não tratada como zoom nativo medido.

