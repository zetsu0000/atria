# Shape: Landing, Clinic Preview, and Internal Admin

Status: Confirmed  
Date: 2026-07-16  
Implementation: Separate future task; no application code belongs to this shape phase.

## 1. Feature Summary

The MVP has three connected responsive web routes:

- `/`: commercial landing page for Atria.
- `/preview/clinica-aurora`: complete public demonstration preview.
- `/admin`: simple internal operations surface.

Atria is the primary B2B product and service and the only institutional brand across the landing, navigation, product shell, visual identity, overall page composition, and product voice. Atria modernizes websites for clinics; it is not a clinic, medical provider, healthcare institution, or medical practice.

Clínica Aurora Dermatologia is only a fictional demonstration client. It may appear only as content inside Atria's preview experience. Clínica Aurora must never control Atria's navigation, logo, institutional voice, product shell, visual identity, or overall page composition.

The landing and preview lead the commercial experience. The admin exists only to help the founder or operator understand each clinic's next action and open its preview.

## 2. Strategic Lock

Primary promise:

> Seu novo site, aprovado antes de ir ao ar.

Supporting message:

> Modernizamos o site da sua clínica, mostramos o resultado antes da publicação e cuidamos de toda a parte técnica.

Primary CTA:

> Solicitar uma prévia do meu site

Secondary CTA:

> Ver exemplo de prévia

WhatsApp is a secondary support option below the main conversion path or after the preview. It is never the landing page's primary CTA.

The required demonstration notice is always visible anywhere Clínica Aurora appears:

> Demonstração fictícia — nenhuma clínica real está sendo representada.

The product must never claim more patients, increased revenue, improved conversion, improved SEO, medical superiority, medical outcomes, or other unproven quantitative results.

## 3. Primary User Action

The main action is requesting a preview of the visitor's existing clinic website. The experience should first establish this belief sequence:

1. The current website may communicate a first impression below the clinic's real quality.
2. The decision-maker can inspect a concrete alternative before deciding.
3. Nothing changes on the official website without approval.
4. The clinic does not need to manage domain, hosting, SSL, or a technical team.
5. Requesting a preview is a simple, reversible, low-risk next step.

## 4. Design Direction

The visual direction remains open for a future GPT-5.6 Sol Extra High UI/UX exploration. That exploration must start from the approved product strategy rather than the rejected landing implementation.

The final Atria interface should feel premium, architectural, contemporary, restrained, bespoke, precise, calm, and high-trust. It must not feel generic SaaS, template-based, like a conventional marketing agency, hospital-like, visually dated, like a clinic website, like an AI tool, or like a generic website builder.

Color selection remains part of the future visual-direction exploration. No mandatory brand palette, fixed brand hex values, prescribed dominant color, or mandatory semantic color tokens are defined at this stage. The selected direction must provide WCAG 2.2 AAA contrast for essential text and critical interactive or status text; clearly visible keyboard focus; distinguishable hover, active, selected, disabled, success, warning, and error states; no color-only meaning; restrained, intentional color; and no generic SaaS gradient, hospital-like palette, or medical visual cliché.

Spacing and layout also remain open. No fixed spacing scale, mandatory spacing tokens, fixed grid values, content-width lock, or predetermined section spacing is defined here. The future exploration must determine spacing rhythm, grid, gutters, content width, section density, component proportions, asymmetry, typographic rhythm, and responsive adaptation according to the selected visual direction.

The result must use sophisticated, intentional spacing; strong hierarchy; clear semantic grouping; precise optical alignment; generous whitespace where it improves clarity and perceived quality; and tighter proximity between related elements. Avoid mechanically uniform spacing, unnecessary containers, nested cards, and repetitive template-like section rhythm. Desktop, tablet, and mobile compositions must be intentional; mobile may require an independently designed adaptation rather than a stacked desktop layout. The interface must remain resilient at up to 200% zoom, use accessible touch targets, and avoid horizontal overflow.

The previous landing implementation was visually rejected. Its hero, layout, CSS, components, imagery, spacing, color choices, section composition, and responsive composition are not approved sources and must not be preserved, reused, or treated as design references.

## 5. Shared Product Shell

The landing and preview identify Atria as the product and keep one clear primary action. Clínica Aurora never occupies Atria's logo position, navigation, page identity, institutional voice, product shell, visual identity, or overall page composition.

Shared presentation rules:

- Preserve unmistakable separation between the Atria product shell and clinic demonstration content.
- Use icons only where they clarify a known action or state.
- Keep states distinguishable without relying on color alone.
- Avoid unnecessary containers, nested cards, glass effects, decorative grids, gradient text, hero metrics, generic medical stock imagery, medical visual clichés, and generic SaaS gradients.
- Let the future visual-direction exploration determine palette, typography, spacing, grid, content width, proportions, and responsive composition.

## 6. Landing Route

### Content Requirements

The future visual-direction exploration determines the landing's composition, hierarchy, section treatment, and responsive adaptation. The experience must include:

- Atria navigation and a clear primary CTA;
- the primary promise, supporting message, primary CTA, and secondary CTA;
- before-and-after evidence using Clínica Aurora with the fictional notice attached to the artifact;
- three plain-language opportunities: first impression, clarity, and mobile experience;
- the Preview Seguro method: audit, proposal, adjustments, approval, and technical publication;
- operational reassurance: the current site remains active, nothing publishes without approval, the domain remains controlled, and technical work is handled;
- a short request form;
- secondary WhatsApp support and a restrained footer.

The first viewport must identify Atria, communicate its descriptor or category and primary promise, and make the primary CTA clear. Its composition must be established by the future visual-direction exploration and must not resemble Clínica Aurora's clinic website or reuse the rejected landing.

### Opening Experience

The promise, CTA, and preview evidence must establish Atria's offer without copying the rejected landing's hero or composition. Do not use an unrelated promotional photograph or a generic medical illustration. The clinic's visual identity remains contained inside the rendered website frames.

### Demonstration Module

Antes and Proposta must remain easy to find, compare, and understand across desktop, tablet, mobile, and zoomed layouts. The future exploration chooses the comparison model for each context. Do not require novelty interaction, hide either state, lose context during switching, or obscure the fictional notice.

### Diagnostic Context

Show three opportunities only. Each includes a category name, a short observation, and a plain-language improvement. A small demonstrative score may provide context, but it never becomes a giant number, circular meter, badge, or gamified centerpiece.

### Request Form

Required fields:

- Nome
- Nome da clínica
- Cargo ou função
- Cidade e estado
- URL atual do site
- WhatsApp
- E-mail
- Consentimento de contato

Optional field:

- O que mais incomoda no site atual?

Role options are Médico proprietário, Sócio, Gestor, Marketing, and Outro. Do not ask for CRM, RQE, documents, domain access, photos, budget, patient counts, health information, or sensitive data.

Consent copy:

> Autorizo a Atria a entrar em contato sobre esta solicitação de prévia.

Success copy:

> Recebemos seu pedido. Vamos analisar o site informado e entrar em contato com os próximos passos.

Validation messages name the problem and correction. Preserve entered values after any error. Focus the first invalid field after submission and provide an error summary for screen-reader and keyboard users.

## 7. Preview Route

The preview is an Atria product surface that contains a Clínica Aurora demonstration. The product identity remains clear and labels the page as a demonstration preview.

Required content and capabilities:

- clear Atria page identity and context;
- a persistent fictional demonstration notice;
- accessible Antes and Proposta website views;
- explanatory content titled O que mudou e por quê;
- three changes linked to first impression, clarity, and mobile experience;
- reassurance near the CTA that nothing is published without approval;
- the commercial CTA Solicitar uma prévia como esta.

The future visual-direction exploration determines how these elements are composed and how comparison adapts across desktop, tablet, mobile, and zoomed layouts. Actions must remain reachable without covering content, and switching views must preserve context where switching is used.

The demo route must not offer a fake approval or imply that a fictional site will be published. It may explain the future approval controls, but its actionable conversion is requesting a preview for the visitor's own clinic.

## 8. Admin Route

The admin is a product-register surface with simple operational depth. Its primary task is identifying the next action for each clinic and opening the relevant preview.

Required information and capabilities:

- page context and clinic search;
- filters for lead stage, preview status, and next action, including an active-filter count;
- Clínica, Cidade, Score, Lead, Preview, Próxima ação, and Atualizado data;
- selected-clinic details without unnecessary loss of queue context;
- status updates with clear pending, success, and failure feedback;
- a direct Abrir preview action.

The future visual-direction exploration determines whether tables, lists, panels, sheets, popovers, or other appropriate patterns best support each viewport. Mobile must prioritize clinic, preview status, and next action without compressing a desktop table or causing horizontal overflow.

Use 9-13 fictional clinic records in the typical mock dataset and vary specialty, city, score, lead stage, preview status, commercial status, and next action. Clínica Aurora remains confined to Atria's demonstration preview experience and must not become an admin brand or clinic record.

Admin scope excludes site editing, automation, email sequences, analytics, permissions, multi-user support, integrations, automatic generation, custom workflows, and complex settings.

## 9. Interaction Model

- The landing primary CTA moves to and focuses the request form.
- Ver exemplo de prévia opens the complete Clínica Aurora preview.
- The comparison interaction adapts intentionally to each viewport, preserves context, remains keyboard and screen-reader operable, and does not rely on novelty interaction.
- Admin filters update the visible set without losing current filter context.
- Selecting an admin row exposes details without navigating away from the queue.
- Status changes provide immediate feedback and remain reversible during the pending state where practical.
- UI transitions communicate state only and do not delay task completion.
- Reduced-motion mode removes non-essential transitions and preserves all feedback.

## 10. Key States

Landing:

- Default, focused field, invalid field, submitting, success, and network failure.
- Long clinic names, long URLs, and mobile keyboard behavior.

Preview:

- Loading skeleton, ready comparison, active Antes, active Proposta, and unavailable screenshot.
- The comparison presentations selected during future visual exploration for desktop, tablet, mobile, and zoomed layouts.

Admin:

- Loading skeleton, populated list, no clinics, no filter results, fetch error, no next action, status update pending, status update success, and status update failure.
- Long clinic names and large status labels without layout shift.

Loading states use skeletons rather than isolated central spinners. Empty states teach the next available action. Errors retain context and provide a retry action.

## 11. Content and Media Requirements

Clínica Aurora needs two complete website representations:

- Antes: credible but dated, unclear, and weaker on mobile without becoming a caricature.
- Proposta: calm, contemporary, accessible, and clearly improved in hierarchy and usability.

Required media roles:

- Full-page desktop and mobile screenshots for both clinic versions.
- One or two clinic-environment raster images for the proposed site.
- A contained fictional clinic logo used only inside its website.
- Product UI captures for the landing demonstration.

Future implementation may use generated raster images for architecture, reception, or material details. Avoid clinician portraits, treatment close-ups, idealized patients, before-and-after skin imagery, or any image that implies medical outcomes. Do not substitute blank color panels for required website content.

## 12. Accessibility Contract

The three routes must meet these accessibility requirements:

- Complete keyboard operation and visible focus.
- WCAG 2.2 AAA contrast for essential text.
- WCAG 2.2 AAA contrast for critical interactive and status text.
- Semantic landmarks and heading hierarchy.
- Clearly visible keyboard focus and distinguishable hover, active, selected, disabled, success, warning, and error states.
- Touch targets sized for mobile use.
- Form labels, field-level errors, and an accessible error summary.
- Screen-reader names for comparison and admin controls.
- No essential information available only on hover.
- No meaning communicated by color alone.
- Score always accompanied by explanatory text.
- Responsive reflow and zoom up to 200% without lost content, lost actions, overlap, or horizontal page scrolling.
- Reduced-motion support with equivalent non-motion feedback.
- The fictional and publication notices remain discoverable and unambiguous.

## 13. Acceptance Criteria

- A first-time visitor can identify Atria, its descriptor or category, promise, and primary CTA within the first viewport.
- Clínica Aurora never replaces Atria in navigation, logo, institutional voice, product shell, visual identity, overall page composition, or brand hierarchy.
- Every appearance of Clínica Aurora carries the required fictional notice.
- Before-and-after evidence is visually stronger than the score.
- The public demo preview converts to requesting a personal preview rather than simulating approval.
- The landing form includes only the confirmed fields and preserves user input on error.
- Admin users can find the next action, filter records, update status, view details, and open a preview.
- Desktop, tablet, and mobile compositions are intentional; mobile adaptation is designed independently where necessary rather than merely stacking or shrinking desktop.
- No unsupported medical or commercial claim appears in copy or imagery.
- Keyboard, screen-reader, contrast, motion, and responsive checks meet the accessibility contract.

## 14. Implementation Handoff

Implement in focused tasks rather than one platform-wide diff:

1. Shared foundations: approved product shell and visual foundations, mock types, mock clinic data, and reusable demonstration notice.
2. Landing route: conversion narrative, before-and-after module, reassurance, and request form.
3. Preview route: complete Clínica Aurora comparison and explanatory context.
4. Admin route: operational list, filters, detail panel, status changes, and preview link.
5. Integrated verification: responsive behavior, accessibility, copy guardrails, and cross-route continuity.

Each future implementation task should run the relevant Impeccable flow and finish with lint and build verification. This shape task does not run craft, critique, polish, audit, or harden and does not create visual probes.
