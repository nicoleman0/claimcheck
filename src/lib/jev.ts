import { endpoints, models, openrouterKey, timeouts } from "@/lib/models"
import type { Answer, CheckResult, Finding, Recommendation, Review, ReviewItem, Vendor } from "@/lib/types"
import { CHECK_KINDS, VERDICTS } from "@/lib/types"

// One POST to the decisions endpoint; throws on transport, status or shape problems.
type ChoiceAnswer = { choice?: unknown; confidence?: unknown; probabilities?: Record<string, number> }
type ScoreAnswer = { score?: unknown; confidence?: unknown; legend?: Record<string, string>; probabilities?: Record<string, number> }
type NoulAnswer = { noul?: unknown }
type DecisionAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer
type DecisionResponse = { answers?: Record<string, DecisionAnswer>; model?: string }

async function decide(
  state: string,
  questions: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ answers: Record<string, DecisionAnswer>; model: string }> {
  const res = await fetch(endpoints.decisions, {
    method: "POST",
    headers: { Authorization: `Bearer ${openrouterKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: models.jev, state, questions }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 200)
    throw new Error(`Jev ${res.status}: ${detail}`)
  }
  const body = (await res.json()) as DecisionResponse
  if (!body.answers || typeof body.answers !== "object") throw new Error("Jev returned no answers")
  return { answers: body.answers, model: body.model ?? models.jev }
}

async function safely(
  fn: () => Promise<{ answers: Record<string, DecisionAnswer>; model: string }>,
): Promise<{ answers: Record<string, DecisionAnswer>; model: string } | Error> {
  try {
    return await fn()
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

const CHECK_SOURCE_GUIDANCE: Record<(typeof CHECK_KINDS)[number], string> = {
  dmarc: "The live DNS check of the vendor's DMARC policy record (_dmarc.<domain>).",
  spf: "The live DNS check of the vendor's SPF policy record (<domain>).",
  tls: "The live TLS connection check to <domain>:443 (protocol version negotiated and certificate status).",
  hsts: "The live HTTP header check for strict-transport-security on the vendor's homepage.",
  csp: "The live HTTP header check for content-security-policy on the vendor's homepage.",
  security_txt: "The live check of https://<domain>/.well-known/security.txt and whether its Expires date has passed.",
  hibp: "The live Have I Been Pwned breach lookup for the vendor's domain.",
  kev: "The live CISA Known Exploited Vulnerabilities feed filtered for this vendor.",
}

const VERDICT_CRITERIA = {
  agrees: "The evidence directly supports the answer.",
  contradicts:
    "The evidence shows the answer is false or overstated: an exception, a scope exclusion, a different frequency or a weaker setting. State that a claim only partly supported is a contradiction.",
  no_evidence: "Nothing in the evidence addresses this claim.",
}

export const firstLine = (text: string, chars = 120): string =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean)
    ?.slice(0, chars) ?? ""

const checkLine = (c: CheckResult) => {
  const bits = [`ok=${c.ok === null ? "unavailable" : c.ok}`]
  if (c.value) bits.push(`value=${JSON.stringify(c.value)}`)
  if (c.error) bits.push(`error=${JSON.stringify(c.error)}`)
  return `${c.kind}: ${bits.join(" ")}`
}

export function reviewState(checks: CheckResult[], pages: string[]): string {
  return [
    "Live checks that ran against the vendor's public presence during this assessment:",
    ...checks.map(checkLine),
    "",
    "Vendor questionnaire answers are judged against the vendor's SOC 2 report pages and the live checks below.",
    ...pages.map((page, i) => `[Page ${i + 1}]\n${page}`),
  ].join("\n")
}

// One decisions request for every answer: a pair of questions per answer.
export async function reviewAnswers(answers: Answer[], pages: string[], checks: CheckResult[]): Promise<Review> {
  if (!answers.length) return { ok: false, error: "no answers to review" }
  const questions: Record<string, unknown> = {}
  for (const a of answers) {
    questions[`${a.qid}_verdict`] = {
      type: "choice",
      instructions: `Vendor claim ${a.qid} (section ${a.section}): "${a.question}" The vendor answered: "${a.answer}". Judge this claim against the evidence. A claim that is only partly supported is a contradiction.`,
      criteria: VERDICT_CRITERIA,
    }
    const sourceCriteria: Record<string, string> = {}
    pages.forEach((page, i) => {
      sourceCriteria[`p${i + 1}`] = `[Page ${i + 1}] ${firstLine(page)}`
    })
    for (const kind of CHECK_KINDS) sourceCriteria[kind] = CHECK_SOURCE_GUIDANCE[kind]
    sourceCriteria.none = "No usable evidence for this claim."
    questions[`${a.qid}_source`] = {
      type: "choice",
      instructions: `Claim ${a.qid}: "${a.question}" Name the evidence your verdict on this claim stands on. If the SOC 2 report alone decides it, answer the report page as pN (page 7 is p7). If a live check alone decides it, answer that check's name (${CHECK_KINDS.join(", ")}). If both do, pick the one that decides it. Answer none only when the claim has no evidence at all.`,
      criteria: sourceCriteria,
    }
  }

  const outcome = await safely(() => decide(reviewState(checks, pages), questions, timeouts.jev))
  if (outcome instanceof Error) return { ok: false, error: outcome.message }

  const findings: ReviewItem[] = []
  const problems: string[] = []
  for (const a of answers) {
    const verdict = outcome.answers[`${a.qid}_verdict`] as ChoiceAnswer | undefined
    const source = outcome.answers[`${a.qid}_source`] as ChoiceAnswer | undefined
    if (!verdict || typeof verdict.choice !== "string") {
      problems.push(`${a.qid}: verdict missing`)
      continue
    }
    const v = verdict.choice.trim().toLowerCase()
    if (!(VERDICTS as readonly string[]).includes(v)) {
      problems.push(`${a.qid}: unknown verdict ${JSON.stringify(verdict.choice)}`)
      continue
    }
    const confidence = Number(verdict.confidence) === Number(verdict.confidence) ? Number(verdict.confidence) : 0
    if (!source || typeof source.choice !== "string") {
      problems.push(`${a.qid}: source missing`)
      continue
    }
    const src = source.choice.trim().toLowerCase()
    let resolved: ReviewItem["source"]
    let page: number | null = null
    if (src === "none") {
      resolved = "none"
    } else if ((CHECK_KINDS as readonly string[]).includes(src)) {
      resolved = src as ReviewItem["source"]
    } else {
      const m = /^p(\d+)$/.exec(src)
      const n = m ? Number(m[1]) : NaN
      if (!m || n < 1 || n > pages.length) {
        problems.push(`${a.qid}: unknown source ${JSON.stringify(source.choice)}`)
        continue
      }
      resolved = "report"
      page = n
    }
    findings.push({
      qid: a.qid,
      verdict: v as ReviewItem["verdict"],
      confidence: Math.min(1, Math.max(0, confidence)),
      source: resolved,
      page,
    })
  }
  if (problems.length) return { ok: false, error: `Jev returned unusable answers: ${problems.slice(0, 5).join("; ")}` }
  return { ok: true, model: outcome.model, findings }
}

export async function recommend(vendor: Vendor, findings: Finding[]): Promise<Recommendation | null> {
  void vendor; void findings
  return null
}

const STOPWORDS = new Set(
  "a an and are as at be been but by for from has have if in into is it its of on or our so that the their them then these this to was we were will with you your".split(" "),
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
    const hitCount = sentenceWords.filter((w) => target.has(w)).length
    if (!hitCount) continue
    const score = hitCount / Math.sqrt(sentenceWords.length)
    if (score > bestScore) {
      bestScore = score
      best = sentence
    }
  }
  return best || flat.slice(0, 300)
}
