import { extractText, getDocumentProxy } from "unpdf"

// One text string per page, in the source PDF's order (page N in results = page N of the PDF).
// Throws on a non-PDF or a PDF with no extractable text.
export async function extractPages(file: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(file)
  const result = await extractText(pdf, { mergePages: false })
  const pages = (result as { text?: string[] }).text
  if (!Array.isArray(pages) || pages.length === 0) throw new Error("PDF has no extractable text")
  return pages.map((page) => page.split("\r\n").join("\n").split("\r").join("\n"))
}
