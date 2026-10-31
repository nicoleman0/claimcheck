import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"

import { FilterBar, SortHeader, ariaSort } from "@/components/list-filters"
import { Pager } from "@/components/pager"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState, LoadingRows } from "@/components/states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listVendors, VENDOR_SORTS } from "@/lib/db"
import { listHref, readListQuery, type ListQuery } from "@/lib/list-query"
import { label, riskTone, statusTone } from "@/lib/tones"
import { VENDOR_STATUSES } from "@/lib/types"

export const metadata: Metadata = { title: "Register" }

const PATH = "/"

export default function RegisterPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="Supplier register"
        description="Every supplier, its review status, residual risk and next review date."
        actions={<Button nativeButton={false} render={<Link href="/assessments/new" />}>new assessment</Button>}
      />
      <Suspense fallback={<LoadingRows />}>
        <Register searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Register({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const query = readListQuery(await searchParams, { sorts: VENDOR_SORTS, defaultSort: "name", filters: VENDOR_STATUSES })
  const { rows, total, counts } = await listVendors(query)
  const searchedTotal = Object.values(counts).reduce((a, b) => a + b, 0)
  const filters = VENDOR_STATUSES.map((s) => ({ value: s, label: label(s), count: counts[s] ?? 0 }))
  const sortable = (column: string, text: string) => (
    <TableHead aria-sort={ariaSort(query as ListQuery, column)}>
      <SortHeader query={query as ListQuery} path={PATH} column={column}>{text}</SortHeader>
    </TableHead>
  )
  return (
    <>
      <FilterBar query={query as ListQuery} path={PATH} filters={filters} total={searchedTotal} placeholder="search name, domain, owner" />
      {rows.length === 0 ? (
        <EmptyState
          title="No suppliers"
          description="Nothing matches this search and filter."
          action={<Link href={listHref(PATH, query as ListQuery, { q: "", filter: null })} className="font-mono text-xs text-primary hover:underline">clear filters</Link>}
        />
      ) : (
        <div className="overflow-x-auto border-x">
          <Table>
            <TableHeader>
              <TableRow>
                {sortable("name", "Supplier")}
                {sortable("domain", "Domain")}
                {sortable("owner", "Owner")}
                {sortable("status", "Status")}
                {sortable("risk", "Risk")}
                {sortable("next_review", "Next review")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell><Link href={`/vendors/${v.id}`} className="font-medium hover:underline">{v.name}</Link></TableCell>
                  <TableCell className="font-mono text-xs">{v.domain}</TableCell>
                  <TableCell>{v.owner}</TableCell>
                  <TableCell><StatusBadge tone={statusTone[v.status] ?? "neutral"}>{label(v.status)}</StatusBadge></TableCell>
                  <TableCell>{v.risk ? <StatusBadge tone={riskTone[v.risk]}>{v.risk}</StatusBadge> : <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{v.nextReview ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager query={query as ListQuery} total={total} path={PATH} label="suppliers" />
    </>
  )
}
