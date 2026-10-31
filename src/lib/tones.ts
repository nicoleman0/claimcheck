import type { Tone } from "@/components/status-badge"

export const statusTone: Record<string, Tone> = {
  new: "neutral", assessing: "info", awaiting_vendor: "warning", approved: "success", approved_with_conditions: "info", rejected: "danger",
}
export const riskTone: Record<string, Tone> = { low: "success", medium: "info", high: "warning", critical: "danger" }
export const verdictTone: Record<string, Tone> = { contradicts: "warning", no_evidence: "neutral", agrees: "info" }
export const label = (s: string) => s.replaceAll("_", " ")
