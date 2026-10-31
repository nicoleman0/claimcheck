export const VENDOR_STATUSES = ["new", "assessing", "awaiting_vendor", "approved", "approved_with_conditions", "rejected"] as const
export type VendorStatus = (typeof VENDOR_STATUSES)[number]
export const RISKS = ["low", "medium", "high", "critical"] as const
export type Risk = (typeof RISKS)[number]
export const CHECK_KINDS = ["dmarc", "spf", "tls", "hsts", "csp", "security_txt", "hibp", "kev"] as const
export type CheckKind = (typeof CHECK_KINDS)[number]
export const VERDICTS = ["agrees", "contradicts", "no_evidence"] as const
export type Verdict = (typeof VERDICTS)[number]
export const FINDING_STATUSES = ["open", "accepted", "dismissed"] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]
export const ACTIONS = ["approve", "approve with conditions", "reject"] as const
export type Action = (typeof ACTIONS)[number]
// "report" or a check kind or "none"
export type Source = "report" | CheckKind | "none"

export type Vendor = {
  id: number
  name: string
  domain: string
  owner: string
  status: VendorStatus
  risk: Risk | null
  nextReview: string | null
  createdAt: string
}

export type Assessment = {
  id: number
  vendorId: number
  createdAt: string
  questionnaireName: string
  reportName: string
  pages: string[]
  reviewModel: string | null
  reviewError: string | null
  draft: string | null
  draftModel: string | null
  draftApprovedAt: string | null
}

export type CheckResult = {
  kind: CheckKind
  ok: boolean | null
  value: string
  raw: string
  error: string | null
  ms: number
}

export type Answer = { qid: string; section: string; question: string; answer: string }

export type Finding = Answer & {
  id: number
  assessmentId: number
  verdict: Verdict | null
  confidence: number | null
  source: Source | null
  page: number | null
  evidence: string | null
  status: FindingStatus
}

export type ReviewItem = { qid: string; verdict: Verdict; confidence: number; source: Source; page: number | null }
export type Review = { ok: true; model: string; findings: ReviewItem[] } | { ok: false; error: string }

export type Recommendation = {
  riskScore: number // 0..3 fractional
  riskProbs: Record<Risk, number>
  action: Action
  actionProbs: Record<Action, number>
  misrepresented: number // 0..1
  model: string
}

export type Decision = Recommendation & {
  assessmentId: number
  analystAction: Action | null
  reason: string | null
  decidedAt: string | null
}

export type Event = { id: number; vendorId: number; assessmentId: number | null; at: string; actor: string; action: string; detail: string }

export const NEEDS_REVIEW_BELOW = 0.6
