import { endpoints, models, openrouterKey, timeouts } from "@/lib/models"
import type { Action, Answer, CheckResult, Finding, Recommendation, Review, ReviewItem, Risk, Vendor } from "@/lib/types"
import { ACTIONS, CHECK_KINDS, RISKS, VERDICTS } from "@/lib/types"

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

// Plain sentences, so Jev reads the control and its outcome without knowing the kind codes.
const CHECK_STATEMENT: Record<(typeof CHECK_KINDS)[number], string> = {
  dmarc: "The DMARC policy found in DNS for the vendor's domain (_dmarc record).",
  spf: "The SPF policy found in DNS for the vendor's domain.",
  tls: "A TLS connection to the vendor's website: the protocol version negotiated and whether its certificate is trusted.",
  hsts: "The strict-transport-security response header on the vendor's homepage.",
  csp: "The content-security-policy response header on the vendor's homepage.",
  security_txt: "The security policy at the vendor's /.well-known/security.txt, including whether its Expires date has passed.",
  hibp: "The breach history of the vendor's domain recorded by Have I Been Pwned.",
  kev: "Known exploited vulnerabilities attributed to the vendor in the CISA KEV feed.",
}

const checkLine = (c: CheckResult) => {
  const verdict = c.ok === null ? "UNAVAILABLE" : c.ok ? "PASS" : "FAIL"
  const details = [
    c.value ? `reported value: ${JSON.stringify(c.value)}` : null,
    c.error ? `error: ${c.error}` : null,
  ]
    .filter(Boolean)
    .join(", ")
  return `[Check ${c.kind}] ${CHECK_STATEMENT[c.kind]} Result: ${verdict}${details ? ` (${details})` : ""}. Raw: ${c.raw || "(none)"}`
}

export function reviewState(checks: CheckResult[], pages: string[]): string {
  return [
    "Evidence part 1: live checks that just ran against the vendor's public domain.",
    ...checks.map(checkLine),
    "",
    "Evidence part 2: the vendor's SOC 2 report, page by page.",
    ...pages.map((page, i) => `[Page ${i + 1}]\n${page}`),
    "",
    "Evidence part 3: the same live checks again against the vendor's public domain. These are current facts and override the vendor's answers.",
    ...checks.map(checkLine),
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

export const RECOMMEND_PROFILE = "Payroll and pensions provider for UK/EU customers. It processes national insurance numbers, bank details and salary data. Rate it as a critical-regulation third party: a control failure or an upside-down questionnaire answer puts employee data and money at risk."

function recommendState(vendor: Vendor, accepted: Finding[], unsupported: Finding[]): string {
  const lines = [
    `Vendor under review: ${vendor.name} (${vendor.domain}), current register status: ${vendor.status}.`,
    RECOMMEND_PROFILE,
    "",
    "Accepted findings — vendor claims the evidence (SOC 2 report or live checks) shows are false or overstated:",
  ]
  for (const f of accepted) {
    lines.push(
      `- [${f.qid}] ${f.question} The vendor answered: "${f.answer}"` +
      (f.evidence ? ` Evidence: ${f.evidence.slice(0, 400)}` : " Evidence: (arbitrated)"),
    )
  }
  if (!accepted.length) lines.push("- (none)")
  lines.push("", "Unsupported claims — the vendor gave an answer but the evidence does not address it either way:")
  for (const f of unsupported) lines.push(`- [${f.qid}] ${f.question} The vendor answered: "${f.answer}"`)
  if (!unsupported.length) lines.push("- (none)")
  return lines.join("\n")
}

const RISK_OPTIONS = ["low", "medium", "high", "critical"]
const prob = (record: unknown, key: string): number => {
  const value = (record as Record<string, unknown> | undefined)?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// Residual risk from the accepted findings plus the unsupported claims; null on any failure, never a guess.
export async function recommend(vendor: Vendor, findings: Finding[]): Promise<Recommendation | null> {
  const accepted = findings.filter((f) => f.status === "accepted" && f.verdict !== null)
  const unsupported = findings.filter((f) => f.verdict === "no_evidence")
  const outcome = await safely(() =>
    decide(
      recommendState(vendor, accepted, unsupported),
      {
        risk: {
          type: "score",
          instructions: "The residual risk of continuing to use this vendor after the accepted findings above. The accepted findings drive the score; unsupported claims add modest uncertainty only.",
          criteria: RISK_OPTIONS,
        },
        action: {
          type: "choice",
          instructions: "What we recommend the analyst do about this vendor, given the accepted findings.",
          criteria: {
            approve: "No accepted finding touches the vendor's core payroll, identity or data-handling controls; residual risk is low.",
            "approve with conditions": "Residual risk is medium, or a small number of findings must be remediated first.",
            reject: "Residual risk is high or critical, or the evidence shows the vendor's questionnaire answers were materially wrong.",
          },
        },
        misrepresented: {
          type: "noul",
          instructions: "How strongly does the accepted evidence show the vendor misrepresented its controls in the questionnaire?",
          criteria: {
            true: "Accepted findings straightforwardly contradict questionnaire answers about the same controls.",
            false: "The answers hold up in the evidence, or the gaps are minor process deviations rather than false statements.",
          },
        },
      },
      timeouts.jev,
    ),
  )
  if (outcome instanceof Error) {
    console.error("recommend failed:", outcome.message)
    return null
  }

  const risk = outcome.answers.risk as ScoreAnswer | undefined
  const action = outcome.answers.action as ChoiceAnswer | undefined
  const misrep = outcome.answers.misrepresented as NoulAnswer | undefined
  const riskScore = Number(risk?.score)
  if (!Number.isFinite(riskScore)) return null
  if (!action || typeof action.choice !== "string") return null

  // Score probabilities come back keyed "0".."3"; action probabilities by option name.
  const choice = action.choice.trim().toLowerCase()
  if (!(ACTIONS as readonly string[]).includes(choice)) return null
  const misrepresented = misrep && Number.isFinite(Number(misrep.noul)) ? clamp01(Number(misrep.noul)) : 0
  const riskProbs = Object.fromEntries(RISKS.map((name, i) => [name, clamp01(prob(risk?.probabilities, String(i)))])) as Record<Risk, number>

  return {
    riskScore: Math.min(3, Math.max(0, riskScore)),
    riskProbs,
    action: choice as Action,
    actionProbs: Object.fromEntries(ACTIONS.map((name) => [name, clamp01(prob(action.probabilities, name))])) as Record<Action, number>,
    misrepresented,
    model: outcome.model,
  }
}

const STOPWORDS = new Set(
  "a an and are as at be been but by for from has have if in into is it its of on or our so that the their them then these this to was we were will with you your".split(" "),
)

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []

// Lines that appear on more than half of a document's pages are report furniture, never the deciding evidence.
function repeatedLines(allPages: string[], pageText: string): string {
  if (allPages.length < 2) return pageText
  const pagesWithLine = new Map<string, number>()
  for (const page of allPages) {
    for (const line of new Set(page.split("\n").map((l) => l.trim()).filter(Boolean))) {
      pagesWithLine.set(line, (pagesWithLine.get(line) ?? 0) + 1)
    }
  }
  const kept = pageText
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      return (pagesWithLine.get(trimmed) ?? 0) <= allPages.length / 2
    })
    .join("\n")
  return kept || pageText
}

// The sentence in pageText with the most word overlap with the answer, ties broken by concentration.
// Pass allPages to ignore lines repeated on more than half the document's pages.
export function evidenceSentence(pageText: string, answer: string, allPages: string[] = []): string {
  const flat = repeatedLines(allPages, pageText).replace(/\s+/g, " ").trim()
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
