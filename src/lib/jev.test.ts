import { beforeEach, expect, test } from "bun:test"

import type { Answer, CheckResult } from "@/lib/types"
import { CHECK_KINDS } from "@/lib/types"

import { evidenceSentence, recommend, reviewAnswers } from "./jev"

process.env.OPENROUTER_API_KEY ??= "test-key"

const answer = (qid = "Q01", over: Partial<Answer> = {}): Answer => ({
  qid,
  section: "General",
  question: `Claim ${qid}?`,
  answer: `Yes for ${qid}.`,
  ...over,
})
const check = (kind: CheckResult["kind"], over: Partial<CheckResult> = {}): CheckResult => ({
  kind,
  ok: true,
  value: "present",
  raw: `${kind} raw record`,
  error: null,
  ms: 10,
  ...over,
})

const endpoint = "https://openrouter.ai/api/alpha/decisions"

type Call = { url: string; body: { state: string; questions: Record<string, { criteria?: Record<string, string>; instructions?: string }> } }
let calls: Call[] = []

function mockFetch(respond: (body: Call["body"]) => unknown, status = 200) {
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push({ url: String(_url), body })
    return new Response(JSON.stringify(typeof respond === "function" ? respond(body) : respond), { status })
  }) as typeof fetch
}

beforeEach(() => {
  calls = []
})

const pair = (a: Answer, verdict: string, source: string, confidence = 0.9, page?: number) => ({
  [`${a.qid}_verdict`]: { choice: verdict, confidence, probabilities: { [verdict]: 1 } },
  [`${a.qid}_source`]: { choice: page != null ? `p${page}` : source, confidence, probabilities: {} },
})

test("review returns one finding per answer and maps pages to 1-based page numbers", async () => {
  const a1 = answer("Q01")
  const a2 = answer("Q02")
  mockFetch(() => ({
    model: "typesafe/jev-1.14",
    answers: { ...pair(a1, "agrees", "", 0.8, 2), ...pair(a2, "contradicts", "csp", 0.95) },
  }))
  const review = await reviewAnswers([a1, a2], ["Page one text\n", "Page two text\n"], [check("csp", { ok: false, value: "" })])
  expect(review.ok).toBe(true)
  if (!review.ok) return
  expect(review.model).toBe("typesafe/jev-1.14")
  expect(review.findings).toEqual([
    { qid: "Q01", verdict: "agrees", confidence: 0.8, source: "report", page: 2 },
    { qid: "Q02", verdict: "contradicts", confidence: 0.95, source: "csp", page: null },
  ])

  // One request, with both pair questions named after qids and full state.
  expect(calls).toHaveLength(1)
  expect(calls[0]!.url).toBe(endpoint)
  const names = Object.keys(calls[0]!.body.questions)
  expect(names).toContain("Q01_verdict")
  expect(names).toContain("Q01_source")
  expect(names).toContain("Q02_verdict")
  const sourceCriteria = calls[0]!.body.questions.Q01_source?.criteria as Record<string, string>
  expect(sourceCriteria.p1).toContain("[Page 1]")
  expect(sourceCriteria.p2).toContain("[Page 2]")
  expect(Object.keys(sourceCriteria)).toEqual(["p1", "p2", ...CHECK_KINDS, "none"])
  expect(calls[0]!.body.state).toContain("[Page 2]")
  expect(calls[0]!.body.state).toContain("[Check csp]")
  expect(calls[0]!.body.state).toContain("Part 2: the vendor's SOC 2 report, page by page.")
})

test("missing Jev answers fail the review with a usable error", async () => {
  mockFetch(() => ({ model: "m", answers: { Q01_verdict: { choice: "agrees", confidence: 0.9 } } }))
  const review = await reviewAnswers([answer("Q01")], ["p"], [check("tls")])
  expect(review).toMatchObject({ ok: false })
  if (!review.ok) expect(review.error).toContain("Q01: source missing")
})

test("unknown verdict strings fail the review", async () => {
  mockFetch(() => ({ model: "m", answers: pair(answer("Q01"), "maybe", "none") }))
  const review = await reviewAnswers([answer("Q01")], ["p"], [check("tls")])
  expect(review).toMatchObject({ ok: false })
  if (!review.ok) expect(review.error).toContain("unknown verdict")
})

test("an out-of-range page fails the review", async () => {
  mockFetch(() => ({ model: "m", answers: pair(answer("Q01"), "agrees", "", 0.9, 9) }))
  const review = await reviewAnswers([answer("Q01")], ["p"], [check("tls")])
  expect(review).toMatchObject({ ok: false })
  if (!review.ok) expect(review.error).toContain("unknown source")
})

test("HTTP and transport errors return ok:false with the API's message, never verdicts", async () => {
  mockFetch(() => ({ error: { message: "rate limited" } }), 500)
  const review = await reviewAnswers([answer("Q01")], ["p"], [check("tls")])
  expect(review).toMatchObject({ ok: false })
  if (!review.ok) expect(review.error).toContain("Jev 500")
})

test("an empty answer list reports a failure without calling Jev", async () => {
  const review = await reviewAnswers([], ["p"], [check("tls")])
  expect(review).toMatchObject({ ok: false, error: "no answers to review" })
  expect(calls).toHaveLength(0)
})

const vendor = {
  id: 1,
  name: "Tallyfern Ltd",
  domain: "tallyfern.co.uk",
  owner: "analyst",
  status: "assessing" as const,
  risk: null,
  nextReview: null,
  createdAt: "2026-10-31T00:00:00.000Z",
}

const finding = (qid: string, over: Partial<import("@/lib/types").Finding> = {}): import("@/lib/types").Finding => ({
  id: 1,
  assessmentId: 1,
  qid,
  section: "Access control",
  question: `Claim ${qid}?`,
  answer: `Yes for ${qid}.`,
  verdict: "contradicts",
  confidence: 0.95,
  source: "report",
  page: 19,
  evidence: "MFA was not enforced on 3 of 25 admin accounts during the period.",
  status: "accepted",
  ...over,
})

const recBody = {
  model: "typesafe/jev-1.14",
  answers: {
    risk: {
      score: 2.3,
      legend: { "0": "low", "1": "medium", "2": "high", "3": "critical" },
      probabilities: { "0": 0.05, "1": 0.1, "2": 0.6, "3": 0.25 },
      confidence: 0.8,
    },
    action: {
      choice: "reject",
      confidence: 0.9,
      probabilities: { approve: 0.02, "approve with conditions": 0.1, reject: 0.88 },
    },
    misrepresented: { noul: 0.91 },
  },
}

test("recommend maps score, choice and noul answers onto the Recommendation shape", async () => {
  mockFetch(() => recBody)
  const rec = await recommend(vendor, [finding("Q08"), finding("Q30", { verdict: "no_evidence", status: "open", evidence: null, page: null })])
  expect(rec).toEqual({
    riskScore: 2.3,
    riskProbs: { low: 0.05, medium: 0.1, high: 0.6, critical: 0.25 },
    action: "reject",
    actionProbs: { approve: 0.02, "approve with conditions": 0.1, reject: 0.88 },
    misrepresented: 0.91,
    model: "typesafe/jev-1.14",
  })
  if (!rec) return

  // State carries the vendor profile, accepted findings with evidence, and unsupported claims.
  const state = calls[0]!.body.state
  expect(state).toContain("Payroll and pensions provider")
  expect(state).toContain("Q08")
  expect(state).toContain("MFA was not enforced on 3 of 25 admin accounts")
  expect(state).toContain("Q30")
  const questions = calls[0]!.body.questions as Record<string, { type: string; criteria: unknown }>
  expect(questions.risk?.type).toBe("score")
  expect(questions.action?.type).toBe("choice")
  expect(Object.keys(questions.action?.criteria as object)).toEqual(["approve", "approve with conditions", "reject"])
  expect(questions.misrepresented?.type).toBe("noul")
})

test("recommend returns null when the action is not an approved option", async () => {
  mockFetch(() => ({ ...recBody, answers: { ...recBody.answers, action: { choice: "suspend" } } }))
  expect(await recommend(vendor, [finding("Q08")])).toBeNull()
})

test("recommend returns null on HTTP errors, transport failures and missing score", async () => {
  mockFetch(() => ({ error: { message: "overloaded" } }), 503)
  expect(await recommend(vendor, [finding("Q08")])).toBeNull()

  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed")
  }) as unknown as typeof fetch
  expect(await recommend(vendor, [finding("Q08")])).toBeNull()

  mockFetch(() => ({ ...recBody, answers: { misrepresented: { noul: 0.9 } } }))
  expect(await recommend(vendor, [finding("Q08")])).toBeNull()
})

test("evidenceSentence picks the decisive sentence", () => {
  const page = "Independence. The audit was performed by Calderbrook Assurance LLP in London.\n" +
    "All Tallyfern products are in scope of our SOC 2 Type II report. We also note that the auditor kept working papers.\n"
  const found = evidenceSentence(page, "All Tallyfern products are in scope of our SOC 2 Type II report.")
  expect(found).toContain("All Tallyfern products are in scope")

  const decisive =
    "The audit was performed in London over the period. HR Records is excluded from the scope of the report.\n" +
    "For the payroll platform, no exceptions were noted. The auditor is independent."
  expect(evidenceSentence(decisive, "Our SOC 2 report covers the payroll platform without exceptions.")).toContain("no exceptions were noted")

  const fallback = evidenceSentence("The weather was mild. Nothing relevant there.", "Cloudflare storage quotas")
  expect(fallback.startsWith("The weather was mild.")).toBe(true)
})
