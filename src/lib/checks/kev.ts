import { fetchRecord, type Probe } from "./shared"

type Entry = { vendorProject: string; [key: string]: unknown }
let cache: { at: number; entries: Entry[] } | null = null

function vendorKey(value: string): string {
  return value.toLowerCase().replace(/\b(ltd|limited|inc|llc|corp|corporation)\b/g, "").replace(/[^a-z0-9]/g, "")
}

export const kev: Probe = async (_domain, signal, vendorName) => {
  if (!cache || Date.now() - cache.at > 3_600_000) {
    const response = await fetchRecord("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", signal)
    const data = await response.json() as { vulnerabilities?: Entry[] }
    if (!Array.isArray(data.vulnerabilities) || data.vulnerabilities.some((e) => typeof e.vendorProject !== "string")) throw new Error("Invalid KEV response")
    cache = { at: Date.now(), entries: data.vulnerabilities }
  }
  const key = vendorKey(vendorName)
  if (!key) throw new Error("Vendor name is required")
  const matches = cache.entries.filter((entry) => vendorKey(entry.vendorProject) === key)
  return { ok: matches.length === 0, value: `${matches.length} entries`, raw: JSON.stringify(matches) }
}
