// Deterministic sample rows for the list pattern page.
export const VERDICTS = ["contradicts", "no_evidence", "agrees"] as const
export type Verdict = (typeof VERDICTS)[number]
export type SampleRow = { id: string; claim: string; verdict: Verdict; confidence: number }

const claims = [
  "Records are encrypted at rest",
  "Access is reviewed quarterly",
  "Data is deleted within 30 days",
  "Backups are restore-tested",
  "MFA is enforced for admins",
  "Incidents are reported within 24 hours",
  "Suppliers are assessed annually",
]

export const sample: SampleRow[] = Array.from({ length: 57 }, (_, i) => ({
  id: `F${String(i + 1).padStart(3, "0")}`,
  claim: claims[i % claims.length],
  verdict: VERDICTS[(i * 7) % 3],
  confidence: Math.round((0.35 + ((i * 37) % 65) / 100) * 100) / 100,
}))
