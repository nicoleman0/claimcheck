import { connect } from "node:tls"
import type { Probe } from "./shared"

export const tls: Probe = (domain, signal) => new Promise((resolve, reject) => {
  const socket = connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false })
  const abort = () => socket.destroy(new Error("Check timed out"))
  signal.addEventListener("abort", abort, { once: true })
  socket.once("close", () => signal.removeEventListener("abort", abort))
  socket.once("error", reject)
  socket.once("secureConnect", () => {
    const protocol = socket.getProtocol()
    const cert = socket.getPeerCertificate()
    resolve({ ok: socket.authorized && (protocol === "TLSv1.2" || protocol === "TLSv1.3"), value: `${protocol ?? "unknown"}${socket.authorized ? "" : " (untrusted certificate)"}`, raw: JSON.stringify({ protocol, authorized: socket.authorized, authorizationError: socket.authorizationError, subject: cert.subject, issuer: cert.issuer, valid_from: cert.valid_from, valid_to: cert.valid_to }) })
    socket.end()
  })
  if (signal.aborted) abort()
})
