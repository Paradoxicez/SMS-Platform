"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UsageMeters } from "@/components/billing/usage-meters"
import { MfaToggle } from "@/components/profile/mfa-toggle"
import { apiClient } from "@/lib/api-client"
import { setDatePrefs, type DateFormatPref, type TimeFormatPref } from "@/lib/format-date"
import { toast } from "sonner"
import {
  User,
  Clock,
  CreditCard,
  Loader2,
  Check,
  Lock,
  ChevronsUpDown,
  AlertTriangle,
  Camera,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────

interface UsageData {
  plan_name: string
  plan_display_name: string
  cameras: { current: number; limit: number }
  projects: { current: number; limit: number }
  users: { current: number; limit: number }
}

// ─── Tab definitions ────────────────────────────────────────

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "datetime", label: "Date & Time", icon: Clock },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const

type TabId = (typeof TABS)[number]["id"]

// ─── Helpers ────────────────────────────────────────────────

function useUnsavedChanges() {
  const [dirty, setDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const markDirty = useCallback(() => setDirty(true), [])
  const markClean = useCallback(() => setDirty(false), [])

  const guardAction = useCallback(
    (action: () => void) => {
      if (dirty) {
        setPendingAction(() => action)
      } else {
        action()
      }
    },
    [dirty],
  )

  const confirmDiscard = useCallback(() => {
    setDirty(false)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }, [pendingAction])

  const cancelDiscard = useCallback(() => {
    setPendingAction(null)
  }, [])

  return { dirty, markDirty, markClean, guardAction, confirmDiscard, cancelDiscard, showDialog: pendingAction !== null }
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score: 20, label: "Weak", color: "bg-red-500" }
  if (score === 2) return { score: 40, label: "Fair", color: "bg-orange-500" }
  if (score === 3) return { score: 60, label: "Good", color: "bg-yellow-500" }
  if (score === 4) return { score: 80, label: "Strong", color: "bg-lime-500" }
  return { score: 100, label: "Very Strong", color: "bg-green-500" }
}

// ─── Unsaved Changes Dialog ─────────────────────────────────

function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Unsaved Changes
          </DialogTitle>
          <DialogDescription>
            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Stay
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Timezone Combobox ──────────────────────────────────────

const TIMEZONES = typeof Intl !== "undefined" && Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : []

function TimezoneCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select timezone..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {TIMEZONES.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === tz ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {tz.replace(/_/g, " ")}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Main Page ──────────────────────────────────────────────

function ProfileSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get("tab") as TabId) || "profile"
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const unsaved = useUnsavedChanges()

  // Sync tab with browser back/forward
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search)
      const tab = (params.get("tab") as TabId) || "profile"
      setActiveTab(tab)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  function switchTab(tab: TabId) {
    unsaved.guardAction(() => {
      setActiveTab(tab)
      router.replace(`/profile?tab=${tab}`, { scroll: false })
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, preferences, and subscription.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar tabs */}
        <nav className="w-48 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {activeTab === "profile" && <ProfileTab onDirtyChange={unsaved.dirty ? undefined : unsaved.markDirty} onClean={unsaved.markClean} />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "datetime" && <DateTimeTab />}
          {activeTab === "billing" && <BillingTab />}
        </div>
      </div>

      <UnsavedChangesDialog
        open={unsaved.showDialog}
        onConfirm={unsaved.confirmDiscard}
        onCancel={unsaved.cancelDiscard}
      />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProfileSettingsContent />
    </Suspense>
  )
}

// ─── Tab: Profile ───────────────────────────────────────────

function ProfileTab({ onDirtyChange, onClean }: { onDirtyChange?: () => void; onClean?: () => void }) {
  const { data: session } = useSession()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("viewer")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const initialValues = useRef({ name: "", email: "" })

  // Organization
  const [orgName, setOrgName] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [tier, setTier] = useState("free")
  const [savingOrg, setSavingOrg] = useState(false)
  const [orgErrors, setOrgErrors] = useState<{ orgName?: string; billingEmail?: string }>({})

  useEffect(() => {
    if (session?.user) {
      const n = session.user.name ?? ""
      const e = session.user.email ?? ""
      setName(n)
      setEmail(e)
      setRole((session as any).role ?? "viewer")
      initialValues.current = { name: n, email: e }
    }
  }, [session])

  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await apiClient.get<{
          data: { name: string; billing_email: string; subscription_tier: string }
        }>("/tenants/me")
        setOrgName(res.data.name ?? "")
        setBillingEmail(res.data.billing_email ?? "")
        setTier(res.data.subscription_tier ?? "free")
      } catch { /* */ }
    }
    fetchTenant()
  }, [])

  // Track dirty state
  useEffect(() => {
    const isDirty =
      name !== initialValues.current.name || email !== initialValues.current.email
    if (isDirty) onDirtyChange?.()
    else onClean?.()
  }, [name, email, onDirtyChange, onClean])

  function validateProfile(): boolean {
    const errs: { name?: string; email?: string } = {}
    if (!name.trim()) errs.name = "Name is required"
    if (!email.trim()) errs.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email format"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateOrg(): boolean {
    const errs: { orgName?: string; billingEmail?: string } = {}
    if (!orgName.trim()) errs.orgName = "Organization name is required"
    if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail))
      errs.billingEmail = "Invalid email format"
    setOrgErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSaveProfile() {
    if (!validateProfile()) return
    setSaving(true)
    try {
      await apiClient.patch("/users/me", { name, email })
      initialValues.current = { name, email }
      onClean?.()
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOrg() {
    if (!validateOrg()) return
    setSavingOrg(true)
    try {
      await apiClient.patch("/tenants/me", { name: orgName, billing_email: billingEmail })
      toast.success("Organization updated")
    } catch {
      toast.error("Failed to update organization")
    } finally {
      setSavingOrg(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>Update your name and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                {name
                  ? name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : <User className="size-6 text-muted-foreground" />}
              </div>
              <button
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => toast.info("Avatar upload coming soon")}
              >
                <Camera className="size-4 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium">{name || "Your Name"}</p>
              <p className="text-xs text-muted-foreground">{email || "your@email.com"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })) }}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label className="text-sm">Role</Label>
              <p className="text-xs text-muted-foreground">Assigned by an administrator</p>
            </div>
            <Badge variant="outline" className="capitalize">{role}</Badge>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>
            Your tenant information.
            <Badge variant="outline" className="ml-2 capitalize">{tier}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setOrgErrors((p) => ({ ...p, orgName: undefined })) }}
                aria-invalid={!!orgErrors.orgName}
              />
              {orgErrors.orgName && <p className="text-xs text-destructive">{orgErrors.orgName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-email">Billing Email</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(e) => { setBillingEmail(e.target.value); setOrgErrors((p) => ({ ...p, billingEmail: undefined })) }}
                aria-invalid={!!orgErrors.billingEmail}
              />
              {orgErrors.billingEmail && <p className="text-xs text-destructive">{orgErrors.billingEmail}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleSaveOrg} disabled={savingOrg}>
            {savingOrg && <Loader2 className="mr-2 size-4 animate-spin" />}
            Update Organization
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ─── Tab: Security ──────────────────────────────────────────

function SecurityTab() {
  const [mfaEnabled, setMfaEnabled] = useState(false)

  useEffect(() => {
    async function loadMfa() {
      try {
        const res = await apiClient.get<{ data: { mfa_enabled: boolean } }>("/mfa/status")
        setMfaEnabled(res.data.mfa_enabled)
      } catch { /* */ }
    }
    loadMfa()
  }, [])

  return (
    <div className="space-y-6">
      {/* MFA first — more prominent */}
      <MfaToggle
        mfaEnabled={mfaEnabled}
        onStatusChange={setMfaEnabled}
      />
      <ChangePasswordCard />
    </div>
  )
}

// ─── Change Password Card ───────────────────────────────────

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const strength = newPassword ? getPasswordStrength(newPassword) : null

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      await apiClient.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      const msg = err?.message?.includes("incorrect")
        ? "Current password is incorrect"
        : "Failed to change password"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
        <CardDescription>
          Update your account password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          {/* Password strength + mismatch on one row */}
          <div className="flex items-center justify-between gap-4">
            {strength ? (
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", strength.color)}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <p className={cn("text-xs", {
                  "text-red-500": strength.score <= 20,
                  "text-orange-500": strength.score === 40,
                  "text-yellow-600": strength.score === 60,
                  "text-lime-600": strength.score === 80,
                  "text-green-600": strength.score === 100,
                })}>
                  Password strength: {strength.label}
                </p>
              </div>
            ) : <div className="flex-1" />}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive shrink-0">Passwords do not match</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={!canSubmit || saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Change Password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ─── Tab: Date & Time ───────────────────────────────────────

function DateTimeTab() {
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  // Load saved preferences from API
  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await apiClient.get<{
          data: { timezone?: string; date_format?: string; time_format?: string }
        }>("/users/me")
        if (res.data.timezone) setTimezone(res.data.timezone)
        if (res.data.date_format) setDateFormat(res.data.date_format)
        if (res.data.time_format) setTimeFormat(res.data.time_format)
      } catch { /* use browser default */ }
    }
    loadPrefs()
  }, [])

  async function handleSavePreferences() {
    setSavingPrefs(true)
    try {
      await apiClient.patch("/users/me", { timezone, date_format: dateFormat, time_format: timeFormat })
      setDatePrefs({
        timezone,
        dateFormat: dateFormat as DateFormatPref,
        timeFormat: timeFormat as TimeFormatPref,
      })
      toast.success("Preferences saved")
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2000)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSavingPrefs(false)
    }
  }

  const now = new Date()
  const datePreview = (() => {
    switch (dateFormat) {
      case "DD/MM/YYYY": return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
      case "MM/DD/YYYY": return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`
      default: return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    }
  })()

  const timePreview = timeFormat === "12h"
    ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date & Time</CardTitle>
          <CardDescription>
            Configure how dates and times are displayed throughout the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <TimezoneCombobox value={timezone} onChange={setTimezone} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select value={timeFormat} onValueChange={setTimeFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24-hour</SelectItem>
                  <SelectItem value="12h">12-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Preview: <span className="font-medium text-foreground">{datePreview} {timePreview}</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? <Loader2 className="mr-2 size-4 animate-spin" /> : prefsSaved ? <Check className="mr-2 size-4" /> : null}
            {prefsSaved ? "Saved" : "Save Preferences"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ─── Tab: Billing ───────────────────────────────────────────

function BillingTab() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const usageRes = await apiClient.get<{ data: UsageData }>("/billing/usage")
        setUsage(usageRes.data)
      } catch { /* */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Plan + Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Current Plan</CardTitle>
                <Badge variant="secondary">{usage.plan_display_name}</Badge>
              </div>
            </div>
            <CardDescription>Your current resource usage and limits.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMeters
              meters={[
                { label: "Cameras", current: usage.cameras.current, limit: usage.cameras.limit },
                { label: "Projects", current: usage.projects.current, limit: usage.projects.limit },
                { label: "Users", current: usage.users.current, limit: usage.users.limit },
              ]}
            />
          </CardContent>
        </Card>
      )}

    </div>
  )
}
