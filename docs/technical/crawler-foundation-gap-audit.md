# Crawler foundation — gap audit

> **Baseline commit:** `13be782` (`Document crawler and discovery project`)  
> **Branch:** `feature/crawler-data-foundation`  
> **Strategic source:** `PROJECT_CRAWLER.md`  
> **Date:** 2026-07-20

## Decision summary

Keep physical tables `crawl_jobs` / `crawl_pages` / `crawl_findings` (already shipped). Map them conceptually to `scans` / `scan_pages`. Add **additive** tables for discovery, clinics, contacts, assets metadata, extracted content, scores, and outreach drafts. Do not rename or drop existing tables. Do not weaken RLS.

| Area | Required by PROJECT_CRAWLER.md | Exists now | Gap | Action |
| --- | --- | --- | --- | --- |
| discovery_jobs | Jobs de busca/importação | Não | Total | Criar tabela + módulos `lib/discovery` |
| prospect_candidates | Candidatos brutos pré-promoção | Não | Total | Criar tabela + normalização/dedupe |
| clinics | Registro canônico | Não | Total | Criar tabela + promoção a partir de candidato |
| clinic_contacts | Contatos com proveniência | Não | Total | Criar tabela + schema de candidatos |
| scans | Tentativa de scan | `crawl_jobs` (equiv.) | Naming only | Manter `crawl_jobs`; documentar mapeamento; FK opcional `clinic_id` |
| scan_pages | Páginas visitadas | `crawl_pages` (equiv.) | Naming only | Manter `crawl_pages` |
| scan_assets | Screenshots / artefatos (paths privados) | Não | Total | Criar tabela de metadados (sem bytes) |
| extracted_content | Extração versionada + proveniência | Parcial em `crawl_pages` (title/text) | Proveniência estruturada e contatos | Tabela `extracted_content` + extrator de candidatos |
| scores | Score 5×20 com evidência | Não | Total | Tabela + `lib/score` com regras placeholder |
| outreach_messages | Rascunhos revisados (sem envio) | Não | Total | Tabela + `lib/outreach` (draft only) |
| leads compatibility | Preservar inbound `leads` | Sim (`20260718120000` + expansão status) | Ligação clinics↔leads | FK nullable / campos opcionais |
| previews compatibility | Prévia futura | Só UI fictícia Aurora | Sem tabela de previews reais | Diferir tabela `previews`; não bloquear fundação |
| RLS | RLS on; sem acesso anon | Sim nas tabelas crawl/leads | Manter padrão | RLS + revoke anon/authenticated em tabelas novas |
| storage | Bucket privado screenshots | Não | Metadados only agora | Paths em `scan_assets`; sem bucket live |
| SSRF protection | Bloquear localhost/privado/metadata/credenciais/redirects | Forte em `url-policy.ts` + redirect revalidation em `fetch-page.ts` | Cobertura/testes extras | Reforçar skip paths + testes redirect/DNS |
| crawler limits | Até 8 páginas; same-origin | Default 10; hard 20; same-origin sim | Default ≠ 8 | Baixar default para 8 (código + migration alter default) |
| robots behavior | Respeitar robots.txt | Sim (`robots.ts`) | — | Manter; testar disallow |
| extraction provenance | value + source URL + method + confidence + review | Não estruturado | Total | Modelo `ExtractionCandidate` |
| screenshots | Desktop/mobile | Não | Metadados + fixture only | `scan_assets` + CLI fixture; sem captura real |
| tests | Sem internet / sem Supabase live | Parcial (crawler/leads) | Discovery/score/outreach/provenance | Expandir suite local |
| documentation | PROJECT + docs técnicas | PROJECT + `docs/references/crawler-*` | docs/technical/* | Criar docs técnicos desta rodada |
| AI / mass outreach | Proibido nesta fase | Ausente (bom) | — | Não integrar IA nem envio |
| UI landing / Aurora | Não alterar | Intacta | — | Não tocar |

## Existing implementation map

| Module | Path |
| --- | --- |
| URL/SSRF policy | `lib/crawler/url-policy.ts` |
| Fetch + redirect revalidation | `lib/crawler/fetch-page.ts` |
| Robots | `lib/crawler/robots.ts` |
| Link discovery | `lib/crawler/discover-links.ts` |
| HTML parse | `lib/crawler/parse-page.ts` |
| Orchestration | `lib/crawler/run-crawl.ts` |
| Persistence | `lib/crawler/persistence.ts` |
| Ops facade | `lib/operations/crawl-operations.ts` |
| Lead status | `lib/leads/status.ts` |

## Naming map (canonical ↔ physical)

| PROJECT_CRAWLER.md | Physical / module |
| --- | --- |
| scans | `public.crawl_jobs` |
| scan_pages | `public.crawl_pages` |
| (findings) | `public.crawl_findings` |
| scan_assets | `public.scan_assets` (new) |
| discovery_jobs | `public.discovery_jobs` (new) |
| prospect_candidates | `public.prospect_candidates` (new) |
| clinics | `public.clinics` (new) |
| clinic_contacts | `public.clinic_contacts` (new) |
| extracted_content | `public.extracted_content` (new) |
| scores | `public.scores` (new) |
| outreach_messages | `public.outreach_messages` (new) |
| leads | `public.leads` (existing) |
