// URL state for server-rendered lists: ?page=&sort=&dir=&q=&filter=
// `sort` and `filter` only ever hold values from the caller's allow-lists, so they are safe to map to SQL.

export const PAGE_SIZE = 20

export type Dir = "asc" | "desc"

export type ListQuery<S extends string = string, F extends string = string> = {
  page: number
  size: number
  offset: number
  sort: S
  dir: Dir
  q: string
  filter: F | null
}

type Params = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function readListQuery<S extends string, F extends string = never>(
  params: Params,
  opts: { sorts: readonly S[]; defaultSort: S; defaultDir?: Dir; filters?: readonly F[]; size?: number },
): ListQuery<S, F> {
  const size = opts.size ?? PAGE_SIZE
  const n = Number(one(params.page))
  const page = Number.isInteger(n) && n > 0 ? n : 1
  const sort = opts.sorts.find((s) => s === one(params.sort)) ?? opts.defaultSort
  const d = one(params.dir)
  const dir: Dir = d === "asc" || d === "desc" ? d : (opts.defaultDir ?? "asc")
  const filter = opts.filters?.find((f) => f === one(params.filter)) ?? null
  const q = (one(params.q) ?? "").trim().slice(0, 200)
  return { page, size, offset: (page - 1) * size, sort, dir, q, filter }
}

// Link to the same list with some state changed. Any change other than the page returns to page 1.
export function listHref(path: string, query: ListQuery, change: Partial<Pick<ListQuery, "page" | "sort" | "dir" | "q" | "filter">>): string {
  const next = { ...query, ...change, page: change.page ?? (Object.keys(change).length ? 1 : query.page) }
  const params = new URLSearchParams()
  if (next.page > 1) params.set("page", String(next.page))
  params.set("sort", next.sort)
  params.set("dir", next.dir)
  if (next.q) params.set("q", next.q)
  if (next.filter) params.set("filter", next.filter)
  return `${path}?${params}`
}
