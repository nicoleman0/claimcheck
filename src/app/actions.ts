"use server"

import { revalidatePath } from "next/cache"

import { saveDecision, setFindingStatus } from "@/lib/db"
import { ACTIONS, FINDING_STATUSES, type Action, type FindingStatus } from "@/lib/types"

export async function setFindingsAction(assessmentId: number, ids: number[], status: FindingStatus): Promise<void> {
  if (!FINDING_STATUSES.includes(status)) throw new Error(`bad status ${status}`)
  if (!Array.isArray(ids) || ids.some((i) => !Number.isInteger(i))) throw new Error("bad ids")
  await setFindingStatus(ids, status)
  revalidatePath(`/assessments/${assessmentId}`)
}

export async function decideAction(assessmentId: number, action: Action, reason: string): Promise<{ error?: string }> {
  if (!ACTIONS.includes(action)) return { error: "Choose a decision." }
  if (!reason?.trim()) return { error: "A reason is required." }
  await saveDecision(assessmentId, action, reason.trim().slice(0, 2000))
  revalidatePath(`/assessments/${assessmentId}`)
  revalidatePath("/")
  return {}
}
