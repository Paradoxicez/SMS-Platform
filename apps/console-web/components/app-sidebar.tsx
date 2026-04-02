"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { getApiBaseUrl } from "@/lib/api-url"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
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
  Sliders,
  KeyRound,
  Globe,
  Video,
  Settings,
  CreditCard,
  LifeBuoy,
} from "lucide-react"

type Role = "admin" | "operator" | "developer" | "viewer"

interface NavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
  roles?: Role[]       // if set, only these roles see it; if omitted, all roles see it
  onPremOnly?: boolean
}

const monitoringNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban, roles: ["admin", "operator", "viewer"] },
  { title: "Cameras", href: "/cameras", icon: Camera },
  { title: "Map", href: "/map", icon: Map },
  { title: "Recordings", href: "/recordings", icon: Video },
]

const managementNav: NavItem[] = [
  { title: "Policies", href: "/policies", icon: ShieldCheck, roles: ["admin", "operator", "developer"] },
  { title: "Stream Profiles", href: "/profiles", icon: Sliders, roles: ["admin", "operator"] },
  { title: "Audit Log", href: "/audit", icon: ClipboardList, roles: ["admin", "operator"] },
]

const platformNav: NavItem[] = [
  { title: "API Keys", href: "/api-keys", icon: KeyRound, roles: ["admin", "developer"] },
  { title: "Developer", href: "/developer", icon: Code2, roles: ["admin", "developer"] },
  { title: "Users", href: "/settings/users", icon: User, roles: ["admin"] },
  { title: "Stream Engine", href: "/settings/stream-engine", icon: Server, roles: ["admin"] },
  { title: "Webhooks", href: "/settings/webhooks", icon: Globe, roles: ["admin"] },
  { title: "License", href: "/settings/license", icon: KeyRound, roles: ["admin"], onPremOnly: true },
]

function filterByRole(items: NavItem[], role: Role, isOnPrem: boolean): NavItem[] {
  return items.filter((item) => {
    if (item.onPremOnly && !isOnPrem) return false
    if (item.roles && !item.roles.includes(role)) return false
    return true
  })
}

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOnPrem, setIsOnPrem] = useState(false)

  const userRole = ((session as any)?.role as Role) ?? "viewer"

  useEffect(() => {
    async function checkDeployment() {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/license/status`,
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

  const visibleMonitoring = filterByRole(monitoringNav, userRole, isOnPrem)
  const visibleManagement = filterByRole(managementNav, userRole, isOnPrem)
  const visiblePlatform = filterByRole(platformNav, userRole, isOnPrem)

  const userName = session?.user?.name ?? "User"
  const userEmail = session?.user?.email ?? ""
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const isProfileActive = pathname.startsWith("/profile")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <a
          href="/dashboard"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
            <Radio className="size-4 text-primary-foreground" />
          </div>
          <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-tight">SMS Platform</p>
            <p className="text-xs text-muted-foreground leading-tight">Surveillance Management</p>
          </div>
        </a>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMonitoring.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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

        {visibleManagement.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleManagement.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
          </>
        )}

        {visiblePlatform.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visiblePlatform.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Docs">
              <a href="/docs">
                <BookOpen className="size-4" />
                <span>Docs</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={userName}
                  className={isProfileActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {userInitials}
                  </div>
                  <div className="flex-1 truncate text-left">
                    <p className="text-sm font-medium leading-tight truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground leading-tight truncate">{userEmail}</p>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side="top"
                sideOffset={4}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/profile?tab=profile" className="cursor-pointer">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/profile?tab=billing" className="cursor-pointer">
                    <CreditCard className="mr-2 size-4" />
                    Billing
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/docs" className="cursor-pointer">
                    <LifeBuoy className="mr-2 size-4" />
                    Help & Support
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
