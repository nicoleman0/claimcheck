import type { Answer } from "@/lib/types"

export type ParseResult = { answers: Answer[]; errors: string[] }

const HEADER = "id,section,question,answer"

// RFC 4180-style CSV: quoted fields may contain commas, escaped quotes and newlines.
// Returns rows with the 1-based line they start on, so row errors point at real lines.
type CsvRow = { cells: string[]; line: number }

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  let row: string[] = []
  let field = ""
  let rowLine = 1
  let line = 1
  let inRow = false

  const pushRow = () => {
    row.push(field)
    field = ""
    if (inRow || row.some((c) => c !== "")) rows.push({ cells: row, line: rowLine })
    row = []
    inRow = false
    rowLine = line
  }

  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (!inRow && c !== "\n" && c !== "\r") {
      rowLine = line
      inRow = true
    }
    if (c === '"') {
      i++
      for (;;) {
        if (i >= text.length) break
        const ch = text[i]!
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"'
            i += 2
            continue
          }
          i++
          break
        }
        if (ch === "\n") line++
        field += ch
        i++
      }
      continue
    }
    if (c === ",") {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (c === "\n") {
      line++
      pushRow()
      i++
      continue
    }
    if (c === "\r") {
      i++
      continue
    }
    field += c
    i++
  }
  if (inRow) pushRow()
  return rows
}

export function parseQuestionnaire(text: string): ParseResult {
  const rows = parseCsv(text)
  if (!rows.length) return { answers: [], errors: ["questionnaire is empty"] }

  const header = rows[0]!.cells.map((c) => c.trim().toLowerCase())
  if (header.join(",") !== HEADER) {
    return {
      answers: [],
      errors: [
        `not a questionnaire: expected a header "${HEADER}", got ${rows[0]!.cells.map((c) => c.trim()).join(",") || "(empty)"}`,
      ],
    }
  }

  const answers: Answer[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const row of rows.slice(1)) {
    const label = `row ${row.line}`
    if (row.cells.length !== 4) {
      errors.push(`${label}: expected 4 fields, got ${row.cells.length}`)
      continue
    }
    const [id, section, question, answer] = row.cells.map((c) => c.trim())
    if (!id) {
      errors.push(`${label}: missing id`)
      continue
    }
    if (seen.has(id)) {
      errors.push(`${label}: duplicate id ${id}`)
      continue
    }
    if (!question || !answer) {
      errors.push(`${label}: missing question or answer`)
      continue
    }
    seen.add(id)
    answers.push({ qid: id, section, question, answer })
  }
  return { answers, errors }
}
