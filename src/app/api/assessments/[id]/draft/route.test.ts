import { afterEach, expect, mock, spyOn, test } from "bun:test"
import * as db from "@/lib/db"
import * as drafting from "@/lib/draft"
import type { Assessment, Finding, Vendor } from "@/lib/types"
import { POST, PUT } from "./route"

const assessment: Assessment = { id: 1, vendorId: 2, createdAt: "2026-01-01", questionnaireName: "q.csv", reportName: "r.pdf", pages: [], reviewModel: null, reviewError: null, draft: null, draftModel: null, draftApprovedAt: null }
const vendor: Vendor = { id: 2, name: "Vendor", domain: "vendor.example", owner: "Analyst", status: "assessing", risk: null, nextReview: null, createdAt: "2026-01-01" }
const context = (id = "1") => ({ params: Promise.resolve({ id }) })
const request = (body: unknown) => new Request("http://localhost/api/assessments/1/draft", { method: "PUT", body: JSON.stringify(body) })
afterEach(() => mock.restore())

test("draft creation only passes accepted findings and persists model provenance", async () => {
  spyOn(db, "getAssessment").mockResolvedValue(assessment)
  spyOn(db, "getVendor").mockResolvedValue(vendor)
  const accepted = { id: 1, status: "accepted" } as Finding
  spyOn(db, "allFindings").mockResolvedValue([accepted, { id: 2, status: "dismissed" } as Finding, { id: 3, status: "open" } as Finding])
  const generate = spyOn(drafting, "draftFollowUp").mockResolvedValue({ text: "Please clarify.", model: "template" })
  const save = spyOn(db, "saveDraft").mockResolvedValue()
  const response = await POST(request({}), context())
  expect(response.status).toBe(200)
  expect(generate).toHaveBeenCalledWith(vendor, [accepted])
  expect(save).toHaveBeenCalledWith(1, "Please clarify.", "template")
})

test("approval stores the edited draft through the audited database operation", async () => {
  spyOn(db, "getAssessment").mockResolvedValue(assessment)
  const approve = spyOn(db, "approveDraft").mockResolvedValue()
  const response = await PUT(request({ text: " Edited follow-up " }), context())
  expect(response.status).toBe(200)
  expect(approve).toHaveBeenCalledWith(1, "Edited follow-up")
})

test("invalid IDs, malformed JSON and blank text create no writes", async () => {
  const approve = spyOn(db, "approveDraft").mockResolvedValue()
  expect((await POST(request({}), context("bad"))).status).toBe(400)
  for (const body of [{ text: "  " }, { text: 123 }, null, {}]) {
    expect((await PUT(request(body), context())).status).toBe(400)
  }
  expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{" }), context())).status).toBe(400)
  expect(approve).not.toHaveBeenCalled()
})

test("missing assessments return 404 and failed writes return an error", async () => {
  const load = spyOn(db, "getAssessment").mockResolvedValue(null)
  expect((await POST(request({}), context())).status).toBe(404)
  expect((await PUT(request({ text: "Hello" }), context())).status).toBe(404)
  load.mockResolvedValue(assessment)
  spyOn(db, "approveDraft").mockRejectedValue(new Error("database unavailable"))
  expect((await PUT(request({ text: "Hello" }), context())).status).toBe(500)
})

test("draft creation rejects zero accepted findings before generating or saving", async () => {
  spyOn(db, "getAssessment").mockResolvedValue(assessment)
  spyOn(db, "getVendor").mockResolvedValue(vendor)
  spyOn(db, "allFindings").mockResolvedValue([{ id: 2, status: "dismissed" } as Finding, { id: 3, status: "open" } as Finding])
  const generate = spyOn(drafting, "draftFollowUp").mockResolvedValue({ text: "Unexpected", model: "template" })
  const save = spyOn(db, "saveDraft").mockResolvedValue()
  const response = await POST(request({}), context())
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: "accept at least one finding first" })
  expect(generate).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
