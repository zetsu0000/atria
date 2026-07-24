# Sistema de IA futuro — Atria

> Não pertence ao MVP ativo. Toda saída exige schema e revisão humana.
> Fonte histórica: `PRODUCT-v1.2-archive.md`.


<!-- linhas 1385-1494 do archive v1.2 -->
# 16. Sistema de IA — fase futura

> Não pertence ao MVP 0. Toda saída deve passar por schema e revisão humana.


## 16.1 Usos permitidos

- classificar conteúdo;
- resumir páginas;
- detectar serviços;
- sugerir sitemap;
- gerar copy institucional preliminar;
- gerar FAQ preliminar;
- sugerir títulos;
- sugerir CTAs;
- adaptar tom;
- organizar conteúdo em template.

## 16.2 Usos proibidos

A IA não pode inventar:

- CRM;
- RQE;
- formação;
- certificação;
- especialidade;
- endereço;
- telefone;
- serviços;
- convênios;
- experiência;
- número de pacientes;
- resultados;
- depoimentos;
- taxas de sucesso;
- claims médicos.

## 16.3 Campos bloqueados

Devem vir do site ou do cliente:

- nome;
- CRM;
- RQE;
- equipe;
- endereço;
- telefone;
- serviços;
- convênios;
- formação;
- redes sociais.

## 16.4 Campos geráveis

- headline;
- subheadline;
- texto institucional;
- ordem dos serviços;
- CTAs;
- FAQ;
- descrições gerais;
- textos de transição.

## 16.5 Status de conteúdo

- draft;
- internal_review;
- client_review;
- approved;
- published.

Nada com status `draft` pode ser publicado.

## 16.6 Formato de resposta

A IA deve retornar JSON validado.

Exemplo:

```json
{
  "schemaVersion": 1,
  "hero": {
    "headline": "",
    "subheadline": "",
    "primaryCta": "",
    "secondaryCta": ""
  },
  "about": {
    "title": "",
    "body": ""
  },
  "services": [
    {
      "sourceName": "",
      "displayName": "",
      "summary": ""
    }
  ],
  "faq": [
    {
      "question": "",
      "answer": ""
    }
  ]
}
```

---
