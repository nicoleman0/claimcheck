import type { Answer, CheckResult, Finding, Recommendation, Review, Vendor } from "@/lib/types"

// Stubs: builder B implements against the decisions API.
export async function reviewAnswers(answers: Answer[], pages: string[], checks: CheckResult[]): Promise<Review> {
  void answers; void pages; void checks
  return { ok: false, error: "not implemented" }
}

export async function recommend(vendor: Vendor, findings: Finding[]): Promise<Recommendation | null> {
  void vendor; void findings
  return null
}

// The sentence in pageText with the most word overlap with answer.
export function evidenceSentence(pageText: string, answer: string): string {
  void answer
  return pageText.slice(0, 200)
}
