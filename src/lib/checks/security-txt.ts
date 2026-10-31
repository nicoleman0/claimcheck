import type { Probe } from "./shared"

export const securityTxt: Probe = async (domain, signal) => {
  const response = await fetch(`https://${domain}/.well-known/security.txt`, { signal, redirect: "error" })
  if (response.status === 404) return { ok: false, value: "missing", raw: "HTTP 404" }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const raw = await response.text()
  const expires = raw.match(/^Expires:\s*(.+)$/im)?.[1]?.trim()
  const timestamp = expires ? Date.parse(expires) : NaN
  if (!Number.isFinite(timestamp)) return { ok: false, value: "missing or invalid Expires", raw }
  const expired = timestamp <= Date.now()
  return { ok: !expired, value: `${expired ? "expired" : "expires"} ${new Date(timestamp).toISOString().slice(0, 10)}`, raw }
}
