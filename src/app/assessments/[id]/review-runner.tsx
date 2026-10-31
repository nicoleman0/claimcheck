"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { ErrorState, LoadingRows } from "@/components/states"

export function ReviewRunner({ assessmentId, reviewed, error, model }: { assessmentId: number; reviewed: boolean; error: string | null; model: string | null }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<string | null>(error)
  const started = useRef(false)

  async function run() {
    setRunning(true)
    setFailure(null)
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/review`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (!reviewed && !error && !started.current) {
      started.current = true
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewed, error])

  if (running) return <div className="mb-3"><p className="mb-2 font-mono text-xs text-muted-foreground">reviewing every answer against the report and checks…</p><LoadingRows rows={6} /></div>
  if (failure && !reviewed) return <ErrorState title="Review unavailable" message={`The model review did not complete (${failure}). Checks and answers are kept. Retry.`} onRetry={run} />
  if (reviewed && model) return <p className="mb-3 font-mono text-[11px] text-muted-foreground">verdicts by {model}</p>
  return null
}
