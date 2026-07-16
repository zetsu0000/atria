---
name: atria
description: "Modernização digital para clínicas"
status: strategic-direction
---

# Design Direction: Atria

This document defines strategic experience and quality requirements. It is not a token specification and does not lock a visual direction before exploration.

## 1. Product and Brand Boundary

**Descriptor:** Modernização digital para clínicas

**Primary promise:** Seu novo site, aprovado antes de ir ao ar.

Atria is the primary B2B product and service. It modernizes websites for clinics, but it is not a clinic, medical provider, healthcare institution, or medical practice.

Clínica Aurora Dermatologia is only a fictional demonstration client. It may appear only as content inside Atria's preview experience. Clínica Aurora must never control Atria's navigation, logo, institutional voice, product shell, visual identity, or overall page composition.

The Atria brand and product shell must remain visually and semantically distinct from every clinic shown in a preview. Demonstration content must never make Atria look like the website of a specific clinic.

## 2. Product Experience

Atria earns trust through a concrete preview, transparent audit context, explicit approval checkpoints, and clear technical reassurance. The experience should help a non-technical clinic decision-maker understand:

- what could improve in the clinic's current website;
- what the proposed site could look like;
- that nothing is published without approval;
- that Atria handles the technical publication work;
- what the next reversible action is.

Public surfaces prioritize the commercial story and preview evidence. The internal admin prioritizes operational scanability and clear next actions. Both belong to the same Atria product, but their density and task emphasis may differ.

## 3. Desired Visual Character

The final Atria interface should feel:

- premium;
- architectural;
- contemporary;
- restrained;
- bespoke;
- precise;
- calm;
- high-trust.

It must not feel:

- generic SaaS;
- template-based;
- like a conventional marketing agency;
- hospital-like;
- visually dated;
- like a clinic website;
- like an AI tool;
- like a generic website builder.

Avoid generic SaaS gradients, medical visual clichés, decorative noise, excessive containers, nested cards, repetitive feature grids, cheap template polish, tiny low-contrast text, pressure tactics, and visual cues that imply unproven medical or commercial outcomes.

## 4. Visual Direction Remains Open

The future GPT-5.6 Sol Extra High UI/UX exploration must determine the visual direction from the approved product strategy. The strategic documentation deliberately does not prescribe a palette, dominant color, spacing scale, grid, section rhythm, component proportions, or typographic rhythm.

### Color

Color selection remains part of future visual-direction exploration. No mandatory brand palette, fixed brand hex values, prescribed dominant color, or mandatory semantic color tokens are defined at this stage.

Whatever palette is selected must:

- achieve WCAG 2.2 AAA contrast for essential text;
- achieve WCAG 2.2 AAA contrast for critical interactive and status text;
- provide clearly visible keyboard focus;
- keep hover, active, selected, disabled, success, warning, and error states distinguishable;
- communicate no meaning through color alone;
- use color with restraint and intention;
- avoid generic SaaS gradients;
- avoid hospital-like palettes;
- avoid medical visual clichés.

### Spacing, Layout, and Responsive Composition

No fixed spacing scale, mandatory spacing tokens, fixed grid values, content-width lock, or predetermined section spacing is defined here. The future UI/UX exploration must determine:

- spacing rhythm;
- grid;
- gutters;
- content width;
- section density;
- component proportions;
- asymmetry;
- typographic rhythm;
- responsive adaptation.

The selected system must provide:

- sophisticated and intentional spacing;
- strong visual hierarchy;
- clear semantic grouping;
- precise optical alignment;
- generous whitespace where it improves clarity and perceived quality;
- tighter proximity between semantically related elements;
- no mechanically uniform spacing;
- no unnecessary containers;
- no nested cards;
- no repetitive, template-like section rhythm;
- intentional desktop, tablet, and mobile compositions;
- mobile adaptation designed independently where necessary rather than merely stacking desktop;
- zoom resilience up to 200%;
- accessible touch targets;
- no horizontal overflow.

### Typography and Shape

Typeface selection, type scale, typographic rhythm, corner treatment, elevation, and component geometry remain part of the future visual direction. They must support confident hierarchy, effortless reading, precise alignment, and a bespoke Atria identity without borrowing from clinic or hospital conventions.

## 5. Content and Interaction Principles

### Voice

Use plain Brazilian Portuguese, concrete outcomes, and predictable next steps. Explain what happens, when approval is required, and who handles technical work. Avoid implementation jargon, startup slogans, AI-flavored language, agency hype, and unsupported claims.

### Risk Reversal

Approval before publication, no unapproved changes, and handled technical work are core trust points. Keep them visible near consequential actions without repeating them mechanically or overwhelming the page.

### Preview and Audit

The before-and-after preview is the primary proof artifact. Give it enough visual priority and context to be understood without novelty interaction. Scores must feel diagnostic rather than gamified, and every score or status must include a plain-language label and explanation.

### Components and States

Components should be familiar enough to use without instruction and distinctive enough to belong to Atria. Every interactive component must expose clear default, hover, active, focus, selected, disabled, pending, success, warning, and error behavior where relevant. State changes must remain understandable without color, motion, or hover alone.

### Public Navigation

Navigation must identify Atria, orient the user, and keep the primary next action clear. A fictional clinic may never occupy Atria's logo position, navigation, page identity, or institutional voice.

### Internal Admin

The admin is an Atria operational surface, not a marketing page and not a clinic dashboard. Prioritize scanability, precise labels, status clarity, and the next action. Use structured lists or tables when they communicate operational information more efficiently than cards.

## 6. Accessibility Contract

- Support complete keyboard operation and clearly visible focus.
- Meet WCAG 2.2 AAA contrast for essential text and critical interactive or status text.
- Preserve semantic landmarks, heading hierarchy, accessible names, and logical reading order.
- Keep essential information available without hover and avoid color-only meaning.
- Provide clear labels, field-level errors, error summaries, and retained form values after validation failures.
- Keep touch targets accessible and controls operable across desktop, tablet, and mobile.
- Support responsive reflow and zoom up to 200% without lost content, lost actions, overlap, or horizontal overflow.
- Respect reduced-motion preferences and preserve equivalent feedback when motion is reduced.
- Pair audit scores, statuses, and visual indicators with explanatory text.
- Keep fictional-demonstration and publication notices explicit, discoverable, and unambiguous.

## 7. Rejected Implementation Boundary

The previous landing implementation was visually rejected and is not an approved source for future exploration. Do not preserve, reuse, or infer design direction from its hero, layout, CSS, components, imagery, spacing, colors, section composition, or responsive composition.

Future visual probes must begin from this strategic document, `PRODUCT.md`, and the approved product requirements in `docs/shape-landing-preview-admin.md`. They must not treat production UI code as visual reference material.

## 8. Product-Specific Guardrails

- Keep Atria's identity dominant over all fictional clinic content.
- Show transformation through honest preview evidence and plain-language audit findings.
- Keep conversion calm, clear, and reversible.
- Do not imply more patients, increased revenue, conversion lift, SEO improvement, medical outcomes, or other unsupported results.
- Do not use clinician portraits, treatment imagery, patient transformations, or imagery that implies medical outcomes as generic persuasion.
- Do not make a fictional demonstration look like a real customer case study.
- Do not let any clinic demonstration determine Atria's overall page composition or visual identity.
