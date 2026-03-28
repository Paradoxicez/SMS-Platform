import * as React from "react"
import {
  LayoutDashboard,
  Camera,
  Map,
  ShieldCheck,
  ClipboardList,
  Code2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../components/ui/button"
import { ScrollArea } from "../components/ui/scroll-area"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Cameras", href: "/cameras", icon: Camera },
  { title: "Map", href: "/map", icon: Map },
  { title: "Policies", href: "/policies", icon: ShieldCheck },
  { title: "Audit", href: "/audit", icon: ClipboardList },
  { title: "Developer", href: "/developer", icon: Code2 },
]

interface AppSidebarProps {
  children: React.ReactNode
}

export function AppSidebar({ children }: AppSidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex flex-col border-r bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!collapsed && (
            <span className="text-lg font-semibold">CCTV Platform</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </a>
            ))}
          </nav>
        </ScrollArea>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
