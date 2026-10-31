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

## How it works

- `src/lib/checks/`: eight live checks run in parallel, 5 s timeout each; a failed check shows as unavailable.
- `src/lib/jev.ts`: one decision request (`typesafe/jev-1.14` via OpenRouter) returns a verdict, evidence pointer and confidence for every answer; a second returns residual risk, recommended action and whether the vendor misrepresented its controls. The evidence sentence shown beside each answer is chosen by code.
- `src/lib/draft.ts`: the follow-up email is written by DeepSeek, then GLM, then a plain template.
- `src/lib/db.ts`: Postgres; every write also records an audit event with its actor (analyst, system or model ID).

## Assumptions and limitations

- Single analyst, no login or tenants. Nothing is emailed; an approved follow-up only changes the vendor's status.
- Uploaded files are not stored; the report's page texts and the parsed answers are.
- Uploads: 4 MB per file and about 4.4 MB in total (the platform's request limit).
- Model verdicts on the sample score 28 of 30 against `sample/expected-findings.csv`, with all eight planted contradictions found. Q02 and Q30 disagree with the key.

## Deploy

Vercel with the Neon integration. Set `OPENROUTER_API_KEY` in the project's environment. Pushes to `main` deploy production.
