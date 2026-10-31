# claimcheck

Supplier security review for third-party risk analysts. Upload a supplier's security questionnaire (CSV) and SOC 2 report (PDF); claimcheck runs live checks on the supplier's domain (DMARC, SPF, TLS, HSTS, CSP, security.txt, breaches, known exploited vulnerabilities), checks every answer against the report and the checks, recommends a decision, and records the analyst's decision in a supplier register with an audit log.

## Requirements

- Bun 1.4
- A Postgres database (Neon) in `DATABASE_URL`
- An OpenRouter key in `OPENROUTER_API_KEY`

## Setup

```bash
bun install
cp .env.example .env.local   # fill in both values
bun --env-file=.env.local run db:setup   # creates tables and seeds five vendors
bun dev
```

Open http://localhost:3000, choose "new assessment", and use `sample/tallyfern-questionnaire.csv`, `sample/tallyfern-soc2.pdf` and the domain `tallyfern.co.uk`. `sample/expected-findings.csv` is the answer key.

## Test

```bash
bun test
bun run lint
bun run build
E2E_BASE_URL=http://localhost:3000 bunx playwright test
```

## Deploy

Vercel with the Neon integration. Set `OPENROUTER_API_KEY` in the project's environment. Pushes to `main` deploy production.
