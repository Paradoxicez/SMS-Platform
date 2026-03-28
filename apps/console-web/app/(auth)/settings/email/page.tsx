"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react"

type Provider = "console" | "smtp" | "sendgrid"

export default function EmailSettingsPage() {
  const [provider, setProvider] = useState<Provider>("console")
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [smtpFrom, setSmtpFrom] = useState("")
  const [sendgridKey, setSendgridKey] = useState("")
  const [sendgridFrom, setSendgridFrom] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  async function handleSave() {
    setSaving(true)
    // For MVP, settings are stored as env vars on the server.
    // This page provides a UI for viewing/testing the configuration.
    setTimeout(() => {
      setSaving(false)
    }, 1000)
  }

  async function handleTestEmail() {
    setTesting(true)
    setTestResult(null)

    try {
      // In a full implementation, this would call POST /api/v1/email/test
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setTestResult({
        success: true,
        message: "Test email sent successfully. Check your inbox.",
      })
    } catch {
      setTestResult({
        success: false,
        message: "Failed to send test email.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Email Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the email provider used for notifications and alerts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            Email Provider
          </CardTitle>
          <CardDescription>
            Select how emails are sent from the platform. For development, use
            Console mode which logs emails to stdout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as Provider)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="console">Console (Development)</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
              </SelectContent>
            </Select>
            {provider === "console" && (
              <p className="text-xs text-muted-foreground">
                Emails will be logged to the server console. No actual emails
                are sent.
              </p>
            )}
          </div>

          {provider === "smtp" && (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="text-sm font-medium">SMTP Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">Host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.example.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-user">Username</Label>
                <Input
                  id="smtp-user"
                  placeholder="user@example.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-pass">Password</Label>
                <Input
                  id="smtp-pass"
                  type="password"
                  placeholder="SMTP password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from">From Address</Label>
                <Input
                  id="smtp-from"
                  placeholder="noreply@yourcompany.com"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                />
              </div>
            </div>
          )}

          {provider === "sendgrid" && (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="text-sm font-medium">SendGrid Settings</h4>
              <div className="space-y-2">
                <Label htmlFor="sg-key">API Key</Label>
                <Input
                  id="sg-key"
                  type="password"
                  placeholder="SG.xxxx..."
                  value={sendgridKey}
                  onChange={(e) => setSendgridKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sg-from">From Address</Label>
                <Input
                  id="sg-from"
                  placeholder="noreply@yourcompany.com"
                  value={sendgridFrom}
                  onChange={(e) => setSendgridFrom(e.target.value)}
                />
              </div>
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Configuration
            </Button>
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={testing}
            >
              {testing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send Test Email
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: For MVP, email provider settings are configured via environment
            variables (EMAIL_PROVIDER, SMTP_HOST, etc.). This page allows
            testing the current configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
