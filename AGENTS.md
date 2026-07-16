# AGENTS.md - Atria

## Project Identity

This repository and its only product are **Atria**.

Atria is a B2B product and service for modernizing clinic websites in Brazil.

Descriptor:

> Modernização digital para clínicas

The product helps clinic owners, doctors, and clinic managers in Brazil modernize their existing clinic website through:

- a first-impression audit;
- an audit/score page;
- a before/after preview;
- a specialized clinic website template;
- approval before publication;
- done-for-you domain, hosting, SSL, backup, and launch support.

Primary promise:

> Seu novo site, aprovado antes de ir ao ar.

Supporting message:

> Modernizamos o site da sua clinica, mostramos o resultado antes da publicacao e cuidamos de toda a parte tecnica.

Brand distinction:

- Atria is the primary B2B product and service.
- Atria modernizes websites for clinics.
- Atria is not a clinic, medical provider, healthcare institution, or medical practice.
- Clínica Aurora Dermatologia is only a fictional demonstration client.
- Clínica Aurora may appear only as content inside Atria's preview experience.
- Clínica Aurora must never control Atria's navigation, logo, institutional voice, product shell, visual identity, or overall page composition.

## Workspace Scope

ECC has been moved outside the Atria workspace. It is external tooling only and must not be treated as part of the application or product.

Impeccable remains available as project tooling.

All product code changes must happen inside `atria` unless explicitly instructed otherwise.

Before making changes, confirm the current working directory is `atria`.

If the task mentions frontend, product UI, preview, landing, admin dashboard, clinic audit, scoring, templates, or publication workflow, it belongs to Atria.

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

- premium;
- architectural;
- contemporary;
- restrained;
- bespoke;
- precise;
- calm;
- high-trust.

Avoid:

- generic SaaS look;
- template-based presentation;
- conventional marketing-agency aesthetics;
- hospital-like styling;
- visually dated styling;
- clinic-website composition or identity;
- AI-tool aesthetics;
- generic website-builder aesthetics;
- generic SaaS gradients;
- medical visual clichés;
- unnecessary containers;
- nested cards;
- tiny gray text;
- gray text on colored backgrounds;
- decorative noise;
- overused startup visuals.

The previous landing implementation was visually rejected. Its hero, layout, CSS, components, imagery, spacing, color choices, section composition, and responsive composition are not approved visual references and must not be reused or inferred as design direction.

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

Do not treat ECC as part of the Atria repository or application.

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
