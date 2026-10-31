import { cn } from "@/lib/utils"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const toneClass: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

// Apps pass their own status -> tone map, so status names stay in the app.
export function toneFor(status: string, tones: Record<string, Tone>): Tone {
  return tones[status] ?? "neutral"
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs font-bold whitespace-nowrap", toneClass[tone])}>
      <span className="size-1.5 bg-current" aria-hidden />
      {children}
    </span>
  )
}
