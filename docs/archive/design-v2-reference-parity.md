# Arquivo — Design v2, paridade com referência externa (Konpo)

> **Sem autoridade normativa.** Extraído de `DESIGN.md` em 2026-07-24.
> Corresponde à Etapa 1 (paridade estrutural), concluída e aceita em `docs/references/atria-konpo-parity-review.md`.
> Mantido apenas como registro do que foi feito e por quê.

> **Não seguir estas instruções.** Palavras como "obrigatório", "deve" e "aprovado quando" aqui referem-se a uma fase encerrada.
> A direção ativa está em `DESIGN.md` §0, §1.3 e §11.

---
# 2. Política de reconstrução

> **ARQUIVO HISTÓRICO — NÃO NORMATIVO (marcado em 2026-07-24).**
> Esta seção pertence à Etapa 1 (paridade Konpo), declarada concluída em §1.1.
> Ela permanece como registro do que foi feito, não como instrução.
> Em conflito com §0.2 ou §0.4, **§0.2 e §0.4 vencem**.
> Não iniciar nova medição da Konpo nem tratar "aprovado quando" desta seção como critério de entrega.

## 2.1 O que deve ficar quase igual no início

A reconstrução inicial pode ser quase equivalente à referência em:

- estrutura macro da homepage;
- proporção entre texto e mídia;
- posição relativa dos elementos;
- sequência de regiões;
- altura aparente das seções;
- uso de viewport;
- escala e peso visual dos títulos;
- ritmo de espaços vazios;
- contraste entre regiões densas e abertas;
- distribuição de projetos ou demonstrações;
- comportamento do menu;
- navegação sobre conteúdo;
- entrada e saída de mídia;
- interações de hover;
- mudança de cursor;
- rótulos de interação;
- comportamento de vídeos;
- transições de cor;
- rodapé;
- adaptação desktop/mobile.

O objetivo é permitir comparação visual lado a lado e reconhecer a mesma lógica.

## 2.2 O que não deve ser copiado

Não copiar ou reutilizar:

- nome Konpo;
- logotipo Konpo;
- textos Konpo;
- títulos de projetos;
- nomes de clientes;
- imagens de projetos;
- vídeos de projetos;
- retratos;
- depoimentos;
- marcas;
- selos;
- credenciais;
- slogans;
- ilustrações proprietárias;
- arquivos de fonte privados;
- código-fonte;
- classes copiadas;
- scripts extraídos;
- assets servidos pelo domínio da referência;
- identidade visual específica de clientes da Konpo.

## 2.3 Substituição obrigatória

Toda área proprietária da referência deve receber uma contraparte original da Atria.

Exemplos:

- projetos da Konpo → capítulos da experiência Atria;
- vídeos de clientes → mídia original sobre transformação, preview e aprovação;
- depoimentos → princípios de confiança enquanto não existirem depoimentos reais;
- logos de clientes → não exibir logos até existirem autorizações reais;
- credenciais e prêmios → não inventar equivalentes;
- formulário de contratação → solicitação de prévia;
- casos de trabalho → demonstração Atual/Proposta e método Atria;
- retratos da equipe Konpo → mídia abstrata ou conteúdo original da Atria.

## 2.4 Uso público

O protótipo não deve ser considerado pronto para publicação quando:

- ainda parecer uma troca de marca sobre a Konpo;
- mantiver composições exclusivas demais;
- reproduzir movimentos distintivos sem adaptação;
- depender da mesma sequência narrativa;
- não possuir linguagem reconhecível da Atria.

Antes da publicação, executar a fase de divergência descrita neste documento.

---

# 3. Referência primária

> **ARQUIVO HISTÓRICO — NÃO NORMATIVO (marcado em 2026-07-24).**
> Esta seção pertence à Etapa 1 (paridade Konpo), declarada concluída em §1.1.
> Ela permanece como registro do que foi feito, não como instrução.
> Em conflito com §0.2 ou §0.4, **§0.2 e §0.4 vencem**.
> Não iniciar nova medição da Konpo nem tratar "aprovado quando" desta seção como critério de entrega.

## 3.1 Site

Referência:

`https://www.konpo.studio/`

O site deve ser analisado no navegador, não apenas por screenshots estáticos.

## 3.2 Características observáveis que orientam a reconstrução

A referência combina:

- abertura tipográfica dominante;
- navegação discreta;
- menu de tela cheia;
- projetos tratados como experiências de mídia;
- vídeos com grande presença;
- controles contextuais;
- rótulos como play, pause, preview, detail, drag e close;
- alternância entre texto editorial e interface;
- seções de serviços sem aparência de cards SaaS;
- lista de trabalhos com comportamento interativo;
- prova social extensa;
- fechamento de alta energia;
- uso de conteúdo full-bleed;
- transições entre mundos visuais;
- densidade alta sem parecer dashboard.

## 3.3 Tecnologia observada

A referência apresenta sinais confirmados de:

- implementação em Webflow;
- uso de mídia entregue por Wistia;
- conteúdo de projetos organizado como coleção;
- controles personalizados sobre mídia.

Não assumir como fato sem inspeção:

- GSAP;
- Lenis;
- Framer Motion;
- Swiper;
- Barba;
- Lottie;
- qualquer biblioteca específica não confirmada.

## 3.4 Regra de detecção técnica

Antes de escolher dependências para a Atria:

1. inspecionar scripts;
2. inspecionar network;
3. verificar computed styles;
4. verificar listeners e comportamento;
5. classificar cada descoberta;
6. escolher equivalente apropriado para Next.js.

Classificações:

- confirmado;
- medido;
- fortemente inferido;
- não verificado.

---

# 4. Processo obrigatório de análise

> **ARQUIVO HISTÓRICO — NÃO NORMATIVO (marcado em 2026-07-24).**
> Esta seção pertence à Etapa 1 (paridade Konpo), declarada concluída em §1.1.
> Ela permanece como registro do que foi feito, não como instrução.
> Em conflito com §0.2 ou §0.4, **§0.2 e §0.4 vencem**.
> Não iniciar nova medição da Konpo nem tratar "aprovado quando" desta seção como critério de entrega.

Antes de codificar a reconstrução completa, criar:

`docs/references/konpo-reconstruction.md`

## 4.1 Viewports obrigatórios

Analisar:

- 1440 × 900;
- 1280 × 800;
- 1024 × 768;
- 768 × 1024;
- 390 × 844;
- 320 × 700;
- 200% de zoom.

## 4.2 Capturas obrigatórias da referência

Registrar:

- página inteira;
- primeira dobra;
- menu fechado;
- menu aberto;
- primeiro bloco de projetos;
- serviços;
- lista de trabalhos;
- prova social;
- formulário ou contato;
- rodapé;
- principais hovers;
- principais estados de vídeo;
- comportamento mobile.

## 4.3 Tabela de medição

Para cada região, documentar:

| Região | Viewport | Largura | Altura | Gutter | Colunas | Gap | Tipografia | Movimento | Estado |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Header | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Hero | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Showcase | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Services | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Work | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Contact | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |
| Footer | 1440 | medir | medir | medir | medir | medir | medir | medir | observado |

Valores medidos devem substituir estimativas.

## 4.4 Comparação visual

Criar capturas equivalentes da Atria.

Comparar usando:

- lado a lado;
- overlay com opacidade;
- diferença visual;
- comparação por seção;
- comparação em movimento.

Não avaliar apenas pela memória.

## 4.5 Regra de iteração

Para cada viewport:

1. capturar referência;
2. capturar Atria;
3. alinhar as duas imagens;
4. identificar as cinco maiores diferenças;
5. corrigir;
6. repetir;
7. só avançar quando a macrocomposição estiver próxima.

---


---

# 28. Critérios de paridade

> **ARQUIVO HISTÓRICO — NÃO NORMATIVO (marcado em 2026-07-24).**
> Esta seção pertence à Etapa 1 (paridade Konpo), declarada concluída em §1.1.
> Ela permanece como registro do que foi feito, não como instrução.
> Em conflito com §0.2 ou §0.4, **§0.2 e §0.4 vencem**.
> Não iniciar nova medição da Konpo nem tratar "aprovado quando" desta seção como critério de entrega.

## 28.1 Macroestrutura

Aprovado quando:

- hero possui impacto equivalente;
- mídia tem proporção equivalente;
- sequência possui ritmo semelhante;
- regiões ocupam quantidades comparáveis de viewport;
- footer possui peso equivalente;
- mobile é uma recomposição, não empilhamento.

## 28.2 Espaçamento

Aprovado quando:

- gutters comparáveis;
- relações de espaço equivalentes;
- títulos não parecem menores ou mais tímidos;
- regiões densas e abertas correspondem;
- nenhuma seção parece cardizada.

## 28.3 Tipografia

Aprovado quando:

- escala visual equivalente;
- quebras intencionais;
- line-height equivalente;
- corpo possui presença;
- labels possuem função semelhante;
- português mantém naturalidade.

## 28.4 Movimento

Aprovado quando:

- menu possui qualidade equivalente;
- reveals possuem ritmo equivalente;
- mídia responde de forma equivalente;
- hovers têm intenção;
- scroll não parece padrão;
- reduced motion continua funcional.

## 28.5 Interação

Aprovado quando:

- usuário identifica áreas interativas;
- controles possuem feedback;
- cursor contextual acrescenta valor;
- mobile mantém equivalência funcional;
- formulário parece parte da experiência.

## 28.6 Qualidade percebida

Perguntas:

- Parece um trabalho feito sob medida?
- Parece pertencer ao mesmo nível da referência?
- Existe algum trecho que parece template?
- Existe alguma região que parece dashboard?
- O hero é confiante ou cauteloso?
- A mídia estrutura a página?
- O rodapé é memorável?
- A Atria ainda é compreensível?

## 28.7 Rejeição

Rejeitar a implementação quando:

- apenas cores e fonte mudaram;
- layout atual foi preservado;
- projetos viraram cards;
- Atual/Proposta parece widget;
- tipografia é pequena;
- vídeos são decorativos;
- mobile é empilhado;
- menu é dropdown comum;
- rodapé é genérico;
- há aparência de clínica;
- o resultado é “parecido, mas pior”.

---

# 29. Fase de divergência

> **ARQUIVO HISTÓRICO — NÃO NORMATIVO (marcado em 2026-07-24).**
> Esta seção pertence à Etapa 1 (paridade Konpo), declarada concluída em §1.1.
> Ela permanece como registro do que foi feito, não como instrução.
> Em conflito com §0.2 ou §0.4, **§0.2 e §0.4 vencem**.
> Não iniciar nova medição da Konpo nem tratar "aprovado quando" desta seção como critério de entrega.

Depois da paridade, criar:

`docs/references/atria-divergence-plan.md`

## 29.1 Objetivo

Tornar a experiência proprietária sem reduzir qualidade.

## 29.2 Identificar

- seções próximas demais;
- transições distintivas;
- composição de hero;
- sequência narrativa;
- comportamento de menu;
- padrão de projetos;
- cursor;
- footer;
- cores;
- mídia.

## 29.3 Transformar

Criar elementos Atria:

- Threshold mais reconhecível;
- transição Atual/Proposta própria;
- aprovação como evento visual;
- mídia original;
- composição de método própria;
- linguagem de confiança própria;
- navegação com assinatura própria.

## 29.4 Manter

Manter princípios genéricos de alta qualidade:

- escala;
- ritmo;
- confiança;
- mídia;
- acabamento;
- responsividade;
- movimento disciplinado;
- clareza;
- acessibilidade.

## 29.5 Requisito antes de publicação

A versão pública deve:

- ser identificável como Atria;
- não depender da Konpo para fazer sentido;
- não parecer reskin;
- usar somente assets autorizados;
- possuir copy própria;
- possuir movimento adaptado;
- manter o nível de paridade alcançado.

---
