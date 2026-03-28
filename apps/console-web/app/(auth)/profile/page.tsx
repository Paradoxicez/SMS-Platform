"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChangePassword } from "@/components/profile/change-password"
import { MfaToggle } from "@/components/profile/mfa-toggle"
import { apiClient } from "@/lib/api-client"
import { User, Save, Loader2, Building2 } from "lucide-react"

export default function ProfilePage() {
  const { data: session } = useSession()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("viewer")
  const [mfaEnabled, _setMfaEnabled] = useState(false)
  const [lastLogin, _setLastLogin] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "")
      setEmail(session.user.email ?? "")
      setRole((session as any).role ?? "viewer")
    }
  }, [session])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      await apiClient.patch("/users/me", { name, email })
      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message ?? "Failed to update profile.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and security preferences.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Update your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Role</Label>
              <p className="text-xs text-muted-foreground">Assigned by an administrator</p>
            </div>
            <Badge variant="outline" className="capitalize">{role}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>MFA Status</Label>
              <p className="text-xs text-muted-foreground">Two-factor authentication</p>
            </div>
            {mfaEnabled ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>

          {lastLogin && (
            <div className="flex items-center justify-between">
              <Label>Last Login</Label>
              <span className="text-sm text-muted-foreground">
                {new Date(lastLogin).toLocaleString()}
              </span>
            </div>
          )}

          {message && (
            <div
              className={`rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Security Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Security</h2>
        <div className="space-y-4">
          <ChangePassword />
          <MfaToggle mfaEnabled={mfaEnabled} />
        </div>
      </div>

      <Separator />

      {/* Organization / Plan */}
      <OrganizationCard />
    </div>
  )
}

function OrganizationCard() {
  const [tenantName, setTenantName] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [tier, setTier] = useState("free")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await apiClient.get<{
          data: { name: string; billing_email: string; subscription_tier: string }
        }>("/tenants/me")
        setTenantName(res.data.name ?? "")
        setBillingEmail(res.data.billing_email ?? "")
        setTier(res.data.subscription_tier ?? "free")
      } catch {
        // Tenant info unavailable
      }
    }
    fetchTenant()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.patch("/tenants/me", {
        name: tenantName,
        billing_email: billingEmail,
      })
    } catch {
      // Error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Organization & Plan</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Organization
          </CardTitle>
          <CardDescription>
            Your tenant information and subscription plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Plan</Label>
              <p className="text-xs text-muted-foreground">Current subscription</p>
            </div>
            <Badge variant="outline" className="capitalize">{tier}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Your organization"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-email">Billing Email</Label>
            <Input
              id="org-email"
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="billing@example.com"
            />
          </div>

          <Button variant="outline" onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Update Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
