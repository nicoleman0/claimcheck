import type { Answer } from "@/lib/types"

export type ParseResult = { answers: Answer[]; errors: string[] }

// Stub: builder B implements (header id,section,question,answer; quoted fields).
export function parseQuestionnaire(text: string): ParseResult {
  void text
  return { answers: [], errors: ["not implemented"] }
}
