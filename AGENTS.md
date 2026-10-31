<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI

- Components are shadcn on Base UI (`src/components/ui`). Compose with `render`, not `asChild`: `<DialogTrigger render={<Button />}>`. A `Button` rendered as a link needs `nativeButton={false}`.
- `Select` needs an `items` prop to show labels. Copy patterns from `src/app/kitchen-sink`.
- Use the starter's components for every control and table. No raw `<input>`, `<select>`, `<table>` or hard-coded colours; use theme tokens (`text-muted-foreground`, `text-warning`, `bg-panel`). Corners are square; orange (`warning`) marks problems only.
- Pages start with `PageHeader`. Group content in `Panel`; show model output with `ConfidenceMeter`, `ProbabilityBars` and `RiskScale`, and check results with `CheckLine` (`src/components/data.tsx`). Async views show `LoadingRows`, `EmptyState` or `ErrorState` (`src/components/states.tsx`). Statuses use `StatusBadge` with a status-to-tone map.
- App name and sidebar links live in `src/lib/app.ts`; each link has a `g <key>` shortcut. Use `Kbd` to show keys.
- Styling files (`globals.css`, `components/ui/**`, `components/shell/**`, `layout.tsx`) have one owner; ask before changing them.
- Page grids start from `grid-cols-1` (`minmax(0, 1fr)`): a plain `grid` column grows to its widest child, so a table widens the page on phones instead of scrolling.
- Lists use the list kit; `/kitchen-sink/list` is the reference to copy. Sort, filter and page on the server through the URL (`readListQuery`, `listHref` in `src/lib/list-query.ts`; `FilterBar`, `SortHeader`, `ariaSort` in `src/components/list-filters.tsx`; `Pager`). Map `sort` and `filter` to SQL only through their allow-lists, and query with `limit`/`offset` plus `count(*) over()` for the total. Lists a user works through also get selection, `BulkBar` and keyboard rows (`useRowSelection`, `useRowKeys`, `rowStateClass`, `KeyHints` in `src/components/list-controls.tsx`). Never show a key hint that does nothing.
