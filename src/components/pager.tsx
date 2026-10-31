import Link from "next/link"

import { listHref, type ListQuery } from "@/lib/list-query"

export function Pager({ query, total, path, label = "rows" }: { query: ListQuery; total: number; path: string; label?: string }) {
  const pages = Math.max(1, Math.ceil(total / query.size))
  const first = total === 0 ? 0 : query.offset + 1
  const last = Math.min(query.offset + query.size, total)
  const step = (n: number, text: string) =>
    n >= 1 && n <= pages ? (
      <Link href={listHref(path, query, { page: n })} className="border px-2.5 py-1 hover:bg-accent hover:text-accent-foreground">
        {text}
      </Link>
    ) : (
      <span aria-disabled className="border px-2.5 py-1 opacity-40">{text}</span>
    )
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 py-3 font-mono text-xs text-muted-foreground">
      <span>{label} {first}–{last} of {total}</span>
      {pages > 1 && (
        <span className="flex items-center gap-2">
          {step(query.page - 1, "‹ prev")}
          <span className="px-1 text-foreground">{query.page} / {pages}</span>
          {step(query.page + 1, "next ›")}
        </span>
      )}
    </nav>
  )
}
