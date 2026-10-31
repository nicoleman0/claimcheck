import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shell/page-header"
import { EmptyState, LoadingRows } from "@/components/states"
import { EventsTable } from "@/components/events-table"
import { listEvents } from "@/lib/db"
import { readListQuery } from "@/lib/list-query"
import { Pager } from "@/components/pager"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Audit log" description="Every action, with time and actor: the analyst, the system, or a model ID." />
      <Suspense fallback={<LoadingRows />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Events({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const query = readListQuery(await searchParams, { sorts: ["at"] as const, defaultSort: "at", defaultDir: "desc", size: 50 })
  const { rows: events, total } = await listEvents({ limit: query.size, offset: query.offset })
  if (!events.length && query.page === 1) return <EmptyState title="No events yet" description="Actions on suppliers and assessments appear here." action={<Link href="/" className="font-mono text-xs text-primary hover:underline">open the register</Link>} />
  return <><EventsTable events={events} /><Pager query={query} total={total} path="/audit" label="events" /></>
}
