# Score → prioritization alignment

Aligns prospect prioritization (`lib/operations/prioritization/`) and
commercial template eligibility (`lib/operations/commercial-templates/`)
with the calibrated score v1 behavior from
[`crawler-score-calibration-v1.md`](./crawler-score-calibration-v1.md).
That task taught `calculateScoreV1` to zero every dimension — honestly and
explainably — for a directory listing, a `robots_denied` refusal, or any
other unreachable site. This task closes the gap that calibration opened:
the prioritization layer was still treating "a score row exists" as
positive evidence, even when that score row is a hard, explained zero.

Required disclaimer (unchanged, still enforced by
`lib/score/calculate.ts`'s schema, never touched by this task):

> "Esta análise avalia apenas a apresentação digital e a facilidade de
> encontrar informações. Não avalia qualidade médica."

## Files changed

- `lib/operations/prioritization/prioritize-prospects.ts` — the core fix
  (see below) plus no other behavior change.
- `lib/operations/commercial-templates/build-commercial-template-pack.ts`
  — one new, explicit defense-in-depth check for directory listings.
- `lib/operations/prospect-prioritization.test.ts` — 4 new tests.
- `lib/operations/commercial-templates.test.ts` — 2 new tests.
- `docs/technical/crawler-score-prioritization-alignment.md` — this
  document.

## The core fix: a zero-total score is not "evidence available"

Before this task, `prioritizeClinic` treated *any* existing score row as
worth a flat `+10` ("Score digital disponível: X/100"), regardless of
what `X` was:

```ts
if (hasScore && clinicScore) {
  score += 10;
  reasons.push(`Score digital disponível: ${clinicScore.total}/100 ...`);
  // + up to another +10 if 30 <= total <= 85
}
```

But calibration v1 made `total: 0` a *specific, meaningful* outcome — it
is what `calculateScoreV1` always returns for a directory listing, a
`robots_denied` refusal, or any other unreachable site
(`docs/technical/crawler-score-calibration-v1.md`, "Unreachable reason
codes" / "Directory listing detection"). A real, computed `0/100` is not
"some evidence the clinic has a decent site" — it is the same "nothing
usable to show" signal as never having scored the clinic at all, and
treating it as a positive `+10` could meaningfully misrank a bad
prospect. Concretely, before this fix, a `robots_denied` clinic with a
salvageable screenshot, a public contact, and an `approved` review
decision could reach **60** (`medium` tier, eligible for commercial
copy) — because the flat `+10` scoring bonus combined with the
screenshot/contact/decision bonuses outweighed the (correctly-applied)
`robots_denied` crawl penalty. After the fix, the same inputs reach at
most **35** (`low` tier, no copy generated) — verified directly by the
new "robots_denied cannot reach medium/high tier..." test in both test
files.

The fix (`lib/operations/prioritization/prioritize-prospects.ts`):

```ts
if (hasScore && clinicScore && clinicScore.total > 0) {
  score += 10;
  reasons.push(`Score digital disponível: ${clinicScore.total}/100 ...`);
  // unchanged range bonus/penalty for 30-85 / >85
} else if (hasScore && clinicScore) {
  // total === 0: same treatment as "no score at all"
  score -= 15;
  blockers.push(`Score calculado é ${clinicScore.total}/100 (...) — sem evidência de presença digital utilizável.`);
} else {
  score -= 15;
  blockers.push("Nenhum score disponível ainda para esta clínica.");
}
```

A clinic with a genuine, computed `0/100` now gets the exact same `-15`
treatment as a clinic that was never scored at all — no flat bonus, and
the blocker text names the zero explicitly rather than pretending it's
neutral. This is the single behavioral change in the ranking formula;
everything else (website/directory detection, screenshot bonus, crawl
failure penalties, contact bonus, review-decision handling, recency
penalty) was already correct and unchanged.

## Defense-in-depth: directory listings never get commercial copy

`build-commercial-template-pack.ts` already relied on the tier scorer's
`-60` directory-listing penalty to keep a directory listing capped at
`low` (never `medium`/`high`), and copy generation was already withheld
for `low` tier. That chain of reasoning is correct today (confirmed by
a new test — "a directory listing stays capped at low/blocked even with
every other signal maximally favorable" — that maxes out every other
bonus a directory-listing clinic could plausibly earn and shows it still
cannot cross into `medium`), but it depends on the tier-scoring math
never changing enough to let a directory listing slip through. Per the
task's explicit instruction to "ensure commercial templates only
generate review-ready copy for genuinely high-confidence cases," this
task adds an **explicit** `isDirectoryListing` check in
`buildCommercialTemplatePack`, checked before the tier-based branches —
the same pattern already used for `needs_changes`. A directory listing
now never produces copy, independent of whatever its numeric tier
happens to be.

## Requirement-by-requirement summary

| # | Requirement | Status before this task | Status after |
| --- | --- | --- | --- |
| 1 | Respect calibrated score semantics | A real `0/100` scored as positive evidence (`+10`) | Fixed — `0/100` scores exactly like "no score" |
| 2 | Directory listings blocked/low | Already capped at `low` via `-60` (verified, unchanged) | Same, plus an explicit copy-eligibility check |
| 3 | `rejected` blocks | Already a hard override (`-100`, forces `blocked`) | Unchanged |
| 4 | `do_not_contact` blocks | Already a hard override (`-100`, forces `blocked`) | Unchanged |
| 5 | `needs_changes` withholds copy | Already an explicit check in `build-commercial-template-pack.ts` | Unchanged |
| 6 | Missing score never outranks real evidence | True for real vs. missing, but a *zero* score could rank above missing | Fixed — zero and missing now score identically |
| 7 | Unpromoted candidates get no commercial copy | Already true (`kind === "candidate"` branch) | Unchanged |
| 8 | `robots_denied` usually blocked/low, unless salvageable | Could reach `medium` in a worst-case combination (see above) | Fixed — capped at `low` even in the worst case |
| 9 | Screenshots/contact increase confidence | Already true (`+15` screenshot, `+10` contact) | Unchanged |
| 10 | Recently logged lowers priority | Already true (`-20` within 30 days, real contact events only) | Unchanged |
| 11 | No sending | Both modules are structurally read-only; no `outreachRepo` dependency exists anywhere in either module's signature | Unchanged |
| 12 | Production refused | Enforced upstream by the shared `selectRepositories`/`target-guard` gate, not by this module | Unchanged |

## Output behavior

Unchanged shape, already satisfying the task's requirement — every
prospect already produced `priorityScore`, `priorityTier`, `reasons`,
`blockers`, and `suggestedNextAction` (see
`lib/operations/prioritization/types.ts`); no new fields were needed.

## Staging validation (read-only)

Ran `npm run crawler:prioritize-prospects -- --target staging` and
`npm run crawler:commercial-templates -- --target staging --clinic-id/--candidate-id <id>`
against project ref `lfkyiztuwptmddsraucg`. Both tools are structurally
read-only (no repository write method exists in either module's
dependency surface — enforced directly by tests), so nothing was
mutated; this was confirmed by re-running the existing prioritization
list a second time and getting byte-identical results.

### Top ranked prospects after alignment

| Rank | Name | Kind | Tier | Score | Next action |
| --- | --- | --- | --- | --- | --- |
| 1 | SkinLaser - Higienopolis | clinic | **high** | 75 | ready_for_manual_outreach_review |
| 2 | Dermatológica - Farmácia de Manipulação (candidate) | candidate | medium | 60 | needs_manual_research |
| 2 | Clínica Graciosa (candidate) | candidate | medium | 60 | needs_manual_research |
| 2 | Clínica Dermic - Dermatologia Integrada (candidate) | candidate | medium | 60 | needs_manual_research |
| 5 | CEPELLE Batel | clinic | medium | 55 | review_pack (copy withheld: `needs_changes`) |
| 6 | Dermaclinic | clinic | medium | 50 | review_pack (copy withheld: `needs_changes`) |
| 7 | Instituto Dermatológico de Curitiba | clinic | medium | 40 | review_pack (copy withheld: `needs_changes`) |
| 8 | GRUPO CPD | clinic | low | 30 | review_pack |
| 9 | Dra. Ana Carolina Apolinário Sala (Doctoralia) | candidate | **blocked** | -10 | skip (directory listing) |
| 10 | Dra Ana Paula Pedrino (robots_denied + rejected) | clinic | **blocked** | -125 | skip |

### Whether SkinLaser remains high

**Yes.** SkinLaser's score is a real `80/100`, unaffected by the
zero-score fix (which only changes behavior for `total === 0`). It keeps
its `+10` score bonus, its `+10` sweet-spot bonus, screenshot bonus,
contact bonus, and its `approved`-decision bonus, landing at `75`/`high`
— same tier as before this task, confirmed by the new regression test
("a high-scored clinic with screenshot + contact remains high").

### Directory / robots / fetch-error cases

- **Directory listing** (Dra. Ana Carolina Apolinário Sala, a Doctoralia
  profile): `priorityTier: "blocked"`, `suggestedNextAction: "skip"`.
  Generating a commercial template pack for it returns
  `whatsapp.available: false`, `email.available: false`,
  `blockedReason: "Website é uma listagem de diretório de terceiros..."`
  — confirmed live against staging.
- **`robots_denied` + real zero score** (Dra Ana Paula Pedrino — also
  independently `rejected` by human review in an earlier task): now
  `priorityScore: -125`, `blockers` include the new
  `"Score calculado é 0/100 (v1) — sem evidência de presença digital
  utilizável."` text (the concrete, direct proof the fix is live — this
  same clinic previously would have earned a misleading `+10` for
  "Score digital disponível: 0/100"). Its commercial template pack
  returns no copy, `blockedReason` naming robots.txt, the zero score,
  the missing contact, and the `rejected` decision all together.
- **`needs_changes` clinics with decent real scores** (CEPELLE 81,
  Dermaclinic 48, Instituto Dermatológico 71 — all canonicalized
  http→https successes from earlier tasks): all three still rank
  `medium` by tier score (their real, non-zero scores are unaffected by
  this fix), but all three correctly produce **no commercial copy** —
  confirmed live — because of the pre-existing explicit `needs_changes`
  check, which this task didn't need to touch.

### Tier changes from the prior calibration batch

The only ranking-affecting change from this task is the zero-score fix,
which only changes clinics with a real, computed `0/100` score. The one
staging example of that shape (Dra Ana Paula Pedrino) was already
`blocked` before this task (via the independent `rejected` decision and
`robots_denied` hard penalty), so its *tier* didn't change — but its
`priorityScore` and blocker text did, and the fix closes a real gap that
would have mattered for a *different* zero-score clinic without an
independent hard block. All other staging clinics/candidates kept the
same tier they had after the previous score-calibration-v1 rehearsal.

## Limitations

- **Wrong-audience detection is directory-listing-only.** The candidate
  "Dermatológica - Farmácia de Manipulação em Curitiba" — flagged as a
  wrong-audience result (a pharmacy, not a clinic) in
  `docs/technical/crawler-commercial-calibration-batch.md` — still ranks
  `medium` here, because `isDirectoryListing` only recognizes a small,
  known allowlist of third-party directory domains
  (`KNOWN_DIRECTORY_LISTING_ORIGINS`), not audience mismatch on the
  prospect's own domain. Catching this would need a real
  business-category signal, which doesn't exist in the extraction
  pipeline yet — out of scope for a prioritization-only task.
- **The live pipeline still doesn't always compute a score for a 0-page
  crawl** (documented in `crawler-score-calibration-v1.md`, "Remaining
  calibration needs" #1) — `run-crawl-job.ts`'s existing gate means most
  `robots_denied`/unreachable clinics reach prioritization with
  `hasScore: false` (the "missing score" branch), not a real `0/100` row
  (the "zero score" branch this task's fix targets). Both branches now
  apply the identical `-15` penalty, so the ranking outcome is the same
  either way — but the more specific, honestly-worded blocker text
  (`"Score calculado é 0/100..."`) is only available when a score row
  was explicitly (re)computed, e.g. via
  `scripts/crawler/recalculate-score.ts`.
- **No production project (`cskodsnvghavkcjwmafr`) was linked, targeted,
  or touched** — only staging (`lfkyiztuwptmddsraucg`) was read.
- **No crawl was performed** — this task only reads already-persisted
  clinic/candidate/crawl/score/contact/decision/log rows.
- **No outreach was sent** — neither module has a send-capable
  dependency; both are covered by an explicit "no `outreachRepo`
  anywhere in the dependency surface" test.
