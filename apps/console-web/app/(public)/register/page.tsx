"use client"

import { useState } from "react"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Radio, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

function RegisterForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [tenantName, setTenantName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    if (!email || !password || !confirmPassword || !tenantName) {
      return "All fields are required."
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address."
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters."
    }
    if (password !== confirmPassword) {
      return "Passwords do not match."
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tenant_name: tenantName,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error?.message ?? "Registration failed. Please try again."
        )
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
              <Radio className="size-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold">CCTV Platform</h1>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6 pb-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="size-6 text-emerald-600" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold">Check your email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a verification link to <strong>{email}</strong>.
                  Click it to activate your account.
                </p>
              </div>
              <a href="/login">
                <Button variant="outline">Back to Sign in</Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
            <Radio className="size-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">CCTV Platform</h1>
        </div>

        {/* Register Card */}
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>
              Get started with your CCTV streaming platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Organization Name</Label>
                <Input
                  id="tenant-name"
                  type="text"
                  placeholder="Acme Corp"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pt-0">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </a>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          B2B CCTV Streaming Platform
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
