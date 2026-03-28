"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, Info } from "lucide-react"

const KEYCLOAK_ACCOUNT_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER
    ? `${process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER}/account/#/security/signingin`
    : "http://localhost:8080/realms/sms-platform/account/#/security/signingin"

export function ChangePassword() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your account password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input id="current-password" type="password" disabled placeholder="********" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input id="new-password" type="password" disabled placeholder="********" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <Input id="confirm-password" type="password" disabled placeholder="********" />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Password changes are managed through Keycloak. Click the button below
            to open the Keycloak account page where you can update your password.
          </p>
        </div>

        <Button asChild className="w-full">
          <a href={KEYCLOAK_ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
            Change via Keycloak
            <ExternalLink className="ml-2 size-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
