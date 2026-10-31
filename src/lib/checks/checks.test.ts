import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as nodeTls from "node:tls"
import { EventEmitter } from "node:events"
import { dmarc } from "./dmarc"
import { spf } from "./spf"
import { securityTxt } from "./security-txt"
import { runChecks } from "./index"

const signal = new AbortController().signal
const originalFetch = globalThis.fetch
function respond(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }
function txt(record: string) { globalThis.fetch = mock(async () => respond({ Status: 0, Answer: [{ type: 16, data: `"${record}"` }] })) as unknown as typeof fetch }
afterEach(() => { globalThis.fetch = originalFetch; mock.restore() })

describe("DNS policies", () => {
  test("DMARC monitoring fails and enforcement passes", async () => {
    txt("v=DMARC1; p=none;")
    expect((await dmarc("vendor.example", signal, "Vendor")).ok).toBe(false)
    txt("v=DMARC1; p=reject;")
    expect((await dmarc("vendor.example", signal, "Vendor")).ok).toBe(true)
  })
  test("SPF only passes a hard fail", async () => {
    for (const policy of ["~all", "?all", "+all", "all", "include:example.com", "-all"]) {
      txt(`v=spf1 ${policy}`)
      expect((await spf("vendor.example", signal, "Vendor")).ok).toBe(policy === "-all")
    }
  })
  test("DNS errors are not mistaken for missing records", async () => {
    globalThis.fetch = mock(async () => respond({ Status: 2 })) as unknown as typeof fetch
    await expect(dmarc("vendor.example", signal, "Vendor")).rejects.toThrow("DNS status 2")
  })
})

test("security.txt reports expired, missing and invalid expiry", async () => {
  for (const [body, status, value] of [["Expires: 2025-06-30T00:00:00Z", 200, "expired 2025-06-30"], ["", 404, "missing"], ["Contact: mailto:security@example.com", 200, "missing or invalid Expires"]] as const) {
    globalThis.fetch = mock(async () => new Response(body, { status })) as unknown as typeof fetch
    const result = await securityTxt("vendor.example", signal, "Vendor")
    expect(result.ok).toBe(false)
    expect(result.value).toBe(value)
  }
})

function fakeTls() {
  const socket = Object.assign(new EventEmitter(), {
    authorized: true,
    authorizationError: null,
    getProtocol: () => "TLSv1.3",
    getPeerCertificate: () => ({ subject: { CN: "vendor.example" }, issuer: {}, valid_to: "2030" }),
    end: () => socket.emit("close"),
    destroy: (error: Error) => { socket.emit("error", error); socket.emit("close") },
  })
  spyOn(nodeTls, "connect").mockImplementation((() => { queueMicrotask(() => socket.emit("secureConnect")); return socket }) as unknown as typeof nodeTls.connect)
}

test("parallel checks retain successful siblings when one HTTP request fails", async () => {
  fakeTls()
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes("cloudflare")) return respond({ Status: 0, Answer: [{ type: 16, data: url.includes("_dmarc") ? '"v=DMARC1; p=none"' : '"v=spf1 ~all"' }] })
    if (url.includes("haveibeenpwned")) return new Response("", { status: 503 })
    if (url.includes("cisa.gov")) return respond({ vulnerabilities: [{ vendorProject: "Unrelated" }] })
    if (url.includes("security.txt")) return new Response("Expires: 2025-06-30T00:00:00Z")
    return new Response("", { headers: { "strict-transport-security": "max-age=31536000" } })
  }) as unknown as typeof fetch
  const results = await runChecks("vendor.example")
  expect(results).toHaveLength(8)
  expect(results.find((r) => r.kind === "hibp")).toMatchObject({ ok: null, error: "HTTP 503", value: "unavailable" })
  expect(results.find((r) => r.kind === "tls")).toMatchObject({ ok: true, value: "TLSv1.3" })
  expect(results.find((r) => r.kind === "hsts")?.ok).toBe(true)
  expect(results.find((r) => r.kind === "csp")?.ok).toBe(false)
  expect(results.find((r) => r.kind === "kev")?.value).toBe("0 entries")
})

test("an unresponsive request times out even if the transport ignores abort", async () => {
  fakeTls()
  globalThis.fetch = mock(() => new Promise(() => {})) as unknown as typeof fetch
  const results = await runChecks("vendor.example")
  expect(results.filter((r) => r.error === "Check timed out").length).toBeGreaterThanOrEqual(6)
  expect(results.every((r) => r.ms < 6000)).toBe(true)
}, 7000)

test("invalid domains produce unavailable results without making requests", async () => {
  const fetchMock = mock(async () => new Response(""))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  const results = await runChecks("https://vendor.example/path")
  expect(results.every((r) => r.ok === null && r.error === "Invalid vendor domain")).toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
})
