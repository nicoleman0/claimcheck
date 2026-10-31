import { expect, test } from "bun:test"

import { parseQuestionnaire } from "./questionnaire"

const HEADER = "id,section,question,answer\n"

test("parses quoted fields with commas, escaped quotes and embedded newlines", () => {
  const text = `${HEADER}Q01,General,What is your name?,"Tallyfern Ltd, registered in Wales"\nQ02,People,"Say ""yes"", briefly.","line one\nline two"\n`
  const r = parseQuestionnaire(text)
  expect(r.errors).toEqual([])
  expect(r.answers).toEqual([
    { qid: "Q01", section: "General", question: "What is your name?", answer: "Tallyfern Ltd, registered in Wales" },
    { qid: "Q02", section: "People", question: 'Say "yes", briefly.', answer: "line one\nline two" },
  ])
})

test("handles CRLF line endings", () => {
  const r = parseQuestionnaire(`id,section,question,answer\r\nQ01,General,Q?,A\r\n`)
  expect(r.errors).toEqual([])
  expect(r.answers).toEqual([{ qid: "Q01", section: "General", question: "Q?", answer: "A" }])
})

test("tolerates a trailing blank line but keeps a data-only line count right", () => {
  const r = parseQuestionnaire(`${HEADER}Q01,General,Q?,A\n\n`)
  expect(r.errors).toEqual([]) // blank line is skipped, so Q01 is still "row 2"
  expect(r.answers).toHaveLength(1)
})

test("rejects a non-CSV header", () => {
  const r = parseQuestionnaire("name,age\nAda,36\n")
  expect(r.answers).toEqual([])
  expect(r.errors[0]).toContain('expected a header "id,section,question,answer"')
})

test("reports row errors without dropping good rows", () => {
  const text = `${HEADER}Q01,General,Q?,A\nQ02,General,only three fields\n,Q04,,\nQ03,General,Q?,A\nQ03,General,Q?,A again\nQ05,General,,A\nQ06,General,Q?,\n`
  const r = parseQuestionnaire(text)
  expect(r.errors).toEqual([
    "row 3: expected 4 fields, got 3",
    "row 4: missing id",
    "row 6: duplicate id Q03",
    "row 7: missing question or answer",
    "row 8: missing question or answer",
  ])
  expect(r.answers.map((a) => a.qid)).toEqual(["Q01", "Q03"])
})

test("blank input is an error", () => {
  expect(parseQuestionnaire("")).toEqual({ answers: [], errors: ["questionnaire is empty"] })
  expect(parseQuestionnaire("\n\n")).toEqual({ answers: [], errors: ["questionnaire is empty"] })
})
