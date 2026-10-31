import { txtRecords, type Probe } from "./shared"

export const dmarc: Probe = async (domain, signal) => {
  const records = (await txtRecords(`_dmarc.${domain}`, signal)).filter((r) => /^v=DMARC1(?:;|$)/i.test(r))
  const policy = records[0]?.match(/(?:^|;)\s*p=(none|quarantine|reject)\s*(?:;|$)/i)?.[1]?.toLowerCase()
  return { ok: records.length === 1 && (policy === "quarantine" || policy === "reject"), value: records.length > 1 ? "multiple DMARC records" : policy ? `p=${policy}` : "missing", raw: records.join("\n") }
}
