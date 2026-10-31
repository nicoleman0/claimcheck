"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { decideAction } from "@/app/actions"
import { Panel } from "@/components/data"
import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ACTIONS, type Action, type Decision } from "@/lib/types"

const items = ACTIONS.map((a) => ({ value: a, label: a }))

export function DecisionForm({ assessmentId, decision }: { assessmentId: number; decision: Decision | null }) {
  const router = useRouter()
  const [action, setAction] = useState<Action | null>(decision?.analystAction ?? null)
  const [reason, setReason] = useState(decision?.reason ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!action) return setError("Choose a decision.")
    if (!reason.trim()) return setError("A reason is required.")
    setError(null)
    start(async () => {
      const r = await decideAction(assessmentId, action, reason)
      if (r.error) return setError(r.error)
      toast.success(`Decision recorded: ${action}`)
      router.refresh()
    })
  }

  return (
    <Panel label="Analyst decision">
      {decision?.decidedAt && (
        <p className="mb-3 text-sm">
          Recorded <span className="font-semibold">{decision.analystAction}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{decision.decidedAt.slice(0, 16).replace("T", " ")} UTC · model recommended {decision.model === "none" ? "nothing" : decision.action}</span>
          <span className="mt-1 block text-xs">{decision.reason}</span>
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label>Decision</Label>
          <Select items={items} value={action} onValueChange={(v) => setAction(v as Action)}>
            <SelectTrigger className="w-full" aria-label="Decision"><SelectValue placeholder="choose" /></SelectTrigger>
            <SelectContent>
              {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reason">Reason (required)</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        {error && <ErrorState title="Not recorded" message={error} />}
        <Button type="submit" size="sm" disabled={pending} className="self-start">{pending ? "saving…" : decision?.decidedAt ? "update decision" : "record decision"}</Button>
      </form>
    </Panel>
  )
}
