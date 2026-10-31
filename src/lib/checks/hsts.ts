import { fetchRecord, type Probe } from "./shared"

export const hsts: Probe = async (domain, signal) => {
  const response = await fetchRecord(`https://${domain}`, signal)
  const value = response.headers.get("strict-transport-security")
  await response.body?.cancel()
  return { ok: value !== null, value: value === null ? "missing" : "present", raw: value ?? "strict-transport-security: missing" }
}
