import { expect, test } from "bun:test"

import { extractPages } from "./pdf"

const sample = new URL("../../sample/tallyfern-soc2.pdf", import.meta.url)

test("extracts one string per page, in order", async () => {
  const pages = await extractPages(new Uint8Array(await Bun.file(sample).arrayBuffer()))
  expect(pages).toHaveLength(25)
  expect(pages[0]).toContain("SOC 2 Type II Report")
  // Page numbers in the report must line up with the 1-based array index.
  expect(pages[6] ?? "").toContain("7")
})

test("throws on a non-PDF", async () => {
  const bytes = new TextEncoder().encode("Q01,General,What is your name?,Tallyfern")
  expect(extractPages(bytes)).rejects.toThrow()
})

test("returns a plain string for every page, including blank ones", async () => {
  const pages = await extractPages(new Uint8Array(await Bun.file(sample).arrayBuffer()))
  expect(pages.every((page) => typeof page === "string")).toBe(true)
})
