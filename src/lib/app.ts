import { ListChecksIcon, ScrollTextIcon, type LucideIcon } from "lucide-react"

// App name and navigation live here; the shell and metadata read them.
// `key` is the shortcut after "g" (g r opens the register).
export const app = {
  name: "claimcheck",
  description: "Check supplier security claims against their SOC 2 report and public evidence.",
  nav: [
    { title: "register", href: "/", icon: ListChecksIcon, key: "r" },
    { title: "audit log", href: "/audit", icon: ScrollTextIcon, key: "l" },
  ] satisfies NavItem[],
}

export type NavItem = { title: string; href: string; icon: LucideIcon; key: string }
