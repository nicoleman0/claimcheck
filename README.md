# App starter

Next.js 16 template: Bun, Tailwind 4, shadcn/ui on Base UI, an app shell, loading, empty and error states, light and dark themes, Bun and Playwright tests.

## Use

```bash
gh repo create <owner>/<app> --public --template <owner>/app-starter --clone
cd <app> && bun install
```

Set the name, description and nav in `src/lib/app.ts`. `/kitchen-sink` shows every component and state; it is not linked from the nav.

## Run and test

```bash
bun dev
bun test
bun run build
E2E_BASE_URL=http://localhost:3000 bunx playwright test
```

The Playwright test checks `/kitchen-sink` at 1280 and 375 px for horizontal scroll and saves screenshots to `test-results/`.
