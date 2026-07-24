# Plano de mídia original Atria

Status: fase product design; **Higgsfield retirado**
Atualizado: 2026-07-24

Toolchain de mídia:

1. Figma (composição / frames / export)
2. Image-gen do ambiente Cursor (quando necessário)
3. SVG / DOM editorial local
4. Playwright (prova visual pós-export)

Nenhum asset da Konpo será baixado, hotlinkado ou usado no produto. Os screenshots da referência permanecem somente em `docs/references/screenshots/konpo/`.

## Estratégia

A mídia estrutura a página. Fallbacks DOM/CSS já implementados nos capítulos do hero e no comparador Continuam válidos como **fallback**, não como destino final.

Prioridade desta fase:

- compor Threshold e aprovação no Figma;
- exportar posters estáticos para `public/atria-media/`;
- substituir fake UI eterna por artefatos editoriais originais;
- validar cada asset com Playwright nos viewports 1440 / 768 / 390.

## Inventário

| Asset | Região | Objetivo | Proporção | Duração futura | Ferramenta | Fallback | Status |
|---|---|---|---:|---:|---|---|---|
| `chapter-current` | Hero | Site existente, funcional porém datado | 4:5 / 7:5 | 6 s | DOM + CSS | DOM/CSS | implementado (fallback) |
| `chapter-proposal` | Hero | Hierarquia modernizada | 4:5 / 7:5 | 6 s | DOM + CSS | DOM/CSS | implementado (fallback) |
| `chapter-approved` | Hero | Aprovação como passagem | 4:5 / 7:5 | 5 s | DOM + CSS | DOM/CSS | implementado (fallback) |
| `current-site` | Comparison | Representação Atual | 16:10 / 3:4 | n/a | DOM demonstrativo | DOM | implementado |
| `proposal-site` | Comparison | Representação Proposta | 16:10 / 3:4 | n/a | DOM demonstrativo | DOM | implementado |
| `threshold-loop` | Hero/closing | Atual → Proposta → Aprovado | 16:9 | 6 s | Figma + CSS/SVG | poster estático | a produzir |
| `approval-sequence` | Método/closing | Publicação bloqueada até aprovação | 16:9 | 5 s | Figma + SVG | composição estática | a produzir |

## Regras dos fallbacks

- Dimensões explícitas e `aspect-ratio` para impedir layout shift.
- Sem pessoas, pacientes, procedimentos, cruzes, estetoscópios ou cenas hospitalares.
- Clínica Aurora aparece apenas dentro do artefato demonstrativo e com aviso fictício adjacente.
- Nenhum CTA da clínica fictícia é interativo.
- UI gerada não será usada como imagem final quando o texto for ilegível; as telas importantes são DOM real.
- Mobile não depende do crop desktop: o conteúdo é recomposto no componente.
- Não criar jobs nem prompts Higgsfield.

## Briefs de art direction (ex-prompts; agora Figma / image-gen)

Os briefs abaixo são direção visual. Produzir em Figma primeiro; image-gen só se o frame estiver aprovado.

### 1 — Threshold hero loop

Plano 16:9. Fundo quase preto. À esquerda, arquitetura de website em blocos rígidos e desaturados. No centro, intervalo vertical estreito em vermelho-terra. À direita, a mesma informação reorganizada. Sem texto legível gerado. Câmera ortográfica, 6 s, ease-out forte. Export 1920×1080 + poster WebP/AVIF.

### 2 — Current → Proposal

Plano 4:3. Modernização de informação, não cosmética. Mesmos módulos entre estados. 8 s. Sem mockup de laptop, sem estética clínica.

### 3 — Approval checkpoint

Campo preto, duas superfícies (Proposta / Publicação), barreira vermelho-terra. Labels reais ficam no HTML. 5 s. Sem checkmark clichê, confetti ou glow.

### 4 — Closing field

Off-white frio, linha negra interrompida por intervalo vermelho-terra. Assinatura Threshold. ≤ 1 MB.

## Otimização

- `preload="metadata"` só no loop do hero; `preload="none"` abaixo da dobra.
- Pausar por `IntersectionObserver` quando < 20% visível.
- Respeitar `prefers-reduced-motion` e `Save-Data`.
- Declarar width/height; texto essencial no HTML; sem autoplay de áudio.
- Validar com Playwright após cada asset entrar em `public/atria-media/`.
