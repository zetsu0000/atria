# Review final de paridade Atria × Konpo

Status: **aceito como protótipo interno de paridade**  
Data: 2026-07-17  
Escopo: rota `/`, componentes de apoio e documentação de referência

## Resultado

A reconstrução preserva a gramática estrutural observada na Konpo — trilho e header fixos, hero central monumental, três capítulos visuais entrando na dobra, manifesto de escala extrema, capítulos de serviço, região principal de trabalho, bloco de confiança, contato imersivo e fechamento tipográfico — sem importar código, mídia, marca ou identidade da referência.

Atria permanece inequívoca como produto B2B de modernização de sites. Clínica Aurora aparece apenas dentro do artefato demonstrativo e recebe aviso explícito de ficção.

## Evidência medida

| Viewport | Referência | Atria final | Leitura |
|---|---:|---:|---|
| 1440 | rail/header ≈ 67 px; título ≈ 83 px; mídia inicia ≈ 681 px | rail/header 67 px; título ≈ 84 px; mídia inicia ≈ 692 px | Paridade geométrica forte |
| 1280 | título ≈ 74 px | título ≈ 75 px | Escala equivalente |
| 1024 | título ≈ 59 px | título ≈ 60 px | Escala equivalente |
| 768 | título começa ≈ 372 px | título começa ≈ 375 px | Ocupação de viewport equivalente |
| 390 | título ≈ 44 px; mídia inicia ≈ 450 px | título ≈ 44 px; mídia inicia ≈ 460 px | Composição recomposta, sem sobreposição |
| 320 | faixa horizontal e próxima mídia aparente | mesma lógica | Sem overflow da página |
| Reflow 200% | proxy de 640 CSS px | 640 CSS px sem overflow | Passa; zoom nativo do CLI não alterou CSS viewport |

Altura total aproximada: referência 16.911 px e Atria 21.017 px em 1440; referência 10.345 px e Atria 20.857 px em 390. O mobile Atria é deliberadamente mais longo porque expõe cinco capítulos de método, compromissos operacionais e oito campos de solicitação sem esconder conteúdo. Esta é a maior divergência ainda aberta para uma futura versão pública.

## Comparações

- Prova anterior à expansão: `comparisons/parity-proof.html` e `comparisons/parity-proof-desktop.png`.
- Comparação final lado a lado e overlay: `comparisons/final-parity-comparison.html` e `comparisons/final-parity-comparison.png`.
- Screenshot integral final: `screenshots/atria/final-1440-full-playwright.png`.

## Diferenças encontradas e correções

1. **Promessa longa sobrepunha o apoio no mobile.** O limite tipográfico de `10ch` forçava cinco linhas. O título passou a usar toda a largura móvel, preservando a escala e reduzindo a composição a três linhas em 390 px.
2. **CTA do header ficava próximo da marca em tablet.** Quando o status desaparecia abaixo de 1056 px, o CTA não ocupava o extremo direito. `margin-left: auto` corrigiu a distribuição.
3. **Conteúdo de fundo continuava exposto à árvore acessível com o menu aberto.** O modal já prendia foco, mas agora marca marca/CTA/main/footer como `inert` durante a abertura e restaura o estado no cleanup.
4. **A captura full-page repetia frames quando `scroll-behavior: smooth` participava do stitching.** A evidência integral final foi produzida em contexto Playwright separado; as capturas por âncora foram feitas em novas sessões.
5. **Formulário sem backend precisava evitar falso sucesso.** O fluxo agora valida localmente, preserva valores, apresenta resumo de erros e declara de forma explícita que nenhum dado foi enviado.

## Checklist visual

- [x] Header e trilho preservam a ocupação da referência.
- [x] Hero é uma declaração central, não uma composição SaaS em duas colunas.
- [x] Três capítulos aparecem simultaneamente no desktop e em faixa horizontal no mobile.
- [x] Menu ocupa a tela com uma região principal e quatro mundos visuais.
- [x] Método usa capítulos de viewport e stacking sticky no desktop.
- [x] Atual / Proposta é um stage de quadro inteiro com altura estável.
- [x] Confiança usa compromissos verdadeiros, sem logos, depoimentos ou métricas inventadas.
- [x] Request é imersivo e não finge envio.
- [x] Fechamento retoma a promessa canônica e a assinatura Atria.

## Checklist funcional e acessível

- [x] Um `h1`, landmarks e hierarquia de headings coerente.
- [x] Skip link funcional.
- [x] Menu: nome acessível, `aria-expanded`, `aria-controls`, `aria-modal`, trap, Escape, restauração de foco, `inert` e scroll lock.
- [x] Tabs: setas, Home/End, `aria-selected`, `aria-controls`, live region e posição preservada.
- [x] Form: labels persistentes, oito validações, `aria-invalid`, `aria-describedby`, resumo linkado, foco gerenciado e sucesso local honesto.
- [x] CTA atualiza `#solicitar`, preserva refresh e foca `#request-title`.
- [x] Reduced motion: scroll automático, animações em `0.01ms`, nenhum conteúdo oculto.
- [x] Touch targets principais ≥ 44 px.
- [x] Sem overflow horizontal em 1440, 1280, 1024, 768, 640, 390 e 320 px.
- [x] Contraste: ink/page 17.06:1; soft/page 8.75:1; inverse 18.48:1; accent/inverse 5.49:1; ink/accent 5.14:1.

## Performance e rede

- Build estático da rota `/`.
- TTFB local: 2,2 ms.
- FCP local: 1008 ms.
- LCP local: 1008 ms.
- CLS: 0.
- Nenhuma requisição externa: documento, fonte auto-hospedada pelo Next, CSS, chunks locais e favicon.
- Nenhuma imagem/vídeo pesado na primeira versão; os artefatos visuais são DOM/CSS original com dimensões estáveis.

## Diferenças deliberadas restantes

- Hanken Grotesk substitui a Neue Haas Display Pro proprietária.
- Accent Atria é vermelho-terra, não o lavanda da referência.
- Atria mantém wordmark no mobile para evitar ambiguidade de marca.
- Mídia de portfólio foi substituída por estados do mecanismo Preview-First.
- Motion usa CSS e APIs nativas, sem reproduzir GSAP, Lenis, Matter.js, Swiper ou Wistia.
- A região de solicitação faz parte do fluxo, em vez de depender apenas de overlay.
- O mobile é mais longo; deve ser reavaliado após teste com usuários, sem ocultar conteúdo essencial.

## Risco de publicação

Este resultado continua sendo um protótipo interno. Não há backend, envio, crawler, autenticação, dados reais ou publicação. A linguagem visual deve receber aprovação explícita antes de ser tratada como versão pública.
