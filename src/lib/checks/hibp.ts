import { fetchRecord, type Probe } from "./shared"

export const hibp: Probe = async (domain, signal) => {
  const response = await fetchRecord(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, signal, { "User-Agent": "claimcheck" })
  const records: unknown = await response.json()
  if (!Array.isArray(records)) throw new Error("Invalid breach response")
  return { ok: records.length === 0, value: `${records.length} breaches`, raw: JSON.stringify(records) }
}
