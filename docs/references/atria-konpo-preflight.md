# Atria × Konpo — Preflight

Status: levantamento interno antes da reconstrução da rota `/`  
Data: 2026-07-17  
Branch: `feature/konpo-reference-parity`

## Estado inicial do repositório

- Commit de referência: `7da7743` (`Archive functional Atria Threshold landing`).
- Alterações pré-existentes do usuário: `PRODUCT.md`, `DESIGN.md` e `docs/archive/`.
- Essas alterações são fonte de verdade deste trabalho e não devem ser revertidas, limpas ou sobrescritas de forma incidental.
- A implementação atual ocupa somente `app/page.tsx`, `app/landing-interactions.tsx`, `app/globals.css` e `app/layout.tsx`.
- Não há configuração de Playwright, Cypress ou `agent-browser` no repositório.

## Código funcional reutilizável

- Validação local do formulário, mensagens por campo, sumário de erros e foco no primeiro campo inválido.
- Campos, opções de função e consentimento alinhados ao documento de produto.
- Alternância `Atual` / `Proposta` com semântica de tabs, setas, Home/End e anúncio em região viva.
- Preservação da posição de leitura durante a troca de versão no mobile.
- Navegação por âncoras com foco no título do formulário e respeito a `prefers-reduced-motion`.
- Avisos de demonstração fictícia e de não publicação já presentes no conteúdo.

Esses comportamentos podem ser reimplementados na nova arquitetura. A marcação e os estilos atuais não são referências visuais aprovadas.

## Código a substituir

- Toda a macrocomposição de `app/page.tsx`: hero em duas colunas, listas uniformes, módulo de comparação em cards e rodapé estreito.
- A estrutura visual da navegação atual, que não constitui um menu de tela cheia com coreografia e controle completo de foco.
- A representação compacta da Clínica Aurora, insuficiente para funcionar como mídia estrutural.
- A maior parte de `app/globals.css`, pois cores, espaçamento, escalas, containers, seções e responsividade pertencem à landing rejeitada.

## Dependências e estratégia técnica

- Runtime: Next.js `16.2.10`, React e React DOM `19.2.4`.
- Estilo: CSS global existente; Tailwind está instalado, mas não é necessário para esta reconstrução.
- Fonte: Hanken Grotesk via `next/font`, auto-hospedada pelo build do Next.js.
- Motion: nenhum pacote instalado. A primeira implementação usará CSS, Web Animations quando necessário e `IntersectionObserver`, evitando hidratação ampla.
- Comparação visual e inspeção: CLI `agent-browser`, sem adicionar dependência ao aplicativo.
- Nenhuma nova dependência de produção está prevista no preflight.

## Riscos técnicos e de produto

- O site de referência é dinâmico; conteúdo, carregamento de vídeo e estados podem variar entre capturas.
- A proximidade estrutural deve respeitar a fronteira autoral: nenhum asset, texto, logo, classe, script ou fonte proprietária será copiado.
- Mídia original precisa ter papel estrutural. Na ausência de acesso direto ao Higgsfield, serão usados artefatos locais claramente documentados como placeholders e prompts de produção.
- A Clínica Aurora precisa permanecer confinada à demonstração e sempre identificada como fictícia.
- O formulário não possui backend nesta fase; o estado final deve declarar honestamente que nenhum dado foi enviado.
- Zoom de 200%, 320 px, focus trap, scroll lock e restauração de foco são áreas de risco prioritárias.
- A etapa Impeccable foi explicitamente dispensada pelo usuário nesta execução; a revisão será feita por inspeção manual, navegador e testes técnicos.

## Escopo da rota

- Alterar somente `/` e a infraestrutura compartilhada estritamente necessária para essa rota.
- Não implementar preview dedicado, admin, crawler, banco, autenticação, pagamentos, envio de e-mail, WhatsApp ou automações.
- Não realizar deploy nem commit automático.

## Restrições de implementação

- Preservar `PRODUCT.md`, `DESIGN.md` e o arquivo de shape como fontes de verdade.
- Manter TypeScript estrito e a página majoritariamente como Server Component, isolando apenas interações em Client Components.
- Ler e seguir a documentação local do Next.js 16 antes de editar código.
- Executar `npm run lint`, `npm run build`, `git diff --check` e revisão real no navegador antes da entrega.

