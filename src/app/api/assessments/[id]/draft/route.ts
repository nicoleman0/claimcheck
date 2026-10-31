import { allFindings, approveDraft, getAssessment, getVendor, saveDraft } from "@/lib/db"
import { draftFollowUp } from "@/lib/draft"

type Context = { params: Promise<{ id: string }> }

async function assessmentId(context: Context): Promise<number | null> {
  const { id } = await context.params
  const number = Number(id)
  return /^\d+$/.test(id) && Number.isSafeInteger(number) && number > 0 ? number : null
}

export async function POST(_request: Request, context: Context) {
  const id = await assessmentId(context)
  if (id === null) return Response.json({ error: "Invalid assessment ID" }, { status: 400 })
  try {
    const assessment = await getAssessment(id)
    if (!assessment) return Response.json({ error: "Assessment not found" }, { status: 404 })
    const vendor = await getVendor(assessment.vendorId)
    if (!vendor) return Response.json({ error: "Vendor not found" }, { status: 404 })
    const findings = (await allFindings(id)).filter((finding) => finding.status === "accepted")
    const draft = await draftFollowUp(vendor, findings)
    await saveDraft(id, draft.text, draft.model)
    return Response.json(draft)
  } catch {
    return Response.json({ error: "Unable to create draft" }, { status: 500 })
  }
}

export async function PUT(request: Request, context: Context) {
  const id = await assessmentId(context)
  if (id === null) return Response.json({ error: "Invalid assessment ID" }, { status: 400 })
  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: "Expected JSON with non-empty text" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "Draft text is required" }, { status: 400 })
  }
  try {
    if (!await getAssessment(id)) return Response.json({ error: "Assessment not found" }, { status: 404 })
    await approveDraft(id, body.text.trim())
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Unable to approve draft" }, { status: 500 })
  }
}
