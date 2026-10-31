import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listHref, type ListQuery } from "@/lib/list-query"
import { cn } from "@/lib/utils"

// Header cell content that sorts by `column`; put it inside <TableHead aria-sort={ariaSort(query, column)}>.
export function SortHeader({ query, path, column, children }: { query: ListQuery; path: string; column: string; children: React.ReactNode }) {
  const active = query.sort === column
  const dir = active && query.dir === "asc" ? "desc" : "asc"
  return (
    <Link href={listHref(path, query, { sort: column, dir })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
      {children}
      <span aria-hidden className={cn(!active && "opacity-30")}>{active && query.dir === "desc" ? "▼" : "▲"}</span>
    </Link>
  )
}

export function ariaSort(query: ListQuery, column: string): "ascending" | "descending" | "none" {
  return query.sort !== column ? "none" : query.dir === "asc" ? "ascending" : "descending"
}

// Search box plus filter chips with counts. A plain GET form, so it works before JavaScript loads.
export function FilterBar({
  query,
  path,
  filters,
  total,
  placeholder = "search",
}: {
  query: ListQuery
  path: string
  filters: { value: string; label: string; count: number }[]
  total: number
  placeholder?: string
}) {
  const chip = (value: string | null, text: string) => (
    <Link
      key={value ?? "all"}
      href={listHref(path, query, { filter: value })}
      aria-current={query.filter === value ? "true" : undefined}
      className={cn(
        "border px-2 py-1 font-mono text-xs",
        query.filter === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {text}
    </Link>
  )
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <form action={path} method="get" role="search" className="flex min-w-0 flex-1 basis-60 gap-2">
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir} />
        {query.filter && <input type="hidden" name="filter" value={query.filter} />}
        <Input name="q" type="search" defaultValue={query.q} placeholder={placeholder} aria-label="Search" className="font-mono text-xs" />
        <Button type="submit" variant="outline">search</Button>
      </form>
      {chip(null, `all ${total}`)}
      {filters.map((f) => chip(f.value, `${f.label} ${f.count}`))}
      {(query.q || query.filter) && (
        <Link href={listHref(path, query, { q: "", filter: null })} className="font-mono text-xs text-primary hover:underline">
          clear
        </Link>
      )}
    </div>
  )
}
