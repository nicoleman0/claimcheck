import { cn } from "@/lib/utils"

// Display components for model output and checks. Values are 0..1 probabilities or confidences.

export function ConfidenceMeter({ value, threshold = 0.6 }: { value: number; threshold?: number }) {
  const filled = Math.round(value * 10)
  const low = value < threshold
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs" title={low ? "Low confidence: needs review" : undefined}>
      <span role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} className="inline-flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("h-3 w-[5px]", i < filled ? (low ? "bg-primary" : "bg-strong") : "bg-border")} />
        ))}
      </span>
      {value.toFixed(2)}
    </span>
  )
}

export function ProbabilityBars({ options }: { options: { label: string; p: number }[] }) {
  const top = Math.max(...options.map((o) => o.p))
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-x-2.5 gap-y-1.5 font-mono text-xs text-muted-foreground">
      {options.map((o) => (
        <div key={o.label} className="contents">
          <span className="truncate">{o.label}</span>
          <span className="h-1.5 bg-border">
            <span className={cn("block h-1.5", o.p === top ? "bg-strong" : "bg-primary")} style={{ width: `${Math.round(o.p * 100)}%` }} />
          </span>
          <span className="text-right">{o.p.toFixed(2).replace(/^0/, "")}</span>
        </div>
      ))}
    </div>
  )
}

export function RiskScale({ levels, probabilities }: { levels: string[]; probabilities: number[] }) {
  const top = probabilities.indexOf(Math.max(...probabilities))
  return (
    <div className="font-mono text-[11px] text-muted-foreground">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}>
        {levels.map((l, i) => (
          <span key={l} className={cn("h-2", i === top ? "bg-strong" : probabilities[i] >= 0.1 ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}>
        {levels.map((l, i) => (
          <span key={l} className={cn(i === top && "font-bold text-foreground")}>
            {l}{probabilities[i] >= 0.1 ? ` ${probabilities[i].toFixed(2).replace(/^0/, "")}` : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

export function CheckLine({ name, ok, value }: { name: string; ok: boolean | null; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-mono text-xs leading-[22px]">
      <span className="text-muted-foreground">{name}</span>
      <span className={cn("font-medium", ok === false ? "text-warning" : ok ? "text-info" : "text-muted-foreground")}>
        {ok === false ? "✕" : ok ? "✓" : "·"} {value}
      </span>
    </div>
  )
}

export function Panel({ label, emphasis, className, children }: { label: string; emphasis?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("border p-4", emphasis && "border-primary bg-panel", className)}>
      <h2 className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{label}</h2>
      {children}
    </section>
  )
}
