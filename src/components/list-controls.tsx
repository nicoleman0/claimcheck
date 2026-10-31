"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

// Selection over the rows currently shown; it resets when the rows change (new page, sort or filter).
export function useRowSelection(ids: string[]) {
  const key = ids.join("|")
  const [state, setState] = useState<{ key: string; selected: Set<string> }>({ key, selected: new Set() })
  const selected = state.key === key ? state.selected : new Set<string>()
  const set = (next: Set<string>) => setState({ key, selected: next })
  return useMemo(
    () => ({
      selected,
      count: selected.size,
      allSelected: ids.length > 0 && selected.size === ids.length,
      someSelected: selected.size > 0 && selected.size < ids.length,
      isSelected: (id: string) => selected.has(id),
      toggle: (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        set(next)
      },
      toggleAll: () => set(selected.size === ids.length ? new Set() : new Set(ids)),
      clear: () => set(new Set()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, selected],
  )
}

// j/k or arrows move the focused row; other keys in `actions` run on it. Ignored while typing in a field.
export function useRowKeys(count: number, actions: Record<string, (index: number) => void>) {
  const [focus, setFocus] = useState<{ count: number; index: number }>({ count, index: -1 })
  const focused = focus.count === count ? focus.index : -1
  const ref = useRef({ focused, actions })
  useEffect(() => {
    ref.current = { focused, actions }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (document.querySelector("[role=dialog]")) return
      const { focused, actions } = ref.current
      let next = focused
      if (e.key === "j" || e.key === "ArrowDown") next = Math.min(count - 1, focused + 1)
      else if (e.key === "k" || e.key === "ArrowUp") next = Math.max(0, focused - 1)
      else if (actions[e.key] && focused >= 0) {
        e.preventDefault()
        actions[e.key](focused)
        return
      } else return
      e.preventDefault()
      setFocus({ count, index: next })
      document.querySelector(`[data-row-index="${next}"]`)?.scrollIntoView({ block: "nearest" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [count])

  return {
    focused,
    rowProps: (index: number) => ({
      "data-row-index": index,
      "data-focused": index === focused ? "" : undefined,
      onClick: () => setFocus({ count, index }),
    }),
  }
}

// Row classes for focus and selection; add to a <TableRow> together with rowProps and aria-selected.
export const rowStateClass =
  "data-focused:bg-accent/60 data-focused:shadow-[inset_3px_0_0_var(--primary)] aria-selected:bg-accent"

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClear()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [count, onClear])
  if (count === 0) return null
  return (
    <div role="toolbar" aria-label="Bulk actions" className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-3 border border-primary bg-panel px-3 py-2 font-mono text-xs">
      <span className="font-bold">{count} selected</span>
      {children}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        clear <Kbd>esc</Kbd>
      </Button>
    </div>
  )
}

export function KeyHints({ hints }: { hints: [string, string][] }) {
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {hints.map(([k, label], i) => (
        <span key={k}>
          {i > 0 && " · "}
          <Kbd>{k}</Kbd> {label}
        </span>
      ))}
    </span>
  )
}
