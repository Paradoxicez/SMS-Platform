"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Camera,
  Map,
  FolderKanban,
  BookOpen,
  ShieldCheck,
  ClipboardList,
  Code2,
  ChevronsUpDown,
  Radio,
  LogOut,
  User,
  Server,
  Forward,
  Sliders,
  CreditCard,
  KeyRound,
  Mail,
  Globe,
  Video,
  BrainCircuit,
  ExternalLink,
} from "lucide-react"

const monitoringNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Cameras", href: "/cameras", icon: Camera },
  { title: "Map", href: "/map", icon: Map },
  { title: "Recordings", href: "/recordings", icon: Video },
]

const managementNav = [
  { title: "Policies", href: "/policies", icon: ShieldCheck },
  { title: "Stream Profiles", href: "/profiles", icon: Sliders },
  { title: "Audit Log", href: "/audit", icon: ClipboardList },
]

const platformNav = [
  { title: "API Keys", href: "/api-keys", icon: KeyRound },
  { title: "Developer", href: "/developer", icon: Code2 },
  { title: "Users", href: "/settings/users", icon: User },
  { title: "Stream Engine", href: "/settings/stream-engine", icon: Server },
  { title: "Forwarding", href: "/settings/forwarding", icon: Forward },
  { title: "Webhooks", href: "/settings/webhooks", icon: Globe },
  { title: "AI Integrations", href: "/settings/ai", icon: BrainCircuit },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Email", href: "/settings/email", icon: Mail },
  { title: "License", href: "/settings/license", icon: KeyRound, onPremOnly: true },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOnPrem, setIsOnPrem] = useState(false)

  useEffect(() => {
    // Check if this is an on-prem deployment to show/hide license nav
    async function checkDeployment() {
      try {
        const res = await fetch(
          `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1"}/license/status`,
        )
        if (res.ok) {
          const data = await res.json()
          setIsOnPrem(data?.data?.is_on_prem === true)
        }
      } catch {
        // Ignore — default to hiding license nav
      }
    }
    checkDeployment()
  }, [])

  const filteredPlatformNav = platformNav.filter(
    (item) => !("onPremOnly" in item && item.onPremOnly) || isOnPrem,
  )

  const userName = session?.user?.name ?? "User"
  const userEmail = session?.user?.email ?? ""
  const userRole = (session as any)?.role ?? "viewer"
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary">
            <Radio className="size-3.5 text-primary-foreground" />
          </div>
          <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-tight">{userName}</p>
            <p className="text-xs text-muted-foreground leading-tight capitalize">{userRole}</p>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitoringNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <a href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <a href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredPlatformNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <a href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 space-y-2">
        <a
          href="/docs"
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Docs</span>
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {userInitials}
              </div>
              <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium leading-tight truncate">{userName}</p>
                <p className="text-xs text-muted-foreground leading-tight truncate">{userEmail}</p>
              </div>
              <ChevronsUpDown className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/profile" className="cursor-pointer">
                <User className="mr-2 size-4" />
                Profile
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="size-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="group-data-[collapsible=icon]:hidden">All systems operational</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
