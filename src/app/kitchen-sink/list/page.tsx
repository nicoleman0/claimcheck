import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FilterBar } from "@/components/list-filters";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, LoadingRows } from "@/components/states";
import { listHref, readListQuery } from "@/lib/list-query";
import { ListExample } from "./list-example";
import { sample, VERDICTS } from "./sample";

// Reference implementation of a triage list. Copy it for any list a user works through.
export const metadata: Metadata = { title: "List pattern" };

const PATH = "/kitchen-sink/list";
const SORTS = ["id", "claim", "verdict", "confidence"] as const;

export default function ListPatternPage({ searchParams }: PageProps<"/kitchen-sink/list">) {
  return (
    <>
      <PageHeader
        title="List pattern"
        description="Sort, filter and page on the server through the URL; select, act in bulk and move with the keyboard in the browser."
      />
      <Suspense fallback={<LoadingRows />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = readListQuery(await searchParams, { sorts: SORTS, defaultSort: "id", defaultDir: "asc", filters: VERDICTS });

  // In an app this is one SQL query: where + order by + limit/offset, with count(*) over() for the total.
  const searched = sample.filter((r) => !query.q || r.claim.toLowerCase().includes(query.q.toLowerCase()));
  const matching = searched.filter((r) => !query.filter || r.verdict === query.filter);
  const sorted = [...matching].sort((a, b) => {
    const x = a[query.sort], y = b[query.sort];
    return (x < y ? -1 : x > y ? 1 : 0) * (query.dir === "asc" ? 1 : -1);
  });
  const rows = sorted.slice(query.offset, query.offset + query.size);
  const filters = VERDICTS.map((v) => ({ value: v, label: v.replace("_", " "), count: searched.filter((r) => r.verdict === v).length }));

  return (
    <>
      <FilterBar query={query} path={PATH} filters={filters} total={searched.length} placeholder="search claims" />
      {rows.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Nothing matches this search and filter."
          action={<Link href={listHref(PATH, query, { q: "", filter: null })} className="font-mono text-xs text-primary hover:underline">clear filters</Link>}
        />
      ) : (
        <ListExample rows={rows} query={query} path={PATH} />
      )}
      <Pager query={query} total={matching.length} path={PATH} label="findings" />
    </>
  );
}
