# Commercial calibration batch

A small (10-prospect) rehearsal of the full operator flow — discovery →
promotion → controlled crawl → score/report/review pack → prioritization
→ commercial templates → review decision — run end-to-end against
staging to calibrate whether the tier/scoring/copy models introduced in
the last three tasks actually feel commercially correct. **Not scale —
a deliberate, small, human-judged sample.**

## Commands run

```
npm run crawler:operator-preflight -- --target staging

npm run crawler:discover:places -- --dry-run --query "clínica dermatológica" --location "Curitiba, PR" --max-results 5 --max-pages 1
npm run crawler:discover:places -- --target staging --query "clínica dermatológica" --location "Curitiba, PR" --max-results 5 --max-pages 1

npm run crawler:promote -- --target staging --candidate-id 4ed93b59-5344-4675-aca2-e7f19e777fb3   # CEPELLE Batel
npm run crawler:promote -- --target staging --candidate-id e3b51383-1c82-4903-98fe-f754b9f1248e   # Instituto Dermatológico de Curitiba

npm run crawler:queue:process -- --target staging --allow-real-crawl --capture-screenshots \
  --screenshot-storage-bucket crawler-screenshots --approved-domains cepelle.com.br,www.cepelle.com.br \
  --clinic-ids b2c32a64-90cf-4cc1-a7d2-566a37d7776b --max-pages 3

npm run crawler:queue:process -- --target staging --allow-real-crawl --capture-screenshots \
  --screenshot-storage-bucket crawler-screenshots --approved-domains idc.med.br,www.idc.med.br \
  --clinic-ids 4ee0e80f-1504-483b-8f13-237b460fed7f --max-pages 3

npm run crawler:report -- --target staging --clinic-id <id> --allow-incomplete --write-artifact       # both new clinics
npm run crawler:review-pack -- --target staging --clinic-id <id> --allow-incomplete --write-artifact  # both new clinics

npm run crawler:review-decision -- --target staging --clinic-id b2c32a64-... --decision needs_changes --reviewer "Atria QA" --notes "..."
npm run crawler:review-decision -- --target staging --clinic-id 4ee0e80f-... --decision needs_changes --reviewer "Atria QA" --notes "..."

npm run crawler:prioritize-prospects -- --target staging --limit 15 --output table --write-artifact

npm run crawler:commercial-templates -- --target staging --tier high --output json --write-artifact
npm run crawler:commercial-templates -- --target staging --tier medium --output json --write-artifact
npm run crawler:commercial-templates -- --target staging --tier low --output json --write-artifact
npm run crawler:commercial-templates -- --target staging --tier blocked --output json --write-artifact
```

Every real-crawl command was bounded to `--max-pages 3` with an
explicit, 2-entry `--approved-domains` allowlist (apex + www) for
exactly the one clinic being crawled. Only 2 candidates were promoted
this task (within the "max 3 promoted clinics" limit); the batch's
other 3 fresh candidates were deliberately left unpromoted for
calibration diversity (see "Common blockers" below).

## Prospects selected

Fresh discovery (`--query "clínica dermatológica" --location "Curitiba,
PR" --max-results 5 --max-pages 1`) found 5 candidates, all with their
own domains (no directory listings this round):

| Candidate | Website | Decision |
| --- | --- | --- |
| CEPELLE Batel | `cepelle.com.br` | **Promoted** |
| Instituto Dermatológico de Curitiba | `idc.med.br` | **Promoted** |
| Clínica Dermic - Dermatologia Integrada | `clinicadermic.com.br` | Left as candidate (not crawled this round) |
| Clínica Graciosa | `clinicagraciosa.com.br` | Left as candidate (not crawled this round) |
| "Dermatológica - Farmácia de Manipulação" | `dermatologica.com.br` | Left as candidate — **not a clinic** (compounding pharmacy), a real "wrong audience" finding |

Combined with the 5 prospects already retained in staging from prior
tasks (SkinLaser, GRUPO CPD, Dermaclinic, and 2 blocked/rejected
prospects), this batch evaluated **exactly 10 prospects** — the top of
the requested 5-10 range.

## Tier result

```
tier     score  kind       name                                              next_action
-------  -----  ---------  ------------------------------------------------  ---------------------------------
high     75     clinic     SkinLaser - Higienopolis                          ready_for_manual_outreach_review
medium   60     candidate  Dermatológica - Farmácia de Manipulação em Curit  needs_manual_research
medium   60     candidate  Clínica Graciosa                                  needs_manual_research
medium   60     candidate  Clínica Dermic - Dermatologia Integrada           needs_manual_research
low      30     clinic     GRUPO CPD - Centro Paulista de Dermatologia e Es  review_pack
blocked  10     clinic     Instituto Dermatológico de Curitiba               retry_crawl
blocked  10     clinic     Dermaclinic                                       retry_crawl
blocked  10     clinic     CEPELLE Batel - Clínica de Dermatologia em Curit  retry_crawl
blocked  -10    candidate  Dra. Ana Carolina Apolinário Sala – Dermatologis  skip
blocked  -125   clinic     Dra Ana Paula Pedrino | Dermatologia. Referência  skip
```

**Distribution: 1 high, 3 medium, 1 low, 5 blocked** (out of 10).

## Template result

Ran a full tier sweep (`--tier high|medium|low|blocked`). Confirmed
behavior at every tier:

- **High** (SkinLaser): full review-ready WhatsApp + email drafts
  generated, exactly as designed:

  ```
  Olá! Aqui é da Atria.
  Fizemos uma revisão rápida da presença digital de SkinLaser - Higienopolis — é só sobre apresentação do site e facilidade de contato, não avalia qualidade médica.
  Posso te mandar o resumo?
  ```

- **Medium** (3 unpromoted candidates): **no copy generated for any of
  them**, correctly — `whatsapp.available: false`,
  `unavailableReason: "Candidato ainda não promovido/crawleado — sem
  evidências reais para gerar copy."` This confirms the copy-eligibility
  guard (candidates never get copy, regardless of numeric tier) held up
  under real data, not just synthetic tests.
- **Low** (GRUPO CPD): no copy by default, `blockedReason: null`
  (recommendation, not a block), warning recommends manual research.
- **Blocked** (5 prospects — 3 http:// crawl failures + 1 directory
  listing + 1 rejected/robots-denied): no copy for any of them.
  `recommendedNextAction` correctly differentiates the retriable
  failures (`retry_crawl` for the 3 http:// clinics) from the permanent
  ones (`skip` for the directory listing and the rejected/robots-denied
  clinic) — this distinction is genuinely useful and reads correctly to
  a human operator.

## Human judgment

- **Tier assignment felt commercially correct for the clear cases**:
  SkinLaser (real crawl, real score, real contact, approved) at `high`
  is exactly right. The rejected/robots-denied duplicate-domain clinic
  at the most negative score in the whole batch is exactly right.
  Directory listings correctly bottom out regardless of anything else.
- **The "medium" tier for unpromoted candidates is misleading in
  isolation.** All three unpromoted candidates land at an identical
  score (60) purely from "has its own domain" — nothing about their
  actual digital presence has been evaluated yet. A "medium, score 60"
  candidate sitting next to a "blocked, score 10" *already-crawled*
  clinic visually implies the candidate is a *better* prospect right
  now, when in fact the candidate is simply *unknown* — it hasn't even
  been attempted yet. An operator scanning the table by score alone
  could reasonably (and wrongly) prioritize an untested candidate over
  a real clinic that's merely blocked on a fixable crawl issue. This is
  the single most important finding of this calibration round — see
  "Recommended adjustments" below.
- **WhatsApp/email copy is usable as-is** for the high tier — short,
  human, matches the runbook's own established quality bar, no editing
  needed before a human sends it manually. The medium-tier copy template
  itself (softer ask) reads well in isolation (verified in the prior
  task's unit tests and rehearsal), but this round never got to see it
  fire for real, since no clinic actually landed at "medium" — every
  medium-tier item this round was a copy-ineligible candidate.
- **Score alignment with human judgment**: for the one clinic that
  actually got a real score (SkinLaser, 80/100 v1), the score
  qualitatively matches an operator's own read of the site (functional,
  reasonably modern, clear room for improvement) — consistent with
  every prior calibration task's own conclusion about this clinic.
  No new real score was produced this round to further calibrate
  against, since both newly-promoted clinics failed to crawl.
- **Screenshot/report usefulness**: for both new clinics, the
  screenshots are the *only* real evidence available (desktop + mobile,
  both `captured`, private storage, re-confirmed not publicly
  accessible) — genuinely useful on their own even without a score,
  since an operator can visually assess the site while deciding whether
  `retry_crawl` is worth pursuing. This reinforces the manual outreach
  pack's existing "screenshot evidence despite a blocker is
  commercially useful evidence" design principle from the prioritization
  model.

## Common blockers found (real, this round)

- **`unexpected_error` on `http://` (non-HTTPS) origins — 3 for 3.**
  Every domain promoted and crawled this round that used a plain
  `http://` URL (`cepelle.com.br`, `idc.med.br`, and — from the prior
  small-batch rehearsal — `dermaclinic.com.br`) failed content fetch
  with the generic `unexpected_error` code, **while Playwright screenshot
  capture succeeded for all three anyway.** This is now a
  three-for-three reproducible pattern, not a one-off. See "Recommended
  adjustments" below.
- **Wrong-audience own-domain candidate** — "Dermatológica - Farmácia
  de Manipulação" has its own domain (not a directory) and would pass
  every current automated filter, but a human glance immediately shows
  it's a compounding pharmacy, not a clinic. The current model has no
  signal for "is this actually a clinic" beyond the search query itself.
- **Directory listing** (Doctoralia) — correctly caught by the existing
  allowlist-based detector, as in the prior rehearsal.
- **`robots_denied` + duplicate domain + rejected decision** — the same
  clinic from the prior small-batch rehearsal, still correctly bottoming
  out the ranking.
- **No new occurrences this round of**: TLS certificate errors on
  `https://` origins specifically, or "no score" as an isolated blocker
  on an otherwise-successful crawl (every failure this round was a
  complete crawl failure, not a partial one).

## Recommended adjustments

1. **Investigate the `http://`-origin fetch failure as a dedicated,
   focused bug-fix task** — not bundled into this rehearsal. Three
   independent real domains have now failed identically
   (`unexpected_error`, 0 pages, screenshot succeeds). The
   `safeErrorMessage` design intentionally strips the real exception
   before it's persisted, so root-causing this requires either
   temporary, deliberate debug instrumentation or a controlled
   reproduction outside this task's read-only/rehearsal scope. Given
   how many otherwise-good candidates likely use plain HTTP or redirect
   from HTTP to HTTPS, fixing this could meaningfully improve the
   fraction of clinics that ever reach a real score.
2. **Differentiate "unpromoted candidate" from "crawled clinic" more
   visibly in the prioritization output** — e.g. a distinct tier
   namespace or a visual/numeric penalty for candidates so a
   `medium`-tier candidate can never numerically outrank a
   `blocked`-tier clinic that has *already* produced real evidence
   (screenshots, partial crawl data) just because it hasn't been
   crawled yet. The current candidate base score (50) is calibrated
   independently of the clinic base score (20) and the two aren't
   currently guaranteed to stay ordered relative to each other as more
   signals get added on the clinic side.
3. **Add a lightweight "is this actually a clinic" heuristic** (e.g. a
   small keyword denylist for pharmacy/compounding-lab naming patterns,
   similar to the existing directory-listing allowlist) — a small,
   well-scoped follow-up, not attempted in this rehearsal to avoid
   scope creep into a dedicated calibration task.
4. **`retry_crawl` clinics should be easy to bulk re-attempt** — all
   three http:// failures currently require a manual, per-clinic
   `crawler:queue:process --clinic-ids <id>` call. A small follow-up CLI
   convenience (e.g. `--retry-blocked` sourcing ids from the
   prioritization ranking directly) could reduce operator toil once the
   underlying fetch bug above is fixed and retries are actually likely
   to succeed.

None of these were implemented in this task — this is a calibration
rehearsal, not a fix task, per its own explicit scope ("prefer
docs/rehearsal only").

## Retained staging rows

Nothing was deleted or modified — every table in this pipeline is
append-only/additive. New rows added by this task:

| Table | New rows this task | Total after |
| --- | --- | --- |
| `prospect_candidates` | +5 (CEPELLE, Instituto, Dermic, Graciosa, Dermatológica-pharmacy) | 10 |
| `clinics` | +2 (CEPELLE `b2c32a64-90cf-4cc1-a7d2-566a37d7776b`, Instituto `4ee0e80f-1504-483b-8f13-237b460fed7f`) | 6 |
| `crawl_jobs` | +2 (both `failed`/`unexpected_error`) | 10 |
| `scan_assets` | +4 (2 screenshots × 2 clinics) | 16 |
| `scores` | +0 (neither new crawl produced a score) | 10 |
| `outreach_messages` | +0 (neither new clinic produced evidence to draft from) | 7 (unchanged, all `draft`) |
| `human_review_decisions` | +2 (both `needs_changes`) | 6 |
| `manual_outreach_logs` | +0 — no manual action occurred outside this system this round, so none was logged, per this task's own instruction | 1 (unchanged) |

## Verification

- `npm test` — 416/416 passing (unchanged — no code or test files were added; this task is documentation/rehearsal only).
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- `git diff --check` — clean.

## Scope confirmations

- No UI was modified.
- No production project (`Atria`, ref `cskodsnvghavkcjwmafr`) was linked, targeted, or touched — staging (`lfkyiztuwptmddsraucg`) reconfirmed via `supabase/.temp/project-ref` and `crawler:operator-preflight` before this batch began.
- No broad crawl — every real-crawl command was bounded to `--max-pages 3` and an explicit, per-clinic, 2-entry `--approved-domains` allowlist; only 2 clinics were actually crawled (well under the 3-clinic limit), and both crawls fetched 0 pages before failing.
- No Google/SERP beyond the official Places API — one `--target staging` discovery call, `--max-results 5 --max-pages 1`, no scraping, no browser automation against Google.
- No outreach was sent — no outreach draft was ever created for either new clinic (nothing to send), and all 7 pre-existing `outreach_messages` rows remain `status: "draft"`, unchanged. No `manual_send_logged` event was recorded, since no real manual send occurred.
- No secrets were stored in any file, log, or this document.
