import { expect, test } from "bun:test"

import { evidenceSentence } from "./jev"

test("picks the sentence with the most claim words", () => {
  const page = "Independence. The audit was performed by Calderbrook Assurance LLP in London.\n" +
    "All Tallyfern products are in scope of our SOC 2 Type II report. We also note that the auditor kept working papers.\n"
  const found = evidenceSentence(page, "All Tallyfern products are in scope of our SOC 2 Type II report.")
  expect(found).toContain("All Tallyfern products are in scope")
})

test("ignores stopword-only overlap and prefers the decisive sentence", () => {
  const page =
    "The audit was performed in London over the period. HR Records is excluded from the scope of the report.\n" +
    "For the payroll platform, no exceptions were noted. The auditor is independent."
  const found = evidenceSentence(page, "Our SOC 2 report covers the payroll platform without exceptions.")
  expect(found).toContain("no exceptions were noted")
})

test("falls back to the page opening when nothing matches", () => {
  const found = evidenceSentence("The weather was mild. Nothing gerService-related here.", "Cloudflare storage quotas")
  expect(found.startsWith("The weather was mild.")).toBe(true)
})
