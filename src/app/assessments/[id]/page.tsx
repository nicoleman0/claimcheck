import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { CheckLine, Panel } from "@/components/data"
import { FilterBar } from "@/components/list-filters"
import { Pager } from "@/components/pager"
import { PageHeader } from "@/components/shell/page-header"
import { EmptyState, LoadingRows } from "@/components/states"
import { StatusBadge } from "@/components/status-badge"
import { allFindings, FINDING_FILTERS, FINDING_SORTS, getAssessment, getDecision, getVendor, listChecks, listFindings } from "@/lib/db"
import { listHref, readListQuery, type ListQuery } from "@/lib/list-query"
import { label, statusTone } from "@/lib/tones"
import { NEEDS_REVIEW_BELOW } from "@/lib/types"
import { DecisionForm } from "./decision-form"
import { DraftPanel } from "./draft-panel"
import { FindingsList } from "./findings-list"
import { RecommendationPanel } from "./recommendation"
import { ReviewRunner } from "./review-runner"

export const metadata: Metadata = { title: "Assessment" }

export default function AssessmentPage({ params, searchParams }: PageProps<"/assessments/[id]">) {
  return (
    <Suspense fallback={<><PageHeader title="Assessment" /><LoadingRows rows={8} /></>}>
      <Assessment params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Assessment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const a = await getAssessment(id)
  if (!a) notFound()
  const [vendor, checks, all, decision] = await Promise.all([getVendor(a.vendorId), listChecks(id), allFindings(id), getDecision(id)])
  if (!vendor) notFound()
  const path = `/assessments/${id}`
  const query = readListQuery(await searchParams, { sorts: FINDING_SORTS, defaultSort: "qid", filters: FINDING_FILTERS })
  const { rows, total, counts } = await listFindings(id, query)

  const reviewed = all.some((f) => f.verdict)
  const sure = all.filter((f) => f.confidence != null && f.confidence >= NEEDS_REVIEW_BELOW)
  const summary = `${sure.filter((f) => f.verdict === "contradicts").length} contradictions, ${sure.filter((f) => f.verdict === "no_evidence").length} unsupported, ${all.filter((f) => f.confidence != null && f.confidence < NEEDS_REVIEW_BELOW).length} need review`
  const accepted = all.filter((f) => f.status === "accepted").length
  const filters = FINDING_FILTERS.map((v) => ({ value: v, label: label(v), count: counts[v] ?? 0 }))

  return (
    <>
      <PageHeader
        title={vendor.name}
        description={`${vendor.domain} · ${a.questionnaireName} · ${a.reportName} · ${a.pages.length} report pages · started ${a.createdAt.slice(0, 16).replace("T", " ")} UTC`}
        actions={<StatusBadge tone={statusTone[vendor.status] ?? "neutral"}>{label(vendor.status)}</StatusBadge>}
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel label={reviewed ? `Findings · ${summary}` : "Findings"} emphasis>
            <ReviewRunner assessmentId={id} reviewed={reviewed} error={a.reviewError} model={a.reviewModel} />
            {reviewed && (
              <>
                <FilterBar query={query as ListQuery} path={path} filters={filters} total={counts.all ?? 0} placeholder="search questions, answers, evidence" />
                {rows.length === 0 ? (
                  <EmptyState title="No matches" description="Nothing matches this search and filter." action={<Link href={listHref(path, query as ListQuery, { q: "", filter: null })} className="font-mono text-xs text-primary hover:underline">clear filters</Link>} />
                ) : (
                  <FindingsList assessmentId={id} rows={rows} pages={a.pages} checks={checks} query={query as ListQuery} path={path} />
                )}
                <Pager query={query as ListQuery} total={total} path={path} label="findings" />
              </>
            )}
          </Panel>
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <Panel label="Live checks">
            {checks.length === 0 ? (
              <EmptyState title="No checks recorded" description="Checks run when the assessment is created." />
            ) : (
              <div className="flex flex-col">
                {checks.map((c) => (
                  <div key={c.kind}>
                    <CheckLine name={c.kind} ok={c.ok} value={c.ok === null ? `unavailable${c.error ? ` (${c.error})` : ""}` : c.value} />
                    {c.raw && <p className="mb-1 truncate font-mono text-[11px] text-muted-foreground" title={c.raw}>{c.raw}</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <RecommendationPanel assessmentId={id} decision={decision} reviewed={reviewed} accepted={accepted} />
          <DecisionForm assessmentId={id} decision={decision} />
          <DraftPanel assessmentId={id} draft={a.draft} model={a.draftModel} approvedAt={a.draftApprovedAt} accepted={accepted} />
        </div>
      </div>
    </>
  )
}
