// Creates tables and seeds the register. `--reset` drops everything first.
import { neon } from "@neondatabase/serverless"
import { readFileSync } from "node:fs"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")
const sql = neon(url)

if (process.argv.includes("--reset")) {
  for (const t of ["events", "decisions", "findings", "checks", "assessments", "vendors"]) await sql.query(`drop table if exists ${t}`)
}
for (const stmt of readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8").split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt)
}

const seed = [
  ["Northwind Payments", "northwind.example", "A. Patel", "approved", "low", "2027-03-01"],
  ["Brightledger", "brightledger.example", "J. Okafor", "approved_with_conditions", "medium", "2027-01-15"],
  ["Quillstack Cloud", "quillstack.example", "M. Novak", "awaiting_vendor", "high", "2026-12-01"],
  ["Harbourline KYC", "harbourline.example", "A. Patel", "rejected", "critical", "2027-04-30"],
  ["Pebblemint Analytics", "pebblemint.example", "S. Duarte", "new", null, null],
] as const
for (const [name, domain, owner, status, risk, next] of seed) {
  const [v] = await sql`insert into vendors (name, domain, owner, status, risk, next_review) values (${name}, ${domain}, ${owner}, ${status}, ${risk}, ${next})
    on conflict (domain) do nothing returning id`
  if (v) await sql`insert into events (vendor_id, actor, action, detail) values (${v.id}, 'seed', 'vendor.created', ${name})`
}
console.log("db ready")
