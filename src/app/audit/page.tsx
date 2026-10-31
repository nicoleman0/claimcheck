import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shell/page-header"
import { EmptyState, LoadingRows } from "@/components/states"
import { EventsTable } from "@/components/events-table"
import { listEvents } from "@/lib/db"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Audit log" description="Every action, with time and actor: the analyst, the system, or a model ID." />
      <Suspense fallback={<LoadingRows />}>
        <Events />
      </Suspense>
    </>
  )
}

async function Events() {
  await connection()
  const events = await listEvents({ limit: 300 })
  if (!events.length) return <EmptyState title="No events yet" description="Actions on suppliers and assessments appear here." action={<Link href="/" className="font-mono text-xs text-primary hover:underline">open the register</Link>} />
  return <EventsTable events={events} />
}
