"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Panel, ProbabilityBars, RiskScale } from "@/components/data"
import { EmptyState, ErrorState, LoadingRows } from "@/components/states"
import { Button } from "@/components/ui/button"
import { ACTIONS, RISKS, type Decision } from "@/lib/types"

export function RecommendationPanel({ assessmentId, decision, reviewed, accepted }: { assessmentId: number; decision: Decision | null; reviewed: boolean; accepted: number }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auto = useRef(false)
  const hasRec = decision && decision.model !== "none"

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/recommend`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }, [assessmentId, router])

  // Re-run after every accept or dismiss.
  useEffect(() => {
    const on = () => void run()
    window.addEventListener("findings-changed", on)
    return () => window.removeEventListener("findings-changed", on)
  }, [run])

  useEffect(() => {
    if (reviewed && accepted > 0 && !hasRec && !auto.current) {
      auto.current = true
      void run()
    }
  }, [reviewed, accepted, hasRec, run])

  return (
    <Panel label="Recommendation" emphasis>
      {running && <LoadingRows rows={3} />}
      {!running && error && <ErrorState title="Recommendation unavailable" message={error} onRetry={run} />}
      {!running && !error && (!hasRec || accepted === 0) && <EmptyState title={reviewed ? "No recommendation yet" : "Waiting for the review"} description="Accept findings to get a recommendation; it updates after every accept or dismiss." />}
      {!running && hasRec && accepted > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Recommended: <span className="font-semibold">{decision.action}</span>
            <span className="block font-mono text-[11px] text-muted-foreground">over {accepted} accepted findings · {decision.model}</span>
          </p>
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted-foreground uppercase">Action</p>
            <ProbabilityBars options={ACTIONS.map((a) => ({ label: a, p: decision.actionProbs[a] ?? 0 }))} />
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted-foreground uppercase">Residual risk (score {decision.riskScore.toFixed(2)} of 3)</p>
            <RiskScale levels={[...RISKS]} probabilities={RISKS.map((r) => decision.riskProbs[r] ?? 0)} />
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted-foreground uppercase">Misrepresented its controls</p>
            <ProbabilityBars options={[{ label: "yes", p: decision.misrepresented }, { label: "no", p: 1 - decision.misrepresented }]} />
          </div>
          <Button size="sm" variant="outline" className="self-start" onClick={run}>re-run</Button>
        </div>
      )}
    </Panel>
  )
}
