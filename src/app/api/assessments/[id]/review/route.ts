import { allFindings, getAssessment, listChecks, saveReview } from "@/lib/db"
import { evidenceSentence, reviewAnswers } from "@/lib/jev"
import { NEEDS_REVIEW_BELOW } from "@/lib/types"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid assessment id" }, { status: 400 })

  const assessment = await getAssessment(id)
  if (!assessment) return Response.json({ error: "assessment not found" }, { status: 404 })

  const answers = (await allFindings(id)).map(({ qid, section, question, answer }) => ({ qid, section, question, answer }))
  const checks = await listChecks(id)

  const review = await reviewAnswers(answers, assessment.pages, checks)
  // The checks and answers stay untouched on a review failure; review_error is recorded and the page shows a retry.
  if (!review.ok) {
    await saveReview(id, review)
    return Response.json({ ok: false, error: review.error }, { status: 502 })
  }

  const byQid = new Map(answers.map((a) => [a.qid, a]))
  const evidence: Record<string, string> = {}
  for (const f of review.findings) {
    const answer = byQid.get(f.qid)
    if (!answer) continue
    let text: string | null = null
    if (f.source === "report" && f.page != null) {
      const page = assessment.pages[f.page - 1]
      if (page) text = evidenceSentence(page, answer.answer)
    } else if (f.source !== "none") {
      text = checks.find((c) => c.kind === f.source)?.raw ?? null
    }
    if (text?.trim()) evidence[f.qid] = text
  }
  await saveReview(id, review, evidence)

  const counts = {
    contradicts: review.findings.filter((f) => f.verdict === "contradicts").length,
    no_evidence: review.findings.filter((f) => f.verdict === "no_evidence").length,
    needs_review: review.findings.filter((f) => f.confidence < NEEDS_REVIEW_BELOW).length,
  }
  return Response.json({ ok: true, model: review.model, counts })
}
