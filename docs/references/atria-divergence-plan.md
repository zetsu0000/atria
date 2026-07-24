# Plano de divergência — Product design Atria

Status: **fase ativa** (pós-paridade)
Atualizado: 2026-07-24
Toolchain: taste-skill · emilkowalski/skills · Figma · Playwright · Impeccable
Higgsfield: **retirado**

## Baseline preservado

Da paridade interna (`atria-konpo-parity-review.md`):

- trilho + header fixos, menu imersivo acessível;
- escala tipográfica e uso de viewport;
- índices contínuos no lugar de cards;
- comparador Atual/Proposta;
- formulário local honesto;
- reduced motion e contraste medidos;
- conteúdo Preview-First e Clínica Aurora contida.

## O que já é Atria (reforçar)

- promessa canônica;
- accent vermelho-terra + Threshold;
- método em cinco capítulos;
- compromissos de aprovação;
- artefatos DOM/CSS originais (como fallback).

## Backlog de product design (prioridade)

1. **Retirar scaffolding de paridade / AI tells**
   - rationar `section-index` numerado (`01`…);
   - remover em-dashes da copy de UI;
   - hero stack ≤ 4 elementos de texto (taste-skill).

2. **Mídia própria sem Higgsfield**
   - Figma → `public/atria-media/`;
   - Threshold loop + approval sequence;
   - DOM de capítulos vira fallback, não destino.

3. **Motion Emil**
   - auditar com `review-animations`;
   - ease-out custom; sem `transition: all`; sem animar ações frequentes demais;
   - `find-animation-opportunities` com viés de restrição.

4. **Compressão mobile**
   - reduzir altura (~20k px) sem esconder responsabilidades;
   - revalidar 390/320 no Playwright.

5. **Assinatura geométrica Threshold**
   - sistema reconhecível no Figma (intervalo + checkpoint);
   - aplicar com parcimônia (DESIGN.md §6.3).

6. **Tipografia**
   - avaliar família licenciada só com orçamento; Hanken Grotesk permanece até lá.

7. **Prova verdadeira**
   - casos/clientes/métricas só com autorização real.

8. **Playwright como gate**
   - screenshots em 1440/1024/768/390 para `/` e `/previa/clinica-aurora` a cada lote visual.

## Critérios de conclusão da fase

- DESIGN.md (versão ativa no próprio documento) seguido;
- zero dependência Higgsfield na docs e no código;
- Figma Atria com frames das seções críticas;
- Playwright suite mínima documentada;
- taste-skill preflight passando nos itens de copy/eyebrow/hero;
- aprovação explícita antes de tratar como versão pública.
