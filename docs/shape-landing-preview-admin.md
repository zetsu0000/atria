# Shape: Landing, Clinic Preview, and Internal Admin

Status: Confirmed  
Date: 2026-07-16  
Implementation: Separate future task; no application code belongs to this shape phase.

## 1. Feature Summary

The MVP has three connected responsive web routes:

- `/`: commercial landing page for Clínica Atual.
- `/preview/clinica-aurora`: complete public demonstration preview.
- `/admin`: simple internal operations surface.

Clínica Atual is the B2B product and the only institutional brand across the landing, navigation, page shell, and product voice. Clínica Aurora Dermatologia is a recurring fictional demonstration used only inside before-and-after artifacts, the full preview, and mock admin records.

The landing and preview lead the commercial experience. The admin exists only to help the founder or operator understand each clinic's next action and open its preview.

## 2. Strategic Lock

Primary promise:

> Seu novo site de clínica, aprovado antes de ir ao ar.

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

Direction A, Preview Dominant, is the lead. It is moderated by the whitespace, calm pacing, and low cognitive load of direction B. Direction C contributes diagnostic context and plain-language explanations without allowing the score to compete with the preview.

Color strategy:

- Landing: Committed. Surgical teal owns the product-led hero area, balanced by a large clear preview artifact and generous neutral space.
- Preview: Restrained. The clinic transformation is the visual focus; product chrome stays quiet.
- Admin: Restrained. Color communicates action or status, never decoration.

Theme scene:

A clinic owner or manager reviews the proposal on a laptop or phone in a bright clinic during business hours, with limited time and focused attention. This requires a light theme, immediate hierarchy, firm contrast, short copy, obvious actions, and a mobile experience equal in importance to desktop.

Reference qualities:

- Stripe: hierarchy, trust, and finish.
- Linear: precision, rhythm, and consistency.
- Doctolib and mature digital-health products: accessible clarity for non-technical users.

These references are quality anchors, not templates to copy.

Typography uses the system stack already defined in `app/globals.css`. Do not introduce `next/font/google`, remote fonts, or new font files. Hierarchy comes from weight, scale, spacing, and line length.

## 5. Shared Product Shell

The landing and preview use the Clínica Atual wordmark, restrained navigation, and one clear primary action. Clínica Aurora never occupies the product logo position, primary navigation, page title, or institutional voice.

Shared presentation rules:

- Use full-width bands and unframed layouts before cards.
- Keep containers to 8-12px radii.
- Keep body copy within 65-75 characters per line.
- Use surgical teal for primary actions and selected states.
- Reserve green, amber, and red for meaningful status.
- Use icons only where they clarify a known action or state.
- Avoid nested cards, glass effects, decorative grids, gradient text, hero metrics, generic medical stock imagery, and dark product chrome.

## 6. Landing Route

### Information Architecture

1. Clínica Atual navigation with product anchors and the primary CTA.
2. Hero with the primary promise, supporting message, primary CTA, and secondary CTA.
3. Early before-and-after demonstration of Clínica Aurora with the fictional notice attached to the artifact.
4. Three plain-language opportunities: first impression, clarity, and mobile experience.
5. Preview Seguro method: audit, proposal, adjustments, approval, and technical publication.
6. Operational reassurance: current site remains active, nothing publishes without approval, domain remains controlled, and technical work is handled.
7. Short request form.
8. Secondary WhatsApp support and restrained footer.

The first viewport must identify Clínica Atual as a website-modernization platform and show enough of the before-and-after artifact to make the next section visible. It must not resemble Clínica Aurora's clinic website.

### Hero

The promise and CTA lead; the product preview is the primary visual proof. Do not use an unrelated hero photograph or a generic medical illustration. The clinic's visual identity remains contained inside the rendered website frames.

### Demonstration Module

Desktop shows Antes and Proposta simultaneously with equally readable labels and no novelty interaction required. Mobile uses a segmented control while preserving scroll position and context. The fictional notice remains visible in both modes.

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

> Autorizo a Clínica Atual a entrar em contato sobre esta solicitação de prévia.

Success copy:

> Recebemos seu pedido. Vamos analisar o site informado e entrar em contato com os próximos passos.

Validation messages name the problem and correction. Preserve entered values after any error. Focus the first invalid field after submission and provide an error summary for screen-reader and keyboard users.

## 7. Preview Route

The preview is a Clínica Atual product surface that contains a Clínica Aurora demonstration. The product header remains visible and labels the page as a demonstration preview.

Desktop layout:

- Quiet product header with page context and CTA.
- Persistent fictional demonstration notice.
- Large side-by-side Antes and Proposta website views.
- Narrow explanatory area titled O que mudou e por quê.
- Three changes linked to first impression, clarity, and mobile experience.
- Reassurance near the CTA: nothing is published without approval.
- Commercial CTA: Solicitar uma prévia como esta.

Mobile layout:

- Sticky but compact Antes / Proposta segmented control.
- One full-width website view at a time.
- Change explanations below the active view.
- The CTA follows the evidence and remains reachable without covering content.

The demo route must not offer a fake approval or imply that a fictional site will be published. It may explain the future approval controls, but its actionable conversion is requesting a preview for the visitor's own clinic.

## 8. Admin Route

The admin is a product-register surface with simple operational depth. Its primary task is identifying the next action for each clinic and opening the relevant preview.

Desktop structure:

- Compact top bar with page title and clinic search.
- Filter toolbar for lead stage, preview status, and next action.
- Dense table or list with Clínica, Cidade, Score, Lead, Preview, Próxima ação, and Atualizado.
- Selected-row detail panel that preserves list context.
- Inline status update with clear pending, success, and failure feedback.
- Direct Abrir preview action.

Mobile structure:

- Prioritized list rather than a compressed desktop table.
- Each row shows clinic, preview status, and next action first.
- Secondary fields expand inline.
- Filters open in an accessible sheet or popover and show an active-filter count.

Use 9-13 fictional clinics in the typical mock dataset, including Clínica Aurora. Vary specialty, city, score, lead stage, preview status, commercial status, and next action. Clínica Aurora carries the fictional notice when its detail or preview is open.

Admin scope excludes site editing, automation, email sequences, analytics, permissions, multi-user support, integrations, automatic generation, custom workflows, and complex settings.

## 9. Interaction Model

- The landing primary CTA moves to and focuses the request form.
- Ver exemplo de prévia opens the complete Clínica Aurora preview.
- The desktop comparison remains side by side; mobile changes view through a semantic segmented control.
- Admin filters update the visible set without losing current filter context.
- Selecting an admin row exposes details without navigating away from the queue.
- Status changes provide immediate feedback and remain reversible during the pending state where practical.
- Normal UI transitions last 150-250ms and communicate state only.
- Reduced-motion mode removes non-essential transitions and preserves all feedback.

## 10. Key States

Landing:

- Default, focused field, invalid field, submitting, success, and network failure.
- Long clinic names, long URLs, and mobile keyboard behavior.

Preview:

- Loading skeleton, ready comparison, active Antes, active Proposta, and unavailable screenshot.
- Desktop side-by-side and mobile segmented presentation.

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

The three routes target WCAG 2.2 AA:

- Complete keyboard operation and visible focus.
- Semantic landmarks and heading hierarchy.
- Sufficient text, control, placeholder, and focus contrast.
- Touch targets sized for mobile use.
- Form labels, field-level errors, and an accessible error summary.
- Screen-reader names for comparison and admin controls.
- No essential information available only on hover.
- No meaning communicated by color alone.
- Score always accompanied by explanatory text.
- Responsive reflow and zoom without lost actions or horizontal page scrolling.
- The fictional and publication notices remain discoverable and unambiguous.

## 13. Acceptance Criteria

- A first-time visitor can identify Clínica Atual, its category, promise, and primary CTA within the first viewport.
- Clínica Aurora never replaces Clínica Atual in institutional navigation or brand hierarchy.
- Every appearance of Clínica Aurora carries the required fictional notice.
- Before-and-after evidence is visually stronger than the score.
- The public demo preview converts to requesting a personal preview rather than simulating approval.
- The landing form includes only the confirmed fields and preserves user input on error.
- Admin users can find the next action, filter records, update status, view details, and open a preview.
- Mobile layouts restructure comparisons and admin data instead of shrinking desktop layouts.
- No unsupported medical or commercial claim appears in copy or imagery.
- No remote or bundled font is added; the existing system stack is used.
- Keyboard, screen-reader, contrast, motion, and responsive checks meet the accessibility contract.

## 14. Implementation Handoff

Implement in focused tasks rather than one platform-wide diff:

1. Shared foundations: product shell, tokens, mock types, mock clinic data, and reusable demonstration notice.
2. Landing route: conversion narrative, before-and-after module, reassurance, and request form.
3. Preview route: complete Clínica Aurora comparison and explanatory context.
4. Admin route: operational list, filters, detail panel, status changes, and preview link.
5. Integrated verification: responsive behavior, accessibility, copy guardrails, and cross-route continuity.

Each implementation task should run the relevant Impeccable flow and finish with lint and build verification. Recommended implementation references are `layout.md`, `adapt.md`, `clarify.md`, `harden.md`, `polish.md`, and `audit.md`; use the brand register for landing and preview, and the product register for admin.
