"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { ErrorState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MAX = 4 * 1024 * 1024

function clientCheck(form: FormData): string | null {
  const q = form.get("questionnaire"), r = form.get("report")
  if (!(q instanceof File) || !q.size) return "Choose a questionnaire CSV."
  if (!(r instanceof File) || !r.size) return "Choose a SOC 2 report PDF."
  if (q.size > MAX || r.size > MAX) return "Each file must be 4 MB or smaller."
  return null
}

export function NewAssessmentForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const bad = clientCheck(form)
    if (bad) return setError(bad)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/assessments", { method: "POST", body: form })
      const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }))
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`)
      router.push(`/assessments/${body.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="domain">Supplier domain</Label>
        <Input id="domain" name="domain" required placeholder="tallyfern.co.uk" pattern="[A-Za-z0-9.-]+\.[A-Za-z]{2,}" className="font-mono" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Supplier name (optional)</Label>
        <Input id="name" name="name" placeholder="Tallyfern Ltd" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="questionnaire">Questionnaire (CSV)</Label>
        <Input id="questionnaire" name="questionnaire" type="file" accept=".csv,text/csv" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report">SOC 2 report (PDF)</Label>
        <Input id="report" name="report" type="file" accept=".pdf,application/pdf" required />
      </div>
      {error && <ErrorState title="Could not start the assessment" message={error} />}
      <Button type="submit" disabled={busy} className="self-start">{busy ? "uploading and running checks…" : "start assessment"}</Button>
    </form>
  )
}
