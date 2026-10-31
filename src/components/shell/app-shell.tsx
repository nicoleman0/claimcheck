"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect } from "react"

import { app } from "@/lib/app"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

// Pathname is runtime data on dynamic routes; the Suspense fallbacks render without it.
function NavMenu({ pathname }: { pathname: string | null }) {
  return (
    <SidebarMenu>
      {app.nav.map((item) => {
        const active = pathname != null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              className="h-9 font-mono text-[13px] data-active:shadow-[inset_2px_0_0_var(--primary)]"
              render={<Link href={item.href} />}
            >
              <span>{active ? "› " : ""}{item.title}</span>
              <Kbd className="ml-auto">g {item.key}</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function ActiveNavMenu() {
  return <NavMenu pathname={usePathname()} />
}

function PathCrumb() {
  const segments = usePathname().split("/").filter(Boolean)
  return (
    <span className="truncate">
      {segments.slice(0, -1).map((s) => `${s}/`)}
      <span className="text-foreground">{segments.at(-1)}</span>
    </span>
  )
}

// "g" then a nav key jumps to that page; ignored while typing in a field.
function useGoShortcuts() {
  const router = useRouter()
  useEffect(() => {
    let armed = 0
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key === "g") { armed = Date.now(); return }
      const item = Date.now() - armed < 1000 && app.nav.find((n) => n.key === e.key)
      armed = 0
      if (item) router.push(item.href)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useGoShortcuts()

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="h-11 justify-center border-b px-4">
          <Link href="/" className="font-mono text-sm font-bold">
            {app.name}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              <Suspense fallback={<NavMenu pathname={null} />}>
                <ActiveNavMenu />
              </Suspense>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4 font-mono text-xs text-muted-foreground">
          <SidebarTrigger className="-ml-1" />
          <Suspense fallback={null}>
            <PathCrumb />
          </Suspense>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
