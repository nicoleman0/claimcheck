import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { Panel } from "@/components/data"
import { EventsTable } from "@/components/events-table"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState, LoadingRows } from "@/components/states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { getVendor, listEvents, listVendorAssessments } from "@/lib/db"
import { label, riskTone, statusTone } from "@/lib/tones"

export const metadata: Metadata = { title: "Supplier" }

export default function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  return (
    <Suspense fallback={<><PageHeader title="Supplier" /><LoadingRows /></>}>
      <Vendor params={params} />
    </Suspense>
  )
}

async function Vendor({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const v = await getVendor(id)
  if (!v) notFound()
  const [assessments, events] = await Promise.all([listVendorAssessments(id), listEvents({ vendorId: id, limit: 100 }).then((r) => r.rows)])
  return (
    <>
      <PageHeader
        title={v.name}
        description={`${v.domain} · owner ${v.owner} · next review ${v.nextReview ?? "not set"}`}
        actions={<>
          <StatusBadge tone={statusTone[v.status] ?? "neutral"}>{label(v.status)}</StatusBadge>
          {v.risk && <StatusBadge tone={riskTone[v.risk]}>{v.risk} risk</StatusBadge>}
          <Button size="sm" nativeButton={false} render={<Link href="/assessments/new" />}>new assessment</Button>
        </>}
      />
      <div className="grid grid-cols-1 gap-4">
        <Panel label="Assessments">
          {assessments.length === 0 ? <EmptyState title="No assessments" description="Start one to check this supplier's claims." /> : (
            <ul className="flex flex-col gap-1 text-sm">
              {assessments.map((a) => (
                <li key={a.id}><Link href={`/assessments/${a.id}`} className="hover:underline">{a.createdAt.slice(0, 16).replace("T", " ")} UTC · {a.questionnaireName} · {a.reportName}</Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel label="Audit log">
          {events.length === 0 ? <EmptyState title="No events" /> : <EventsTable events={events.map((e) => ({ ...e, vendorName: v.name }))} />}
        </Panel>
      </div>
    </>
  )
}
