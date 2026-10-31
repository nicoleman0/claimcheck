"use client"

import { useRouter } from "next/navigation"
import { Fragment, useState, useTransition } from "react"
import { toast } from "sonner"

import { setFindingsAction } from "@/app/actions"
import { ConfidenceMeter } from "@/components/data"
import { BulkBar, KeyHints, rowStateClass, useRowKeys, useRowSelection } from "@/components/list-controls"
import { ariaSort, SortHeader } from "@/components/list-filters"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ListQuery } from "@/lib/list-query"
import { label, verdictTone } from "@/lib/tones"
import { NEEDS_REVIEW_BELOW, type CheckResult, type Finding, type FindingStatus } from "@/lib/types"

const statusTone = { open: "neutral", accepted: "warning", dismissed: "neutral" } as const

export function FindingsList({ assessmentId, rows, pages, checks, query, path }: {
  assessmentId: number; rows: Finding[]; pages: string[]; checks: CheckResult[]; query: ListQuery; path: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState<number | null>(null)
  const selection = useRowSelection(rows.map((r) => String(r.id)))

  const act = (status: FindingStatus, ids: number[]) =>
    start(async () => {
      try {
        await setFindingsAction(assessmentId, ids, status)
        toast.success(`${ids.length} ${ids.length === 1 ? "finding" : "findings"} ${status}`)
        window.dispatchEvent(new CustomEvent("findings-changed"))
        router.refresh()
      } catch (e) {
        toast.error(`Could not update: ${e instanceof Error ? e.message : e}`)
      }
    })

  const keys = useRowKeys(rows.length, {
    x: (i) => selection.toggle(String(rows[i].id)),
    a: (i) => act("accepted", [rows[i].id]),
    d: (i) => act("dismissed", [rows[i].id]),
  })
  const bulk = (status: FindingStatus) => { act(status, [...selection.selected].map(Number)); selection.clear() }

  const sortable = (column: string, text: string) => (
    <TableHead aria-sort={ariaSort(query, column)}><SortHeader query={query} path={path} column={column}>{text}</SortHeader></TableHead>
  )

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{pending ? "saving…" : ""}</span>
        <KeyHints hints={[["j", "down"], ["k", "up"], ["x", "select"], ["a", "accept"], ["d", "dismiss"]]} />
      </div>
      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button size="sm" onClick={() => bulk("accepted")}>accept</Button>
        <Button size="sm" variant="outline" onClick={() => bulk("dismissed")}>dismiss</Button>
      </BulkBar>
      <div className="overflow-x-auto border-x">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label="Select all on this page" checked={selection.allSelected} indeterminate={selection.someSelected} onCheckedChange={selection.toggleAll} />
              </TableHead>
              {sortable("qid", "ID")}
              <TableHead>Answer</TableHead>
              <TableHead>Evidence</TableHead>
              {sortable("verdict", "Verdict")}
              {sortable("confidence", "Confidence")}
              {sortable("status", "Status")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const check = r.source && r.source !== "report" && r.source !== "none" ? checks.find((c) => c.kind === r.source) : undefined
              const pageText = r.source === "report" && r.page ? pages[r.page - 1] : undefined
              const id = String(r.id)
              return (
                <Fragment key={r.id}>
                  <TableRow {...keys.rowProps(i)} aria-selected={selection.isSelected(id)} className={rowStateClass}>
                    <TableCell><Checkbox aria-label={`Select ${r.qid}`} checked={selection.isSelected(id)} onCheckedChange={() => selection.toggle(id)} /></TableCell>
                    <TableCell className="align-top font-mono text-xs text-muted-foreground">{r.qid}</TableCell>
                    <TableCell className="max-w-72 min-w-56 align-top text-xs whitespace-normal">
                      <p className="mb-1 text-muted-foreground">{r.question}</p>
                      <p>{r.answer}</p>
                    </TableCell>
                    <TableCell className="max-w-80 min-w-56 align-top text-xs whitespace-normal">
                      <p className="mb-1 font-mono text-[11px] text-muted-foreground">
                        {r.source === "report" ? `report p${r.page}` : r.source === "none" || !r.source ? "no evidence" : `check: ${r.source}`}
                      </p>
                      {r.evidence ? <p className={check ? "font-mono text-[11px] break-all" : ""}>{r.evidence}</p> : check ? <p className="font-mono text-[11px] break-all">{check.raw}</p> : null}
                      {pageText && (
                        <Button variant="link" size="xs" className="px-0" onClick={(e) => { e.stopPropagation(); setOpen(open === r.id ? null : r.id) }}>
                          {open === r.id ? "hide page" : "full page text"}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {r.verdict ? <StatusBadge tone={verdictTone[r.verdict]}>{label(r.verdict)}</StatusBadge> : "-"}
                      {r.confidence != null && r.confidence < NEEDS_REVIEW_BELOW && <p className="mt-1 font-mono text-[11px] text-warning">needs review</p>}
                    </TableCell>
                    <TableCell className="align-top">{r.confidence != null ? <ConfidenceMeter value={r.confidence} /> : "-"}</TableCell>
                    <TableCell className="align-top"><StatusBadge tone={statusTone[r.status]}>{r.status}</StatusBadge></TableCell>
                  </TableRow>
                  {open === r.id && pageText && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-panel text-xs whitespace-pre-wrap">
                        <p className="mb-1 font-mono text-[11px] text-muted-foreground">report page {r.page}</p>
                        {pageText}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
