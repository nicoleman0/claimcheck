import { CHECK_KINDS, type CheckResult } from "@/lib/types"

// Stub: builder A replaces with real parallel checks. Never throws.
export async function runChecks(domain: string): Promise<CheckResult[]> {
  void domain
  return CHECK_KINDS.map((kind) => ({ kind, ok: null, value: "", raw: "", error: "not implemented", ms: 0 }))
}
