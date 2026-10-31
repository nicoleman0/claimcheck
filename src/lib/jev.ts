import type { Answer, CheckResult, Finding, Recommendation, Review, Vendor } from "@/lib/types"

// Stubs: implemented in later commits. reviewAnswers must never invent verdicts.
export async function reviewAnswers(answers: Answer[], pages: string[], checks: CheckResult[]): Promise<Review> {
  void answers; void pages; void checks
  return { ok: false, error: "not implemented" }
}

export async function recommend(vendor: Vendor, findings: Finding[]): Promise<Recommendation | null> {
  void vendor; void findings
  return null
}

const STOPWORDS = new Set(
  "a an and are as at be been but by for from has have if in into is it its of on or our that the their them then these this to was we were will with you your".split(" "),
)

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []

// The sentence in pageText with the most word overlap with the answer, ties broken by concentration.
export function evidenceSentence(pageText: string, answer: string): string {
  const flat = pageText.replace(/\s+/g, " ").trim()
  const target = new Set(words(answer))
  if (!target.size) return flat.slice(0, 300)
  let best = ""
  let bestScore = -1
  for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
    const sentenceWords = words(sentence)
    const hit = new Set(sentenceWords.filter((w) => target.has(w)))
    if (!hit.size) continue
    const score = hit.size / Math.sqrt(sentenceWords.length)
    if (score > bestScore) {
      bestScore = score
      best = sentence
    }
  }
  return best || flat.slice(0, 300)
}
