import { neon } from "@neondatabase/serverless"

import type { ListQuery } from "@/lib/list-query"
import type {
  Action, Answer, Assessment, CheckResult, Decision, Event, Finding, FindingStatus, Recommendation, Review, Vendor, VendorStatus,
} from "@/lib/types"

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

type Row = Record<string, unknown>
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))
const day = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

const toVendor = (r: Row): Vendor => ({
  id: r.id as number, name: r.name as string, domain: r.domain as string, owner: r.owner as string,
  status: r.status as VendorStatus, risk: (r.risk as Vendor["risk"]) ?? null, nextReview: day(r.next_review), createdAt: iso(r.created_at)!,
})
const toAssessment = (r: Row): Assessment => ({
  id: r.id as number, vendorId: r.vendor_id as number, createdAt: iso(r.created_at)!, questionnaireName: r.questionnaire_name as string,
  reportName: r.report_name as string, pages: r.pages as string[], reviewModel: (r.review_model as string) ?? null,
  reviewError: (r.review_error as string) ?? null, draft: (r.draft as string) ?? null, draftModel: (r.draft_model as string) ?? null,
  draftApprovedAt: iso(r.draft_approved_at),
})
const toFinding = (r: Row): Finding => ({
  id: r.id as number, assessmentId: r.assessment_id as number, qid: r.qid as string, section: r.section as string,
  question: r.question as string, answer: r.answer as string, verdict: (r.verdict as Finding["verdict"]) ?? null,
  confidence: (r.confidence as number) ?? null, source: (r.source as Finding["source"]) ?? null, page: (r.page as number) ?? null,
  evidence: (r.evidence as string) ?? null, status: r.status as FindingStatus,
})
const toCheck = (r: Row): CheckResult => ({
  kind: r.kind as CheckResult["kind"], ok: (r.ok as boolean) ?? null, value: r.value as string, raw: r.raw as string,
  error: (r.error as string) ?? null, ms: r.ms as number,
})
const toDecision = (r: Row): Decision => ({
  assessmentId: r.assessment_id as number, riskScore: r.risk_score as number, riskProbs: r.risk_probs as Decision["riskProbs"],
  action: r.action as Action, actionProbs: r.action_probs as Decision["actionProbs"], misrepresented: r.misrepresented as number,
  model: r.model as string, analystAction: (r.analyst_action as Action) ?? null, reason: (r.reason as string) ?? null, decidedAt: iso(r.decided_at),
})

async function event(vendorId: number, assessmentId: number | null, actor: string, action: string, detail: string) {
  await db()`insert into events (vendor_id, assessment_id, actor, action, detail) values (${vendorId}, ${assessmentId}, ${actor}, ${action}, ${detail})`
}

// ---------- vendors ----------

export const VENDOR_SORTS = ["name", "domain", "owner", "status", "risk", "next_review"] as const
export type VendorSort = (typeof VENDOR_SORTS)[number]
const VENDOR_ORDER: Record<VendorSort, string> = {
  name: "name", domain: "domain", owner: "owner", status: "status", next_review: "next_review",
  risk: "array_position(array['low','medium','high','critical'], risk)",
}

export async function listVendors(q: ListQuery<VendorSort, VendorStatus>): Promise<{ rows: Vendor[]; total: number; counts: Record<string, number> }> {
  const like = `%${q.q}%`
  const order = `${VENDOR_ORDER[q.sort]} ${q.dir === "desc" ? "desc" : "asc"} nulls last, id`
  const rows = await db().query(
    `select *, count(*) over() as total from vendors
     where ($1 = '' or name ilike $2 or domain ilike $2 or owner ilike $2) and ($3::text is null or status = $3)
     order by ${order} limit $4 offset $5`,
    [q.q, like, q.filter, q.size, q.offset],
  )
  const counts = await db()`select status, count(*)::int as n from vendors where (${q.q} = '' or name ilike ${like} or domain ilike ${like} or owner ilike ${like}) group by status`
  return {
    rows: rows.map(toVendor),
    total: rows.length ? Number(rows[0].total) : 0,
    counts: Object.fromEntries(counts.map((c) => [c.status as string, c.n as number])),
  }
}

export async function getVendor(id: number): Promise<Vendor | null> {
  const [r] = await db()`select * from vendors where id = ${id}`
  return r ? toVendor(r) : null
}

export async function upsertVendorByDomain(domain: string, name: string): Promise<Vendor> {
  const [r] = await db()`insert into vendors (name, domain, owner) values (${name}, ${domain}, 'analyst')
    on conflict (domain) do update set domain = excluded.domain returning *, (xmax = 0) as inserted`
  if (r.inserted) await event(r.id as number, null, "analyst", "vendor.created", name)
  return toVendor(r)
}

export async function listVendorAssessments(vendorId: number): Promise<Assessment[]> {
  return (await db()`select * from assessments where vendor_id = ${vendorId} order by created_at desc`).map(toAssessment)
}

// ---------- assessments ----------

export async function getAssessment(id: number): Promise<Assessment | null> {
  const [r] = await db()`select * from assessments where id = ${id}`
  return r ? toAssessment(r) : null
}

export async function createAssessment(input: { vendorId: number; questionnaireName: string; reportName: string; pages: string[]; answers: Answer[] }): Promise<Assessment> {
  const sql = db()
  const [a] = await sql`insert into assessments (vendor_id, questionnaire_name, report_name, pages)
    values (${input.vendorId}, ${input.questionnaireName}, ${input.reportName}, ${JSON.stringify(input.pages)}::jsonb) returning *`
  for (const x of input.answers) {
    await sql`insert into findings (assessment_id, qid, section, question, answer) values (${a.id}, ${x.qid}, ${x.section}, ${x.question}, ${x.answer})`
  }
  await sql`update vendors set status = 'assessing' where id = ${input.vendorId}`
  await event(input.vendorId, a.id as number, "analyst", "assessment.created", `${input.answers.length} answers, ${input.pages.length} report pages`)
  return toAssessment(a)
}

export async function saveChecks(assessmentId: number, checks: CheckResult[]): Promise<void> {
  const sql = db()
  await sql`delete from checks where assessment_id = ${assessmentId}`
  for (const c of checks) {
    await sql`insert into checks (assessment_id, kind, ok, value, raw, error, ms) values (${assessmentId}, ${c.kind}, ${c.ok}, ${c.value}, ${c.raw}, ${c.error}, ${c.ms})`
  }
  const a = await getAssessment(assessmentId)
  const failed = checks.filter((c) => c.ok === false).length
  const unavailable = checks.filter((c) => c.ok === null).length
  await event(a!.vendorId, assessmentId, "system", "checks.run", `${checks.length} checks, ${failed} failed, ${unavailable} unavailable`)
}

export async function listChecks(assessmentId: number): Promise<CheckResult[]> {
  return (await db()`select * from checks where assessment_id = ${assessmentId} order by id`).map(toCheck)
}

// evidence: per qid, the deciding sentence or raw check record chosen by code.
export async function saveReview(assessmentId: number, review: Review, evidence: Record<string, string> = {}): Promise<void> {
  const sql = db()
  const a = await getAssessment(assessmentId)
  if (!review.ok) {
    await sql`update assessments set review_error = ${review.error} where id = ${assessmentId}`
    await event(a!.vendorId, assessmentId, "system", "review.failed", review.error)
    return
  }
  for (const f of review.findings) {
    await sql`update findings set verdict = ${f.verdict}, confidence = ${f.confidence}, source = ${f.source}, page = ${f.page},
      evidence = ${evidence[f.qid] ?? null}, status = 'open' where assessment_id = ${assessmentId} and qid = ${f.qid}`
  }
  await sql`update assessments set review_model = ${review.model}, review_error = null where id = ${assessmentId}`
  const n = (v: string) => review.findings.filter((f) => f.verdict === v).length
  await event(a!.vendorId, assessmentId, review.model, "review.completed", `${n("contradicts")} contradictions, ${n("no_evidence")} unsupported`)
}

// ---------- findings ----------

export const FINDING_SORTS = ["qid", "confidence", "verdict", "status"] as const
export type FindingSort = (typeof FINDING_SORTS)[number]
const FINDING_ORDER: Record<FindingSort, string> = { qid: "qid", confidence: "confidence", verdict: "verdict", status: "status" }

export async function listFindings(assessmentId: number, q: ListQuery<FindingSort, string>): Promise<{ rows: Finding[]; total: number }> {
  const like = `%${q.q}%`
  const order = `${FINDING_ORDER[q.sort]} ${q.dir === "desc" ? "desc" : "asc"} nulls last, qid`
  const rows = await db().query(
    `select *, count(*) over() as total from findings
     where assessment_id = $1 and ($2 = '' or question ilike $3 or answer ilike $3 or qid ilike $3 or coalesce(evidence,'') ilike $3)
       and ($4::text is null or verdict = $4) order by ${order} limit $5 offset $6`,
    [assessmentId, q.q, like, q.filter, q.size, q.offset],
  )
  return { rows: rows.map(toFinding), total: rows.length ? Number(rows[0].total) : 0 }
}

export async function allFindings(assessmentId: number): Promise<Finding[]> {
  return (await db()`select * from findings where assessment_id = ${assessmentId} order by qid`).map(toFinding)
}

export async function setFindingStatus(ids: number[], status: FindingStatus, actor = "analyst"): Promise<void> {
  if (!ids.length) return
  const rows = await db()`update findings f set status = ${status} from assessments a
    where f.id = any(${ids}) and a.id = f.assessment_id returning f.qid, f.assessment_id, a.vendor_id`
  if (!rows.length) return
  await event(rows[0].vendor_id as number, rows[0].assessment_id as number, actor, `finding.${status}`, rows.map((r) => r.qid).join(", "))
}

// ---------- recommendation and decision ----------

export async function saveRecommendation(assessmentId: number, r: Recommendation): Promise<void> {
  await db()`insert into decisions (assessment_id, risk_score, risk_probs, action, action_probs, misrepresented, model)
    values (${assessmentId}, ${r.riskScore}, ${JSON.stringify(r.riskProbs)}::jsonb, ${r.action}, ${JSON.stringify(r.actionProbs)}::jsonb, ${r.misrepresented}, ${r.model})
    on conflict (assessment_id) do update set risk_score = excluded.risk_score, risk_probs = excluded.risk_probs, action = excluded.action,
      action_probs = excluded.action_probs, misrepresented = excluded.misrepresented, model = excluded.model`
  const a = await getAssessment(assessmentId)
  await event(a!.vendorId, assessmentId, r.model, "recommendation.updated", `${r.action}, risk ${r.riskScore.toFixed(2)}`)
}

export async function getDecision(assessmentId: number): Promise<Decision | null> {
  const [r] = await db()`select * from decisions where assessment_id = ${assessmentId}`
  return r ? toDecision(r) : null
}

const STATUS_FOR: Record<Action, VendorStatus> = { approve: "approved", "approve with conditions": "approved_with_conditions", reject: "rejected" }
const RISK_FOR = (score: number) => (["low", "medium", "high", "critical"] as const)[Math.max(0, Math.min(3, Math.round(score)))]

export async function saveDecision(assessmentId: number, action: Action, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error("reason is required")
  const sql = db()
  const a = await getAssessment(assessmentId)
  if (!a) throw new Error("assessment not found")
  const d = await getDecision(assessmentId)
  if (d) {
    await sql`update decisions set analyst_action = ${action}, reason = ${reason}, decided_at = now() where assessment_id = ${assessmentId}`
  } else {
    await sql`insert into decisions (assessment_id, risk_score, risk_probs, action, action_probs, misrepresented, model, analyst_action, reason, decided_at)
      values (${assessmentId}, 0, '{}'::jsonb, ${action}, '{}'::jsonb, 0, 'none', ${action}, ${reason}, now())`
  }
  const risk = d && d.model !== "none" ? RISK_FOR(d.riskScore) : null
  await sql`update vendors set status = ${STATUS_FOR[action]}, risk = coalesce(${risk}, risk),
    next_review = (now() + interval '1 year')::date where id = ${a.vendorId}`
  await event(a.vendorId, assessmentId, "analyst", "decision.recorded", `${action}: ${reason}`)
}

// ---------- draft ----------

export async function saveDraft(assessmentId: number, text: string, model: string): Promise<void> {
  await db()`update assessments set draft = ${text}, draft_model = ${model}, draft_approved_at = null where id = ${assessmentId}`
  const a = await getAssessment(assessmentId)
  await event(a!.vendorId, assessmentId, model, "draft.written", `${text.length} chars`)
}

export async function approveDraft(assessmentId: number, text: string): Promise<void> {
  const sql = db()
  await sql`update assessments set draft = ${text}, draft_approved_at = now() where id = ${assessmentId}`
  const a = await getAssessment(assessmentId)
  await sql`update vendors set status = 'awaiting_vendor' where id = ${a!.vendorId}`
  await event(a!.vendorId, assessmentId, "analyst", "draft.approved", "follow-up approved; not sent")
}

// ---------- events ----------

export async function listEvents(opts: { vendorId?: number; limit?: number } = {}): Promise<(Event & { vendorName: string })[]> {
  const rows = await db()`select e.*, v.name as vendor_name from events e join vendors v on v.id = e.vendor_id
    where (${opts.vendorId ?? null}::int is null or e.vendor_id = ${opts.vendorId ?? null}) order by e.at desc, e.id desc limit ${opts.limit ?? 200}`
  return rows.map((r) => ({
    id: r.id as number, vendorId: r.vendor_id as number, assessmentId: (r.assessment_id as number) ?? null, at: iso(r.at)!,
    actor: r.actor as string, action: r.action as string, detail: r.detail as string, vendorName: r.vendor_name as string,
  }))
}
