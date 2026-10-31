import { LayoutDashboardIcon, type LucideIcon } from "lucide-react"

// App name and navigation live here; the shell and metadata read them.
// `key` is the shortcut after "g" (g o opens Overview).
export const app = {
  name: "app",
  description: "Replace with a one-line description.",
  nav: [{ title: "overview", href: "/", icon: LayoutDashboardIcon, key: "o" }] satisfies NavItem[],
}

export type NavItem = { title: string; href: string; icon: LucideIcon; key: string }
