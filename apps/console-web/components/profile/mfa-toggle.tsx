"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Info, ShieldCheck, Loader2, ShieldOff, ShieldPlus, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

interface MfaToggleProps {
  mfaEnabled: boolean
  onStatusChange: (enabled: boolean) => void
}

type SetupStep = "idle" | "loading" | "scan" | "verify" | "disabling"

export function MfaToggle({ mfaEnabled, onStatusChange }: MfaToggleProps) {
  const [step, setStep] = useState<SetupStep>("idle")
  const [secret, setSecret] = useState("")
  const [uri, setUri] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [copied, setCopied] = useState(false)

  async function handleStartSetup() {
    setStep("loading")
    try {
      const res = await apiClient.post<{ data: { secret: string; uri: string } }>("/mfa/setup", {})
      setSecret(res.data.secret)
      setUri(res.data.uri)
      setStep("scan")
    } catch {
      toast.error("Failed to start MFA setup")
      setStep("idle")
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return
    setStep("loading")
    try {
      await apiClient.post("/mfa/verify", { code })
      toast.success("MFA enabled successfully")
      onStatusChange(true)
      setStep("idle")
      setCode("")
      setSecret("")
      setUri("")
    } catch {
      toast.error("Invalid code. Please try again.")
      setStep("scan")
    }
  }

  async function handleDisable() {
    if (!password) return
    setStep("loading")
    try {
      await apiClient.post("/mfa/disable", { password })
      toast.success("MFA disabled")
      onStatusChange(false)
      setStep("idle")
      setPassword("")
    } catch (err: any) {
      toast.error(err?.message?.includes("password") ? "Incorrect password" : "Failed to disable MFA")
      setStep("disabling")
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security with an authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          {mfaEnabled ? (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </div>

        {/* Idle: show enable/disable buttons */}
        {step === "idle" && !mfaEnabled && (
          <>
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Enable MFA to require a verification code from an authenticator app
                (Google Authenticator, Authy, etc.) each time you sign in.
              </p>
            </div>
            <Button className="w-full" onClick={handleStartSetup}>
              <ShieldPlus className="mr-2 size-4" />
              Enable MFA
            </Button>
          </>
        )}

        {step === "idle" && mfaEnabled && (
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setStep("disabling")}
          >
            <ShieldOff className="mr-2 size-4" />
            Disable MFA
          </Button>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Scan QR / Enter secret */}
        {step === "scan" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">1. Scan with your authenticator app</p>
              <div className="flex justify-center">
                {/* QR code rendered as an image via Google Charts API */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`}
                  alt="TOTP QR Code"
                  className="rounded-md"
                  width={200}
                  height={200}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Or enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                  {secret}
                </code>
                <Button variant="outline" size="sm" className="shrink-0" onClick={copySecret}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>2. Enter the 6-digit code from your app</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={6}
                  autoFocus
                />
                <Button onClick={handleVerify} disabled={code.length !== 6}>
                  Verify
                </Button>
              </div>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => { setStep("idle"); setCode(""); setSecret(""); setUri("") }}>
              Cancel
            </Button>
          </div>
        )}

        {/* Disable: require password */}
        {step === "disabling" && (
          <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
            <p className="text-sm">Enter your password to disable MFA:</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDisable} disabled={!password}>
                Disable MFA
              </Button>
              <Button variant="outline" onClick={() => { setStep("idle"); setPassword("") }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
