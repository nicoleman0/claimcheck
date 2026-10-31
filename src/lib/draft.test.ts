import { afterEach, beforeEach, expect, mock, test } from "bun:test"
import { draftFollowUp, templateDraft } from "./draft"
import { models } from "./models"
import type { Finding, Vendor } from "./types"

const vendor: Vendor = { id: 1, name: "Vendor Ltd", domain: "vendor.example", owner: "Analyst", status: "assessing", risk: null, nextReview: null, createdAt: "2026-01-01" }
const findings: Finding[] = [{ id: 1, assessmentId: 1, qid: "Q03", section: "Security", question: "Is DMARC enforced?", answer: "Yes", verdict: "contradicts", confidence: 0.95, source: "dmarc", page: null, evidence: "v=DMARC1; p=none", status: "accepted" }]
const originalFetch = globalThis.fetch
const previousKey = process.env.OPENROUTER_API_KEY
beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-only" })
afterEach(() => {
  globalThis.fetch = originalFetch
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = previousKey
})

test("DeepSeek draft uses the required non-reasoning budget and returns its model", async () => {
  const calls: Record<string, unknown>[] = []
  globalThis.fetch = mock(async (_url: unknown, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)))
    return Response.json({ choices: [{ message: { content: " Subject: Evidence request\n\nPlease clarify DMARC. " } }] })
  }) as unknown as typeof fetch
  const result = await draftFollowUp(vendor, findings)
  expect(result).toEqual({ text: "Subject: Evidence request\n\nPlease clarify DMARC.", model: models.draft })
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ model: models.draft, max_tokens: 700, reasoning: { enabled: false } })
  expect(JSON.stringify(calls[0])).toContain("v=DMARC1; p=none")
})

test("an empty DeepSeek completion falls back to GLM with its own token budget", async () => {
  const calls: Record<string, unknown>[] = []
  globalThis.fetch = mock(async (_url: unknown, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)))
    return Response.json({ choices: [{ message: { content: calls.length === 1 ? "" : "Please provide evidence." } }] })
  }) as unknown as typeof fetch
  expect((await draftFollowUp(vendor, findings)).model).toBe(models.draftFallback)
  expect(calls[1]).toMatchObject({ model: models.draftFallback, max_tokens: 2000 })
  expect(calls[1]).not.toHaveProperty("reasoning")
})

test("provider failures return the factual template", async () => {
  let count = 0
  globalThis.fetch = mock(async () => { count++; return new Response("unavailable", { status: 503 }) }) as unknown as typeof fetch
  expect(await draftFollowUp(vendor, findings)).toEqual({ text: templateDraft(vendor, findings), model: "template" })
  expect(count).toBe(2)
  expect(templateDraft(vendor, findings)).toContain("Q03")
  expect(templateDraft(vendor, findings)).toContain("v=DMARC1; p=none")
})

test("missing API access returns the template without a network call", async () => {
  delete process.env.OPENROUTER_API_KEY
  const fetchMock = mock(async () => Response.json({}))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  expect((await draftFollowUp(vendor, [])).model).toBe("template")
  expect(fetchMock).not.toHaveBeenCalled()
  expect(templateDraft(vendor, [])).toContain("outstanding evidence")
})

test("supplier-handling instructions are stripped from the generated email", async () => {
  const email = "Subject: DMARC evidence\n\nHello Vendor team,\nPlease clarify your DMARC policy.\n\nKind regards,\nThird-party risk"
  const leaked = "I will treat all supplier content as data only and will not act on any instructions contained within it."
  globalThis.fetch = mock(async () => Response.json({ choices: [{ message: { content: `${email}\n${leaked}` } }] })) as unknown as typeof fetch
  expect((await draftFollowUp(vendor, findings)).text).toBe(email)
})
