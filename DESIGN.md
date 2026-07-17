# DESIGN.md — Atria

> **Status:** Documento mestre de direção visual e experiência  
> **Uso:** Fonte de verdade para design, frontend, motion e revisão visual  
> **Versão:** Reference Parity v1  
> **Idioma do produto:** Português do Brasil  
> **Produto:** Atria  
> **Referência primária:** https://www.konpo.studio/  
> **Estratégia:** Reconstrução interna de alta fidelidade primeiro; diferenciação proprietária depois  
> **Princípio de execução:** Não criar uma versão “inspirada” e inferior. Primeiro alcançar paridade visual, espacial e comportamental com a referência.

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
- processo de comparação com a referência;
- uso opcional de ferramentas externas de geração visual.

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
- como o benchmark Konpo deve ser reconstruído;
- quais decisões visuais são obrigatórias;
- quais decisões permanecem livres;
- como avaliar paridade.

## 0.1 Ordem de prioridade

Em caso de conflito, seguir:

1. segurança, veracidade e escopo definidos em `PRODUCT.md`;
2. acessibilidade e operação por teclado;
3. paridade estrutural e comportamental com Konpo;
4. clareza da proposta da Atria;
5. identidade própria da Atria;
6. preferências do código existente;
7. conveniência técnica.

O código atual não tem prioridade sobre a direção visual deste documento.

## 0.2 Regra central para Cursor e agentes

A referência não deve ser tratada como uma vaga fonte de inspiração.

O primeiro protótipo deve tentar reproduzir com alta fidelidade:

- arquitetura macro;
- proporções;
- ritmo;
- densidade;
- escala tipográfica;
- alinhamentos;
- comportamento do menu;
- uso de mídia;
- movimento;
- transições;
- interações;
- composição responsiva;
- energia do rodapé;
- sensação de acabamento.

Não suavizar a referência para torná-la:

- mais convencional;
- mais “SaaS”;
- mais segura visualmente;
- mais parecida com o site atual;
- mais parecida com um template médico;
- mais fácil de implementar.

Primeiro reconstruir corretamente.

Depois diferenciar.

## 0.3 Liberdade de execução

O modelo tem liberdade para:

- substituir a arquitetura atual de componentes;
- reescrever CSS;
- alterar a ordem das seções;
- criar novos componentes;
- remover componentes fracos;
- escolher técnicas de animação;
- adicionar dependências justificadas;
- criar SVGs originais;
- criar imagens e vídeos originais;
- utilizar Higgsfield quando necessário;
- criar fallbacks locais;
- adaptar o conteúdo da Atria à estrutura da referência;
- tomar decisões visuais sem pedir confirmação a cada etapa.

A liberdade não autoriza:

- inventar informações de produto;
- remover avisos de demonstração fictícia;
- comprometer acessibilidade;
- copiar assets proprietários;
- copiar textos;
- copiar código-fonte;
- usar marcas ou clientes da Konpo;
- publicar o protótipo de paridade como versão final sem revisão.

---

# 1. Objetivo

Criar uma landing da Atria que, no primeiro estágio, pareça pertencer ao mesmo sistema de composição e interação do site da Konpo.

O visitante deve perceber:

- o mesmo nível de confiança visual;
- o mesmo domínio de espaço;
- a mesma coragem tipográfica;
- uma experiência guiada por mídia;
- uma navegação editorial;
- um ritmo de página não convencional;
- transições controladas;
- acabamento de estúdio de design de alto nível.

Ao mesmo tempo, todo o conteúdo deve pertencer à Atria.

## 1.1 Resultado esperado da primeira etapa

A primeira etapa deve ser descrita como:

> **Protótipo interno de paridade com a referência.**

Ela deve ficar muito próxima da Konpo em execução.

Ela não deve ser apenas:

- “Konpo-inspired”;
- uma landing tradicional com fonte grande;
- uma cópia superficial de cores;
- a landing atual com novas animações;
- uma sequência de cards;
- uma página de clínica;
- uma página de agência genérica.

## 1.2 Resultado esperado da segunda etapa

Depois da paridade, uma etapa separada deve criar:

- dispositivos gráficos próprios;
- composições próprias;
- movimentos próprios;
- sistema de mídia próprio;
- assinatura visual Threshold mais reconhecível;
- relações de seção menos dependentes da referência;
- linguagem proprietária da Atria.

A segunda etapa não deve reduzir o nível de qualidade alcançado.

---

# 2. Política de reconstrução

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

# 5. Arquitetura da landing Atria

A landing deve traduzir a arquitetura da referência para a narrativa da Atria.

A sequência abaixo é uma direção inicial de paridade. O modelo pode ajustar detalhes quando a inspeção da referência justificar.

## 5.1 Região 01 — Abertura

Objetivo:

- estabelecer Atria imediatamente;
- comunicar a promessa;
- criar impacto equivalente ao hero da referência;
- evitar aparência de landing médica.

Conteúdo:

- marca Atria;
- descritor;
- promessa canônica;
- mensagem de apoio;
- CTA principal;
- CTA secundário;
- indicação visual do mecanismo Atual → Proposta → Aprovado.

Regras:

- o título deve dominar o viewport;
- a composição deve usar espaço, não caixas;
- o CTA não deve parecer um widget;
- o hero não deve incluir mockup genérico de notebook;
- não usar ilustração médica genérica;
- não usar foto de médico sorrindo como elemento principal;
- a primeira dobra deve possuir movimento controlado;
- o visitante deve compreender o mecanismo em cinco segundos.

## 5.2 Região 02 — Demonstrações principais

Equivalente funcional aos projetos destacados da referência.

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

Equivalente ao manifesto editorial da referência.

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

A interação deve seguir a lógica editorial da referência:

- itens grandes;
- hover com mídia ou transição;
- divisórias;
- títulos dominantes;
- detalhes contextuais;
- CTA integrado;
- nenhuma grade de cinco cards iguais.

## 5.5 Região 05 — Atual / Proposta

Equivalente à lista de trabalhos selecionados e ao sistema de preview/detail da referência.

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

A composição pode reproduzir a densidade editorial da região de parceiros da referência, mas com conteúdo verdadeiro.

## 5.7 Região 07 — Solicitação de prévia

Equivalente à experiência de contato da referência.

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

O rodapé deve ter presença comparável à referência.

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
- ocupar posição equivalente à marca na referência;
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

## 7.2 Paridade antes de tokens

Na primeira reconstrução:

- medir a referência;
- reproduzir relações;
- só depois consolidar tokens.

Não escolher arbitrariamente:

- container padrão;
- padding padrão;
- gap padrão;
- altura padrão de seção.

## 7.3 Gutter

O gutter deve:

- parecer pequeno em áreas full-bleed;
- permitir alinhamentos editoriais;
- aumentar em viewports maiores quando a referência fizer isso;
- reduzir no mobile sem esmagar conteúdo;
- alinhar header, títulos e metadados quando observado;
- permitir exceções ópticas.

Implementação recomendada:

```css
--page-gutter: clamp(1rem, 2.1vw, 2.25rem);
```

Este valor é apenas ponto de partida.

A medição da referência tem prioridade.

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

A referência usa viewport como parte da composição.

Regras:

- mídia pode tocar bordas;
- títulos podem ocupar quase toda a largura;
- textos longos devem manter medida legível;
- metadados podem ficar em colunas menores;
- regiões podem possuir containers distintos;
- evitar um único `max-width` global aplicado a tudo.

## 7.6 Altura das regiões

A altura deve responder ao conteúdo e ao viewport.

Usar `min-height: 100svh` apenas quando a referência exigir experiência de tela.

Não transformar todas as seções em `100vh`.

## 7.7 Espaçamento vertical

O espaçamento deve ser derivado da referência por relação.

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

Não copiar fonte privada da referência.

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
- excelente em maiúsculas ou sentence case conforme referência.

## 8.4 Escala inicial

A escala final deve vir da medição.

Ponto de partida:

```css
--type-display-1: clamp(3.5rem, 9.5vw, 10rem);
--type-display-2: clamp(2.75rem, 7vw, 7.5rem);
--type-heading-1: clamp(2.25rem, 4.6vw, 5rem);
--type-heading-2: clamp(1.75rem, 3vw, 3.25rem);
--type-body-large: clamp(1.25rem, 1.8vw, 1.75rem);
--type-body: clamp(1rem, 1.1vw, 1.2rem);
--type-label: clamp(0.75rem, 0.8vw, 0.9rem);
```

Esses valores não são definitivos.

## 8.5 Altura de linha inicial

```css
--leading-display: 0.88;
--leading-heading: 0.98;
--leading-body-large: 1.25;
--leading-body: 1.45;
--leading-label: 1.15;
```

Ajustar por fonte e viewport.

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

A cor deve seguir a lógica da referência:

- base neutra;
- contraste forte;
- mudanças de mundo;
- regiões com identidade própria;
- mídia como fonte de cor;
- momentos claros e escuros;
- controle, não decoração.

## 9.2 Não copiar paleta literal

Não copiar hexadecimais da Konpo.

Reproduzir:

- frequência;
- função;
- contraste;
- ritmo;
- alternância;
- saturação relativa.

## 9.3 Paleta Atria

A paleta final não deve ser congelada antes da reconstrução visual.

Ela deve:

- funcionar em grayscale;
- evitar estética médica genérica;
- evitar azul hospitalar como escolha automática;
- evitar gradientes SaaS;
- aceitar uma cor de destaque com personalidade;
- possuir superfícies claras e escuras;
- permitir mundos de mídia;
- preservar Threshold.

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

A referência é fortemente orientada por mídia; a Atria deve preservar isso.

## 10.2 Tipos permitidos

- vídeo original;
- loop abstrato;
- captura de interface;
- comparação;
- composição tipográfica;
- animação de transformação;
- fotografia original ou licenciada;
- SVG;
- WebGL apenas quando justificado;
- imagens geradas para a Atria;
- mídia criada no Higgsfield.

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

Reproduzir as proporções observadas da referência.

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
- usar crop equivalente à referência;
- criar art direction mobile;
- não depender de `object-fit: cover` sem revisar conteúdo;
- preservar foco visual.

---

# 11. Higgsfield

## 11.1 Permissão

Higgsfield está autorizado como ferramenta opcional de produção visual.

Pode ser utilizado para:

- vídeos originais da Atria;
- loops abstratos;
- transições de transformação;
- primeiro e último frame;
- storyboards;
- cenas de passagem;
- fundos;
- mídia editorial;
- material de campanha;
- variações de movimento.

## 11.2 Uso direto

Quando o ambiente tiver acesso autenticado:

- organizar dentro de um projeto Atria;
- nomear gerações;
- registrar prompt;
- registrar modelo;
- registrar seed quando disponível;
- exportar arquivo original;
- gerar fallback;
- otimizar antes de incluir no site.

## 11.3 Sem acesso direto

Quando Higgsfield não estiver disponível, criar:

- prompt completo;
- objetivo;
- proporção;
- duração;
- primeiro frame;
- último frame;
- movimento de câmera;
- movimento do assunto;
- ritmo;
- negative prompt;
- resolução;
- formato;
- loop;
- ponto de corte;
- fallback estático.

## 11.4 Restrições

Não usar Higgsfield para reproduzir:

- vídeos exatos da Konpo;
- composição reconhecível de projeto da Konpo;
- pessoas dos projetos;
- logos;
- clientes;
- obras;
- imagens de portfólio;
- estilo proprietário de uma campanha específica.

O resultado deve ser original da Atria.

## 11.5 Planejamento de assets

Criar:

`docs/references/atria-media-plan.md`

Para cada asset:

| Asset | Região | Objetivo | Proporção | Duração | Ferramenta | Fallback | Status |
|---|---|---|---:|---:|---|---|---|
| Threshold loop | Hero | Mostrar passagem | 16:9 | 6s | Higgsfield/CSS | Poster | Planejado |
| Atual/Proposta | Showcase | Comparação | 4:3 | 8s | UI capture | Imagem | Planejado |
| Aprovação | Closing | Reforçar controle | 16:9 | 5s | Higgsfield | SVG | Planejado |

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

## 12.2 Movimento de referência

Analisar e reproduzir quando observado:

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

As medidas reais da referência têm prioridade.

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

Não assumir que são as curvas da referência.

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

A referência usa linguagem contextual de interação.

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

O header deve reproduzir:

- presença discreta;
- alinhamentos da referência;
- relação com viewport;
- menu claro;
- contraste adaptável;
- comportamento sobre seções.

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

Reproduzir da referência:

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

Este é o mecanismo visual mais importante da Atria.

Ele deve equivaler ao destaque dado pela referência aos projetos.

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

O formulário pode reproduzir a sensação imersiva do contato da referência.

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

# 27. Processo de implementação

## 27.1 Etapa 1 — Auditoria

Ler:

- `AGENTS.md`;
- `PRODUCT.md`;
- `DESIGN.md`;
- implementação atual;
- documentos de shape.

Identificar:

- comportamento funcional reutilizável;
- decisões visuais descartáveis;
- dependências existentes;
- riscos.

## 27.2 Etapa 2 — Reconstrução da referência

Criar:

- screenshots;
- medições;
- mapa de seções;
- mapa de movimento;
- mapa de mídia;
- relatório técnico;
- matriz responsiva.

Arquivo:

`docs/references/konpo-reconstruction.md`

## 27.3 Etapa 3 — Plano Atria

Criar:

`docs/references/atria-konpo-parity-plan.md`

Incluir:

- mapeamento de cada região;
- conteúdo Atria;
- assets;
- motion;
- stack;
- componentes;
- breakpoints;
- riscos;
- acessibilidade;
- uso de Higgsfield.

## 27.4 Etapa 4 — Prova visual

Antes da landing completa, criar:

- hero desktop;
- hero mobile;
- menu;
- um capítulo de mídia;
- Atual/Proposta;
- rodapé.

Comparar com referência.

Não continuar com uma linguagem visual fraca.

## 27.5 Etapa 5 — Implementação completa

Implementar `/`.

Preservar:

- conteúdo aprovado;
- acessibilidade;
- formulário;
- comportamento de comparação;
- demonstração fictícia.

## 27.6 Etapa 6 — Browser review

Testar todos os viewports.

Capturar estados.

Corrigir diferenças.

## 27.7 Etapa 7 — Impeccable

Executar:

- `$impeccable critique landing route`;
- `$impeccable polish landing route`;
- `$impeccable audit landing route`;
- `$impeccable harden landing route`.

Não permitir que a crítica transforme a página em SaaS genérico.

## 27.8 Etapa 8 — Verificação

Executar:

```bash
npm run lint
npm run build
git diff --check
git status --short
```

Não fazer commit automático.

---

# 28. Critérios de paridade

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
- glows sem função.

---

# 31. Checklist final

## Produto

- [ ] Atria é entendida como modernização de sites para clínicas.
- [ ] Não parece clínica.
- [ ] Não parece agência genérica.
- [ ] Preview-First é compreendido.
- [ ] Site atual permanece ativo.
- [ ] Aprovação vem antes da publicação.
- [ ] Demonstração fictícia está identificada.

## Paridade

- [ ] Referência foi medida.
- [ ] Capturas foram comparadas.
- [ ] Hero possui escala equivalente.
- [ ] Menu possui comportamento equivalente.
- [ ] Mídia possui importância equivalente.
- [ ] Ritmo de página é equivalente.
- [ ] Serviços não são cards.
- [ ] Atual/Proposta é um evento central.
- [ ] Rodapé possui energia equivalente.
- [ ] Mobile possui direção própria.

## Identidade

- [ ] Conteúdo é Atria.
- [ ] Assets são originais.
- [ ] Threshold aparece seletivamente.
- [ ] Paleta não é cópia literal.
- [ ] Tipografia não usa fonte privada.
- [ ] Nenhuma marca da Konpo aparece.

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

Quando houver conflito entre uma solução fácil e uma solução que reproduz corretamente a referência, escolher a solução que reproduz corretamente a referência, desde que:

- seja acessível;
- seja performática de forma responsável;
- use conteúdo original;
- respeite `PRODUCT.md`;
- não copie ativos proprietários;
- não comprometa segurança.

A primeira implementação deve buscar paridade.

A originalidade não deve ser usada como desculpa para entregar algo inferior.

A diferenciação acontece depois que o nível de execução foi alcançado.
