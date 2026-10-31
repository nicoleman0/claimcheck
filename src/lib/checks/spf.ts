import { txtRecords, type Probe } from "./shared"

export const spf: Probe = async (domain, signal) => {
  const records = (await txtRecords(domain, signal)).filter((r) => /^v=spf1(?:\s|$)/i.test(r))
  const all = records[0]?.match(/(?:^|\s)([~?+-]?all)(?:\s|$)/i)?.[1]?.toLowerCase()
  return { ok: records.length === 1 && all === "-all", value: records.length > 1 ? "multiple SPF records" : all ?? "missing", raw: records.join("\n") }
}
