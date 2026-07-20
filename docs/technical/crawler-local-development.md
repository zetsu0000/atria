# Crawler local development

## Worktree

```bash
cd "/Users/marcelollin/Modernizacao digital dermato/atria-crawler-foundation"
git branch --show-current   # feature/crawler-data-foundation
```

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run crawler:fixture
npx tsx scripts/crawler-fixture.ts validate --url https://clinic.example.com/
```

## Fixture scan

`npm run crawler:fixture` reads `lib/crawler/fixtures/clinic-home.html`, extracts candidates, builds placeholder score + outreach draft, writes:

- `artifacts/crawler/fixture-scan.json` (gitignored)
- placeholder screenshot text files (gitignored)

No network crawl of real clinics.

## Migrations

Apply **locally only** when authorized:

```bash
# example — do not run against production without explicit approval
supabase db push   # or SQL editor with the new migration file
```

Never applied by agents unless explicitly requested.

## Env

Reuse server-only Supabase vars from `.env.example`. No Places/SERP keys in this phase.
