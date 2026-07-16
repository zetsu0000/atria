---
name: clinic-atual
description: "A calm, premium modernization platform for clinic websites in Brazil."
colors:
  clinical-ink: "#16201f"
  clinical-ink-soft: "#394845"
  surgical-teal: "#1f6f67"
  surgical-teal-deep: "#164f4a"
  approval-green: "#2f7d5b"
  diagnostic-amber: "#a96f20"
  risk-red: "#a8473d"
  clean-bg: "#f7f8f7"
  sterile-white: "#ffffff"
  cool-surface: "#eef3f1"
  border-soft: "#d9e1de"
  muted-copy: "#52625f"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 560
    lineHeight: 0.96
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 560
    lineHeight: 1.04
    letterSpacing: "-0.018em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "72px"
components:
  button-primary:
    backgroundColor: "{colors.surgical-teal}"
    textColor: "{colors.sterile-white}"
    rounded: "{rounded.md}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.surgical-teal-deep}"
    textColor: "{colors.sterile-white}"
    rounded: "{rounded.md}"
    padding: "14px 22px"
  button-secondary:
    backgroundColor: "{colors.sterile-white}"
    textColor: "{colors.clinical-ink}"
    rounded: "{rounded.md}"
    padding: "14px 22px"
  input-default:
    backgroundColor: "{colors.sterile-white}"
    textColor: "{colors.clinical-ink}"
    rounded: "{rounded.md}"
    padding: "13px 14px"
---

# Design System: clinic-atual

<!-- SEED: Strategy-first starter design system. Do not treat the default Next.js starter UI as source material. Re-run document in scan mode once real clinic-atual UI exists. -->

## 1. Overview

**Creative North Star: "The Quiet Clinical Upgrade"**

clinic-atual should feel like a precise modernization service for serious clinics: calm enough for non-technical decision-makers, premium enough to signal credibility, and practical enough to make the next step obvious. The interface is conversion-oriented, but it earns conversion through clarity, before/after evidence, approval checkpoints, and technical reassurance rather than pressure.

The system is medical-adjacent, not hospital-themed. It should borrow the discipline of clinical records, diagnostic summaries, and controlled approvals without looking sterile, cold, or institutional. Public lead-facing surfaces can be more expressive and persuasive; internal admin surfaces should become denser, more operational, and quieter while preserving the same vocabulary.

It explicitly rejects generic SaaS styling, loud purple or blue gradients, AI-toy aesthetics, aggressive agency hype, cheap template polish, tiny gray text, excessive cards, nested cards, and decorative noise.

**Key Characteristics:**
- Calm, premium, trustworthy, precise, modern, and low-friction.
- Built for Portuguese-speaking clinic owners, doctors, and managers in Brazil.
- Risk reduction is always visible: approval before publication, no downtime, and technical work handled.
- Transformation is shown concretely through audits, scores, previews, and before/after comparisons.
- Public pages guide conversion; admin pages support the founder/operator with dense status clarity.

**Layout and Spacing Principles:**
- Use full-width sections with constrained inner content instead of stacked floating cards.
- Prefer generous section rhythm on public surfaces: 72px to 120px vertical spacing on desktop, 48px to 72px on mobile.
- Keep content groups tight when they represent one decision: headline, reassurance copy, CTA, and proof should scan as a single unit.
- Use grid for true two-dimensional comparisons and dashboards; use flex for toolbars, nav, CTA rows, and wrapping metadata.
- Avoid visual clutter around high-trust moments such as approval, domain transfer, SSL, launch, and publication.

## 2. Colors

The palette is restrained and clinical with a deep teal accent, cool clean surfaces, and semantic colors for audit status. It should feel more like a premium medical operations layer than a startup landing page.

### Primary
- **Surgical Teal** (`#1f6f67`): Primary actions, selected states, approval paths, and the main brand accent. Use sparingly; its restraint is what makes it premium.
- **Deep Surgical Teal** (`#164f4a`): Hover states, active states, high-emphasis panels, and small areas where deeper confidence is needed.

### Secondary
- **Approval Green** (`#2f7d5b`): Positive audit findings, completion, launch-ready status, and "approved" moments. Do not use it as generic decoration.
- **Diagnostic Amber** (`#a96f20`): Needs-attention states, moderate audit issues, and "review before publishing" warnings.
- **Risk Red** (`#a8473d`): High-risk findings, broken trust signals, urgent website issues, and destructive actions in admin.

### Neutral
- **Clinical Ink** (`#16201f`): Primary text, serious headings, and high-confidence UI labels.
- **Soft Clinical Ink** (`#394845`): Secondary headings, metadata with meaning, and supporting content that still needs strong contrast.
- **Muted Copy** (`#52625f`): Supporting text only when contrast stays comfortably readable. Never use pale gray for body copy.
- **Clean Background** (`#f7f8f7`): Primary page background for public and admin surfaces.
- **Sterile White** (`#ffffff`): Main content surfaces, forms, modals, and comparison panes.
- **Cool Surface** (`#eef3f1`): Subtle bands, score backgrounds, nav rails, and quiet grouped areas.
- **Soft Border** (`#d9e1de`): Dividers, form borders, comparison lines, and contained elements.

### Named Rules

**The No SaaS Gradient Rule.** Do not use loud purple/blue gradients or brandless startup gradient blobs. If a gradient is needed, it must be subtle, local, and derived from neutral-to-teal clinical tones.

**The Readability First Rule.** Body copy must be dark enough to read without effort. Avoid tiny gray text, low-contrast placeholders, and pale metadata on tinted backgrounds.

**The Status Means Something Rule.** Green, amber, and red are reserved for audit and project meaning. Do not use semantic colors as decorative accents.

## 3. Typography

**Display Font:** Project system UI stack

**Body Font:** Project system UI stack

**Label Font:** Project system UI stack

**Character:** One precise sans family keeps the system calm, modern, and operational. The distinction comes from hierarchy, spacing, and copy discipline, not ornamental font pairing.

For the MVP, use the system stack already declared in `app/globals.css`. Do not add `next/font/google`, remote font requests, or font files. A locally hosted, licensed font may replace the stack in a later task after it is added to the repository intentionally.

### Hierarchy
- **Display** (560, `clamp(2.5rem, 6vw, 5rem)`, 0.96 line-height): Hero headlines and major conversion claims only. Use `text-wrap: balance`; do not exceed `-0.025em` tracking.
- **Headline** (560, `clamp(2rem, 4vw, 3.5rem)`, 1.04 line-height): Section leads, preview page summaries, and offer framing.
- **Title** (600, `1.25rem`, 1.25 line-height): Component headings, dashboard panel titles, audit category names, and comparison labels.
- **Body** (400, `1rem`, 1.65 line-height): Explanatory Portuguese copy, process reassurance, and audit descriptions. Keep prose at 65-75ch.
- **Label** (600, `0.875rem`, 1.2 line-height): Buttons, form labels, status labels, score labels, and table headers. Do not rely on all-caps labels as decoration.

### Copy Tone

Copy should be plain Brazilian Portuguese, concrete, and reassuring. Say what happens, when the clinic approves it, and who handles the technical work. Prefer "Aprovado antes da publicação", "Sem troca de hospedagem feita por você", and "Cuidamos do domínio, SSL e backup" over abstract phrases like "solução completa" or "transformação digital".

Landing pages should speak to the clinic owner or manager directly without sounding like an agency pitch. Admin UI should be short, factual, and status-oriented.

### Named Rules

**The No Hype Rule.** Avoid exaggerated claims, startup slogans, and AI-flavored language. Use proof, process, and preview evidence instead.

**The Non-Technical Rule.** Never expose implementation vocabulary when user-facing copy can say the outcome: "site seguro no ar" is better than "SSL provisionado" for leads; admin can use technical labels when they help the operator.

## 4. Elevation

Depth is mostly conveyed through tonal layering, borders, and hierarchy. Shadows are quiet and functional: they can clarify sticky navigation, focused dialogs, hover on a primary preview pane, or active menus, but they should never create ghost-card decoration.

### Shadow Vocabulary
- **Resting Surface** (`box-shadow: none`): Default for sections, audit rows, comparison panes, and admin containers.
- **Soft Lift** (`box-shadow: 0 8px 24px rgba(22, 32, 31, 0.08)`): Hover or selected preview panes where interaction needs to be clear.
- **Overlay Lift** (`box-shadow: 0 18px 48px rgba(22, 32, 31, 0.16)`): Dialogs, popovers, confirmation sheets, and blocking approval moments.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Use borders and tonal background shifts before adding shadows.

**The No Ghost Card Rule.** Do not combine a decorative 1px border with a large soft shadow on every card. Pick structural border or functional elevation, not both as ornament.

## 5. Components

Components should feel precise, familiar, and low-friction. Public components are conversion tools; internal components are operational tools. Both must share restrained shape, strong contrast, and clear states.

### Buttons
- **Shape:** 8px radius. Use consistent button geometry across public and admin surfaces.
- **Primary:** Surgical Teal background with white text, `14px 22px` padding, label weight 600. Use for one primary action per decision area: request preview, approve, publish, continue.
- **Hover / Focus:** Deep Surgical Teal on hover. Focus uses a visible 2px outline offset with a teal ring and no layout shift.
- **Secondary:** White or transparent surface, Clinical Ink text, Soft Border stroke. Use for "ver detalhes", "comparar antes/depois", and lower-commitment actions.
- **Destructive:** Risk Red only for true destructive admin actions.

### Cards / Containers
- **Corner Style:** 8px for standard containers, 12px for larger preview or score surfaces. Never use over-rounded 24px+ cards.
- **Background:** White for active content, Cool Surface for quiet grouping, Clean Background for page body.
- **Shadow Strategy:** Flat by default; Soft Lift only for interactive or selected preview panes.
- **Border:** Soft Border for structure. Avoid colored side stripes and nested cards.
- **Internal Padding:** 24px for standard panels, 32px to 40px for major public proof blocks, 16px to 20px for dense admin rows.

### Inputs / Fields
- **Style:** White background, Soft Border stroke, 8px radius, clear labels above fields.
- **Focus:** Teal focus ring with strong contrast. Do not rely on placeholder text as the only label.
- **Error / Disabled:** Errors use Risk Red with explanatory text. Disabled states must remain legible and should explain why action is unavailable when relevant.

### Navigation
- **Public Nav:** Minimal, calm, and trust-forward. Prioritize logo/name, proof/process anchors, and one clear CTA. Sticky nav may use subtle tonal separation after scroll.
- **Mobile Nav:** Keep actions obvious; do not hide the primary CTA behind complex menus.
- **Admin Nav:** Use a compact side or top navigation with clear active states, counts where useful, and predictable labels such as "Clínicas", "Previews", "Leads", and "Projetos".

### Landing Page Guidance
- Lead with the core promise: "Seu novo site de clínica, aprovado antes de ir ao ar."
- The first viewport should make the service clear, reduce risk, and expose the next step without sounding aggressive.
- Use proof-oriented sections: audit result, preview transformation, approval flow, technical handoff, and launch support.
- Avoid generic feature-card grids. If cards are used, they must represent concrete process steps or evidence.
- Show the before/after idea early. A credible preview or framed comparison is more persuasive than abstract benefit copy.

### Preview Page Guidance
- Treat the before/after preview as the highest-trust artifact. It needs generous space, clear labels, and a direct approval path.
- Comparison controls should be obvious: side-by-side on desktop, segmented before/after controls on mobile, and never hidden behind novelty interaction.
- Include reassurance near the approval action: no publication before approval, no downtime, and technical launch handled.
- Keep the preview page quiet. The website transformation should be the visual focus.

### Score / Audit UI Guidance
- Scores should feel diagnostic, not gamified. Avoid playful badges, confetti, neon meters, or AI-toy scoring visuals.
- Use clear categories such as "Primeira impressão", "Confiança", "Clareza", "Mobile", "Velocidade percebida", and "Ação de contato".
- Explain what each finding means for a clinic owner. Pair every issue with a plain-language improvement path.
- Use green, amber, and red consistently. Never communicate severity by color alone; include labels and short explanations.

### Internal Admin Dashboard Guidance
- The admin surface is product register inside a brand-led system: denser, calmer, and optimized for repeated work.
- Prioritize scanability: analyzed clinics list, score, preview status, lead status, approval state, launch state, and next action.
- Use tables or dense lists where they are more efficient than cards.
- Status labels should be precise: "Analisado", "Preview pronto", "Aguardando aprovação", "Aprovado", "Em publicação", "Publicado".
- Avoid marketing layout inside admin. The operator needs speed, filters, bulk clarity, and reliable state transitions.

## 6. Do's and Don'ts

### Do:
- **Do** keep the primary conversion path visible: audit, preview, approval, publication.
- **Do** use calm, high-contrast text and make body copy readable on every surface.
- **Do** use Surgical Teal for primary actions and selected states, not decoration.
- **Do** show concrete transformation through before/after previews and audit findings.
- **Do** keep public pages persuasive but restrained; conversion should come from trust and clarity.
- **Do** make internal admin screens denser and task-focused while preserving the same calm vocabulary.
- **Do** include visible focus states, keyboard access, readable labels, and reduced-motion alternatives.
- **Do** design mobile first for lead-facing surfaces; clinic decision-makers may review previews on a phone.
- **Do** collapse complex comparison layouts into clear mobile controls rather than forcing cramped side-by-side views.
- **Do** use motion to clarify state changes: preview transitions, score reveal, approval confirmation, and admin status updates.

### Don't:
- **Don't** make clinic-atual look like a website for one specific clinic. It is a modernization platform/service for many clinics.
- **Don't** use generic SaaS layouts, loud purple/blue gradients, overused startup visuals, or generic AI branding.
- **Don't** make the experience feel like an AI toy, developer tool, or aggressive marketing agency.
- **Don't** use excessive cards, nested cards, decorative grid backgrounds, gradient text, or colored side-stripe borders.
- **Don't** use hype language, cheap template aesthetics, vague claims, or agency-style pressure.
- **Don't** use tiny gray text or low-contrast placeholders. Supporting copy must still be comfortably readable.
- **Don't** hide technical reassurance. Domain, hosting, SSL, backup, launch support, no downtime, and approval before publication are product trust points.
- **Don't** animate decorative page-load sequences that slow users down. Motion should be 150-250ms for normal UI state changes, with reduced-motion support.
- **Don't** rely on color alone for audit severity, lead status, or project state.
- **Don't** let desktop layouts simply shrink on mobile; restructure hero, comparison, forms, nav, and admin tables for touch and narrow viewports.
