# SkinLaser review copy polish

Polishes the WhatsApp and email outreach copy used in SkinLaser's human
review pack so it reads as short, human, and non-spammy — a small,
specific observation about digital presence, not an automated evidence
dump. **Does not change the review decision. Does not send anything.**

## Source report/review pack used

The pre-polish review pack for SkinLaser - Higienopolis
(`bbfd72a3-a013-4a6c-bd82-4a70479d694a`), regenerated via
`npm run crawler:review-pack -- --target staging --clinic-id
bbfd72a3-a013-4a6c-bd82-4a70479d694a --output markdown`, built from the
same crawl job and v1 score used by the previous task
(`docs/technical/crawler-score-v1-staging-recalculation.md`): crawl job
`81a7b754-e9d9-40d7-b89d-83f1ca2c53a4`, score `12fd6a90-2131-4707-8ef4-796c93867afd`
(v1, 80/100).

Before this task, the pack's WhatsApp draft (freshly generated, never
persisted) listed all **17 raw evidence bullets** verbatim in the message
body. The pack's email draft (surfaced from the latest *persisted* row,
id `1c0a39ef-25a4-4898-8216-3f0108266875`) listed **11 raw bullets**,
including a leaked internal line: `"TODO: placeholder — não estima
abandono nem resultado comercial."` Neither was appropriate as an actual
first-contact message — both read as an automated scrape, not a human
reaching out.

## Copy changes (and why)

The root cause was the shared template in `buildOutreachDraft`
(`lib/outreach/draft.ts`), used by every future clinic — not something
specific to SkinLaser. Fixing only SkinLaser's persisted draft by hand
would leave the generator producing the same spammy copy for the next
clinic. So the change was made at the template level:

- **Removed** the per-observation bullet-list body construction for both
  channels (previously joined every `input.observations[i].observation`
  as a `- ...` line directly into the message body).
- **Replaced** with fixed, short, human copy matching the task's
  suggested direction verbatim: "fizemos um raio-X rápido da primeira
  impressão digital", "é só sobre a apresentação do site / facilidade de
  contato", "não avalia qualidade médica", "posso te mandar o resumo?".
- **Kept** `evidence: input.observations` fully populated in the
  persisted draft object (`draft.evidence`) — the complete evidence list
  is still preserved verbatim for human-reviewer/audit purposes; it's
  just no longer echoed in the send-ready message text itself.
- **Preserved** the disclaimer-adjacent phrase ("não avalia qualidade
  médica") in both channels, and the soft, non-committal CTA ("posso te
  mandar o resumo? Sem compromisso." / "posso te mandar o resumo?").
- Avoided everything the task flagged: no diagnosis of the clinic, no
  claim the site is bad, no mention of lost patients, no score numbers,
  no screenshot mentions, no pressure/urgency language, no
  automated-send language.

6 new tests were added to `lib/outreach/draft.test.ts` (all 4 pre-existing
tests still pass unmodified) directly asserting these properties: body
length stays short even with 17 synthetic observations, none of the raw
observation strings leak into the body, `draft.evidence` still contains
every observation verbatim, the required soft-open phrasing is present,
and a fixed list of pressure/spam/automated-send/score/diagnostic phrases
never appears.

## New script: `regenerate-outreach-draft.ts`

The review pack surfaces a clinic's latest **persisted** draft for a
channel when one exists, only falling back to fresh (non-persisted)
generation otherwise. SkinLaser already had an old, pre-polish email
draft persisted (id `1c0a39ef-...`), so fixing the template alone would
not change what the pack displayed for the email channel — the WhatsApp
channel (never persisted) would show the new copy, but email would keep
showing the old spammy text.

Added `scripts/crawler/regenerate-outreach-draft.ts`
(`npm run crawler:regenerate-outreach-draft`) — a small, gated CLI that
builds a fresh draft from the clinic's already-persisted score evidence
(`scoreRepo.getLatestForClinic`) and persists it via the existing
`outreachRepo.createDraft`. It never crawls and never calls an external
API; every draft it produces is `status: "draft"` (never anything else).
Run for both channels for SkinLaser (staging only):

```
npm run crawler:regenerate-outreach-draft -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --channel email
npm run crawler:regenerate-outreach-draft -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a --channel whatsapp_manual --whatsapp-digits 551131555555
```

(The WhatsApp number reused is the real number previously extracted from
the clinic's own published click-to-chat link in an earlier rehearsal —
no new lookup was performed.)

No test file was added for this script, consistent with every other thin
CLI wrapper in `scripts/crawler/` (none have their own test file — the
underlying `buildOutreachDraft` logic it calls is fully covered).

## WhatsApp draft (final)

Persisted row `ca0c3fba-86ac-442c-afb5-276552287177`, `status: draft`:

```
Olá! Aqui é da Atria.
Fizemos um raio-X rápido da primeira impressão digital do site da SkinLaser - Higienopolis — é só sobre apresentação do site e facilidade de contato, não avalia qualidade médica.
Posso te mandar o resumo?
```

## Email draft (final)

Persisted row `ba53a89a-f73e-4eb9-86e6-ed05191b4378`, `status: draft`,
subject "Prévia digital — SkinLaser - Higienopolis":

```
Olá, equipe da SkinLaser - Higienopolis,

Aqui é da Atria. Fizemos um raio-X rápido da primeira impressão digital do site de vocês — é só sobre a apresentação do site e a facilidade de encontrar informações, não avalia qualidade médica.

Encontramos alguns pontos que podem valer uma olhada rápida. Posso te mandar o resumo? Sem compromisso.

Atenciosamente,
Atria
```

## Report/pack regeneration result

```
npm run crawler:review-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output markdown --write-artifact
npm run crawler:review-pack -- --target staging --clinic-id bbfd72a3-a013-4a6c-bd82-4a70479d694a \
  --crawl-job-id 81a7b754-e9d9-40d7-b89d-83f1ca2c53a4 --output json --write-artifact
```

Both regenerated successfully, written only to the gitignored
`artifacts/review-packs/bbfd72a3-a013-4a6c-bd82-4a70479d694a.{md,json}`.
Independently re-confirmed (direct REST query, not just CLI stdout) that
the pack's markdown now cites the newest persisted draft IDs for both
channels (`Origem: rascunho já persistido (id ca0c3fba-...)` for
WhatsApp, `(id ba53a89a-...)` for email), and that both bodies match the
polished copy above exactly. Risk flags unchanged in kind
(`crawl_partial` — medium, `requires_human_review` — info), since neither
depends on outreach copy.

The clinic's `outreach_messages` table retains all 6 rows (4 older
pre-polish email drafts + the 2 new polished ones) — nothing was deleted,
matching the existing append-only convention. Every row, old and new, is
still `status: "draft"`.

## Remaining risk flags

Unchanged from the prior task, unrelated to copy:

- **`crawl_partial`** (medium) — the most recent crawl job only fetched 1
  page (page-limit bound), so contact-page/scheduling-link evidence is
  incomplete.
- **`requires_human_review`** (info) — extracted content is flagged as
  requiring human review before commercial use (standing flag on all
  packs, not specific to this clinic).

## Review decision: unchanged (as required)

Re-confirmed by direct query after all of the above: still exactly one
row, `a769b0ea-3739-4f4d-80ab-2c8000a7e596`, `decision: "needs_changes"`,
`reviewer: "Atria QA"`, same original `reviewed_at`
(`2026-07-22T13:16:49Z`). This task did not create, modify, or supersede
any review decision — moving from `needs_changes` to `approved` remains a
separate, explicit human action.

## Outreach: remains draft (confirmed)

All 6 `outreach_messages` rows for this clinic re-queried directly —
every one still `status: "draft"`. Nothing was sent, approved, or
otherwise transitioned. No message was dispatched through any channel.

## Recommendation

The copy itself is now short, human, non-spammy, and matches every
constraint in the task brief (no medical claims, no diagnosis, no
invented claims, no pressure language, no automated-send language,
disclaimer preserved). From a **copy-quality** standpoint this is ready
for a human reviewer to re-evaluate.

This does **not** mean the clinic is ready for outreach: the standing
`crawl_partial` flag (only 1 page fetched) and the `requires_human_review`
flag are unrelated to copy and still apply, and the review decision
remains `needs_changes` until a human explicitly re-reviews and records a
new decision. Recommended next step: a human reviewer re-reads the pack
(now showing the polished drafts) and records a fresh review decision —
this task deliberately does not do that automatically.

## Verification

- `npm test` — 317/317 passing (6 new tests added to `lib/outreach/draft.test.ts`, 0 regressions).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched.
- No crawl was performed — copy changes and draft regeneration used only already-persisted score evidence; zero new network requests to any clinic website.
- No Google Places/SERP call was made.
- No outreach was sent — all 6 outreach drafts re-confirmed `status: "draft"` after this task's changes.
- No secrets were stored in any file, log, or this document.
