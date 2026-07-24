# Fluxos futuros — Atria

> Onboarding, aprovação, publicação, templates, score detalhado, seeds e testes de fases futuras.
> Fonte histórica: `PRODUCT-v1.2-archive.md`.


<!-- linhas 1212-1286 do archive v1.2 -->
# 14. Score de primeira impressão — fase futura

> Não pertence ao MVP 0 e não deve bloquear a validação comercial.


Total: 100 pontos.

## 14.1 Credibilidade — 20

- identificação clara: 3;
- equipe apresentada: 4;
- registros profissionais encontrados: 4;
- endereço e contato: 3;
- fotos coerentes: 3;
- informações institucionais: 3.

## 14.2 Clareza — 20

- atividade compreensível no hero: 5;
- cidade ou região: 3;
- serviços organizados: 4;
- navegação clara: 4;
- textos legíveis: 4.

## 14.3 Mobile — 20

- sem rolagem horizontal: 5;
- texto legível: 4;
- botões utilizáveis: 4;
- menu funcional: 3;
- imagens dimensionadas: 4.

## 14.4 Contato e ação — 20

- CTA principal: 5;
- telefone ou WhatsApp: 4;
- página de contato: 3;
- localização: 3;
- caminho para agendamento ou contato: 5.

Esta dimensão mede facilidade de ação, não conversão real.

## 14.5 Atualização — 20

- links funcionais: 4;
- sem sinais evidentes de abandono: 4;
- consistência visual: 4;
- informações atuais: 4;
- experiência mobile contemporânea: 4.

## 14.6 Regras

- score deve ser explicável;
- cada nota deve possuir evidência;
- administrador pode editar;
- não declarar perda de pacientes;
- não estimar conversão;
- não tratar esta dimensão como previsão de resultado comercial;
- não avaliar qualidade médica;
- exibir aviso:

> Esta análise avalia apenas a apresentação digital e a facilidade de encontrar informações. Não avalia qualidade médica.

Constraints recomendadas:

```text
credibility between 0 and 20
clarity between 0 and 20
mobile between 0 and 20
actionability between 0 and 20
freshness between 0 and 20
total between 0 and 100
```

---

<!-- linhas 1496-1541 do archive v1.2 -->
# 17. Templates — fase futura

> Não pertence ao MVP 0.


## 17.1 Template A — Médico individual

Seções:

1. hero;
2. apresentação;
3. áreas de atuação;
4. formação;
5. estrutura;
6. FAQ;
7. localização;
8. contato.

## 17.2 Template B — Clínica com equipe

Seções:

1. hero;
2. diferenciais;
3. serviços;
4. equipe;
5. estrutura;
6. FAQ;
7. localização;
8. contato.

## 17.3 Regras

- estrutura controlada;
- conteúdo via JSON;
- sem HTML gerado pela IA;
- sem componentes arbitrários;
- cores limitadas;
- tipografia limitada;
- WCAG 2.2 AA como requisito integral;
- AAA para texto essencial e estados críticos;
- teclado, foco visível, redução de movimento e reflow a 200%;
- mobile-first;
- carregamento rápido.

---

<!-- linhas 1595-1763 do archive v1.2 -->
# 19. Onboarding — fase futura

> Não pertence ao MVP 0.


## 19.1 Dados

- nome da clínica;
- responsável;
- endereço;
- telefone;
- WhatsApp;
- e-mail;
- horários;
- equipe;
- CRM;
- RQE;
- serviços;
- convênios;
- logotipo;
- fotos;
- redes sociais;
- domínio;
- responsável pela aprovação.

## 19.2 Confirmações

O cliente confirma:

- direito de uso das imagens;
- exatidão dos dados;
- autorização de publicação;
- revisão de textos;
- validade das credenciais;
- responsabilidade pela aprovação.

---

# 20. Aprovação — fase futura

> Não pertence ao MVP 0, mas a regra de aprovação antes da publicação é permanente.


## 20.1 Homepage

Opções:

- Aprovar direção.
- Solicitar ajustes.

## 20.2 Ajustes

Categorias:

- texto;
- imagem;
- cor;
- serviço;
- equipe;
- contato;
- outro.

## 20.3 Regra

Uma rodada de ajustes:

- um único envio;
- todas as mudanças consolidadas;
- dentro do escopo.

## 20.4 Aprovação final

Deve registrar:

- nome;
- e-mail;
- data;
- versão;
- aceite.

---

# 21. Publicação — fase futura

> Não pertence ao MVP 0.


## 21.1 Estratégia inicial

Um deployment por cliente.

## 21.2 Processo

1. gerar site;
2. publicar em URL temporária;
3. aprovar;
4. receber pagamento final;
5. registrar DNS atual;
6. confirmar e-mail;
7. configurar domínio;
8. verificar SSL;
9. testar;
10. publicar;
11. monitorar;
12. encerrar janela de risco.

## 21.3 Checklist

- domínio;
- www;
- SSL;
- telefone;
- WhatsApp;
- formulário;
- mapa;
- links;
- imagens;
- mobile;
- e-mail;
- robots;
- favicon;
- metadata;
- 404.

## 21.4 Rollback

Guardar:

- DNS anterior;
- registros;
- provider;
- data;
- responsável;
- backup;
- instruções.

---

# 22. Manutenção

## 22.1 Incluído

- hospedagem;
- SSL;
- backup;
- monitoramento;
- atualização técnica;
- suporte;
- uma pequena alteração mensal.

## 22.2 Pequena alteração

- horário;
- telefone;
- texto;
- foto;
- profissional em estrutura existente.

## 22.3 Não incluído

- nova página;
- redesign;
- integração;
- nova unidade;
- nova estrutura;
- copy completa;
- campanha.

---

<!-- linhas 2286-2356 do archive v1.2 -->
# 33. Seed data

Criar:

- clínica fictícia individual;
- clínica fictícia com equipe;
- template A;
- template B;
- scan completo;
- score;
- preview;
- lead;
- projeto em homepage_review;
- projeto em ready_to_publish.

---

# 34. Testes mínimos

## 34.1 MVP 0

### Unitários

- validação de formulário;
- validação de URL;
- transformação de status;
- schema de preview.

### Integração

- criação de lead;
- criação de clínica;
- criação de preview;
- armazenamento de asset;
- atualização de status.

### E2E

- visitante envia formulário;
- admin visualiza lead;
- admin cria clínica;
- admin cria preview;
- prospect acessa URL privada;
- prospect alterna Atual e Proposta.

## 34.2 Fases futuras

### Unitários

- score;
- normalização;
- schemas de IA;
- estados;
- token hashing.

### Integração

- scan;
- onboarding;
- aprovação;
- projeto;
- deployment.

### E2E

- scan;
- geração;
- onboarding;
- aprovação;
- publicação;
- rollback.
