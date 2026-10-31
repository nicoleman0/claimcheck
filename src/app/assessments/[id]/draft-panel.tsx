"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Panel } from "@/components/data"
import { EmptyState, ErrorState, LoadingRows } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function DraftPanel({ assessmentId, draft, model, approvedAt, accepted }: { assessmentId: number; draft: string | null; model: string | null; approvedAt: string | null; accepted: number }) {
  const router = useRouter()
  const [text, setText] = useState(draft ?? "")
  const [busy, setBusy] = useState<"draft" | "approve" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(kind: "draft" | "approve") {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/draft`, kind === "draft"
        ? { method: "POST" }
        : { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (kind === "draft") setText(body.text)
      toast.success(kind === "draft" ? `Draft written by ${body.model}` : "Follow-up approved. Nothing was sent.")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel label="Follow-up email">
      {busy === "draft" ? <LoadingRows rows={4} /> : !draft && !text ? (
        <EmptyState title="No draft" description={accepted ? `Draft an email from the ${accepted} accepted findings.` : "Accept findings first, then draft."} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] text-muted-foreground">written by {model ?? "unknown"}{approvedAt ? ` · approved ${approvedAt.slice(0, 16).replace("T", " ")} UTC · not sent` : ""}</p>
          <Textarea aria-label="Follow-up email" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-xs" />
        </div>
      )}
      {error && <div className="mt-2"><ErrorState title="Draft failed" message={error} /></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy || !accepted} onClick={() => call("draft")}>{draft ? "redraft" : "draft follow-up"}</Button>
        {(draft || text) && <Button size="sm" disabled={!!busy || !text.trim()} onClick={() => call("approve")}>{approvedAt ? "approved, save edits" : "approve"}</Button>}
      </div>
    </Panel>
  )
}
