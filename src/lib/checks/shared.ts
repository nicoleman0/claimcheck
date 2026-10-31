import type { CheckResult } from "@/lib/types"

export type Observation = Pick<CheckResult, "ok" | "value" | "raw">
export type Probe = (domain: string, signal: AbortSignal, vendorName: string) => Promise<Observation>

export async function fetchRecord(url: string, signal: AbortSignal, headers?: HeadersInit): Promise<Response> {
  const response = await fetch(url, { signal, headers, redirect: "error" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function txtRecords(name: string, signal: AbortSignal): Promise<string[]> {
  const response = await fetchRecord(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, signal, { accept: "application/dns-json" })
  const data = await response.json() as { Status?: number; Answer?: { type: number; data: string }[] }
  if (data.Status !== 0 && data.Status !== 3) throw new Error(`DNS status ${data.Status ?? "missing"}`)
  return (data.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data.replace(/"\s+"/g, "").replace(/^"|"$/g, ""))
}
