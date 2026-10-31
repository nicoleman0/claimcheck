import { fetchRecord, type Probe } from "./shared"

export const csp: Probe = async (domain, signal) => {
  const response = await fetchRecord(`https://${domain}`, signal)
  const value = response.headers.get("content-security-policy")
  await response.body?.cancel()
  return { ok: value !== null, value: value === null ? "missing" : "present", raw: value ?? "content-security-policy: missing" }
}
