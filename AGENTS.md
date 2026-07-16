# AGENTS.md - Clinica Atual

## Project Identity

This project is **clinic-atual**.

Clinica Atual is a B2B platform/service for modernizing clinic websites.

The product helps clinic owners, doctors, and clinic managers in Brazil modernize their existing clinic website through:

- a first-impression audit;
- an audit/score page;
- a before/after preview;
- a specialized clinic website template;
- approval before publication;
- done-for-you domain, hosting, SSL, backup, and launch support.

Core message:

> Seu novo site de clinica, aprovado antes de ir ao ar.

Primary promise:

> Modernizamos o site da sua clinica, mostramos o resultado antes da publicacao e cuidamos de toda a parte tecnica.

## Workspace Scope

ECC may exist in the workspace as future agent tooling / skills infrastructure.

Do not treat ECC as the product.

All product code changes must happen inside `clinic-atual` unless explicitly instructed otherwise.

Before making changes, confirm the current working directory is `clinic-atual`.

If the task mentions frontend, product UI, preview, landing, admin dashboard, clinic audit, scoring, templates, or publication workflow, it belongs to `clinic-atual`.

## Model Routing Policy

Use two levels of model effort.

### Simple execution model

Use **GPT-5.5 medium** for simple, isolated, low-risk tasks.

Examples:

- create a simple component;
- adjust copy;
- rename variables;
- create mock data;
- create small TypeScript types;
- add a button;
- fix simple CSS;
- write a short README section;
- make small mechanical refactors;
- add static placeholder content;
- update AGENTS.md, PRODUCT.md, or DESIGN.md when the instruction is straightforward.

Rules for simple tasks:

- Do not change architecture.
- Do not add dependencies unless explicitly asked.
- Do not touch unrelated files.
- Keep the diff small.
- Run lint/build if code changes are made.

### Complex planning/review model

Use **GPT-5.6 high** for complex, risky, architectural, or review-heavy tasks.

Examples:

- review a PR;
- review crawler security;
- decide database architecture;
- design the scoring system;
- implement preview generation flow;
- review publication/domain workflow;
- debug persistent errors;
- create large implementation prompts;
- review Supabase integration;
- design multi-tenant architecture;
- review before production deployment;
- implement crawler logic;
- implement authentication;
- implement storage;
- implement lead/project data model;
- implement anything involving DNS, deployment, payments, or customer data.

Rules for complex tasks:

- Plan before coding.
- Read relevant project files first.
- Explain the intended file changes before editing.
- Keep changes scoped.
- Add verification steps.
- Run lint/build/tests where applicable.
- Report risks and follow-up tasks.

## Impeccable Frontend Workflow

All frontend work must follow Impeccable guidance.

In Codex, call Impeccable as a skill with `$impeccable`, not `/impeccable`.

Before building substantial UI:

```text
$impeccable shape <target>
```

After the first UI implementation:

```text
$impeccable critique <target>
```

Before considering UI done:

```text
$impeccable polish <target>
$impeccable audit <target>
$impeccable harden <target>
```

Frontend changes must follow `PRODUCT.md` and `DESIGN.md`.

If `PRODUCT.md` or `DESIGN.md` exists, read them before implementing UI.

If they do not exist, ask for direction before implementing major UI.

## Frontend Design Rules

The UI should feel:

- calm;
- premium;
- trustworthy;
- medical-adjacent;
- precise;
- modern;
- low-friction;
- clear for non-technical clinic decision-makers.

Avoid:

- generic SaaS look;
- loud purple/blue gradients;
- AI-toy aesthetics;
- aggressive agency hype;
- excessive cards;
- nested cards;
- cheap template feel;
- tiny gray text;
- gray text on colored backgrounds;
- decorative noise;
- overused startup visuals.

The design should emphasize:

- safety;
- approval before publication;
- technical reliability;
- premium but accessible presentation;
- clear before/after transformation;
- operational reassurance.

## Task Size Rules

Break work into small tasks.

Do not implement the entire platform in one pass.

Preferred workflow:

```text
one task -> one focused diff -> verify -> report -> wait for next instruction
```

For large tasks, first create a plan and wait for approval unless the user explicitly asks to proceed.

## Current MVP Priority

The current MVP priority is:

1. Landing page.
2. Mocked admin page.
3. Mocked clinic preview page.
4. Mocked score.
5. Before/after visual preview.
6. No crawler yet.
7. No Supabase yet.
8. No authentication yet.
9. No payments yet.
10. No AI generation yet.

The first commercial objective is to create a preview page that can help sell the offer.

## Forbidden Actions Unless Explicitly Requested

Do not implement:

- crawler;
- Supabase;
- authentication;
- payments;
- email sending;
- WhatsApp automation;
- multi-tenant architecture;
- domain automation;
- DNS changes;
- production deployment;
- AI content generation;
- external API integrations;
- customer data storage;
- medical patient data handling.

Do not modify ECC unless explicitly instructed.

Do not introduce new dependencies without explaining why.

Do not store patient health data.

Do not make claims about patient acquisition, revenue growth, SEO ranking, conversion lift, or medical outcomes.

## Verification Checklist

After code changes, run:

```bash
npm run lint
npm run build
```

If tests exist, run the relevant tests.

For frontend work, also report:

- whether Impeccable was used;
- which Impeccable commands were run;
- major critique/audit findings;
- what was changed after critique;
- remaining UI risks.

## Reporting Format

After each task, report:

1. Model used.
2. Files changed.
3. Summary of changes.
4. Impeccable commands used, if any.
5. Lint/build/test results.
6. Known issues.
7. Recommended next step.

Keep the report concise and specific.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
