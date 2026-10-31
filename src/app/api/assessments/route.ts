import { runChecks } from "@/lib/checks"
import { createAssessment, saveChecks, upsertVendorByDomain } from "@/lib/db"
import { extractPages } from "@/lib/pdf"
import { parseQuestionnaire } from "@/lib/questionnaire"

// 4 MB per file: reject before reading or writing anything.
const MAX_BYTES = 4 * 1024 * 1024

const bad = (error: string) => Response.json({ error }, { status: 400 })

function cleanDomain(input: string): string | null {
  const domain = input.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/\.$/, "").replace(/\/+$/, "")
  if (!domain || /\s/.test(domain) || !domain.includes(".")) return null
  return domain
}

const vendorName = (domain: string) => {
  const label = domain.split(".")[0]!
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return bad("expected multipart/form-data with domain, questionnaire and report")
  }

  const rawDomain = String(form.get("domain") ?? "")
  const domain = cleanDomain(rawDomain)
  if (!domain) return bad("domain is required and must look like a hostname, e.g. tallyfern.co.uk")

  const questionnaire = form.get("questionnaire")
  const report = form.get("report")
  if (!(questionnaire instanceof File)) return bad("questionnaire CSV file is required")
  if (!(report instanceof File)) return bad("report PDF file is required")

  const over = [questionnaire.size, report.size].filter((n) => n > MAX_BYTES).length
  if (over) {
    const sizes = [questionnaire, report].filter((f) => f.size > MAX_BYTES).map((f) => Math.ceil(f.size / (1024 * 1024)))
    return bad(`files are too large (${sizes.join(", ")} MB); the limit is 4 MB per file`)
  }

  // Validate both files before touching the database, so an upload that fails creates nothing.
  const parsed = parseQuestionnaire(await questionnaire.text())
  if (!parsed.answers.length) {
    return bad(parsed.errors.slice(0, 4).join("; ") || "questionnaire had no usable answers")
  }

  let pages: string[]
  try {
    pages = await extractPages(new Uint8Array(await report.arrayBuffer()))
  } catch (e) {
    return bad(`report is not a readable PDF: ${e instanceof Error ? e.message : "unknown error"}`)
  }

  const name = String(form.get("name") ?? "").trim() || vendorName(domain)
  const vendor = await upsertVendorByDomain(domain, name)
  const assessment = await createAssessment({
    vendorId: vendor.id,
    questionnaireName: questionnaire.name,
    reportName: report.name,
    pages,
    answers: parsed.answers,
  })

  const checks = await runChecks(domain)
  await saveChecks(assessment.id, checks)
  return Response.json({ id: assessment.id }, { status: 201 })
}
