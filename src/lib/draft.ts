import type { Finding, Vendor } from "@/lib/types"

export function templateDraft(vendor: Vendor, findings: Finding[]): string {
  const items = findings.map((f) => `- ${f.qid} ${f.question}\n  Your answer: ${f.answer}\n  What we found: ${f.evidence ?? "no supporting evidence"}`)
  return `Subject: Follow-up on your security questionnaire\n\nHello ${vendor.name} team,\n\nThank you for your questionnaire and SOC 2 report. Before we can complete our assessment, please clarify the following:\n\n${items.join("\n")}\n\nKind regards,\nThird-party risk`
}

// Stub: builder A adds the DeepSeek then GLM chain in front of the template.
export async function draftFollowUp(vendor: Vendor, findings: Finding[]): Promise<{ text: string; model: string }> {
  return { text: templateDraft(vendor, findings), model: "template" }
}
