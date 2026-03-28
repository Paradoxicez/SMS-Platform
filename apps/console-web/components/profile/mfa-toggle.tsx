"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Info, ShieldCheck } from "lucide-react"

const KEYCLOAK_ACCOUNT_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER
    ? `${process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER}/account/#/security/signingin`
    : "http://localhost:8080/realms/sms-platform/account/#/security/signingin"

interface MfaToggleProps {
  mfaEnabled: boolean
}

export function MfaToggle({ mfaEnabled }: MfaToggleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Status</span>
          {mfaEnabled ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Two-factor authentication (MFA) protects your account by requiring a
            second verification step when signing in. Manage your MFA settings
            through Keycloak.
          </p>
        </div>

        <Button asChild variant={mfaEnabled ? "outline" : "default"} className="w-full">
          <a href={KEYCLOAK_ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
            Manage MFA
            <ExternalLink className="ml-2 size-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
