import { allFindings, getAssessment, getVendor, saveRecommendation } from "@/lib/db"
import { recommend } from "@/lib/jev"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid assessment id" }, { status: 400 })

  const assessment = await getAssessment(id)
  if (!assessment) return Response.json({ error: "assessment not found" }, { status: 404 })
  const vendor = await getVendor(assessment.vendorId)
  if (!vendor) return Response.json({ error: "vendor not found" }, { status: 404 })

  const findings = await allFindings(id)
  const recommendation = await recommend(vendor, findings)
  if (!recommendation) return Response.json({ error: "recommendation unavailable" }, { status: 502 })

  await saveRecommendation(id, recommendation)
  return Response.json(recommendation)
}
