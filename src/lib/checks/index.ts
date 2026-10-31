import { CHECK_KINDS, type CheckResult } from "@/lib/types"
import { timeouts } from "@/lib/models"
import { dmarc } from "./dmarc"
import { spf } from "./spf"
import { tls } from "./tls"
import { hsts } from "./hsts"
import { csp } from "./csp"
import { securityTxt } from "./security-txt"
import { hibp } from "./hibp"
import { kev } from "./kev"
import type { Probe } from "./shared"

const probes: Record<CheckResult["kind"], Probe> = { dmarc, spf, tls, hsts, csp, security_txt: securityTxt, hibp, kev }

export async function runChecks(domain: string, vendorName = domain.split(".")[0]): Promise<CheckResult[]> {
  const validDomain = domain.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
  return Promise.all(CHECK_KINDS.map(async (kind): Promise<CheckResult> => {
    const start = Date.now()
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (!validDomain) throw new Error("Invalid vendor domain")
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { reject(new Error("Check timed out")); controller.abort() }, timeouts.check)
      })
      const result = await Promise.race([probes[kind](domain, controller.signal, vendorName), deadline])
      return { kind, ...result, error: null, ms: Date.now() - start }
    } catch (error) {
      return { kind, ok: null, value: "unavailable", raw: "", error: error instanceof Error ? error.message : "Check failed", ms: Date.now() - start }
    } finally {
      clearTimeout(timer)
    }
  }))
}
