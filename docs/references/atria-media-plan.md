# Plano de mídia original Atria

Status: implementação com fallbacks locais; geração externa pendente  
Higgsfield: conexão disponível, plano `free`, saldo verificado em 2026-07-17: **0 créditos**

Nenhum asset da Konpo será baixado, hotlinkado ou usado no produto. Os screenshots da referência permanecem somente em `docs/references/screenshots/konpo/`.

## Estratégia

A mídia da primeira implementação será composta por artefatos originais legíveis:

- representações completas do site Atual e da Proposta da Clínica Aurora;
- uma passagem Threshold entre estados;
- um checkpoint de aprovação;
- variações desktop/mobile construídas em DOM e SVG local;
- posters estáticos com dimensões finais para cada loop futuro.

Os fallbacks são parte da experiência e não serão apresentados como vídeos finalizados. O texto essencial permanece no HTML.

## Inventário

| Asset | Região | Objetivo | Proporção | Duração futura | Ferramenta atual | Fallback | Status |
|---|---|---|---:|---:|---|---|---|
| `chapter-current` | Hero | Mostrar um site existente, funcional porém datado | 4:5 desktop / 7:5 mobile crop | 6 s | DOM + CSS original | DOM/CSS | implementado |
| `chapter-proposal` | Hero | Mostrar hierarquia e composição modernizadas | 4:5 / 7:5 | 6 s | DOM + CSS original | DOM/CSS | implementado |
| `chapter-approved` | Hero | Tornar a aprovação uma passagem controlada | 4:5 / 7:5 | 5 s | DOM + CSS original | DOM/CSS | implementado |
| `current-site` | Comparison | Representação completa Atual | 16:10 / 3:4 | n/a | DOM demonstrativo | DOM | implementado |
| `proposal-site` | Comparison | Representação completa Proposta | 16:10 / 3:4 | n/a | DOM demonstrativo | DOM | implementado |
| `threshold-loop` | Hero/closing | Marcar Atual → Proposta → Aprovado | 16:9 | 6 s | CSS clip/mask | composição estática | implementado como fallback |
| `approval-sequence` | Método/closing | Mostrar publicação bloqueada até aprovação | 16:9 | 5 s | DOM + CSS state sequence | composição estática | implementado como fallback |

## Regras dos fallbacks

- Dimensões explícitas e `aspect-ratio` para impedir layout shift.
- Sem pessoas, pacientes, procedimentos, cruzes, estetoscópios ou cenas hospitalares.
- Clínica Aurora aparece apenas dentro do artefato demonstrativo e com aviso fictício adjacente.
- Nenhum CTA da clínica fictícia é interativo.
- UI gerada não será usada como imagem final quando o texto for ilegível; as telas importantes são DOM real.
- Mobile não depende do crop desktop: o conteúdo é recomposto no componente.

## Prompt de produção 1 — Threshold hero loop

**Objetivo visual**  
Um loop editorial abstrato que materializa a passagem controlada entre um site atual e uma proposta aprovada, sem representar uma clínica ou pessoa.

**Composição**  
Plano 16:9. Fundo quase preto. À esquerda, uma arquitetura de website em blocos rígidos, desaturados e levemente desalinhados. No centro, um intervalo vertical estreito em vermelho-terra luminoso. À direita, a mesma informação reorganizada em um sistema calmo, preciso e claro. Nenhum texto legível gerado; apenas planos, linhas e módulos.

**Primeiro frame**  
80% do quadro no estado Atual, com o intervalo central quase fechado e a Proposta apenas sugerida na borda direita.

**Último frame**  
80% do quadro no estado Proposta, com um selo geométrico abstrato de aprovação formado por duas superfícies que se encaixam; voltar ao primeiro frame por uma passagem reversa contínua.

**Câmera e movimento**  
Câmera ortográfica fixa. Sem zoom. Os módulos se movem apenas no eixo horizontal, como planos arquitetônicos deslizando. A abertura central cresce de 2% para 18% da largura, revela o sistema novo e fecha do lado oposto.

**Ritmo**  
6 segundos, aceleração rápida e desaceleração longa, dois segundos de leitura no estado Proposta, retorno invisível ao início.

**Luz e textura**  
Luz de estúdio controlada, superfícies foscas, grão óptico mínimo, alto contraste, sem glow decorativo.

**Negative prompt**  
No people, no doctors, no patients, no hospital, no clinic reception, no medical icons, no cross, no stethoscope, no purple-blue SaaS gradient, no floating laptop, no floating phone, no readable generated text, no logos, no watermark, no particles, no glassmorphism, no copied portfolio imagery.

**Export**  
1920 × 1080 e 1080 × 1350; 6 s; 24 fps; H.264 MP4 + WebM VP9; muted; seamless loop; poster AVIF/WebP no frame de Proposta; alvo ≤ 1,8 MB desktop e ≤ 900 KB mobile.

## Prompt de produção 2 — Current → Proposal chapter

**Objetivo visual**  
Mostrar modernização de informação, não uma transformação cosmética.

**Composição**  
Plano 4:3 com uma superfície editorial de website. Estado Atual contém navegação comprimida, linhas longas, contato distante e hierarquia fraca. Estado Proposta usa a mesma informação em ordem clara, tipografia maior, contato visível e composição mobile consciente. Tudo abstrato o suficiente para evitar texto falso, mas com módulos consistentes entre estados.

**Primeiro frame**  
Vista frontal do estado Atual, em tons grafite e cinza aquecido, com conteúdo concentrado na metade superior.

**Último frame**  
Vista frontal do estado Proposta, em off-white frio, ink escuro e accent vermelho-terra. Mesmos módulos, agora alinhados e com espaço respirável.

**Movimento**  
Nada explode ou gira. Elementos atravessam uma fenda vertical, mudam de escala apenas 2–4% e encaixam em novas posições. O contato viaja da borda inferior para uma posição principal.

**Duração e pacing**  
8 s. Atual por 1,5 s; transformação por 3 s; Proposta por 2,5 s; retorno por 1 s.

**Negative prompt**  
No real clinic, no people, no medical treatment, no before-and-after skin, no smiling doctor, no fake testimonial, no readable gibberish text, no browser chrome, no laptop mockup, no dashboard, no bento grid, no neon gradient, no logos, no copied website.

**Export**  
1600 × 1200 e 900 × 1200; MP4/WebM; poster em ambos os estados; loop muted; alvo ≤ 2 MB.

## Prompt de produção 3 — Approval checkpoint

**Objetivo visual**  
Transformar “nada é publicado sem aprovação” em evento visual inequívoco.

**Composição**  
Campo preto com duas superfícies grandes: `Proposta` à esquerda e `Publicação` à direita. Entre elas, uma barreira fina em vermelho-terra. Não gerar palavras; as labels reais ficam no HTML sobreposto.

**Primeiro frame**  
Proposta iluminada, Publicação em baixa luz, barreira fechada.

**Último frame**  
Um pulso único confirma aprovação, a barreira abre e a luz atravessa para Publicação; nenhuma sensação de lançamento automático.

**Movimento**  
Câmera fixa. Um marcador atravessa somente após um gesto de confirmação abstrato. Pausa antes da abertura para comunicar decisão humana.

**Duração**  
5 s, loop com retorno pelo fechamento da barreira.

**Negative prompt**  
No checkmark cliché, no confetti, no rocket, no loading spinner, no medical symbol, no fake UI text, no people, no hand clicking, no cryptocurrency aesthetic, no glow cloud, no particles, no logos.

**Export**  
1920 × 1080 e 1080 × 1080; muted; MP4/WebM; poster estático; alvo ≤ 1,2 MB.

## Prompt de produção 4 — Closing field

**Objetivo visual**  
Uma assinatura de marca Atria baseada no intervalo entre Atual e Aprovado.

**Composição**  
Fundo off-white frio. Uma única linha negra atravessa o quadro e é interrompida por um intervalo vermelho-terra. O intervalo se desloca lentamente, reorganiza duas superfícies tipográficas abstratas e retorna ao centro.

**Movimento**  
Pan óptico mínimo, sem câmera 3D. Máscaras planas, movimento de 6 s, pausa de 1 s no estado final.

**Negative prompt**  
No logo imitation, no particles, no medical imagery, no gradient text, no glass, no 3D chrome, no floating devices, no random blobs, no stock imagery, no copied dot-matrix icon.

**Export**  
1920 × 720 e 1080 × 1080; WebM/MP4; poster SVG equivalente; alvo ≤ 1 MB.

## Otimização futura

- Gerar master com qualidade alta e exportar variantes depois; não servir master 4K no mobile.
- `preload="metadata"` somente no loop do hero; `preload="none"` abaixo da dobra.
- Pausar por `IntersectionObserver` quando menos de 20% visível.
- Respeitar `prefers-reduced-motion` e `Save-Data`, substituindo por poster.
- Declarar width/height, manter texto essencial no HTML e evitar autoplay de áudio.
