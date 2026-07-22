# Manual Outreach Pack

The final operator-facing artifact used immediately before a human
manually contacts a clinic. It is the last step in the crawler pipeline
before any human sends anything — no automatic sending exists anywhere
in this codebase.

## Purpose

Every earlier artifact in this pipeline (operational report, human
review pack) is *preparation* material generated before a decision
exists. The Manual Outreach Pack is different: it can only be produced
**after** a human has already recorded an `approved` review decision and
the specific outreach draft(s) about to be handed to an operator have
been independently re-validated. It exists so that:

- the copy an operator is about to paste into WhatsApp/email is
  guaranteed to be the exact, already-approved persisted draft — never a
  freshly re-derived approximation of it that could have silently
  drifted from what was actually reviewed;
- generation itself is impossible unless the current, real-time state
  (decision + outreach message status + do_not_contact) still passes —
  not just "was approved at some point in the past."

## Why this pack is required before contact

Two earlier tasks in this pipeline (`docs/technical/crawler-skinlaser-review-copy-polish.md`,
`docs/technical/crawler-skinlaser-human-approval.md`) established that
copy quality and review-decision recording are separate, sequential
human actions. This pack is the third and final gate: it re-checks
*both* of those, live, at generation time, and only then assembles the
document an operator actually works from.

## Approval gate dependency

Generation calls the existing read-only outreach approval gate
(`canPrepareOutreachForSend`, `lib/operations/outreach/approval-gate.ts`)
for every requested channel — nothing new was invented for this check.
That gate already enforces:

1. The clinic exists.
2. The outreach message exists and belongs to that clinic.
3. Neither the clinic nor the message is `do_not_contact` blocked.
4. The message's own status is still a sendable candidate (`draft` or
   `approved` — never `sent`/`rejected`/`ignored`/`replied`).
5. The clinic's *latest* `human_review_decisions` row is `approved`.

This builder (`lib/operations/manual-outreach/build-manual-outreach-pack.ts`)
adds exactly one check the gate itself doesn't do: that a resolved
message's own `channel` matches what was actually requested (so
`--outreach-message-id` can't be pointed at an email draft while asking
for `--channel whatsapp`).

**If every requested channel is blocked, no pack is built at all** —
`buildManualOutreachPack` returns `ok: false` and no copy is ever
computed, matching the task's core rule ("if the gate does not pass, the
pack MUST NOT be generated"). If some channels pass and others don't
(`--channel both` with a mixed result), a pack *is* built with
`status: "partial_blocked"`, but the blocked channel's section carries
only the block reason — its copy is never surfaced.

## Output sections

1. Operator summary
2. Clinic identity
3. Website analyzed
4. Approval status (the clinic-level decision the gate relied on)
5. Approval gate result (one row per requested channel)
6. Score summary
7. Key evidence summary (first evidence reason per score dimension)
8. Screenshot asset references (metadata only — see below)
9. Risk flags
10. Final WhatsApp copy
11. Final email copy
12. Click-to-chat WhatsApp link (part of the WhatsApp copy section, when the persisted draft has one)
13. Manual sending checklist
14. Post-send logging checklist
15. Required disclaimer (`SCORE_DISCLAIMER`, verbatim)

## Copy standards

Copy is **never freshly generated** by this builder — it is always the
verbatim `body`/`subject`/`click_to_chat_url` of the exact
`outreach_messages` row that just passed the approval gate. This is a
deliberate design choice: the copy quality standard (short, human,
non-spammy, no medical claims, no invented testimonials, no pressure
language) was already established and tested in
`lib/outreach/draft.test.ts` and
`docs/technical/crawler-skinlaser-review-copy-polish.md`; re-deriving
copy here would risk showing the operator something different from what
was actually reviewed and approved.

Two flags control what's shown *around* the copy, never inside it:

- **`--include-score-in-copy`** (default off): when on, adds a separate
  `internalScoreNote` field next to the copy — clearly labeled "uso
  interno — não incluir na mensagem" — with the score total. The
  persisted message `body` itself is never rewritten by this flag.
- **`--include-screenshot-links`** (default off): when on, surfaces the
  screenshot's private Supabase Storage path in the screenshots section.
  This is never a public or signed URL — no signed-URL generation exists
  anywhere in this codebase (confirmed by
  `lib/operations/screenshot-assets-pipeline.test.ts`'s own check that
  `getPublicUrl` is never called), and this pack doesn't add any. With
  the flag off, only `status`/`assetId`/`capturedAt` are shown.

## Operator checklist (section 13)

- Nome da clínica confirmado.
- Website confirmado.
- Última decisão de revisão humana está approved.
- Approval gate passou para o(s) canal(is) usado(s).
- Copy de WhatsApp/e-mail revisada manualmente antes do envio.
- Nenhuma alegação de qualidade médica presente.
- Nenhuma alegação/depoimento inventado presente.
- Nenhuma linguagem de pressão ou urgência presente.
- Screenshots não anexados, a menos que aprovados manualmente.
- Operador enviará manualmente — este pacote não envia nada.
- Operador registrará o resultado após o envio.

## Post-send logging checklist (section 14)

- Canal usado.
- Data/hora do envio.
- Nome/iniciais do operador.
- Resposta recebida: sim/não.
- Follow-up necessário: sim/não.
- Notas registradas fora deste pacote ou em um sistema de logging futuro.

This checklist is **text only** — it is not backed by any persistence in
this task. `OutreachRepository` already exposes `markReplied` and
`markIgnored` state transitions that a *future*, separately-triggered,
explicitly human-invoked command could call after a real send, but
wiring that up was out of scope here (the task explicitly says not to
implement actual send logging unless an existing safe repository already
supports the full shape needed, and there is no field anywhere for
"operator name" or free-text post-send notes). See Future work below.

## No-send policy

- The builder (`buildManualOutreachPack`) is read-only: it only calls
  `getClinic`, `getMessage`/`listForClinic`,
  `getLatestDecisionForClinic`, and the approval gate (itself read-only).
  It never calls `createDraft`, `approve`, `markSent`, `markReplied`,
  `markIgnored`, or `recordDecision`.
- Tests 21–22 in `lib/operations/manual-outreach-pack.test.ts` assert
  this directly: repository row counts are unchanged before/after
  generation (allowed and blocked paths), and the four send-adjacent
  repository methods (`markSent`, `approve`, `createDraft`,
  `recordDecision`) are proven to never be called, by monkey-patching
  them and asserting the call flags stay false.
- No provider integration (WhatsApp Business API, email sender) exists
  anywhere in this codebase — sending remains a manual, human action
  outside this foundation entirely.

## Staging validation result

Run against the real SkinLaser staging data (clinic
`bbfd72a3-a013-4a6c-bd82-4a70479d694a`, decision
`bbf7e956-7564-479b-a892-00da2a06c2e4` approved, WhatsApp draft
`ca0c3fba-86ac-442c-afb5-276552287177`, email draft
`ba53a89a-f73e-4eb9-86e6-ed05191b4378`):

```
npm run crawler:manual-outreach-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --output markdown --write-artifact
npm run crawler:manual-outreach-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --output json --write-artifact
```

Both regenerated successfully, `status: "ready"`, written only to the
gitignored `artifacts/manual-outreach-packs/bbfd72a3-a013-4a6c-bd82-4a70479d694a.{md,json}`.

- **Approval gate for WhatsApp draft** (`ca0c3fba-...`): `allowed`,
  reason "Clinic is not do_not_contact, the outreach message is in a
  sendable state, and the latest human review decision is approved."
- **Approval gate for email draft** (`ba53a89a-...`): `allowed`, same
  reason.
- **Outreach messages after generation:** re-queried directly (REST) —
  all 6 rows for this clinic still `status: "draft"`. No transition
  occurred.
- **Review decision after generation:** re-queried directly — still
  exactly 2 rows, latest is `bbf7e956-7564-479b-a892-00da2a06c2e4`
  (`approved`), unchanged by generation.
- Score summary in the pack: 80/100 (v1) — matches the currently
  persisted score exactly.
- Risk flags surfaced: `crawl_partial` (medium, unrelated to this task —
  the crawl was bounded to 1 page) and `requires_human_review` (info,
  standing flag).

## Limitations

- Copy is sourced from whichever `outreach_messages` row is latest for a
  channel (or an explicit `--outreach-message-id` for a single channel)
  — it does not re-validate that the copy still matches the *current*
  score/evidence if either changed after the draft was persisted. In
  practice this is intentional: the draft that was gate-approved is what
  gets shown, not a re-derived one.
- `--outreach-message-id` cannot be used with `--channel both` (refused
  as ambiguous — one id can't disambiguate two channels). Use a single
  `--channel whatsapp`/`--channel email` call if you need to pin an
  exact message id.
- No actual send or post-send logging is performed or persisted by this
  pack — see Future work.

## Future work

- A separate, explicitly human-triggered "record outreach outcome" CLI
  that calls `OutreachRepository.markReplied`/`markIgnored` (both
  already exist) after a real manual send, plus a small schema addition
  for `sentAt`/`sentBy`/free-text notes if that level of detail is
  wanted — deliberately not built here, since this task's pack is
  read-only by design and adding persistence was explicitly out of
  scope.
- A real send integration (WhatsApp Business API / email provider) is
  intentionally not planned as part of this foundation; sending remains
  a manual, human action.

## Files changed

- `lib/operations/manual-outreach/types.ts` (new)
- `lib/operations/manual-outreach/build-manual-outreach-pack.ts` (new)
- `lib/operations/manual-outreach/render-manual-outreach-pack-markdown.ts` (new)
- `lib/operations/manual-outreach-pack.test.ts` (new — 27 tests; kept one
  level under `lib/operations/` rather than nested under
  `lib/operations/manual-outreach/`, matching the documented `npm test`
  glob-depth convention already used by `review-queue.test.ts`,
  `human-review-pack.test.ts`, and `outreach-approval-gate.test.ts`)
- `scripts/crawler/generate-manual-outreach-pack.ts` (new)
- `package.json` (+ `crawler:manual-outreach-pack` script entry)
- `.gitignore` (+ `/artifacts/manual-outreach-packs/`)

## Verification

- `npm test` — 344/344 passing (27 new tests added, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — every command went through `lib/operations/pipeline/target-guard.ts`'s `KNOWN_PROJECT_REFS` guard, and staging (`lfkyiztuwptmddsraucg`) was reconfirmed via `supabase/.temp/project-ref` before any staging command.
- No crawl was performed — this pack only reads already-persisted data.
- No Google Places/SERP call was made.
- No outreach was sent — all 6 outreach drafts for SkinLaser re-confirmed `status: "draft"` after generation; no send-capable code path exists anywhere in this pack.
- No secrets were stored in any file, log, or this document.
